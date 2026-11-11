import { COLOR_OPTIONS } from '../constants/appearance';

// 알약 글리프의 색·모양 지오메트리(React 없음) — 앱 글리프(Icon.PillGlyph)와 A4 출력물(캔버스)이 같은 도형을 쓴다.
// 좌표계: viewBox 0 0 100 100, 중심 50,50.

export function swatchFor(colorLabel?: string): string {
  return COLOR_OPTIONS.find((o) => o.label === colorLabel)?.swatch || '#e8eef0';
}
/** 글리프에 표시할 각인 라벨 정리: 양끝 구분자(/ - 공백) 제거 후 6자 */
export function cleanMark(s?: string): string {
  if (!s) return '';
  return s
    .replace(/[-_]{2,}/g, ' ') // 분할선 대시 런 → 공백(글리프에 '----' 가 차던 문제)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s/\-,]+|[\s/\-,]+$/g, '')
    .slice(0, 6);
}

export function isLightSwatch(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 165;
}

export function lightenHex(hex: string, amt: number): string {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return hex;
  const f = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amt);
  };
  return `rgb(${f(0)},${f(2)},${f(4)})`;
}
export function darkenHex(hex: string, amt: number): string {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return hex;
  const f = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    return Math.round(c * (1 - amt));
  };
  return `rgb(${f(0)},${f(2)},${f(4)})`;
}

// ── 도형 지오메트리 (viewBox 0 0 100 100, 중심 50,50) ─────────
type Pt = [number, number];
function regularPolygon(n: number, cx: number, cy: number, r: number, rotDeg = 0): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2 + (rotDeg * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
/** 꼭짓점을 둥글린 다각형 path(d) 생성 */
function roundedPolyPath(points: Pt[], r: number): string {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const v1x = p0[0] - p1[0];
    const v1y = p0[1] - p1[1];
    const v2x = p2[0] - p1[0];
    const v2y = p2[1] - p1[1];
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a: Pt = [p1[0] + (v1x / l1) * rr, p1[1] + (v1y / l1) * rr];
    const b: Pt = [p1[0] + (v2x / l2) * rr, p1[1] + (v2y / l2) * rr];
    d += i === 0 ? `M${a[0].toFixed(2)} ${a[1].toFixed(2)}` : `L${a[0].toFixed(2)} ${a[1].toFixed(2)}`;
    d += `Q${p1[0].toFixed(2)} ${p1[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  }
  return d + 'Z';
}

export interface ShapeGeom {
  el: 'circle' | 'ellipse' | 'rect' | 'path';
  attr: Record<string, number | string>;
  /** 각인 텍스트 세로 위치 */
  ty: number;
  /** 각인 글자 크기 배율(꼭짓점 도형은 안쪽 면적이 좁아 축소) */
  shrink?: number;
}
// 모양별: SVG 노드 + 각인 텍스트 세로 위치
export const SHAPE_GEOM: Record<string, ShapeGeom> = {
  원형: { el: 'circle', attr: { cx: 50, cy: 50, r: 39 }, ty: 50 },
  타원형: { el: 'ellipse', attr: { cx: 50, cy: 50, rx: 46, ry: 29 }, ty: 50 },
  장방형: { el: 'rect', attr: { x: 5, y: 31, width: 90, height: 38, rx: 17 }, ty: 50 },
  사각형: { el: 'rect', attr: { x: 15, y: 15, width: 70, height: 70, rx: 13 }, ty: 50 },
  기타: { el: 'rect', attr: { x: 13, y: 13, width: 74, height: 74, rx: 25 }, ty: 50 },
  삼각형: { el: 'path', attr: { d: roundedPolyPath(regularPolygon(3, 50, 55, 47, 0), 8) }, ty: 62, shrink: 0.8 },
  마름모형: { el: 'path', attr: { d: roundedPolyPath(regularPolygon(4, 50, 50, 48, 0), 7) }, ty: 50, shrink: 0.85 },
  오각형: { el: 'path', attr: { d: roundedPolyPath(regularPolygon(5, 50, 52, 46, 0), 7) }, ty: 54, shrink: 0.88 },
  육각형: { el: 'path', attr: { d: roundedPolyPath(regularPolygon(6, 50, 50, 47, 30), 7) }, ty: 50 },
  팔각형: { el: 'path', attr: { d: roundedPolyPath(regularPolygon(8, 50, 50, 48, 22.5), 6) }, ty: 50 },
  반원형: { el: 'path', attr: { d: 'M12 69 L88 69 A38 38 0 0 0 12 69 Z' }, ty: 57, shrink: 0.9 },
};
export function shapeGeom(shape?: string): ShapeGeom {
  return (shape && SHAPE_GEOM[shape]) || SHAPE_GEOM['원형'];
}

/** 도형을 SVG path(d) 하나로 — 캔버스 Path2D 로 그대로 그릴 수 있게. */
export function shapePathD(shape?: string): string {
  const g = shapeGeom(shape);
  const n = (k: string) => Number(g.attr[k]);
  if (g.el === 'path') return String(g.attr.d);
  if (g.el === 'circle') {
    const [cx, cy, r] = [n('cx'), n('cy'), n('r')];
    return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
  }
  if (g.el === 'ellipse') {
    const [cx, cy, rx, ry] = [n('cx'), n('cy'), n('rx'), n('ry')];
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  // rect(rx 둥근 모서리)
  const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
  const r = Math.min(n('rx') || 0, w / 2, h / 2);
  return (
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

/** 글리프 색 구성(채움·그라데이션·각인 글자색·테두리) */
export function glyphColors(color?: string) {
  const fill = swatchFor(color);
  const light = isLightSwatch(fill);
  return {
    fill,
    light,
    top: lightenHex(fill, light ? 0.16 : 0.22),
    bot: darkenHex(fill, 0.07),
    ink: light ? 'rgba(25,31,40,0.82)' : 'rgba(255,255,255,0.95)',
    border: light ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.26)',
  };
}

/** 각인 글자 크기(viewBox 단위) — 앱 글리프와 같은 규칙 */
export function glyphLabelSize(g: ShapeGeom, label: string): number {
  return (g.shrink ?? 1) * (label.length > 4 ? 12.5 : 15.5);
}

