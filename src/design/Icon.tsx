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
  const fill = swatchFor(color);
  const light = isLightSwatch(fill);
  const ink = light ? 'rgba(25,31,40,0.78)' : 'rgba(255,255,255,0.95)';
  const border = light ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.25)';
  let w = size;
  let h = size;
  let br = size / 2;
  if (shape === '타원형' || shape === '장방형') {
    h = size * 0.66;
    br = h / 2;
  } else if (shape === '사각형' || shape === '마름모형') {
    br = size * 0.18;
  } else if (shape === '기타' || shape === '반원형') {
    br = size * 0.3;
  }
  const label = cleanMark(marking);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: w,
          height: h,
          borderRadius: br,
          background: fill,
          border: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: shape === '마름모형' ? 'rotate(45deg)' : 'none',
          boxShadow: light
            ? 'inset 0 -3px 6px rgba(0,0,0,0.06)'
            : 'inset 0 -3px 6px rgba(0,0,0,0.18)',
        }}
      >
        <span
          style={{
            fontSize: Math.max(8, size * 0.155),
            fontWeight: 700,
            color: ink,
            letterSpacing: -0.3,
            transform: shape === '마름모형' ? 'rotate(-45deg)' : 'none',
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          {label}
        </span>
      </div>
    </div>
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
