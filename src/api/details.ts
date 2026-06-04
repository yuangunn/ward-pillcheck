import { idbGet, idbSet } from './dataset';

// 전 품목 허가사항 상세(효능/용법/주의) 번들 — 전문약 포함, 오프라인용.
// 용량이 커서 gzip(.json.gz)로 받고 DecompressionStream 으로 해제한다.
// ⚠️ 단건 조회로 큰 번들을 자동 다운로드하지 않는다.
//   - getBundledDetail: 이미 받아둔(IndexedDB) 경우에만 사용(네트워크 없음).
//   - downloadDetails: 설정의 "전체 다운로드"에서 명시적으로 호출.

export interface DetailRecord {
  seq: string;
  efcy?: string; // 효능·효과
  useMethod?: string; // 용법·용량
  atpn?: string; // 사용상의 주의사항
}
export interface DetailsMeta {
  builtAt: string;
  version: number;
  count: number;
}

const BASE = (import.meta.env.BASE_URL as string | undefined) ?? '/';
const DATA_URL = `${BASE}data/details.json.gz`;
const META_URL = `${BASE}data/details-meta.json`;
const KEY = 'details';
const META_KEY = 'details-meta';

let map: Map<string, DetailRecord> | null = null;
let meta: DetailsMeta | null = null;

function buildMap(arr: DetailRecord[]): Map<string, DetailRecord> {
  const m = new Map<string, DetailRecord>();
  for (const r of arr) if (r.seq) m.set(r.seq, r);
  return m;
}

/** 메모리 → IndexedDB 캐시만 로드(네트워크 없음). 다운로드된 경우에만 채워진다. */
async function ensureLoaded(): Promise<void> {
  if (map) return;
  try {
    const arr = await idbGet<DetailRecord[]>(KEY);
    const m = await idbGet<DetailsMeta>(META_KEY);
    if (arr && arr.length) {
      map = buildMap(arr);
      meta = m ?? null;
    }
  } catch {
    /* IndexedDB 불가 — 미다운로드로 간주 */
  }
}

/** gzip 번들을 받아 해제. DecompressionStream 미지원 시 예외. */
async function fetchDecompress(url: string): Promise<DetailRecord[]> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`details ${res.status}`);
  if (typeof DecompressionStream === 'undefined' || !res.body) {
    throw new Error('DecompressionStream 미지원');
  }
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text) as DetailRecord[];
}

async function fetchMeta(): Promise<DetailsMeta | null> {
  try {
    const res = await fetch(META_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    return (await res.json()) as DetailsMeta;
  } catch {
    return null;
  }
}

/** 설정의 "전체 다운로드" — 허가사항 상세를 받아 IndexedDB+메모리에 적재. 건수 반환. */
export async function downloadDetails(): Promise<number> {
  const arr = await fetchDecompress(DATA_URL);
  const m = (await fetchMeta()) ?? { builtAt: new Date().toISOString(), version: 1, count: arr.length };
  map = buildMap(arr);
  meta = m;
  await idbSet(KEY, arr);
  await idbSet(META_KEY, m);
  return arr.length;
}

/** 이미 받아둔 경우에만 상세 1건 반환(네트워크 없음). 미다운로드면 null. */
export async function getBundledDetail(seq: string): Promise<DetailRecord | null> {
  if (!seq) return null;
  await ensureLoaded();
  return map?.get(seq) ?? null;
}

/** 설정 화면용 상태(다운로드 여부·건수·생성일) */
export async function detailsStatus(): Promise<{ downloaded: boolean; count: number; builtAt?: string }> {
  await ensureLoaded();
  return { downloaded: !!map, count: map?.size ?? 0, builtAt: meta?.builtAt };
}

/** 캐시 비우기(설정) */
export async function clearDetails(): Promise<void> {
  map = null;
  meta = null;
  try {
    await idbSet(KEY, []);
    await idbSet(META_KEY, null);
  } catch {
    /* ignore */
  }
}
