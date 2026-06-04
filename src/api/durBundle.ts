import { idbGet, idbSet } from './dataset';
import type { DurInfo } from './dur';

// DUR 전체 룰셋 번들(오프라인 금기점검). seq별 컴팩트 { c:[{s,n,t}], p,e,a,d }.
// details 와 동일하게 gzip + IndexedDB. 단건 점검으로 큰 번들을 자동 다운로드하지 않는다.

interface DurCompact {
  c?: { s: string; n: string; t?: string }[];
  p?: string;
  e?: string;
  a?: string;
  d?: string;
}
type DurBundle = Record<string, DurCompact>;
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

let bundle: DurBundle | null = null;
let meta: DurMeta | null = null;

async function ensureLoaded(): Promise<void> {
  if (bundle) return;
  try {
    const b = await idbGet<DurBundle>(KEY);
    const m = await idbGet<DurMeta>(META_KEY);
    if (b && Object.keys(b).length) {
      bundle = b;
      meta = m ?? null;
    }
  } catch {
    /* 미다운로드 */
  }
}

async function fetchDecompress(url: string): Promise<DurBundle> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`dur ${res.status}`);
  if (typeof DecompressionStream === 'undefined' || !res.body) throw new Error('DecompressionStream 미지원');
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as DurBundle;
}

/** 설정의 "전체 다운로드" — DUR 룰셋을 받아 캐시. 품목 수 반환. */
export async function downloadDur(): Promise<number> {
  const b = await fetchDecompress(DATA_URL);
  let m: DurMeta;
  try {
    const res = await fetch(META_URL, { cache: 'no-cache' });
    m = res.ok ? ((await res.json()) as DurMeta) : { builtAt: new Date().toISOString(), version: 1, count: Object.keys(b).length };
  } catch {
    m = { builtAt: new Date().toISOString(), version: 1, count: Object.keys(b).length };
  }
  bundle = b;
  meta = m;
  await idbSet(KEY, b);
  await idbSet(META_KEY, m);
  return Object.keys(b).length;
}

function expand(itemSeq: string, c: DurCompact): DurInfo {
  return {
    itemSeq,
    combo: (c.c ?? []).map((x) => ({ seq: x.s, name: x.n, content: x.t })),
    pregnancy: c.p ? [{ content: c.p }] : [],
    elderly: c.e ? [{ content: c.e }] : [],
    age: c.a ? [{ content: c.a }] : [],
    dup: c.d ? [{ content: c.d }] : [],
  };
}

/** 받아둔 경우에만 주어진 seq들의 DUR 맵 반환(네트워크 없음). 미다운로드면 null. */
export async function getBundledDurMap(seqs: string[]): Promise<Map<string, DurInfo> | null> {
  await ensureLoaded();
  if (!bundle) return null;
  const m = new Map<string, DurInfo>();
  for (const seq of seqs) {
    const c = bundle[seq];
    if (c) m.set(seq, expand(seq, c));
  }
  return m;
}

export async function durBundleStatus(): Promise<{ downloaded: boolean; count: number; builtAt?: string }> {
  await ensureLoaded();
  return { downloaded: !!bundle, count: bundle ? Object.keys(bundle).length : 0, builtAt: meta?.builtAt };
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
