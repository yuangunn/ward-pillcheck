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
  ingr?: string; // 주성분(허가정보 결합)
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

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
/** nedrug 이미지를 워커 프록시 경유 URL로 변환(헤더 정리 + CORS). 워커 없으면 원본. */
export function proxiedImg(url?: string): string | undefined {
  if (!url) return undefined;
  if (!API_BASE) return url;
  return `${API_BASE.replace(/\/$/, '')}/api/img?u=${encodeURIComponent(url)}`;
}

// ── IndexedDB 최소 래퍼 (records / meta 두 키만 저장) ──
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result as T);
    r.onerror = () => rej(r.error);
  });
}
export async function idbSet(key: string, val: unknown): Promise<void> {
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
    ingredient: r.ingr,
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
  const markCode = q.markCode?.trim();

  const out: PillResult[] = [];
  for (const r of data) {
    if (name && !r.name.includes(name)) continue;
    if (entp && !r.entp.includes(entp)) continue;
    if (shape && r.shape !== shape) continue;
    if (color && !(r.color ?? '').includes(color) && !(r.color2 ?? '').includes(color)) continue;
    if (print) {
      // 각인은 실제 인쇄된 각인(앞/뒤)만 검색한다.
      // 마크(그림) 속 글자/로고는 별도의 "마크로 찾기/그려서 찾기"가 담당하므로
      // 여기서는 markFA/markBA 를 제외한다(예: "Bayer" 입력 시 Bayer 마크가 끼지 않음).
      const hay = [r.front, r.back]
        .map((v) => (v ?? '').toUpperCase())
        .join(' ');
      if (!hay.includes(print)) continue;
    }
    if (markCode && !markCodesOf(r).includes(markCode)) continue;
    out.push(rec2result(r));
    if (out.length >= limit) break;
  }
  return out;
}

/** 한 레코드의 마크 코드 목록(앞/뒤, 콤마 분리) */
function markCodesOf(r: PillRecord): string[] {
  return [r.markFA, r.markBA].flatMap((v) =>
    v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : [],
  );
}

export interface MarkOption {
  code: string;
  img: string; // 대표 마크 이미지
  count: number;
}
let markOptions: MarkOption[] | null = null;

/** 마크 갤러리용: 고유 마크 코드 + 대표 이미지 (빈도순). 이미지 있는 코드만. */
export async function getMarkOptions(): Promise<MarkOption[]> {
  if (markOptions) return markOptions;
  // 1) 번들 marks.json 우선 (빌드 때 받은 정적 이미지 → 같은 출처, 오프라인)
  try {
    const res = await fetch(`${BASE}data/marks.json`, { cache: 'no-cache' });
    if (res.ok) {
      const arr = (await res.json()) as { code: string; file: string; count: number }[];
      if (arr.length) {
        markOptions = arr.map((m) => ({ code: m.code, img: `${BASE}data/marks/${m.file}`, count: m.count }));
        return markOptions;
      }
    }
  } catch {
    /* 번들 없음 — 데이터셋에서 유도(프록시 URL)로 폴백 */
  }
  // 2) 폴백: 데이터셋 레코드에서 유도
  await ensureDataset();
  if (!records) return [];
  const map = new Map<string, { img?: string; count: number }>();
  for (const r of records) {
    const pairs: [string | undefined, string | undefined][] = [
      [r.markFA, r.markFI],
      [r.markBA, r.markBI],
    ];
    for (const [codes, img] of pairs) {
      if (!codes) continue;
      for (const c of String(codes).split(',').map((s) => s.trim()).filter(Boolean)) {
        const e = map.get(c) ?? { img: undefined, count: 0 };
        e.count += 1;
        if (!e.img && img) e.img = img;
        map.set(c, e);
      }
    }
  }
  markOptions = [...map.entries()]
    .filter(([, v]) => v.img)
    .map(([code, v]) => ({ code, img: proxiedImg(v.img)!, count: v.count }))
    .sort((a, b) => b.count - a.count);
  return markOptions;
}

/** 로드 보장 후 검색 */
export async function searchDataset(q: PillSearchQuery): Promise<PillResult[]> {
  const status = await ensureDataset();
  if (status !== 'ready' || !records) return [];
  return filterRecords(records, q, q.numOfRows ?? 50);
}
