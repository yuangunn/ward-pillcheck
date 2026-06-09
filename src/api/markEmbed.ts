// 실험적(옵트인): 온디바이스 ONNX 임베딩 기반 마크 매칭.
// 작은 CNN(96px·1ch, ~0.7MB)을 마크의 합성 손그림으로 학습한 모델(ml/run_experiment.py).
// 자체 합성 벤치: Recall@1 85% (현재 HOG 31% / 미학습 SqueezeNet 5%).
//   ⚠️ 학습과 같은 "합성 증강" 분포 기준이라 모델에 유리 — 실제 사람 손그림 체감은 더 낮을 수
//   있다(설정 '그림 데이터 수집'으로 실데이터 모아 재학습하면 진짜로 올라감).
// 모델·임베딩은 same-origin 번들(public/models, 프리캐시 제외). ort 런타임/wasm 만 CDN 동적 로드.

import type { MarkFeature, RankedMark } from './marksim';
import { idbGet, idbSet } from './dataset';

const FLAG_KEY = 'ward-pillcheck:embedMode';
const BASE = (import.meta.env.BASE_URL as string) ?? '/';
const MODEL_URL = `${BASE}models/markembed.onnx`; // 번들, same-origin(=CORS 무관, IDB 캐시 후 오프라인)
const EMB_URL = `${BASE}models/embeddings.json`;
const MODEL_KEY = 'onnxmodel:markembed-v1';
// onnxruntime-web 은 번들하지 않고 CDN 에서 런타임 동적 로드(켤 때만, 인터넷 1회) → 앱 번들 0 영향.
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort.min.mjs';
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
const INPUT = 96; // 학습 입력 크기(1채널 회색)

/** 실험 토글: ONNX 임베딩 매칭 사용 여부(기본 false) */
export function getEmbedMode(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}
export function setEmbedMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(FLAG_KEY, '1');
    else localStorage.removeItem(FLAG_KEY);
  } catch {
    /* ignore */
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let ortMod: any = null;
let session: any = null;
let embedCache: MarkFeature[] | null = null;

async function loadOrt(): Promise<any> {
  if (!ortMod) {
    ortMod = await import(/* @vite-ignore */ ORT_CDN);
    ortMod.env.wasm.wasmPaths = WASM_CDN;
  }
  return ortMod;
}

async function getModelBytes(): Promise<ArrayBuffer> {
  try {
    const cached = await idbGet<ArrayBuffer>(MODEL_KEY);
    if (cached && cached.byteLength) return cached;
  } catch {
    /* 계속 받음 */
  }
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`모델 로드 실패(${res.status})`);
  const buf = await res.arrayBuffer();
  try {
    await idbSet(MODEL_KEY, buf);
  } catch {
    /* 캐시 실패 무시 */
  }
  return buf;
}

async function getSession(): Promise<any> {
  if (session) return session;
  const ort = await loadOrt();
  session = await ort.InferenceSession.create(await getModelBytes(), { executionProviders: ['wasm'] });
  return session;
}

/** 캔버스 그림 → 96×96 1채널(회색/255) 입력 텐서 데이터. 학습 전처리와 동일. */
function canvasToInput(canvas: HTMLCanvasElement): Float32Array {
  const cv = document.createElement('canvas');
  cv.width = INPUT;
  cv.height = INPUT;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, INPUT, INPUT);
  ctx.drawImage(canvas, 0, 0, INPUT, INPUT);
  const d = ctx.getImageData(0, 0, INPUT, INPUT).data;
  const out = new Float32Array(INPUT * INPUT);
  for (let i = 0; i < INPUT * INPUT; i++) {
    out[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255; // 'L' 휘도
  }
  return out;
}

async function embedCanvas(canvas: HTMLCanvasElement): Promise<number[]> {
  const ort = await loadOrt();
  const sess = await getSession();
  const t = new ort.Tensor('float32', canvasToInput(canvas), [1, 1, INPUT, INPUT]);
  const out = await sess.run({ [sess.inputNames[0]]: t });
  return Array.from(out[sess.outputNames[0]].data as Float32Array); // 모델이 L2 정규화 출력
}

/** 마크 임베딩 DB 보장(번들 embeddings.json 로드 + 모델 워밍). img 는 imgId 로 복원. */
export async function ensureMarkEmbeddings(
  onProgress?: (done: number, total: number) => void,
): Promise<MarkFeature[]> {
  if (embedCache) return embedCache;
  await getSession(); // 모델(+ort) 준비 — 여기서 다운로드
  onProgress?.(1, 2);
  const res = await fetch(EMB_URL);
  if (!res.ok) throw new Error(`임베딩 로드 실패(${res.status})`);
  const j = (await res.json()) as { marks: { imgId: string; code: string; vec: number[] }[] };
  embedCache = j.marks.map((m) => ({
    code: m.code,
    imgId: m.imgId,
    img: `${BASE}data/marks/${m.imgId}.gif`,
    vec: m.vec,
  }));
  onProgress?.(2, 2);
  return embedCache!;
}

function cosine(a: number[], b: number[]): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) d += a[i] * b[i]; // 질의·마크 모두 L2 정규화 → dot = cosine
  return d;
}

/** 캔버스 그림을 ONNX 임베딩으로 랭킹(상위 topN). */
export async function rankByEmbedding(canvas: HTMLCanvasElement, topN = 24): Promise<RankedMark[]> {
  const feats = await ensureMarkEmbeddings();
  const q = await embedCanvas(canvas);
  return feats
    .map((f) => ({ ...f, score: cosine(q, f.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
