// 식약처 낱알식별 데이터 전체를 받아 번들 데이터셋으로 빌드한다.
// public/data/pills.json (레코드 배열) + public/data/pills-meta.json (생성일/개수).
//
// 실행: SERVICE_KEY=<디코딩키> node scripts/build-dataset.mjs
// - SERVICE_KEY 미설정 시: 경고만 내고 빈 데이터셋을 생성(로컬/데모 빌드용).
// - GitHub Actions(배포/매일 cron)에서 Secret 으로 주입.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data');
const ENDPOINT =
  process.env.PILL_ENDPOINT ??
  'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03';
const KEY = process.env.SERVICE_KEY?.trim();
const NUM = 100; // 페이지당
const MAX_PAGES = 600; // 안전 상한 (6만 알)

mkdirSync(OUT, { recursive: true });

/** 응답 봉투에서 items 추출 */
function items(payload) {
  const it = payload?.body?.items ?? payload?.response?.body?.items;
  if (Array.isArray(it)) return it;
  if (it && typeof it === 'object') return [it];
  return [];
}

/** 원본 레코드 → 앱이 쓰는 컴팩트 레코드(빈 값은 생략) */
function compact(r) {
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
  return o;
}

async function fetchPage(pageNo) {
  const params = new URLSearchParams({
    serviceKey: KEY,
    type: 'json',
    pageNo: String(pageNo),
    numOfRows: String(NUM),
  });
  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`upstream ${res.status} on page ${pageNo}`);
  return items(await res.json());
}

async function buildAll() {
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let rows;
    try {
      rows = await fetchPage(page);
    } catch (e) {
      console.warn(`페이지 ${page} 실패: ${e.message} — 지금까지 받은 것으로 마무리`);
      break;
    }
    if (rows.length === 0) break;
    for (const r of rows) {
      const c = compact(r);
      if (c.seq && !seen.has(c.seq)) {
        seen.add(c.seq);
        all.push(c);
      }
    }
    if (page % 20 === 0) console.log(`  ...${all.length}건 수집`);
    if (rows.length < NUM) break; // 마지막 페이지
  }
  return all;
}

const meta = { builtAt: new Date().toISOString(), version: 1, count: 0 };
let records = [];

if (!KEY) {
  console.warn('⚠️  SERVICE_KEY 미설정 — 빈 데이터셋을 생성합니다(데모/로컬 빌드).');
} else {
  console.log('낱알식별 데이터 수집 시작…');
  records = await buildAll();
  meta.count = records.length;
  console.log(`완료: ${records.length}건`);
}

writeFileSync(`${OUT}/pills.json`, JSON.stringify(records));
writeFileSync(`${OUT}/pills-meta.json`, JSON.stringify(meta));
console.log(`작성됨: ${OUT}/pills.json (${meta.count}건), pills-meta.json`);
