import type { PillResult, PillSearchQuery } from './types';

// 번들 낱알식별 데이터셋: GitHub Pages 의 정적 파일을 받아 IndexedDB 에 캐시하고
// 색/모양/각인 검색을 기기에서 직접 수행한다(완전 오프라인·전체 커버).

/** 빌드 스크립트가 만드는 컴팩트 레코드(빈 값은 생략) */
export interface PillRecord {
  seq: string;
  name: string;
  entp: string;
  shape?: string;
  color?: string;
  color2?: string;
  front?: string;
  back?: string;
  lineF?: string;
  lineB?: string;
  form?: string;
  otc?: string;
  cls?: string;
  img?: string;
  markFI?: string; // 앞면 마크 이미지
  markBI?: string; // 뒤면 마크 이미지
  markFA?: string; // 앞면 마크 분석 텍스트
  markBA?: string; // 뒤면 마크 분석 텍스트
}

export interface DatasetMeta {
  builtAt: string;
  version: number;
  count: number;
}

export type DatasetStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

// 데이터 파일 경로(앱 base 기준). import.meta.env.BASE_URL = '/ward-pillcheck/'
const BASE = import.meta.env.BASE_URL ?? '/';
const DATA_URL = `${BASE}data/pills.json`;
const META_URL = `${BASE}data/pills-meta.json`;

const DB_NAME = 'ward-pillcheck';
const STORE = 'dataset';

// ── IndexedDB 최소 래퍼 (records / meta 두 키만 저장) ──
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result as T);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// ── 메모리 캐시 ──
let records: PillRecord[] | null = null;
let meta: DatasetMeta | null = null;

export function getMeta(): DatasetMeta | null {
  return meta;
}

/** 원격 메타(생성일/개수). 실패 시 null */
async function fetchRemoteMeta(): Promise<DatasetMeta | null> {
  try {
    const res = await fetch(META_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    return (await res.json()) as DatasetMeta;
  } catch {
    return null;
  }
}

/** 원격 데이터 파일을 받아 IndexedDB+메모리에 저장 */
async function downloadAndStore(remoteMeta: DatasetMeta): Promise<void> {
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`pills.json ${res.status}`);
  const data = (await res.json()) as PillRecord[];
  records = data;
  meta = remoteMeta;
  await idbSet('records', data);
  await idbSet('meta', remoteMeta);
}

/**
 * 데이터셋 로드.
 * 1) 메모리 → 2) IndexedDB 캐시 → 3) 원격 메타와 비교해 최신이면 다운로드.
 * 캐시가 있으면 즉시 사용하고, 백그라운드로 최신 여부만 점검(force 시 즉시 갱신).
 */
export async function ensureDataset(force = false): Promise<DatasetStatus> {
  if (records && !force) return records.length ? 'ready' : 'empty';

  // IndexedDB 캐시 먼저
  if (!force) {
    try {
      const cached = await idbGet<PillRecord[]>('records');
      const cachedMeta = await idbGet<DatasetMeta>('meta');
      if (cached && cached.length) {
        records = cached;
        meta = cachedMeta ?? null;
      }
    } catch {
      /* IndexedDB 불가 — 네트워크로 진행 */
    }
  }

  const remote = await fetchRemoteMeta();
  const needDownload =
    force || !records || !records.length || (remote && remote.builtAt !== meta?.builtAt);

  if (needDownload && remote) {
    try {
      await downloadAndStore(remote);
    } catch {
      if (!records) return 'error';
    }
  }

  if (!records) return 'error';
  return records.length ? 'ready' : 'empty';
}

/** 사용자가 "데이터 업데이트"를 눌렀을 때 — 강제 재다운로드 */
export async function updateDataset(): Promise<DatasetStatus> {
  return ensureDataset(true);
}

function rec2result(r: PillRecord): PillResult {
  return {
    itemSeq: r.seq,
    itemName: r.name,
    entpName: r.entp,
    drugShape: r.shape,
    colorClass1: r.color,
    printFront: r.front,
    printBack: r.back,
    lineFront: r.lineF,
    lineBack: r.lineB,
    formCodeName: r.form,
    itemImage: r.img,
    etcOtcName: r.otc,
    className: r.cls,
    markFrontImg: r.markFI,
    markBackImg: r.markBI,
    markFrontAnal: r.markFA,
    markBackAnal: r.markBA,
  };
}

/** 순수 필터(테스트 대상). 색/모양/각인/이름/업체 조합. */
export function filterRecords(
  data: PillRecord[],
  q: PillSearchQuery,
  limit = 50,
): PillResult[] {
  const name = q.itemName?.trim();
  const entp = q.entpName?.trim();
  const shape = q.drugShape?.trim();
  const color = q.colorClass1?.trim();
  const print = q.printFront?.trim().toUpperCase();

  const out: PillResult[] = [];
  for (const r of data) {
    if (name && !r.name.includes(name)) continue;
    if (entp && !r.entp.includes(entp)) continue;
    if (shape && r.shape !== shape) continue;
    if (color && !(r.color ?? '').includes(color) && !(r.color2 ?? '').includes(color)) continue;
    if (print) {
      // 각인 텍스트(앞/뒤) + 마크 분석 텍스트(앞/뒤)까지 검색 대상에 포함
      // → 마크 이미지 속 글자/숫자(예: "25")가 분석필드에 있으면 검색됨
      const hay = [r.front, r.back, r.markFA, r.markBA]
        .map((v) => (v ?? '').toUpperCase())
        .join(' ');
      if (!hay.includes(print)) continue;
    }
    out.push(rec2result(r));
    if (out.length >= limit) break;
  }
  return out;
}

/** 로드 보장 후 검색 */
export async function searchDataset(q: PillSearchQuery): Promise<PillResult[]> {
  const status = await ensureDataset();
  if (status !== 'ready' || !records) return [];
  return filterRecords(records, q, q.numOfRows ?? 50);
}
