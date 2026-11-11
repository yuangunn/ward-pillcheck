import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cleanMark, darkenHex, isLightSwatch, lightenHex, shapeGeom, swatchFor, type ShapeGeom } from './pillShape';

export { swatchFor, cleanMark, isLightSwatch };

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
    print: (
      <>
        <path d="M7 9V4h10v5" {...p} />
        <path d="M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2" {...p} />
        <path d="M7 14h10v6H7z" {...p} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden>
      {paths[name]}
    </svg>
  );
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
        crossOrigin="anonymous"
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
