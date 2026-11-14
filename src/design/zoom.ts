// 사진 확대(라이트박스) 안에서만 쓰는 핀치·두 번 탭 확대 계산(순수 함수).
// 화면 전체 핀줌은 막고(state/noPageZoom), 각인을 읽어야 하는 실물 사진만 앱이 직접 확대한다.
//
// 좌표계: 컨테이너 중심이 원점(px). 표시 변환 = translate(x, y) scale(s), transform-origin 가운데.
// 화면점 p = t + s·c (c = 내용 좌표) → 같은 내용점을 손가락 아래에 붙잡으려면 t' = p − s'·c.

export interface ZoomState {
  s: number; // 배율
  x: number; // 이동(px)
  y: number;
}

export const ZOOM_RESET: ZoomState = { s: 1, x: 0, y: 0 };
export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 확대한 사진이 틀 밖으로 빠져 빈 곳이 보이지 않게 이동 범위를 제한 */
export function clampPan(z: ZoomState, w: number, h: number): ZoomState {
  const s = clamp(z.s, MIN_SCALE, MAX_SCALE);
  const mx = ((s - 1) * w) / 2;
  const my = ((s - 1) * h) / 2;
  // + 0: -0 을 0 으로(상태 비교·표시가 흔들리지 않게)
  return { s, x: clamp(z.x, -mx, mx) + 0, y: clamp(z.y, -my, my) + 0 };
}

/** 점 p(중심 기준)를 고정한 채 배율을 바꾼다 */
export function zoomAt(z: ZoomState, nextScale: number, px: number, py: number, w: number, h: number): ZoomState {
  const s = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const cx = (px - z.x) / z.s;
  const cy = (py - z.y) / z.s;
  return clampPan({ s, x: px - s * cx, y: py - s * cy }, w, h);
}

/** 두 번 탭: 확대돼 있으면 원래대로, 아니면 탭한 곳을 중심으로 확대 */
export function toggleDoubleTap(z: ZoomState, px: number, py: number, w: number, h: number): ZoomState {
  return z.s > 1.01 ? ZOOM_RESET : zoomAt(ZOOM_RESET, DOUBLE_TAP_SCALE, px, py, w, h);
}

export interface Pt {
  x: number;
  y: number;
}

/**
 * 두 손가락 핀치: 시작 상태·시작 두 점 → 지금 두 점일 때의 상태.
 * 배율은 손가락 거리 비율, 위치는 두 손가락 가운데를 따라간다.
 */
export function pinch(start: ZoomState, a0: Pt, b0: Pt, a1: Pt, b1: Pt, w: number, h: number): ZoomState {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const s = clamp(start.s * (d1 / d0), MIN_SCALE, MAX_SCALE);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const cx = (m0.x - start.x) / start.s;
  const cy = (m0.y - start.y) / start.s;
  return clampPan({ s, x: m1.x - s * cx, y: m1.y - s * cy }, w, h);
}

/** 한 손가락 끌기(확대 상태에서만 의미 있음) */
export function pan(start: ZoomState, p0: Pt, p1: Pt, w: number, h: number): ZoomState {
  return clampPan({ s: start.s, x: start.x + (p1.x - p0.x), y: start.y + (p1.y - p0.y) }, w, h);
}
