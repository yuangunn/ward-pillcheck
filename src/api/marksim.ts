// 그려서 마크 찾기 — 온디바이스 형상 유사도.
// 사용자가 캔버스에 그린 그림과 번들 마크 이미지(고유 이미지 단위)를 비교해 닮은 순으로 후보를 낸다.
// 외부 API·서버 없이 전부 기기에서. (마크가 있는 약만 검색 대상)
//
// 정확도 개선(2026-06):
//  - 소프트 잉크 임계: 안티에일리어싱된 가는 선까지 바운딩박스에 포함.
//  - 멀티스케일: 24×24 세부 + 8×8 큰 윤곽을 함께 인코딩해 손떨림에 둔감.
//  - HOG(방향 히스토그램): 획 방향을 인코딩 → 굵기에 둔감하고 선그림 변별력↑.
//  - 회전·미러 탐색: 질의를 여러 각도/거울로 변형해 최대 유사도를 취함(쇼트리스트→재랭킹).
//
// 순수 함수(extractFeature/cosineSim/rank*/rotateImg)는 테스트 대상이고,
// 이미지 디코딩(loadImageData/ensureMarkFeatures)은 브라우저 전용이다.

import { getMarkOptions, getMeta } from './dataset';
import { idbGet, idbSet } from './dataset';

/** ImageData 와 호환되는 최소 형태(테스트에서 합성 가능) */
export interface ImgLike {
  data: Uint8ClampedArray | number[] | Float32Array;
  width: number;
  height: number;
}

export const GRID = 24; // 세부 특징 그리드 한 변
const COARSE = 8; // 큰 윤곽 그리드 한 변(멀티스케일)
const HCELL = 4; // HOG 공간 셀 한 변
const HBIN = 8; // HOG 방향 빈(무방향 0~π)
const INK_BBOX = 0.12; // 바운딩박스 판정용 낮은 임계(가는 선 포함)
const BLUR_RADIUS = 2; // 손그림 흔들림 흡수용 디스크립터 블러(셀 반경)
const FEAT_VERSION = 4; // 디스크립터/스키마 버전(바뀌면 캐시 무효화). v4: imgId 추가

// 디스크립터 블록 가중치(각 블록 L2 정규화 후 적용). cosine 비중 조절.
const W_INTENSITY = 1.0;
const W_COARSE = 0.6;
const W_HOG = 0.9;

const INTENSITY_LEN = GRID * GRID; // 576
const COARSE_LEN = COARSE * COARSE; // 64
const HOG_LEN = HCELL * HCELL * HBIN; // 128
export const FEATURE_LEN = INTENSITY_LEN + COARSE_LEN + HOG_LEN; // 768

/** 그리드 디스크립터에 분리형 박스 블러 — 손그림의 위치/굵기 오차를 흡수 */
function blurGrid(src: Float32Array, grid: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const horiz = new Float32Array(grid * grid);
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      let sum = 0,
        n = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= grid) continue;
        sum += src[y * grid + xx];
        n++;
      }
      horiz[y * grid + x] = sum / n;
    }
  }
  const out = new Float32Array(grid * grid);
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      let sum = 0,
        n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= grid) continue;
        sum += horiz[yy * grid + x];
        n++;
      }
      out[y * grid + x] = sum / n;
    }
  }
  return out;
}

/** 벡터를 단위 길이로 정규화(in-place). 0 벡터는 그대로. */
function l2normalize(v: Float32Array, from = 0, to = v.length): void {
  let s = 0;
  for (let i = from; i < to; i++) s += v[i] * v[i];
  s = Math.sqrt(s);
  if (s === 0) return;
  for (let i = from; i < to; i++) v[i] /= s;
}

/**
 * 잉크 강도 맵(0~1, 어두울수록·불투명할수록 ↑)과 바운딩박스를 계산.
 * 소프트 임계로 가는 선까지 박스에 포함한다.
 */
function inkMap(img: ImgLike): {
  ink: Float32Array;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const { data, width, height } = img;
  const ink = new Float32Array(width * height);
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = (data[i + 3] ?? 255) / 255;
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const v = a * (1 - lum);
      ink[y * width + x] = v;
      if (v > INK_BBOX) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { ink, minX, minY, maxX, maxY };
}

/**
 * 잉크 박스를 종횡비 보존 정사각으로 잡고 grid×grid 셀 평균(0~1) → 위치·크기 불변 디스크립터.
 * 잉크가 없으면 null.
 */
function intensityGrid(img: ImgLike, grid: number): Float32Array | null {
  const { ink, minX, minY, maxX, maxY } = inkMap(img);
  if (maxX < minX) return null;
  const { width, height } = img;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const side = Math.max(bw, bh);
  const ox = minX - (side - bw) / 2;
  const oy = minY - (side - bh) / 2;

  const out = new Float32Array(grid * grid);
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const sx0 = ox + (gx / grid) * side;
      const sx1 = ox + ((gx + 1) / grid) * side;
      const sy0 = oy + (gy / grid) * side;
      const sy1 = oy + ((gy + 1) / grid) * side;
      let sum = 0,
        n = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy++) {
        for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx++) {
          n++;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          sum += ink[yy * width + xx];
        }
      }
      out[gy * grid + gx] = n ? sum / n : 0;
    }
  }
  return out;
}

/** 세부 그리드를 coarse×coarse 로 평균 다운샘플(큰 윤곽 채널) */
function coarseGrid(fine: Float32Array, grid: number, coarse: number): Float32Array {
  const out = new Float32Array(coarse * coarse);
  const block = grid / coarse;
  for (let cy = 0; cy < coarse; cy++) {
    for (let cx = 0; cx < coarse; cx++) {
      let sum = 0,
        n = 0;
      for (let y = Math.floor(cy * block); y < Math.floor((cy + 1) * block); y++) {
        for (let x = Math.floor(cx * block); x < Math.floor((cx + 1) * block); x++) {
          sum += fine[y * grid + x];
          n++;
        }
      }
      out[cy * coarse + cx] = n ? sum / n : 0;
    }
  }
  return out;
}

/**
 * 세부 그리드에서 HOG(무방향 0~π) 히스토그램. 셀별 방향 분포로 획 방향을 인코딩.
 * 굵기에 둔감하고 선그림 변별력이 높다.
 */
function hog(fine: Float32Array, grid: number): Float32Array {
  const out = new Float32Array(HCELL * HCELL * HBIN);
  const cell = grid / HCELL;
  const at = (x: number, y: number) =>
    fine[Math.min(grid - 1, Math.max(0, y)) * grid + Math.min(grid - 1, Math.max(0, x))];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      const mag = Math.hypot(gx, gy);
      if (mag < 1e-6) continue;
      let ang = Math.atan2(gy, gx); // -π~π
      if (ang < 0) ang += Math.PI; // 무방향화 0~π
      const bin = Math.min(HBIN - 1, Math.floor((ang / Math.PI) * HBIN));
      const cxIdx = Math.min(HCELL - 1, Math.floor(x / cell));
      const cyIdx = Math.min(HCELL - 1, Math.floor(y / cell));
      out[(cyIdx * HCELL + cxIdx) * HBIN + bin] += mag;
    }
  }
  return out;
}

/**
 * 이미지(검정 그림/흰 배경 가정) → 형상 디스크립터(길이 FEATURE_LEN).
 * [세부강도(24×24) | 큰윤곽(8×8) | HOG(4×4×8)] 각 블록 L2 정규화 후 가중 결합.
 * 잉크가 없으면 0 벡터.
 */
export function extractFeature(img: ImgLike, grid = GRID): Float32Array {
  const out = new Float32Array(FEATURE_LEN);
  const fineRaw = intensityGrid(img, grid);
  if (!fineRaw) return out;
  const fine = blurGrid(fineRaw, grid, BLUR_RADIUS);
  const coarse = coarseGrid(fine, grid, COARSE);
  const h = hog(fine, grid);

  // 블록별 L2 정규화 후 가중치 적용
  l2normalize(fine);
  l2normalize(coarse);
  l2normalize(h);
  for (let i = 0; i < INTENSITY_LEN; i++) out[i] = fine[i] * W_INTENSITY;
  for (let i = 0; i < COARSE_LEN; i++) out[INTENSITY_LEN + i] = coarse[i] * W_COARSE;
  for (let i = 0; i < HOG_LEN; i++) out[INTENSITY_LEN + COARSE_LEN + i] = h[i] * W_HOG;
  return out;
}

/** 코사인 유사도(0~1). 빈 벡터는 0. */
export function cosineSim(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

// ── 회전·미러 변형(질의 측에서 손그림 기울기 흡수) ──────────────

/** 이미지를 중심 기준 deg 회전(흰 배경, 최근접 샘플). */
export function rotateImg(img: ImgLike, deg: number): ImgLike {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(w * h * 4);
  out.fill(255); // 흰 배경
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad),
    sin = Math.sin(rad);
  const cx = (w - 1) / 2,
    cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx,
        dy = y - cy;
      // 출력→입력 역회전 샘플
      const sx = Math.round(cx + dx * cos + dy * sin);
      const sy = Math.round(cy - dx * sin + dy * cos);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const si = (sy * w + sx) * 4,
        oi = (y * w + x) * 4;
      out[oi] = data[si];
      out[oi + 1] = data[si + 1];
      out[oi + 2] = data[si + 2];
      out[oi + 3] = data[si + 3] ?? 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** 이미지를 좌우 반전. */
export function mirrorImg(img: ImgLike): ImgLike {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + (w - 1 - x)) * 4,
        oi = (y * w + x) * 4;
      out[oi] = data[si];
      out[oi + 1] = data[si + 1];
      out[oi + 2] = data[si + 2];
      out[oi + 3] = data[si + 3] ?? 255;
    }
  }
  return { data: out, width: w, height: h };
}

// 질의 회전 탐색 각도(±16°). 손그림 기울기를 흡수하되, 큰 회전은 탐색하지 않아
// 세로↔가로 같은 방향성은 보존한다(범위를 더 넓히면 회전 동족 마크끼리 혼동↑).
// 미러는 별도 검증 결과 distractor 점수를 함께 끌어올려 정밀도를 떨어뜨려 기본 제외.
const QUERY_ANGLES = [-16, -8, 0, 8, 16];

/** 질의 이미지 → 회전 변형 디스크립터 집합(첫 원소는 0° 원본). */
export function extractFeatureVariants(img: ImgLike): Float32Array[] {
  return QUERY_ANGLES.map((a) => (a === 0 ? extractFeature(img) : extractFeature(rotateImg(img, a))));
}

export interface MarkFeature {
  code: string;
  img: string;
  imgId: string; // 같은 실제 마크 이미지 매칭/중복제거용
  vec: number[];
}
export interface RankedMark extends MarkFeature {
  score: number;
}

/** 질의 특징과 마크 특징들을 비교해 유사도 내림차순 상위 N (단일 질의). */
export function rankFeatures(query: ArrayLike<number>, feats: MarkFeature[], topN = 12): RankedMark[] {
  return feats
    .map((f) => ({ ...f, score: cosineSim(query, f.vec) }))
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

const SHORTLIST = 100; // 0° 변형으로 1차 추린 뒤, 전 변형 최대값으로 재랭킹

/**
 * 회전·미러 변형 질의 집합으로 후보를 랭킹.
 * 1) 0° 변형 cosine 으로 SHORTLIST 추림(싼 단계)
 * 2) 추린 후보만 전 변형 중 최대 cosine 으로 재점수(회전 탐색 재랭킹)
 */
export function rankFeaturesMulti(queryVecs: Float32Array[], feats: MarkFeature[], topN = 12): RankedMark[] {
  if (!queryVecs.length) return [];
  const base = queryVecs[0];
  const shortlist = feats
    .map((f) => ({ f, s: cosineSim(base, f.vec) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.min(SHORTLIST, feats.length));
  return shortlist
    .map(({ f }) => {
      let best = 0;
      for (const q of queryVecs) {
        const s = cosineSim(q, f.vec);
        if (s > best) best = s;
      }
      return { ...f, score: best };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ── 브라우저 전용: 마크 이미지 → 특징 DB(메모리+IndexedDB 캐시) ──

/** url 이미지를 정사각 캔버스(흰 배경)에 contain 으로 그려 ImageData 반환 */
async function loadImageData(url: string, size = 64): Promise<ImgLike | null> {
  if (typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        const r = Math.min(size / im.width, size / im.height) || 1;
        const w = im.width * r;
        const h = im.height * r;
        ctx.drawImage(im, (size - w) / 2, (size - h) / 2, w, h);
        resolve(ctx.getImageData(0, 0, size, size));
      } catch {
        resolve(null); // canvas tainted 등
      }
    };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

let featCache: MarkFeature[] | null = null;

/**
 * 번들 마크 이미지들의 특징 DB 보장.
 * 메모리 → IndexedDB(빌드일 기준 키) → 없으면 디코딩해 생성·캐시.
 */
export async function ensureMarkFeatures(
  onProgress?: (done: number, total: number) => void,
): Promise<MarkFeature[]> {
  if (featCache) return featCache;
  const opts = await getMarkOptions();
  const key = `markfeat:v${FEAT_VERSION}:${getMeta()?.builtAt ?? 'x'}:${opts.length}`;

  try {
    const cached = await idbGet<MarkFeature[]>(key);
    if (cached && cached.length) {
      featCache = cached;
      return cached;
    }
  } catch {
    /* IndexedDB 불가 — 계속 계산 */
  }

  const out: MarkFeature[] = [];
  const BATCH = 12;
  for (let i = 0; i < opts.length; i += BATCH) {
    const batch = opts.slice(i, i + BATCH);
    const ids = await Promise.all(batch.map((o) => loadImageData(o.img)));
    ids.forEach((id, j) => {
      if (id) out.push({ code: batch[j].code, img: batch[j].img, imgId: batch[j].imgId, vec: Array.from(extractFeature(id)) });
    });
    onProgress?.(Math.min(i + BATCH, opts.length), opts.length);
  }

  featCache = out;
  try {
    await idbSet(key, out);
  } catch {
    /* 캐시 실패는 무시 */
  }
  return out;
}

/** 캔버스 요소에서 회전·미러 변형 질의 특징 집합(브라우저). 잉크 없으면 null. */
export function featuresFromCanvas(canvas: HTMLCanvasElement): Float32Array[] | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const base = extractFeature(img);
  if (!base.some((v) => v > 0)) return null; // 잉크 없음
  return extractFeatureVariants(img);
}

/** (구) 캔버스 단일 질의 특징 — 회전 탐색 없이 0° 만. */
export function featureFromCanvas(canvas: HTMLCanvasElement): Float32Array | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const f = extractFeature(img);
  return f.some((v) => v > 0) ? f : null;
}
