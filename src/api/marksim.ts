// 그려서 마크 찾기 — 온디바이스 형상 유사도.
// 사용자가 캔버스에 그린 그림과 번들 마크 이미지(431종)를 비교해 닮은 순으로 후보를 낸다.
// 외부 API·서버 없이 전부 기기에서. (마크가 있는 약만 검색 대상)
//
// 순수 함수(extractFeature/cosineSim/rankFeatures)는 테스트 대상이고,
// 이미지 디코딩(loadImageData/ensureMarkFeatures)은 브라우저 전용이다.

import { getMarkOptions, getMeta } from './dataset';
import { idbGet, idbSet } from './dataset';

/** ImageData 와 호환되는 최소 형태(테스트에서 합성 가능) */
export interface ImgLike {
  data: Uint8ClampedArray | number[] | Float32Array;
  width: number;
  height: number;
}

export const GRID = 24; // 특징 그리드 한 변
const INK_THRESHOLD = 0.32; // 잉크로 칠 luminance 기준(0~1, 클수록 진함)
const BLUR_RADIUS = 2; // 손그림 흔들림 흡수용 디스크립터 블러(셀 반경)
const FEAT_VERSION = 2; // 디스크립터 알고리즘 버전(바뀌면 캐시 무효화)

/** 그리드 디스크립터에 분리형 박스 블러 — 손그림의 위치/굵기 오차를 흡수 */
function blurGrid(src: Float32Array, grid: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const horiz = new Float32Array(grid * grid);
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      let sum = 0, n = 0;
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
      let sum = 0, n = 0;
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

/**
 * 이미지(검정 그림/흰 배경 가정)에서 위치·크기 불변 형상 특징을 뽑는다.
 * 1) 잉크 강도 맵(어두울수록·불투명할수록 ↑) 2) 잉크 바운딩박스 3) 정사각 박스로
 * 종횡비 보존한 채 GRID×GRID 셀 평균 → 0~1 grayscale 디스크립터.
 */
export function extractFeature(img: ImgLike, grid = GRID): Float32Array {
  const { data, width, height } = img;
  const ink = new Float32Array(width * height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = (data[i + 3] ?? 255) / 255;
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const v = a * (1 - lum); // 잉크 강도
      ink[y * width + x] = v;
      if (v > INK_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const out = new Float32Array(grid * grid);
  if (maxX < minX) return out; // 잉크 없음

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const side = Math.max(bw, bh); // 종횡비 보존: 짧은 변을 패딩해 정사각화
  const ox = minX - (side - bw) / 2;
  const oy = minY - (side - bh) / 2;

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const sx0 = ox + (gx / grid) * side;
      const sx1 = ox + ((gx + 1) / grid) * side;
      const sy0 = oy + (gy / grid) * side;
      const sy1 = oy + ((gy + 1) / grid) * side;
      let sum = 0;
      let n = 0;
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
  // 블러로 손그림 vs 인쇄마크의 미세 정렬·굵기 차이를 완화 (마크·질의 동일 적용)
  return blurGrid(out, grid, BLUR_RADIUS);
}

/** 코사인 유사도(0~1). 빈 벡터는 0. */
export function cosineSim(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

export interface MarkFeature {
  code: string;
  img: string;
  vec: number[];
}
export interface RankedMark extends MarkFeature {
  score: number;
}

/** 질의 특징과 마크 특징들을 비교해 유사도 내림차순 상위 N */
export function rankFeatures(query: ArrayLike<number>, feats: MarkFeature[], topN = 12): RankedMark[] {
  return feats
    .map((f) => ({ ...f, score: cosineSim(query, f.vec) }))
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
      if (id) out.push({ code: batch[j].code, img: batch[j].img, vec: Array.from(extractFeature(id)) });
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

/** 캔버스 요소에서 질의 특징 추출(브라우저). 잉크가 없으면 null. */
export function featureFromCanvas(canvas: HTMLCanvasElement): Float32Array | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const f = extractFeature(img);
  return f.some((v) => v > 0) ? f : null;
}
