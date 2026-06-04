// 식약처 데이터를 받아 번들 데이터셋으로 빌드한다.
//  - public/data/pills.json (+meta): 낱알식별 전체
//  - public/data/injections.json (+meta): 주사제(허가정보에서 추림)
//
// 실행: SERVICE_KEY=<디코딩키> node scripts/build-dataset.mjs
// - SERVICE_KEY 미설정 시: 경고만 내고 빈 데이터셋 생성(로컬/데모 빌드).
// - GitHub Actions(배포/매일 cron)에서 Secret 으로 주입.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data');
const KEY = process.env.SERVICE_KEY?.trim();
const NUM = 100; // 페이지당
const CONCURRENCY = 6;
const REQ_TIMEOUT = 20000;

const PILL_ENDPOINT =
  process.env.PILL_ENDPOINT ??
  'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03';
const PERMIT_LIST_ENDPOINT =
  process.env.PERMIT_LIST_ENDPOINT ??
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07';

// 외용약·주사제 판별(품목명 기준) — 낱알식별에 없는(모양 없는) 비경구 약을 추림.
// 주사제 + 흡입제 + 좌약/질정 + 연고/크림/겔/로션/패치 + 점안/점이/점비 + 스프레이/분무 등.
const INJ_RE = /(주사|주입|주사액|주사제|펜|카트리지|바이알|키트|프리필드|플렉스|퀵펜|인슐린|주\)|주$|흡입|에보할러|할러|디스커스|레스피맷|터부할러|네뷸|점안|점이|점비|좌제|좌약|질정|질좌|연고|크림|로션|겔|젤|패치|첩부|스프레이|분무|에어로|도포|외용|카타리)/;

mkdirSync(OUT, { recursive: true });

function items(payload) {
  const it = payload?.body?.items ?? payload?.response?.body?.items;
  if (Array.isArray(it)) return it;
  if (it && typeof it === 'object') return [it];
  return [];
}

/** 낱알식별 컴팩트 레코드 */
function compactPill(r) {
  const o = { seq: r.ITEM_SEQ ?? '', name: r.ITEM_NAME ?? '', entp: r.ENTP_NAME ?? '' };
  const put = (k, v) => {
    if (v) o[k] = v;
  };
  put('shape', r.DRUG_SHAPE);
  put('color', r.COLOR_CLASS1);
  put('color2', r.COLOR_CLASS2);
  put('front', r.PRINT_FRONT);
  put('back', r.PRINT_BACK);
  put('lineF', r.LINE_FRONT);
  put('lineB', r.LINE_BACK);
  put('form', r.FORM_CODE_NAME);
  put('otc', r.ETC_OTC_NAME);
  put('cls', r.CLASS_NAME);
  put('img', r.ITEM_IMAGE);
  put('markFI', r.MARK_CODE_FRONT_IMG);
  put('markBI', r.MARK_CODE_BACK_IMG);
  put('markFA', r.MARK_CODE_FRONT_ANAL);
  put('markBA', r.MARK_CODE_BACK_ANAL);
  return o;
}

/** 허가정보 → 주사제 컴팩트 레코드 (주사제만) */
function compactInjection(r) {
  const name = r.ITEM_NAME ?? '';
  if (!INJ_RE.test(name)) return null;
  const o = { seq: r.ITEM_SEQ ?? '', name, entp: r.ENTP_NAME ?? '' };
  const put = (k, v) => {
    if (v) o[k] = v;
  };
  put('ingr', r.ITEM_INGR_NAME);
  put('otc', r.SPCLTY_PBLC);
  put('img', r.BIG_PRDT_IMG_URL);
  return o;
}

function pageUrl(endpoint, pageNo) {
  const params = new URLSearchParams({
    serviceKey: KEY,
    type: 'json',
    pageNo: String(pageNo),
    numOfRows: String(NUM),
  });
  return `${endpoint}?${params}`;
}

async function fetchPage(endpoint, pageNo) {
  const res = await fetch(pageUrl(endpoint, pageNo), { signal: AbortSignal.timeout(REQ_TIMEOUT) });
  if (!res.ok) throw new Error(`upstream ${res.status} on page ${pageNo}`);
  return items(await res.json());
}

/**
 * 허가정보 목록을 1회 페이징해 두 가지를 동시에 수집:
 *  - injections: 주사제(INJ_RE) 컴팩트 레코드
 *  - ingrBySeq: 모든 품목의 ITEM_SEQ→주성분(ITEM_INGR_NAME) 맵 (낱알 성분 결합용)
 */
async function collectPermit(maxPages) {
  const injections = [];
  const ingrBySeq = new Map();
  const seen = new Set();
  let done = false;
  for (let start = 1; start <= maxPages && !done; start += CONCURRENCY) {
    const batch = [];
    for (let p = start; p < start + CONCURRENCY && p <= maxPages; p++) batch.push(p);
    const results = await Promise.allSettled(batch.map((p) => fetchPage(PERMIT_LIST_ENDPOINT, p)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const row of r.value) {
          const seq = row.ITEM_SEQ ?? '';
          const ingr = (row.ITEM_INGR_NAME ?? '').trim();
          if (seq && ingr && !ingrBySeq.has(seq)) ingrBySeq.set(seq, ingr);
          const inj = compactInjection(row);
          if (inj && inj.seq && !seen.has(inj.seq)) {
            seen.add(inj.seq);
            injections.push(inj);
          }
        }
        if (r.value.length < NUM) done = true;
      } else {
        console.warn(`  [허가] 페이지 실패: ${r.reason?.message ?? r.reason}`);
      }
    }
    console.log(`  [허가] 주사제 ${injections.length} · 성분맵 ${ingrBySeq.size} (page ~${start + CONCURRENCY - 1})`);
  }
  return { injections, ingrBySeq };
}

/** endpoint 를 페이징하며 compactFn 으로 수집(컴팩트가 null이면 제외) */
async function collect(label, endpoint, compactFn, maxPages) {
  const all = [];
  const seen = new Set();
  let done = false;
  for (let start = 1; start <= maxPages && !done; start += CONCURRENCY) {
    const batch = [];
    for (let p = start; p < start + CONCURRENCY && p <= maxPages; p++) batch.push(p);
    const results = await Promise.allSettled(batch.map((p) => fetchPage(endpoint, p)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const row of r.value) {
          const c = compactFn(row);
          if (c && c.seq && !seen.has(c.seq)) {
            seen.add(c.seq);
            all.push(c);
          }
        }
        if (r.value.length < NUM) done = true;
      } else {
        console.warn(`  [${label}] 페이지 실패: ${r.reason?.message ?? r.reason}`);
      }
    }
    console.log(`  [${label}] ...${all.length}건 (page ~${start + CONCURRENCY - 1})`);
  }
  return all;
}

function write(name, records) {
  const meta = { builtAt: new Date().toISOString(), version: 1, count: records.length };
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(records));
  writeFileSync(`${OUT}/${name}-meta.json`, JSON.stringify(meta));
  console.log(`작성됨: ${name}.json (${records.length}건)`);
}

const IMG_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  Referer: 'https://nedrug.mfds.go.kr/',
};
const nedrugId = (url) => (String(url).split('/').pop() || '').replace(/[^a-zA-Z0-9]/g, '');

/** 낱알 레코드에서 고유 마크(코드→대표이미지)를 추려 이미지를 받아 번들 */
async function buildMarks(pills) {
  const map = new Map(); // code -> { img, count }
  for (const r of pills) {
    for (const [codes, img] of [
      [r.markFA, r.markFI],
      [r.markBA, r.markBI],
    ]) {
      if (!codes) continue;
      for (const c of String(codes).split(',').map((s) => s.trim()).filter(Boolean)) {
        const e = map.get(c) || { img: undefined, count: 0 };
        e.count += 1;
        if (!e.img && img) e.img = img;
        map.set(c, e);
      }
    }
  }
  const entries = [...map.entries()].filter(([, v]) => v.img).sort((a, b) => b[1].count - a[1].count);
  const marksDir = resolve(OUT, 'marks');
  mkdirSync(marksDir, { recursive: true });

  const downloaded = new Set();
  const out = [];
  // 동시성 다운로드(배치 8)
  for (let i = 0; i < entries.length; i += 8) {
    const batch = entries.slice(i, i + 8);
    await Promise.allSettled(
      batch.map(async ([code, v]) => {
        const id = nedrugId(v.img);
        if (!id) return;
        const file = `${id}.gif`;
        if (!downloaded.has(id)) {
          try {
            const res = await fetch(v.img, { headers: IMG_HEADERS, signal: AbortSignal.timeout(REQ_TIMEOUT) });
            if (!res.ok) return;
            writeFileSync(resolve(marksDir, file), Buffer.from(await res.arrayBuffer()));
            downloaded.add(id);
          } catch {
            return;
          }
        }
        out.push({ code, file, count: v.count });
      }),
    );
    console.log(`  [마크] ...${out.length}/${entries.length}`);
  }
  out.sort((a, b) => b.count - a.count);
  write('marks', out);
}

if (!KEY) {
  console.warn('⚠️  SERVICE_KEY 미설정 — 빈 데이터셋을 생성합니다(데모/로컬 빌드).');
  write('pills', []);
  write('injections', []);
  write('marks', []);
} else {
  console.log('낱알식별 수집…');
  const pills = await collect('낱알', PILL_ENDPOINT, compactPill, 600);
  console.log('허가정보(주사제 + 성분) 수집…');
  const { injections, ingrBySeq } = await collectPermit(800);
  // 낱알 레코드에 주성분 결합(품목기준코드 ITEM_SEQ 일치)
  let joined = 0;
  for (const p of pills) {
    const ingr = ingrBySeq.get(p.seq);
    if (ingr) {
      p.ingr = ingr;
      joined++;
    }
  }
  console.log(`성분 결합: ${joined}/${pills.length}건`);
  write('pills', pills);
  console.log('마크 이미지 번들…');
  await buildMarks(pills);
  write('injections', injections);
}

