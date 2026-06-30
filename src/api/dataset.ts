import type { PillResult, PillSearchQuery } from './types';
import { splitLineKind } from '../domain/splitLine';
import { imprintHas } from '../domain/imprint';

// 번들 낱알식별 데이터셋: GitHub Pages 의 정적 파일을 받아 IndexedDB 에 캐시하고
// 색/모양/각인 검색을 기기에서 직접 수행한다(완전 오프라인·전체 커버).

/** 빌드 스크립트가 만드는 컴팩트 레코드(빈 값은 생략) */
export interface PillRecord {
  seq: string;
  name: string;
  entp: string;
  shape?: string;
  chart?: string; // 성상(자연어 모양 설명)
  color?: string;
  color2?: string;
  front?: string;
  back?: string;
  lineF?: string;
  lineB?: string;
  form?: string;
  otc?: string;
  cls?: string;
  ingr?: string; // 주성분(영문 INN, 허가정보 ITEM_INGR_NAME 결합)
  ingrKo?: string; // 한글 주성분(허가상세 MAIN_ITEM_INGR 결합)
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
// import.meta.env 는 Vite 빌드에서만 주입 — node/tsx(개발 벤치 등)에서도 모듈이 로드되게 방어.
const BASE = import.meta.env?.BASE_URL ?? '/';
const DATA_URL = `${BASE}data/pills.json`;
const META_URL = `${BASE}data/pills-meta.json`;

const DB_NAME = 'ward-pillcheck';
const STORE = 'dataset';

const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined)?.trim();
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

// ── 로드 진행도(첫 실행 면책·로딩 게이트용) ──
// 다운로드/저장 진행을 0~1 로 알린다. 누가 트리거하든(게이트·홈) 같은 진행을 받도록 모듈 단위 구독.
const progressListeners = new Set<(frac: number) => void>();
/** 데이터셋 로드 진행도 구독(0~1). 해제 함수 반환. */
export function onDatasetProgress(fn: (frac: number) => void): () => void {
  progressListeners.add(fn);
  return () => {
    progressListeners.delete(fn);
  };
}
function emitProgress(frac: number): void {
  for (const fn of progressListeners) fn(frac);
}
// 동시 호출(게이트 + 홈 화면)이 중복 다운로드하지 않도록 비강제 로드는 공유한다.
let inflight: Promise<DatasetStatus> | null = null;

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

/** 원격 데이터 파일을 받아 IndexedDB+메모리에 저장. 다운로드 진행도를 0~0.95 로 알린다. */
async function downloadAndStore(remoteMeta: DatasetMeta): Promise<void> {
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`pills.json ${res.status}`);

  // 스트리밍으로 받아 바이트 진행도 보고(Content-Length 있을 때). 없으면 통째로.
  const total = Number(res.headers.get('Content-Length')) || 0;
  let text: string;
  if (res.body && total > 0) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        emitProgress(Math.min(0.95, received / total));
      }
    }
    text = await new Blob(chunks as BlobPart[]).text();
  } else {
    text = await res.text();
  }

  const data = JSON.parse(text) as PillRecord[];
  records = data;
  meta = remoteMeta;
  await idbSet('records', data);
  await idbSet('meta', remoteMeta);
  emitProgress(1);
}

/**
 * 데이터셋 로드.
 * 1) 메모리 → 2) IndexedDB 캐시 → 3) 원격 메타와 비교해 최신이면 다운로드.
 * 캐시가 있으면 즉시 사용하고, 백그라운드로 최신 여부만 점검(force 시 즉시 갱신).
 */
export async function ensureDataset(force = false): Promise<DatasetStatus> {
  if (records && !force) {
    emitProgress(1);
    return records.length ? 'ready' : 'empty';
  }
  // 비강제 동시 호출은 진행 중인 로드를 공유(중복 다운로드 방지)
  if (!force && inflight) return inflight;

  const run = (async (): Promise<DatasetStatus> => {
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
        if (!records) {
          emitProgress(1);
          return 'error';
        }
      }
    }

    emitProgress(1);
    if (!records) return 'error';
    return records.length ? 'ready' : 'empty';
  })();

  if (!force) inflight = run;
  try {
    return await run;
  } finally {
    if (!force) inflight = null;
  }
}

/** 첫 실행 로딩 게이트용: 데이터셋 선로드(진행도는 onDatasetProgress 로 구독). */
export function preloadDataset(): Promise<DatasetStatus> {
  return ensureDataset(false);
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
    chart: r.chart,
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
    ingredientKo: r.ingrKo,
    markFrontImg: r.markFI,
    markBackImg: r.markBI,
    markFrontAnal: r.markFA,
    markBackAnal: r.markBA,
  };
}

/**
 * 관련도 점수(낮을수록 위). 일치 '품질'로 정렬한다(같은 필터를 통과해도 더 딱 맞는 걸 위로).
 * - 이름: 완전일치 < 접두 < 중간부분일치, 동점이면 짧은 이름(질의에 가까움) 먼저.
 * - 각인: 한 면 전체 일치 < 토큰 일치 < 부분일치, 동점이면 각인 길이가 질의에 가까운 것 먼저.
 * 이름·각인이 둘 다 없으면(색/모양만) 0 → 기존(데이터) 순서 보존.
 */
function relevanceScore(r: PillRecord, name?: string, printUpper?: string): number {
  let s = 0;
  if (name) {
    s += r.name === name ? 0 : r.name.startsWith(name) ? 1 : 2;
    s += r.name.length / 1000; // 동점 tiebreak: 짧은 이름 먼저
  }
  if (printUpper) {
    const sides = [r.front, r.back].map((v) => (v ?? '').toUpperCase()).filter(Boolean);
    const exactSide = sides.some((v) => v === printUpper);
    const tokenHit = sides.some((v) => v.split(/\s+/).includes(printUpper));
    s += exactSide ? 0 : tokenHit ? 1 : 2;
    const lenDiffs = sides.map((v) => Math.abs(v.length - printUpper.length));
    s += (lenDiffs.length ? Math.min(...lenDiffs) : 9) / 1000;
  }
  return s;
}

/** 순수 필터(테스트 대상). 색/모양/각인/이름/업체 조합. 결과는 관련도순(exact) → fuzzy. */
export function filterRecords(
  data: PillRecord[],
  q: PillSearchQuery,
  limit = 50,
): PillResult[] {
  const name = q.itemName?.trim();
  const entp = q.entpName?.trim();
  const shape = q.drugShape?.trim();
  const shapes = (q.shapes ?? []).map((s) => s.trim()).filter(Boolean);
  const color = q.colorClass1?.trim();
  const colors = (q.colors ?? []).map((c) => c.trim()).filter(Boolean);
  const forms = (q.forms ?? []).map((f) => f.trim()).filter(Boolean);
  const lines = q.lines ?? [];
  const print = q.printFront?.trim().toUpperCase();
  // 혼동문자 정규화 매칭은 3글자 이상에서만(1~2글자는 후보가 과도하게 늘어 변별력↓).
  const allowFuzzy = !!print && print.length >= 3;
  // 마크 글자 검색: 대소문자 무시 + 코드 시작일치(예: 'G'→'ㄷㄱ,G'의 'G', '삼각'→'삼각형').
  // 식약처가 같은 마크를 'ㄷㄱ,G' 처럼 자모+라틴 둘 다 적어둔 경우, 'G' 로 찾게 한다.
  const markCode = q.markCode?.trim().toUpperCase();
  const markImg = q.markImg?.trim();

  // 정확/뒤집힘 일치는 exact(관련도순 정렬), 혼동문자로만 일치하면 fuzzy 로 분리해 뒤에 둔다.
  const exact: { res: PillResult; score: number }[] = [];
  const fuzzy: PillResult[] = [];
  for (const r of data) {
    if (name && !r.name.includes(name)) continue;
    if (entp && !r.entp.includes(entp)) continue;
    if (shape && r.shape !== shape) continue;
    if (shapes.length && !shapes.includes(r.shape ?? '')) continue;
    if (color && !(r.color ?? '').includes(color) && !(r.color2 ?? '').includes(color)) continue;
    if (colors.length) {
      const hay = `${r.color ?? ''} ${r.color2 ?? ''}`;
      if (!colors.some((c) => hay.includes(c))) continue;
    }
    if (forms.length) {
      const f = r.form ?? '';
      if (!forms.some((k) => f.includes(k))) continue;
    }
    if (lines.length && !lines.includes(splitLineKind(r.lineF, r.lineB))) continue;
    let flipMatch = false;
    let fuzzyMatch = false;
    if (print) {
      // 각인은 실제 인쇄된 각인(앞/뒤)만 검색한다.
      // 마크(그림) 속 글자/로고는 별도의 "마크로 찾기/그려서 찾기"가 담당하므로
      // 여기서는 markFA/markBA 를 제외한다(예: "Bayer" 입력 시 Bayer 마크가 끼지 않음).
      // 거꾸로 집은 알약 대비: 그대로/180°뒤집힘 일치. 추가로 3글자+ 는 혼동문자(0↔O↔D 등) 정규화 매칭.
      const hay = [r.front, r.back]
        .map((v) => (v ?? '').toUpperCase())
        .join(' ');
      const m = imprintHas(hay, print, { fuzzy: allowFuzzy });
      if (!m.hit) continue;
      flipMatch = m.flipped;
      fuzzyMatch = m.fuzzy;
    }
    if (markImg && !markImgIdsOf(r).includes(markImg)) continue;
    if (markCode && !markCodesOf(r).some((c) => c.toUpperCase().startsWith(markCode))) continue;
    const res = rec2result(r);
    if (flipMatch) res.printFlipMatch = true;
    if (fuzzyMatch) {
      res.printFuzzyMatch = true;
      fuzzy.push(res);
    } else {
      exact.push({ res, score: relevanceScore(r, name, print) });
    }
    // exact 가 limit 을 채우면 더 볼 필요 없음. 아니면 fuzzy 도 모아 뒤에 붙인다.
    if (exact.length >= limit) break;
  }
  // 관련도 오름차순(안정 정렬 — 동점은 데이터 순서 유지) 후 fuzzy 를 뒤에.
  exact.sort((a, b) => a.score - b.score);
  return exact.map((x) => x.res).concat(fuzzy).slice(0, limit);
}

/** 한 레코드의 마크 코드 목록(앞/뒤, 콤마 분리) */
function markCodesOf(r: PillRecord): string[] {
  return [r.markFA, r.markBA].flatMap((v) =>
    v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : [],
  );
}

/**
 * 마크 이미지 URL → 정규 id(파일명 영숫자). 빌드 marks 의 file(`<nedrugId>.gif`)에서
 * `.gif` 를 떼면 알약 markFI/markBI 의 nedrugId 와 같아지도록 맞춘다.
 * 이 id 로 매칭하면 "같은 실제 마크 이미지"만 골라낼 수 있다(글자값 "삼각형" 뭉침 방지).
 */
export function markImgId(url?: string): string {
  return (String(url ?? '').split('/').pop() || '').replace(/[^a-zA-Z0-9]/g, '');
}

/** 한 레코드의 마크 이미지 id 목록(앞/뒤) */
function markImgIdsOf(r: PillRecord): string[] {
  return [markImgId(r.markFI), markImgId(r.markBI)].filter(Boolean);
}

export interface MarkOption {
  code: string;
  img: string; // 대표 마크 이미지
  imgId: string; // 마크 이미지 id(같은 실제 마크 매칭용)
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
        markOptions = arr.map((m) => ({ code: m.code, img: `${BASE}data/marks/${m.file}`, imgId: m.file.replace(/\.gif$/i, ''), count: m.count }));
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
    .map(([code, v]) => ({ code, img: proxiedImg(v.img)!, imgId: markImgId(v.img), count: v.count }))
    .sort((a, b) => b.count - a.count);
  return markOptions;
}

/** 번들 낱알 레코드의 실물사진 URL 목록(선택적 사진 다운로드용). 로드 보장 후. */
export async function getPhotoUrls(): Promise<string[]> {
  await ensureDataset();
  return (records ?? []).map((r) => r.img).filter((u): u is string => !!u);
}

/** 로드 보장 후 검색 */
export async function searchDataset(q: PillSearchQuery): Promise<PillResult[]> {
  const status = await ensureDataset();
  if (status !== 'ready' || !records) return [];
  return filterRecords(records, q, q.numOfRows ?? 50);
}

/** itemSeq → 성분(ingr) 매핑(성분 중복 점검용). 번들 데이터에서, 완전 오프라인. 로드 보장 후. */
export async function getIngredientMap(seqs: string[]): Promise<Map<string, string>> {
  await ensureDataset();
  const want = new Set(seqs);
  const map = new Map<string, string>();
  for (const r of records ?? []) {
    if (want.has(r.seq) && r.ingr) map.set(r.seq, r.ingr);
  }
  return map;
}

/** itemSeq → 제형(form) 매핑(분할·분쇄 주의 점검용). 번들 데이터, 오프라인. 로드 보장 후. */
export async function getFormMap(seqs: string[]): Promise<Map<string, string>> {
  await ensureDataset();
  const want = new Set(seqs);
  const map = new Map<string, string>();
  for (const r of records ?? []) {
    if (want.has(r.seq) && r.form) map.set(r.seq, r.form);
  }
  return map;
}
