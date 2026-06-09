// 실험적(옵트인): 온디바이스 ONNX 임베딩 기반 마크 매칭.
// ⚠️ 합성 벤치 측정상 현재 HOG(marksim)보다 정확도가 낮다(미학습 범용 모델, SqueezeNet).
//    그래도 "직접 실제 마크로 체감"할 수 있게 토글로 제공한다. 기본은 꺼짐.
// 동작: 모델/wasm 은 켤 때만 동적 로드(인터넷 1회 필요) → IndexedDB 캐시 → 이후 오프라인.
//   질의(캔버스 그림)·마크 이미지를 224 로 리사이즈 → ImageNet 정규화 → 1000-d 출력(임베딩)
//   → 코사인 유사도 랭킹. 마크 임베딩은 최초 1회 계산 후 캐시.
//
// 순수 함수가 거의 없고 브라우저(canvas/wasm) 전용이라 단위 테스트는 토글 플래그만 다룬다.

import { getMarkOptions, getMeta, idbGet, idbSet } from './dataset';
import type { MarkFeature, RankedMark } from './marksim';

const FLAG_KEY = 'ward-pillcheck:embedMode';
// SqueezeNet 1.0 (~5MB) — 검증된 ONNX 모델 zoo. 켤 때 1회 받아 캐시.
// ⚠️ github.com/.../raw/ 는 302 리다이렉트의 CORS 헤더가 비어 브라우저 fetch 가 막힌다.
//    리다이렉트 최종 호스트(media.githubusercontent.com, ACAO:*)를 직접 받는다.
const MODEL_URL = 'https://media.githubusercontent.com/media/onnx/models/main/validated/vision/classification/squeezenet/model/squeezenet1.0-7.onnx';
const MODEL_KEY = 'onnxmodel:squeezenet1.0-7';
// onnxruntime-web 는 번들하지 않고 CDN 에서 런타임 동적 로드(토글 켤 때만, 인터넷 필요).
// → 앱 번들/프리캐시에 26MB wasm 이 들어가지 않게 한다.
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort.min.mjs';
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
const INPUT = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

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

// 타입 의존성(npm) 없이 CDN 로드 → 느슨한 타입.
/* eslint-disable @typescript-eslint/no-explicit-any */
let ortMod: any = null;
let session: any = null;
let embedCache: MarkFeature[] | null = null;

async function loadOrt(): Promise<any> {
  if (!ortMod) {
    ortMod = await import(/* @vite-ignore */ ORT_CDN);
    ortMod.env.wasm.wasmPaths = WASM_CDN; // wasm 도 CDN 에서
  }
  return ortMod;
}

async function getModelBytes(): Promise<ArrayBuffer> {
  try {
    const cached = await idbGet<ArrayBuffer>(MODEL_KEY);
    if (cached && cached.byteLength) return cached;
  } catch {
    /* 캐시 불가 — 받음 */
  }
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`모델 다운로드 실패(${res.status})`);
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
  const bytes = await getModelBytes();
  session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
  return session;
}

/** URL 이미지를 224 정사각(흰배경 contain) ImageData 로 */
async function loadImage224(url: string): Promise<ImageData | null> {
  if (typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        resolve(drawTo224((c) => {
          const r = Math.min(INPUT / im.width, INPUT / im.height) || 1;
          const w = im.width * r;
          const h = im.height * r;
          c.drawImage(im, (INPUT - w) / 2, (INPUT - h) / 2, w, h);
        }));
      } catch {
        resolve(null);
      }
    };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

/** 캔버스(그림)를 224 로 리사이즈한 ImageData 로 */
export function canvasTo224(canvas: HTMLCanvasElement): ImageData | null {
  if (typeof document === 'undefined') return null;
  return drawTo224((c) => c.drawImage(canvas, 0, 0, INPUT, INPUT));
}

function drawTo224(paint: (ctx: CanvasRenderingContext2D) => void): ImageData {
  const cv = document.createElement('canvas');
  cv.width = INPUT;
  cv.height = INPUT;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, INPUT, INPUT);
  paint(ctx);
  return ctx.getImageData(0, 0, INPUT, INPUT);
}

/** ImageData(224) → NCHW float32, ImageNet 정규화 */
function toTensorData(img: ImageData): Float32Array {
  const { data } = img;
  const out = new Float32Array(3 * INPUT * INPUT);
  const plane = INPUT * INPUT;
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = (data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return out;
}

/** L2 정규화 복사본 */
function l2(v: Float32Array | number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return Array.from(v, (x) => x / s);
}

async function embedImageData(img: ImageData): Promise<number[]> {
  const ort = await loadOrt();
  const sess = await getSession();
  const tensor = new ort.Tensor('float32', toTensorData(img), [1, 3, INPUT, INPUT]);
  const out = await sess.run({ [sess.inputNames[0]]: tensor });
  const vec = out[sess.outputNames[0]].data as Float32Array;
  return l2(vec);
}

function cosine(a: number[], b: number[]): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) d += a[i] * b[i];
  return d; // 둘 다 L2 정규화됨 → dot = cosine
}

/** 마크 임베딩 DB 보장(최초 1회 계산 후 IndexedDB 캐시). 브라우저 전용. */
export async function ensureMarkEmbeddings(
  onProgress?: (done: number, total: number) => void,
): Promise<MarkFeature[]> {
  if (embedCache) return embedCache;
  const opts = await getMarkOptions();
  const key = `markembed:v1:squeezenet:${getMeta()?.builtAt ?? 'x'}:${opts.length}`;
  try {
    const cached = await idbGet<MarkFeature[]>(key);
    if (cached && cached.length) {
      embedCache = cached;
      return cached;
    }
  } catch {
    /* 계산 진행 */
  }
  await getSession(); // 모델 먼저 준비
  const out: MarkFeature[] = [];
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    const img = await loadImage224(o.img);
    if (img) out.push({ code: o.code, img: o.img, imgId: o.imgId, vec: await embedImageData(img) });
    onProgress?.(i + 1, opts.length);
  }
  embedCache = out;
  try {
    await idbSet(key, out);
  } catch {
    /* 무시 */
  }
  return out;
}

/** 캔버스 그림을 ONNX 임베딩으로 랭킹(상위 topN). 잉크 없으면 호출부에서 거름. */
export async function rankByEmbedding(
  canvas: HTMLCanvasElement,
  topN = 24,
): Promise<RankedMark[]> {
  const feats = await ensureMarkEmbeddings();
  const img = canvasTo224(canvas);
  if (!img) return [];
  const q = await embedImageData(img);
  return feats
    .map((f) => ({ ...f, score: cosine(q, f.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
