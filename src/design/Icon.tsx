import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { COLOR_OPTIONS } from '../constants/appearance';

// 라인 SVG 아이콘 세트.
export function Icon({
  name,
  size = 24,
  stroke = 'currentColor',
  sw = 1.9,
  style,
}: {
  name: string;
  size?: number;
  stroke?: string;
  sw?: number;
  style?: CSSProperties;
}) {
  const p = {
    fill: 'none',
    stroke,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<string, ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" {...p} />
        <path d="M20 20l-3.5-3.5" {...p} />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" {...p} />,
    back: <path d="M15 5l-7 7 7 7" {...p} />,
    undo: (
      <>
        <path d="M9 7L4 12l5 5" {...p} />
        <path d="M4 12h10.5a5.5 5.5 0 010 11H10" {...p} />
      </>
    ),
    chevron: <path d="M9 6l6 6-6 6" {...p} />,
    chevDown: <path d="M6 9l6 6 6-6" {...p} />,
    check: <path d="M5 12.5l4.5 4.5L19 7" {...p} />,
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2.5" {...p} />
        <path d="M5 15V6a2 2 0 012-2h9" {...p} />
      </>
    ),
    share: (
      <>
        <path d="M12 3v13" {...p} />
        <path d="M8 7l4-4 4 4" {...p} />
        <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" {...p} />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4L19 9l-4-4L4 16v4z" {...p} />
        <path d="M14 6l4 4" {...p} />
      </>
    ),
    trash: (
      <path
        d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"
        {...p}
      />
    ),
    warn: (
      <>
        <path d="M12 3l9 16H3l9-16z" {...p} />
        <path d="M12 10v4M12 17.5v.5" {...p} />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4.5" {...p} />
        <path
          d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"
          {...p}
        />
      </>
    ),
    moon: <path d="M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z" {...p} />,
    x: <path d="M6 6l12 12M18 6L6 18" {...p} />,
    pill: (
      <>
        <rect x="3.5" y="8" width="17" height="8" rx="4" {...p} />
        <path d="M12 8v8" {...p} />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8" {...p} />
        <path d="M12 8v4l3 2" {...p} />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" {...p} />
        <path d="M9 12l2 2 4-4" {...p} />
      </>
    ),
    dots: (
      <>
        <circle cx="5" cy="12" r="1.6" fill={stroke} stroke="none" />
        <circle cx="12" cy="12" r="1.6" fill={stroke} stroke="none" />
        <circle cx="19" cy="12" r="1.6" fill={stroke} stroke="none" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2.5" {...p} />
        <path d="M8 11V8a4 4 0 018 0v3" {...p} />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 11l5 5 5-5" {...p} />
        <path d="M5 20h14" {...p} />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h8M16 7h4M4 12h4M12 12h8M4 17h12M18 17h2" {...p} />
        <circle cx="14" cy="7" r="2.2" {...p} />
        <circle cx="9" cy="12" r="2.2" {...p} />
        <circle cx="15" cy="17" r="2.2" {...p} />
      </>
    ),
    send: <path d="M21 4L3 11l6 2 2 6 10-15z M9 13l4-4" {...p} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden>
      {paths[name]}
    </svg>
  );
}

// ── 알약 글리프 (색/모양 + 각인) ──────────────────────────────
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

function lightenHex(hex: string, amt: number): string {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return hex;
  const f = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amt);
  };
  return `rgb(${f(0)},${f(2)},${f(4)})`;
}
function darkenHex(hex: string, amt: number): string {
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

interface ShapeGeom {
  el: 'circle' | 'ellipse' | 'rect' | 'path';
  attr: Record<string, number | string>;
  /** 각인 텍스트 세로 위치 */
  ty: number;
  /** 각인 글자 크기 배율(꼭짓점 도형은 안쪽 면적이 좁아 축소) */
  shrink?: number;
}
// 모양별: SVG 노드 + 각인 텍스트 세로 위치
const SHAPE_GEOM: Record<string, ShapeGeom> = {
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
function shapeGeom(shape?: string): ShapeGeom {
  return (shape && SHAPE_GEOM[shape]) || SHAPE_GEOM['원형'];
}
function shapeSvgChild(g: ShapeGeom, props: Record<string, unknown>): ReactNode {
  if (g.el === 'circle') return <circle {...g.attr} {...props} />;
  if (g.el === 'ellipse') return <ellipse {...g.attr} {...props} />;
  if (g.el === 'rect') return <rect {...g.attr} {...props} />;
  return <path {...g.attr} {...props} />;
}

let glyphSeq = 0;

/** 색·모양 채워진 알약 글리프 (각인 포함). SVG 폴리곤으로 11개 도형을 실제 형태로 렌더. */
export function PillGlyph({
  color,
  shape,
  marking,
  size = 56,
}: {
  color?: string;
  shape?: string;
  marking?: string;
  size?: number;
}) {
  const gid = 'pg' + ++glyphSeq;
  const fill = swatchFor(color);
  const light = isLightSwatch(fill);
  const ink = light ? 'rgba(25,31,40,0.82)' : 'rgba(255,255,255,0.95)';
  const border = light ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.26)';
  const g = shapeGeom(shape);
  const label = cleanMark(marking);
  const top = lightenHex(fill, light ? 0.16 : 0.22);
  const bot = darkenHex(fill, 0.07);
  const tSize = (g.shrink ?? 1) * (label.length > 4 ? 12.5 : 15.5);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ flexShrink: 0, display: 'block', filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.16))' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.55" stopColor={fill} />
          <stop offset="1" stopColor={bot} />
        </linearGradient>
      </defs>
      {shapeSvgChild(g, {
        fill: `url(#${gid})`,
        stroke: border,
        strokeWidth: 1.3,
        strokeLinejoin: 'round',
      })}
      {label && (
        <text
          x="50"
          y={g.ty}
          fill={ink}
          fontSize={tSize}
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: 'inherit', letterSpacing: -0.3 }}
        >
          {label}
        </text>
      )}
    </svg>
  );
}

/** 모양 외곽선 아이콘 (칩/미리보기용, 단색 라인) */
export function ShapeOutline({
  shape,
  size = 22,
  stroke = 'currentColor',
  sw = 6,
}: {
  shape?: string;
  size?: number;
  stroke?: string;
  sw?: number;
}) {
  const g = shapeGeom(shape);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ flexShrink: 0, display: 'block' }}
      aria-hidden
    >
      {shapeSvgChild(g, { fill: 'none', stroke, strokeWidth: sw, strokeLinejoin: 'round' })}
    </svg>
  );
}

/** 분할선 글리프: 없음(빈 정제)·일자(—)·십자(+). 정제 원 위에 분할선을 얹어 표현. */
export function SplitLineGlyph({
  kind,
  size = 20,
  stroke = 'currentColor',
  sw = 2,
}: {
  kind: 'none' | 'single' | 'cross';
  size?: number;
  stroke?: string;
  sw?: number;
}) {
  const p = { stroke, strokeWidth: sw, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block' }} aria-hidden>
      <circle cx="12" cy="12" r="9" {...p} opacity={0.35} />
      {kind !== 'none' && <line x1="4.5" y1="12" x2="19.5" y2="12" {...p} />}
      {kind === 'cross' && <line x1="12" y1="4.5" x2="12" y2="19.5" {...p} />}
    </svg>
  );
}

export interface MarkOpt {
  code: string;
  img?: string;
  letter?: string;
}

/** 마크(그림 식별표시). 실데이터는 이미지 URL, 없으면 코드 글자 폴백. */
export function MarkGlyph({ option, size = 44, plain }: { option?: MarkOpt | null; size?: number; plain?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [option?.img]); // img 바뀌면 실패상태 초기화
  if (!option) return null;
  const letter = (
    <span style={{ fontSize: size * 0.36, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>
      {(option.letter || option.code || '').slice(0, 4)}
    </span>
  );
  const inner =
    option.img && !imgFailed ? (
      <img
        src={option.img}
        alt={option.code}
        onError={() => setImgFailed(true)}
        style={{ width: size * 0.84, height: size * 0.84, objectFit: 'contain' }}
        loading="lazy"
      />
    ) : (
      letter
    );
  if (plain) return inner;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(8, size * 0.22),
        flexShrink: 0,
        background: option.img && !imgFailed ? '#fff' : 'var(--fill)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.05)',
      }}
    >
      {inner}
    </div>
  );
}
