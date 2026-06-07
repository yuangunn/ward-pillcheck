import { idbGet, idbSet } from './dataset';
import type { DurInfo } from './dur';

// DUR 전체 룰셋 번들(오프라인 금기점검). details 와 동일하게 gzip + IndexedDB.
// 압축 포맷 v2: 사유 텍스트를 t[] 에 인터닝하고, 우리 앱이 식별 가능한 약끼리만 보존.
//   { v:2, t:[텍스트], c:{seq:[[mseq,tIdx]|[mseq]]}, p/e/a/d:{seq:tIdx} }
// (상대약 이름은 런타임에 seq 로 조회하므로 저장하지 않는다 — 매칭은 seq 기준)
type ComboRow = [string, number] | [string]; // [상대 itemSeq, 사유텍스트 인덱스?]
interface DurData {
  v: number;
  t: string[];
  c: Record<string, ComboRow[]>;
  p: Record<string, number>;
  e: Record<string, number>;
  a: Record<string, number>;
  d: Record<string, number>;
}
export interface DurMeta {
  builtAt: string;
  version: number;
  count: number;
}

const BASE = (import.meta.env.BASE_URL as string | undefined) ?? '/';
const DATA_URL = `${BASE}data/dur.json.gz`;
const META_URL = `${BASE}data/dur-meta.json`;
const KEY = 'dur';
const META_KEY = 'dur-meta';

let bundle: DurData | null = null;
let meta: DurMeta | null = null;

const isLoaded = (b: unknown): b is DurData => !!b && typeof b === 'object' && (b as DurData).v === 2 && Array.isArray((b as DurData).t);

function distinctCount(b: DurData): number {
  return new Set([...Object.keys(b.c), ...Object.keys(b.p), ...Object.keys(b.e), ...Object.keys(b.a), ...Object.keys(b.d)]).size;
}

async function ensureLoaded(): Promise<void> {
  if (bundle) return;
  try {
    const b = await idbGet<DurData>(KEY);
    const m = await idbGet<DurMeta>(META_KEY);
    if (isLoaded(b)) {
      bundle = b;
      meta = m ?? null;
    }
  } catch {
    /* 미다운로드 */
  }
}

async function fetchDecompress(url: string, onProgress?: (frac: number) => void): Promise<DurData> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`dur ${res.status}`);
  if (typeof DecompressionStream === 'undefined' || !res.body) throw new Error('DecompressionStream 미지원');
  const total = Number(res.headers.get('Content-Length')) || 0;
  let received = 0;
  const counting = new TransformStream({
    transform(chunk, ctrl) {
      received += (chunk as Uint8Array).length;
      if (total > 0 && onProgress) onProgress(Math.min(0.99, received / total));
      ctrl.enqueue(chunk);
    },
  });
  const stream = res.body.pipeThrough(counting).pipeThrough(new DecompressionStream('gzip'));
  const data = JSON.parse(await new Response(stream).text()) as DurData;
  onProgress?.(1);
  return data;
}

/** 설정의 "전체 다운로드" — DUR 룰셋을 받아 캐시. 품목 수 반환. */
export async function downloadDur(onProgress?: (frac: number) => void): Promise<number> {
  const b = await fetchDecompress(DATA_URL, onProgress);
  let m: DurMeta;
  try {
    const res = await fetch(META_URL, { cache: 'no-cache' });
    m = res.ok ? ((await res.json()) as DurMeta) : { builtAt: new Date().toISOString(), version: 2, count: distinctCount(b) };
  } catch {
    m = { builtAt: new Date().toISOString(), version: 2, count: distinctCount(b) };
  }
  bundle = b;
  meta = m;
  await idbSet(KEY, b);
  await idbSet(META_KEY, m);
  return distinctCount(b);
}

function expand(itemSeq: string, b: DurData): DurInfo {
  const tx = (i?: number): string | undefined => (i != null && i >= 0 && i < b.t.length ? b.t[i] : undefined);
  const combo = (b.c[itemSeq] ?? []).map((row) => ({ seq: row[0], name: '', content: tx(row[1]) }));
  const note = (m: Record<string, number>): { content?: string }[] => (m[itemSeq] != null ? [{ content: tx(m[itemSeq]) }] : []);
  return { itemSeq, combo, pregnancy: note(b.p), elderly: note(b.e), age: note(b.a), dup: note(b.d) };
}

/** 받아둔 경우에만 주어진 seq들의 DUR 맵 반환(네트워크 없음). 미다운로드면 null. */
export async function getBundledDurMap(seqs: string[]): Promise<Map<string, DurInfo> | null> {
  await ensureLoaded();
  if (!bundle) return null;
  const b = bundle;
  // 다운로드돼 있으면 — 해당 약에 룰이 없어도 빈 DurInfo 를 넣어 워커 폴백을 막는다.
  return new Map(seqs.map((seq) => [seq, expand(seq, b)]));
}

export async function durBundleStatus(): Promise<{ downloaded: boolean; count: number; builtAt?: string }> {
  await ensureLoaded();
  return { downloaded: !!bundle, count: meta?.count ?? (bundle ? distinctCount(bundle) : 0), builtAt: meta?.builtAt };
}

export async function clearDur(): Promise<void> {
  bundle = null;
  meta = null;
  try {
    await idbSet(KEY, {});
    await idbSet(META_KEY, null);
  } catch {
    /* ignore */
  }
}
