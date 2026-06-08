// $P/$Q 계열 point-cloud 기반 형상 매칭 — "획(stroke) 좌표"를 살려 비교(현재 HOG 는 비트맵만 봄).
//
// ⚠️ 탐색/평가용 모듈. dollar.test.ts 의 합성 손그림 A/B 측정 결과,
//    회전·떨림 전 조건에서 현재 HOG(marksim) 가 $P 보다 같거나 정확해서
//    프로덕션(그려서찾기)엔 적용하지 않았다. 의사결정 근거로 남겨둔다.
//    (참고로 같은 벤치에서 미학습 ONNX 임베딩은 HOG 의 절반 수준이었다.)
// - 질의(사용자 그림): 획 폴리라인 → 등간격 N점 리샘플 → 정규화.
// - 템플릿(마크 이미지): 잉크 픽셀에서 N점 샘플 → 정규화.
// 둘 다 N점 구름이 되면 순서무관 greedy cloud match 로 거리(작을수록 닮음)를 잰다.
// 참고: Vatavu, Anthony, Wobbrock — "$P Point-Cloud Recognizer" (UIST 2012).
//
// 순수 함수만 — 테스트 가능. 캔버스/이미지 디코딩은 호출부에서 ImgLike 로 넘긴다.

import type { ImgLike } from './marksim';

export interface Pt {
  x: number;
  y: number;
}

export const CLOUD_N = 32; // 한 구름의 점 개수(질의·템플릿 공통)

/** 두 점 유클리드 거리 */
function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 폴리라인 전체 길이(획 사이는 잇지 않고 같은 stroke 내부만) */
function pathLength(stroke: Pt[]): number {
  let d = 0;
  for (let i = 1; i < stroke.length; i++) d += dist(stroke[i - 1], stroke[i]);
  return d;
}

/**
 * 여러 획을 등간격 N점으로 리샘플(획 길이 비례 배분). $P 처럼 점 개수를 고정한다.
 * 빈/단일점 획은 보정. 반환은 N점(부족하면 마지막 점으로 패딩).
 */
export function resampleStrokes(strokes: Pt[][], n = CLOUD_N): Pt[] {
  const valid = strokes.filter((s) => s.length > 0);
  if (!valid.length) return [];
  const total = valid.reduce((s, st) => s + Math.max(pathLength(st), 0), 0);
  if (total === 0) {
    // 점만 찍은 경우: 첫 점을 N개 복제
    return Array.from({ length: n }, () => ({ ...valid[0][0] }));
  }
  const out: Pt[] = [];
  // 획별로 길이에 비례한 점 수를 배정(최소 1점)
  let remaining = n;
  valid.forEach((st, idx) => {
    const isLast = idx === valid.length - 1;
    const share = isLast ? remaining : Math.max(1, Math.round((pathLength(st) / total) * n));
    const cnt = Math.min(remaining, share);
    out.push(...resampleOne(st, cnt));
    remaining -= cnt;
  });
  while (out.length < n) out.push({ ...out[out.length - 1] });
  return out.slice(0, n);
}

/** 한 획을 등간격 m점으로 리샘플 */
function resampleOne(stroke: Pt[], m: number): Pt[] {
  if (m <= 1 || stroke.length === 1) return [{ ...stroke[0] }];
  const len = pathLength(stroke);
  if (len === 0) return Array.from({ length: m }, () => ({ ...stroke[0] }));
  const interval = len / (m - 1);
  const out: Pt[] = [{ ...stroke[0] }];
  let prev = stroke[0];
  let acc = 0;
  const pts = stroke.slice();
  for (let i = 1; i < pts.length; ) {
    const d = dist(prev, pts[i]);
    if (acc + d >= interval) {
      const t = (interval - acc) / d;
      const np = { x: prev.x + t * (pts[i].x - prev.x), y: prev.y + t * (pts[i].y - prev.y) };
      out.push(np);
      prev = np;
      acc = 0;
      if (out.length >= m) break;
    } else {
      acc += d;
      prev = pts[i];
      i++;
    }
  }
  while (out.length < m) out.push({ ...stroke[stroke.length - 1] });
  return out.slice(0, m);
}

/** 잉크 강도(어두움·불투명) — marksim 과 동일 기준 */
function inkAt(img: ImgLike, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  const d = img.data;
  const a = (d[i + 3] ?? 255) / 255;
  const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  return a * (1 - lum);
}

/**
 * 마크 이미지에서 잉크 점들을 모아 N점 구름으로 샘플.
 * 균일 스트라이드 샘플 후 N개로 맞춤(많으면 일정 간격, 적으면 패딩). 잉크 없으면 [].
 */
export function pointsFromInk(img: ImgLike, n = CLOUD_N, threshold = 0.35): Pt[] {
  const pts: Pt[] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (inkAt(img, x, y) > threshold) pts.push({ x, y });
    }
  }
  if (!pts.length) return [];
  if (pts.length <= n) {
    const out = pts.slice();
    while (out.length < n) out.push({ ...pts[out.length % pts.length] });
    return out;
  }
  // 균일 스트라이드로 N점 추출(공간 분포 보존)
  const step = pts.length / n;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push({ ...pts[Math.floor(i * step)] });
  return out;
}

/** 구름 정규화: 무게중심을 원점으로, 최대 변(bounding box) 1 로 스케일 */
export function normalizeCloud(points: Pt[]): Pt[] {
  if (!points.length) return points;
  let cx = 0,
    cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const scale = Math.max(maxX - minX, maxY - minY) || 1;
  return points.map((p) => ({ x: (p.x - cx) / scale, y: (p.y - cy) / scale }));
}

/** $P CloudDistance: start 인덱스에서 시작하는 가중 greedy 매칭 합 */
function cloudDistance(a: Pt[], b: Pt[], start: number): number {
  const n = a.length;
  const matched = new Array<boolean>(n).fill(false);
  let sum = 0;
  let i = start;
  do {
    let min = Infinity;
    let index = -1;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = dist(a[i], b[j]);
      if (d < min) {
        min = d;
        index = j;
      }
    }
    if (index >= 0) matched[index] = true;
    const weight = 1 - ((i - start + n) % n) / n;
    sum += weight * min;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}

/** $P GreedyCloudMatch: 여러 시작점 중 최소 거리(작을수록 닮음). 두 구름 길이는 같아야 함. */
export function greedyCloudMatch(a: Pt[], b: Pt[]): number {
  const n = a.length;
  if (n === 0 || b.length !== n) return Infinity;
  const eps = 0.5;
  const step = Math.max(1, Math.floor(Math.pow(n, 1 - eps)));
  let min = Infinity;
  for (let i = 0; i < n; i += step) {
    const d1 = cloudDistance(a, b, i);
    const d2 = cloudDistance(b, a, i);
    min = Math.min(min, d1, d2);
  }
  return min;
}

/** 거리 → 0~1 유사도(클수록 닮음). 랭킹/표시는 유사도로 통일. */
export function cloudSimilarity(a: Pt[], b: Pt[]): number {
  const d = greedyCloudMatch(a, b);
  if (!isFinite(d)) return 0;
  // 정규화 구름 기준 평균거리 → 부드러운 감쇠. 0 거리=1, 멀수록 0.
  return 1 / (1 + d / a.length);
}

/** 질의 획 → 정규화 N점 구름 */
export function cloudFromStrokes(strokes: Pt[][], n = CLOUD_N): Pt[] {
  return normalizeCloud(resampleStrokes(strokes, n));
}

/** 템플릿 이미지 → 정규화 N점 구름(잉크 없으면 []) */
export function cloudFromImage(img: ImgLike, n = CLOUD_N): Pt[] {
  const pts = pointsFromInk(img, n);
  return pts.length ? normalizeCloud(pts) : [];
}
