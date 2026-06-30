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
import { stripDoc } from './strip-doc.mjs';

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

// stripDoc 은 ./strip-doc.mjs 에서 import (테스트와 공유)

/** 낱알식별 컴팩트 레코드 */
function compactPill(r) {
  const o = { seq: r.ITEM_SEQ ?? '', name: r.ITEM_NAME ?? '', entp: r.ENTP_NAME ?? '' };
  const put = (k, v) => {
    if (v) o[k] = v;
  };
  put('shape', r.DRUG_SHAPE);
  put('chart', r.CHART); // 성상(자연어 모양 설명) — '기타' 세분화용
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

/**
 * 허가정보 MAIN_ITEM_INGR(한글 주성분) → 표시용 한글 성분명.
 * '[M269062]모사프리드…' / 복합·중복은 '|' 나열 → [코드] 제거 + 분해 + 중복제거 + '/' 결합.
 * ⚠ src/domain/ingredient.ts 의 koreanActiveIngredient 와 동일 로직(거긴 TS, 여긴 빌드용 JS) — sync 유지.
 */
function koActive(raw) {
  if (!raw) return '';
  const seen = new Set();
  const out = [];
  for (const part of String(raw).split('|')) {
    const name = part.replace(/^\s*\[[^\]]*\]\s*/, '').trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out.join('/');
}

/**
 * 허가 상세(Dtl06) 전수 페이징 → 효능/용법/주의(전문약 포함) + 한글 주성분(MAIN_ITEM_INGR).
 * 반환: { details(seq별 문서 컴팩트), ingrKoBySeq(전 품목 seq→한글 주성분) }
 */
async function collectDetails() {
  const details = [];
  const ingrKoBySeq = new Map();
  const clip = (s) => (s && s.length > DOC_CLIP ? s.slice(0, DOC_CLIP) + '…' : s);
  const handle = (row) => {
    const seq = row.ITEM_SEQ ?? '';
    if (!seq) return;
    // 한글 주성분은 문서 유무와 무관하게 전 품목에서 수집
    const ko = koActive(row.MAIN_ITEM_INGR);
    if (ko && !ingrKoBySeq.has(seq)) ingrKoBySeq.set(seq, ko);
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
  return { details, ingrKoBySeq };
}

/** DUR 룰셋 수집 → 컴팩트 번들(v2). 오프라인 금기점검용.
 *  압축 핵심: ① 우리 앱이 식별 가능한 약끼리(ourSeqs)만 보존 → 병용금기 폭발 억제
 *           ② 사유 텍스트 인터닝(중복 제거) → 행에는 인덱스만, 상대약 이름은 런타임 조회로 생략
 *  포맷: { v:2, t:[텍스트], c:{seq:[[mseq,tIdx]|[mseq]]}, p/e/a/d:{seq:tIdx} } */
function durText(it) {
  return stripDoc(it.PROHBT_CONTENT ?? it.REMARK ?? it.TYPE_NAME) ?? '';
}
function addDurRaw(raw, cat, row, ourSeqs) {
  const seq = row.ITEM_SEQ ?? '';
  if (!seq || !ourSeqs.has(seq)) return; // 우리 약만
  const e = (raw[seq] ??= {});
  if (cat === 'combo') {
    const mseq = row.MIXTURE_ITEM_SEQ ?? '';
    if (!mseq || !ourSeqs.has(mseq)) return; // 상대약도 우리 약이어야 매칭됨
    (e.c ??= new Map());
    if (!e.c.has(mseq)) e.c.set(mseq, durText(row)); // (seq,mseq) 중복 제거, 첫 사유 유지
  } else {
    const key = cat === 'pregnancy' ? 'p' : cat === 'elderly' ? 'e' : cat === 'age' ? 'a' : 'd';
    if (!e[key]) {
      const t = durText(row);
      if (t) e[key] = t; // 사유 없는 플래그는 의미 없으니 생략
    }
  }
}
async function collectDur(ourSeqs) {
  const raw = {};
  // 병용금기는 ~81만행(≈8100p). 우리 약 필터는 행 단위라 전수 스캔이 필요하므로 상한을 넉넉히.
  // (매칭되는 항목만 raw 에 누적되어 메모리는 우리 약 규모로 한정됨)
  const DUR_MAX_PAGES = 12000;
  for (const [cat, op] of Object.entries(DUR_OPS)) {
    const ep = `${DUR_BASE}/${op}`;
    let total = 0;
    let pages = 1;
    try {
      const first = await fetchPayload(ep, 1);
      total = totalCountOf(first);
      pages = Math.min(total ? Math.ceil(total / NUM) : 1, DUR_MAX_PAGES);
      extractItems(first).forEach((row) => addDurRaw(raw, cat, row, ourSeqs));
    } catch (e) {
      console.warn(`  [DUR:${cat}] page1 실패: ${e.message}`);
      continue;
    }
    console.log(`  [DUR:${cat}] 총 ${total} / ${pages}페이지${total / NUM > DUR_MAX_PAGES ? ' (상한 적용)' : ''}`);
    for (let start = 2; start <= pages; start += CONCURRENCY) {
      const batch = [];
      for (let p = start; p < start + CONCURRENCY && p <= pages; p++) batch.push(p);
      const res = await Promise.allSettled(batch.map((p) => fetchItems(ep, p)));
      for (const r of res) if (r.status === 'fulfilled') r.value.forEach((row) => addDurRaw(raw, cat, row, ourSeqs));
    }
  }
  // 인터닝 + 컴팩트화
  const t = [];
  const tIndex = new Map();
  const intern = (s) => {
    if (!s) return -1;
    let i = tIndex.get(s);
    if (i == null) {
      i = t.length;
      t.push(s);
      tIndex.set(s, i);
    }
    return i;
  };
  const c = {};
  const p = {};
  const e = {};
  const a = {};
  const d = {};
  for (const [seq, ent] of Object.entries(raw)) {
    if (ent.c && ent.c.size) {
      c[seq] = [...ent.c].map(([mseq, txt]) => {
        const ti = intern(txt);
        return ti >= 0 ? [mseq, ti] : [mseq];
      });
    }
    if (ent.p) p[seq] = intern(ent.p);
    if (ent.e) e[seq] = intern(ent.e);
    if (ent.a) a[seq] = intern(ent.a);
    if (ent.d) d[seq] = intern(ent.d);
  }
  const count = new Set([...Object.keys(c), ...Object.keys(p), ...Object.keys(e), ...Object.keys(a), ...Object.keys(d)]).size;
  const combos = Object.values(c).reduce((n, arr) => n + arr.length, 0);
  console.log(`  [DUR] 우리 약 ${count}품목 · 병용금기쌍 ${combos} · 사유텍스트 ${t.length}종`);
  return { bundle: { v: 2, t, c, p, e, a, d }, count };
}

/** 낱알식별 등 일반 endpoint 를 totalCount 기준 전수 페이징(컴팩트가 null이면 제외).
 *  병렬 배치 중 한 페이지가 짧게 와도 멈추지 않음(조기종료로 인한 데이터 누락 방지). */
async function collect(label, endpoint, compactFn, maxPages) {
  const all = [];
  const seen = new Set();
  const add = (rows) => {
    for (const row of rows) {
      const c = compactFn(row);
      if (c && c.seq && !seen.has(c.seq)) {
        seen.add(c.seq);
        all.push(c);
      }
    }
  };
  const first = await fetchPayload(endpoint, 1);
  const total = totalCountOf(first);
  const pages = Math.min(total ? Math.ceil(total / NUM) : maxPages, maxPages);
  console.log(`  [${label}] 총 ${total} / ${pages}페이지`);
  add(extractItems(first));
  for (let start = 2; start <= pages; start += CONCURRENCY) {
    const batch = [];
    for (let p = start; p < start + CONCURRENCY && p <= pages; p++) batch.push(p);
    const results = await Promise.allSettled(batch.map((p) => fetchItems(endpoint, p)));
    for (const r of results) {
      if (r.status === 'fulfilled') add(r.value);
      else console.warn(`  [${label}] 페이지 실패: ${r.reason?.message ?? r.reason}`);
    }
    console.log(`  [${label}] ...${all.length}건 (page ~${Math.min(start + CONCURRENCY - 1, pages)}/${pages})`);
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
function writeGz(name, data, countOverride) {
  const count = countOverride != null ? countOverride : Array.isArray(data) ? data.length : Object.keys(data).length;
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
  // 고유 마크 이미지 단위로 수집한다(코드당 대표 1장이 아니라 등장하는 모든 이미지).
  // 같은 코드라도 로고가 다르면 별개 이미지이므로, 약 상세에 보이는 마크가 갤러리에도
  // 반드시 존재하도록 이미지별로 받는다. 검색은 그 이미지의 대표 코드로 한다.
  const map = new Map(); // imageId -> { img, codeCount: Map<code,n>, count }
  for (const r of pills) {
    for (const [codes, img] of [
      [r.markFA, r.markFI],
      [r.markBA, r.markBI],
    ]) {
      if (!codes || !img) continue; // 코드+이미지 둘 다 있어야 코드로 역검색 가능
      const id = nedrugId(img);
      if (!id) continue;
      const e = map.get(id) || { img, codeCount: new Map(), count: 0 };
      e.count += 1;
      for (const c of String(codes).split(',').map((s) => s.trim()).filter(Boolean)) {
        e.codeCount.set(c, (e.codeCount.get(c) || 0) + 1);
      }
      map.set(id, e);
    }
  }
  const repCode = (cc) => [...cc.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const entries = [...map.values()]
    .map((v) => ({ img: v.img, code: repCode(v.codeCount), count: v.count }))
    .sort((a, b) => b.count - a.count);
  const marksDir = resolve(OUT, 'marks');
  mkdirSync(marksDir, { recursive: true });

  const downloaded = new Set();
  const out = [];
  const MARK_TIMEOUT = 8000; // 짧은 타임아웃(차단 시 빌드 무한지연 방지)
  let attempts = 0;
  let aborted = false;
  // 동시성 다운로드(배치 8). 이미 받은(레포 커밋·캐시 포함) 파일은 재사용.
  for (let i = 0; i < entries.length && !aborted; i += 8) {
    const batch = entries.slice(i, i + 8);
    await Promise.allSettled(
      batch.map(async ({ code, img, count }) => {
        const id = nedrugId(img);
        if (!id) return;
        const file = `${id}.gif`;
        const path = resolve(marksDir, file);
        if (downloaded.has(id) || existsSync(path)) {
          downloaded.add(id);
          out.push({ code, file, count });
          return;
        }
        attempts++;
        // 간헐 타임아웃 대비 재시도(최대 3회). 배치 내 8개는 병렬이라 차단 시에도 ~24초로 바운드.
        for (let a = 0; a < 3; a++) {
          try {
            const res = await fetch(img, { headers: IMG_HEADERS, signal: AbortSignal.timeout(MARK_TIMEOUT) });
            if (!res.ok) throw new Error(`mark ${res.status}`);
            writeFileSync(path, Buffer.from(await res.arrayBuffer()));
            downloaded.add(id);
            out.push({ code, file, count });
            break;
          } catch {
            if (a < 2) await new Promise((r) => setTimeout(r, 600 * (a + 1)));
          }
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
    console.log(`성분 결합(영문): ${joined}/${pills.length}건`);
    write('pills', pills); // 상세 수집 실패 대비 1차 기록(영문 성분까지)
    console.log('마크 이미지 번들…');
    await buildMarks(pills);
    write('injections', injections);
    console.log('허가사항 상세(Dtl06) 전수 수집…');
    const { details, ingrKoBySeq } = await collectDetails();
    console.log(`허가사항 상세 ${details.length}건(전문약 포함) → details.json.gz`);
    writeGz('details', details);
    // 한글 주성분(MAIN_ITEM_INGR) 결합 후 pills 재기록
    let koJoined = 0;
    for (const p of pills) {
      const ko = ingrKoBySeq.get(p.seq);
      if (ko) {
        p.ingrKo = ko;
        koJoined++;
      }
    }
    console.log(`성분 결합(한글): ${koJoined}/${pills.length}건`);
    write('pills', pills); // 한글 성분 포함해 최종 기록
    // DUR: 우리 약(낱알+주사·외용)끼리로 제한 + 텍스트 인터닝으로 압축해 오프라인 번들 생성.
    console.log('금기점검(DUR) 룰셋 수집·압축…');
    const ourSeqs = new Set([...pills.map((x) => x.seq), ...injections.map((x) => x.seq)].filter(Boolean));
    const { bundle: durBundle, count: durCount } = await collectDur(ourSeqs);
    writeGz('dur', durBundle, durCount);
  }
}
