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

// 주사제 판별(품목명 기준)
const INJ_RE = /(주사|주입|주사액|주사제|펜|카트리지|바이알|키트|프리필드|플렉스|퀵펜|인슐린|주\)|주$)/;

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

if (!KEY) {
  console.warn('⚠️  SERVICE_KEY 미설정 — 빈 데이터셋을 생성합니다(데모/로컬 빌드).');
  write('pills', []);
  write('injections', []);
} else {
  console.log('낱알식별 수집…');
  write('pills', await collect('낱알', PILL_ENDPOINT, compactPill, 600));
  console.log('주사제(허가정보) 수집…');
  write('injections', await collect('주사제', PERMIT_LIST_ENDPOINT, compactInjection, 800));
}
