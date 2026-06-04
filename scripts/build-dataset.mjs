// 식약처 데이터를 받아 번들 데이터셋으로 빌드한다.
//  - public/data/pills.json (+meta): 낱알식별 전체(+성분 결합)
//  - public/data/injections.json (+meta): 주사·외용약(허가정보에서 추림) 메타
//  - public/data/details.json.gz (+meta): 전 품목 허가사항(효능/용법/주의) — 전문약 포함
//  - public/data/marks.json + marks/*.gif: 고유 마크 이미지 번들
//
// 실행: SERVICE_KEY=<디코딩키> node scripts/build-dataset.mjs
// - SERVICE_KEY 미설정 시: 경고만 내고 빈 데이터셋 생성(로컬/데모 빌드).
// - GitHub Actions(배포/매일 cron)에서 Secret 으로 주입.
// - MARKS_ONLY=1 SERVICE_KEY=<키> node scripts/build-dataset.mjs
//     → 낱알(마크코드용)만 받고 마크 gif 만 번들(허가/상세/DUR 생략, ~3분).
//       이미 받은 gif 는 재사용(existsSync), 없는 것만 추가 다운로드.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
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
// 허가 "상세" — 효능효과(EE)/용법용량(UD)/사용상주의(NB) 문서. 목록(Inq07)엔 없고 여기에 전수로 있음.
const PERMIT_DETAIL_ENDPOINT =
  process.env.PERMIT_DETAIL_ENDPOINT ??
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06';
const DOC_CLIP = 12000; // 문서 1필드 최대 길이(과대 주의사항 표 대비 용량 상한)
const DUR_BASE = process.env.DUR_BASE ?? 'https://apis.data.go.kr/1471000/DURPrdlstInfoService03';
// DUR 5종: 병용금기/임부금기/노인주의/특정연령대금기/효능군중복
const DUR_OPS = {
  combo: 'getUsjntTabooInfoList03',
  pregnancy: 'getPwnmTabooInfoList03',
  elderly: 'getOdsnAtentInfoList03',
  age: 'getSpcifyAgrdeTabooInfoList03',
  dup: 'getEfcyDplctInfoList03',
};

// 외용약·주사제 판별(품목명 기준) — 낱알식별에 없는(모양 없는) 비경구 약을 추림.
// 주사제 + 흡입제 + 좌약/질정 + 연고/크림/겔/로션/패치 + 점안/점이/점비 + 스프레이/분무 등.
const INJ_RE = /(주사|주입|주사액|주사제|펜|카트리지|바이알|키트|프리필드|플렉스|퀵펜|인슐린|주\)|주$|흡입|에보할러|할러|디스커스|레스피맷|터부할러|네뷸|점안|점이|점비|좌제|좌약|질정|질좌|연고|크림|로션|겔|젤|패치|첩부|스프레이|분무|에어로|도포|외용|카타리)/;

mkdirSync(OUT, { recursive: true });

function extractItems(payload) {
  const it = payload?.body?.items ?? payload?.response?.body?.items;
  if (Array.isArray(it)) return it;
  if (it && typeof it === 'object') return [it];
  return [];
}
function totalCountOf(payload) {
  return Number(payload?.body?.totalCount ?? payload?.response?.body?.totalCount ?? 0) || 0;
}

/** 허가사항 문서(XML/HTML) → 평문화. 빈/무의미 값은 undefined */
function stripDoc(s) {
  if (typeof s !== 'string' || !s.trim()) return undefined;
  const text = s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || undefined;
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

/** 허가정보 → 주사·외용약 컴팩트 레코드 (주사·외용만). 상세는 details.json 에서 seq로 연결 */
function compactInjection(r) {
  const name = r.ITEM_NAME ?? '';
  if (!INJ_RE.test(name)) return null;
  const o = { seq: r.ITEM_SEQ ?? '', name, entp: r.ENTP_NAME ?? '' };
  const put = (k, v) => {
    if (v) o[k] = v;
  };
  put('ingr', r.ITEM_INGR_NAME);
  put('otc', r.SPCLTY_PBLC ?? r.ETC_OTC_NAME);
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

async function fetchPayload(endpoint, pageNo) {
  const res = await fetch(pageUrl(endpoint, pageNo), { signal: AbortSignal.timeout(REQ_TIMEOUT) });
  if (!res.ok) throw new Error(`upstream ${res.status} on page ${pageNo}`);
  return res.json();
}
async function fetchItems(endpoint, pageNo) {
  return extractItems(await fetchPayload(endpoint, pageNo));
}

/** [진단] 허가사항 문서(효능/용법/주의)가 어느 엔드포인트/파라미터로 오는지 1회 탐색 로그 */
async function probeDocSource(sampleSeq) {
  const cands = [
    ['Dtl06@07', 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06'],
    ['Dtl05@06', 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService06/getDrugPrdtPrmsnDtlInq05'],
    ['Dtl04@05', 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService05/getDrugPrdtPrmsnDtlInq04'],
  ];
  const hasDoc = (it) => !!(it.EE_DOC_DATA || it.UD_DOC_DATA || it.NB_DOC_DATA || it.EE_DOC_ID || it.eeDocData);
  for (const [name, ep] of cands) {
    // (a) 무필터 1건 — 대량 페이징으로 doc 받을 수 있는지
    try {
      const p = new URLSearchParams({ serviceKey: KEY, type: 'json', pageNo: '1', numOfRows: '1' });
      const j = await (await fetch(`${ep}?${p}`, { signal: AbortSignal.timeout(REQ_TIMEOUT) })).json();
      const it = extractItems(j)[0] ?? {};
      console.log(`  [프로브] ${name} 무필터: total=${totalCountOf(j)} hasDoc=${hasDoc(it)} keys=[${Object.keys(it).join(',')}]`);
    } catch (e) {
      console.log(`  [프로브] ${name} 무필터 실패: ${e.message}`);
    }
    // (b) item_seq 필터 1건
    try {
      const p = new URLSearchParams({ serviceKey: KEY, type: 'json', pageNo: '1', numOfRows: '1', item_seq: sampleSeq });
      const j = await (await fetch(`${ep}?${p}`, { signal: AbortSignal.timeout(REQ_TIMEOUT) })).json();
      const it = extractItems(j)[0] ?? {};
      console.log(`  [프로브] ${name} item_seq=${sampleSeq}: total=${totalCountOf(j)} hasDoc=${hasDoc(it)}`);
    } catch (e) {
      console.log(`  [프로브] ${name} item_seq 실패: ${e.message}`);
    }
  }
}

/**
 * 허가정보 목록을 totalCount 기준으로 끝까지 페이징(조기 종료 버그 제거)하며 동시 수집:
 *  - injections: 주사·외용약 메타(전수)
 *  - ingrBySeq: 전 품목 ITEM_SEQ→주성분(낱알 결합용)
 *  - details: 전 품목 허가사항(효능/용법/주의) — 전문약 포함
 */
async function collectPermit() {
  const injections = [];
  const ingrBySeq = new Map();
  const seenInj = new Set();

  const handle = (row) => {
    const seq = row.ITEM_SEQ ?? '';
    if (!seq) return;
    const ingr = (row.ITEM_INGR_NAME ?? '').trim();
    if (ingr && !ingrBySeq.has(seq)) ingrBySeq.set(seq, ingr);
    const inj = compactInjection(row);
    if (inj && inj.seq && !seenInj.has(inj.seq)) {
      seenInj.add(inj.seq);
      injections.push(inj);
    }
  };

  const first = await fetchPayload(PERMIT_LIST_ENDPOINT, 1);
  const total = totalCountOf(first);
  const pages = total ? Math.ceil(total / NUM) : 1;
  console.log(`  [허가] 총 ${total}건 / ${pages}페이지`);
  for (const row of extractItems(first)) handle(row);

  for (let start = 2; start <= pages; start += CONCURRENCY) {
    const batch = [];
    for (let p = start; p < start + CONCURRENCY && p <= pages; p++) batch.push(p);
    const results = await Promise.allSettled(batch.map((p) => fetchItems(PERMIT_LIST_ENDPOINT, p)));
    for (const r of results) {
      if (r.status === 'fulfilled') r.value.forEach(handle);
      else console.warn(`  [허가] 페이지 실패: ${r.reason?.message ?? r.reason}`);
    }
    console.log(`  [허가] 주사·외용 ${injections.length} · 성분 ${ingrBySeq.size} (page ~${Math.min(start + CONCURRENCY - 1, pages)}/${pages})`);
  }
  return { injections, ingrBySeq };
}

/** 허가 상세(Dtl06) 전수 페이징 → 효능/용법/주의 (전문약 포함). seq별 컴팩트. */
async function collectDetails() {
  const details = [];
  const clip = (s) => (s && s.length > DOC_CLIP ? s.slice(0, DOC_CLIP) + '…' : s);
  const handle = (row) => {
    const seq = row.ITEM_SEQ ?? '';
    if (!seq) return;
    const efcy = clip(stripDoc(row.EE_DOC_DATA));
    const useMethod = clip(stripDoc(row.UD_DOC_DATA));
    const atpn = clip(stripDoc(row.NB_DOC_DATA));
    if (efcy || useMethod || atpn) {
      const d = { seq };
      if (efcy) d.efcy = efcy;
      if (useMethod) d.useMethod = useMethod;
      if (atpn) d.atpn = atpn;
      details.push(d);
    }
  };
  const first = await fetchPayload(PERMIT_DETAIL_ENDPOINT, 1);
  const total = totalCountOf(first);
  const pages = total ? Math.ceil(total / NUM) : 1;
  console.log(`  [상세] 총 ${total} / ${pages}페이지`);
  for (const row of extractItems(first)) handle(row);
  for (let start = 2; start <= pages; start += CONCURRENCY) {
    const batch = [];
    for (let p = start; p < start + CONCURRENCY && p <= pages; p++) batch.push(p);
    const res = await Promise.allSettled(batch.map((p) => fetchItems(PERMIT_DETAIL_ENDPOINT, p)));
    for (const r of res) {
      if (r.status === 'fulfilled') r.value.forEach(handle);
      else console.warn(`  [상세] 페이지 실패: ${r.reason?.message ?? r.reason}`);
    }
    console.log(`  [상세] ...${details.length}건 (page ~${Math.min(start + CONCURRENCY - 1, pages)}/${pages})`);
  }
  return details;
}

/** DUR 룰셋 전수 수집 → seq별 컴팩트 맵 { c:[{s,n,t}], p,e,a,d }. 오프라인 금기점검용 */
function durText(it) {
  return stripDoc(it.PROHBT_CONTENT ?? it.REMARK ?? it.TYPE_NAME) ?? '';
}
function addDur(map, cat, row) {
  const seq = row.ITEM_SEQ ?? '';
  if (!seq) return;
  const e = (map[seq] ??= {});
  if (cat === 'combo') {
    const s = row.MIXTURE_ITEM_SEQ ?? '';
    const n = row.MIXTURE_ITEM_NAME ?? '';
    if (s || n) (e.c ??= []).push({ s, n, t: durText(row) });
  } else {
    const key = cat === 'pregnancy' ? 'p' : cat === 'elderly' ? 'e' : cat === 'age' ? 'a' : 'd';
    if (!e[key]) e[key] = durText(row);
  }
}
async function collectDur() {
  const map = {};
  const DUR_MAX_PAGES = 2000; // 안전 상한(잘못된 totalCount로 무한 페이징 방지)
  for (const [cat, op] of Object.entries(DUR_OPS)) {
    const ep = `${DUR_BASE}/${op}`;
    let total = 0;
    let pages = 1;
    try {
      const first = await fetchPayload(ep, 1);
      total = totalCountOf(first);
      pages = Math.min(total ? Math.ceil(total / NUM) : 1, DUR_MAX_PAGES);
      extractItems(first).forEach((row) => addDur(map, cat, row));
    } catch (e) {
      console.warn(`  [DUR:${cat}] page1 실패: ${e.message}`);
      continue;
    }
    console.log(`  [DUR:${cat}] 총 ${total} / ${pages}페이지${total / NUM > DUR_MAX_PAGES ? ' (상한 적용)' : ''}`);
    for (let start = 2; start <= pages; start += CONCURRENCY) {
      const batch = [];
      for (let p = start; p < start + CONCURRENCY && p <= pages; p++) batch.push(p);
      const res = await Promise.allSettled(batch.map((p) => fetchItems(ep, p)));
      for (const r of res) if (r.status === 'fulfilled') r.value.forEach((row) => addDur(map, cat, row));
    }
  }
  return map;
}

/** 낱알식별 등 일반 endpoint 페이징 수집(컴팩트가 null이면 제외) */
async function collect(label, endpoint, compactFn, maxPages) {
  const all = [];
  const seen = new Set();
  let done = false;
  for (let start = 1; start <= maxPages && !done; start += CONCURRENCY) {
    const batch = [];
    for (let p = start; p < start + CONCURRENCY && p <= maxPages; p++) batch.push(p);
    const results = await Promise.allSettled(batch.map((p) => fetchItems(endpoint, p)));
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

/** 용량이 큰 번들은 gzip 으로 저장(클라이언트가 DecompressionStream 으로 해제). 배열·객체 모두 허용 */
function writeGz(name, data) {
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  const meta = { builtAt: new Date().toISOString(), version: 1, count };
  const gz = gzipSync(Buffer.from(JSON.stringify(data)));
  writeFileSync(`${OUT}/${name}.json.gz`, gz);
  writeFileSync(`${OUT}/${name}-meta.json`, JSON.stringify(meta));
  console.log(`작성됨: ${name}.json.gz (${count}건, ${(gz.length / 1048576).toFixed(1)}MB gz)`);
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
  const MARK_TIMEOUT = 8000; // 짧은 타임아웃(차단 시 빌드 무한지연 방지)
  let attempts = 0;
  let aborted = false;
  // 동시성 다운로드(배치 8). 이미 받은(레포 커밋 포함) 파일은 재사용.
  for (let i = 0; i < entries.length && !aborted; i += 8) {
    const batch = entries.slice(i, i + 8);
    await Promise.allSettled(
      batch.map(async ([code, v]) => {
        const id = nedrugId(v.img);
        if (!id) return;
        const file = `${id}.gif`;
        const path = resolve(marksDir, file);
        if (downloaded.has(id) || existsSync(path)) {
          downloaded.add(id);
          out.push({ code, file, count: v.count });
          return;
        }
        attempts++;
        try {
          const res = await fetch(v.img, { headers: IMG_HEADERS, signal: AbortSignal.timeout(MARK_TIMEOUT) });
          if (!res.ok) throw new Error(`mark ${res.status}`);
          writeFileSync(path, Buffer.from(await res.arrayBuffer()));
          downloaded.add(id);
          out.push({ code, file, count: v.count });
        } catch {
          /* 실패 — 아래 조기중단 판정 */
        }
      }),
    );
    // 초반에 시도분이 전부 실패하면 nedrug 차단으로 보고 마크 번들을 생략(빌드 지연 방지)
    if (out.length === 0 && attempts >= 16) {
      aborted = true;
      console.warn('  [마크] 다운로드가 전부 실패 — nedrug 차단 추정. 마크 번들 생략(재배포 또는 레포 커밋으로 해결).');
    }
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
  writeGz('details', []);
  writeGz('dur', {});
} else {
  console.log('낱알식별 수집…');
  const pills = await collect('낱알', PILL_ENDPOINT, compactPill, 600);

  // 마크만 빠르게 받기: 낱알(마크코드용)만 받고 마크 gif 만 다운로드, 나머지(허가/상세/DUR) 생략.
  if (process.env.MARKS_ONLY) {
    console.log('MARKS_ONLY — 마크 이미지만 번들(허가/상세/DUR 생략)…');
    await buildMarks(pills);
    console.log('완료(MARKS_ONLY) — public/data/marks/ 만 갱신했습니다. 이 폴더를 커밋하세요.');
  } else {
    console.log('허가정보(주사·외용 + 성분) 전수 수집…');
    const { injections, ingrBySeq } = await collectPermit();
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
    console.log('허가사항 상세(Dtl06) 전수 수집…');
    const details = await collectDetails();
    console.log(`허가사항 상세 ${details.length}건(전문약 포함) → details.json.gz`);
    writeGz('details', details);
    // DUR 은 온라인(워커) 전용 — 병용금기만 81만건이라 전수 오프라인 번들이 비현실적.
    // (오프라인에선 DUR 점검 생략, 온라인이면 /api/dur 품목별 점검)
    writeGz('dur', {});
  }
}
