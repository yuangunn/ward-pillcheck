import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Icon, PillGlyph } from './Icon';

/**
 * 화면별 스크롤 영역. 헤더는 바깥(고정)에 두고 이 안의 리스트만 스크롤되게 한다.
 * (flex:1 영역을 채우는 단일 스크롤러 + 내장 "맨 위로" 버튼)
 * bottomGap: 하단 고정 액션바 높이만큼 "맨 위로" 버튼을 띄움.
 */
export function ScrollArea({ children, bottomGap = 16 }: { children: ReactNode; bottomGap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div
        ref={ref}
        className="screen-scroll"
        onScroll={(e) => setShowTop((e.currentTarget as HTMLDivElement).scrollTop > 500)}
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
      >
        {children}
      </div>
      {showTop && (
        <button
          type="button"
          aria-label="맨 위로"
          onClick={() => ref.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'absolute',
            right: 16,
            bottom: bottomGap,
            zIndex: 55,
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--text)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Icon name="chevDown" size={22} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}
    </div>
  );
}
import { proxiedImg } from '../api';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'line';

export function Btn({
  variant = 'primary',
  children,
  onClick,
  disabled,
  full,
  style,
  icon,
  ariaLabel,
  type = 'button',
}: {
  variant?: BtnVariant;
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  style?: CSSProperties;
  icon?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
}) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 17,
    lineHeight: 1,
    borderRadius: 'var(--r-btn)',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    padding: '0 20px',
    height: 54,
    width: full ? '100%' : undefined,
    transition: 'transform .12s ease, background .15s ease, opacity .15s',
    opacity: disabled ? 0.45 : 1,
    WebkitTapHighlightColor: 'transparent',
    letterSpacing: -0.3,
    whiteSpace: 'nowrap',
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'var(--primary)', color: '#fff' },
    secondary: { background: 'var(--primary-weak)', color: 'var(--primary-ink)' },
    ghost: { background: 'var(--fill)', color: 'var(--text)' },
    danger: { background: 'var(--danger-weak)', color: 'var(--danger)' },
    line: { background: 'transparent', color: 'var(--text-weak)', border: '1.5px solid var(--border)' },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      onPointerDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.97)';
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function Chip({
  selected,
  children,
  onClick,
  style,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        fontFamily: 'inherit',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: -0.3,
        whiteSpace: 'nowrap',
        padding: '10px 16px',
        borderRadius: 'var(--r-chip)',
        cursor: 'pointer',
        border: selected ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
        background: selected ? 'var(--primary-weak)' : 'var(--card)',
        color: selected ? 'var(--primary-ink)' : 'var(--text-weak)',
        transition: 'all .12s ease',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ColorChip({
  option,
  selected,
  onClick,
}: {
  option: { label: string; swatch: string };
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={option.label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: option.swatch,
          border: selected ? '3px solid var(--primary)' : '1.5px solid var(--border)',
          boxShadow: selected ? '0 0 0 3px var(--primary-weak)' : 'inset 0 -3px 5px rgba(0,0,0,0.06)',
          transition: 'all .12s ease',
        }}
      />
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          color: selected ? 'var(--primary-ink)' : 'var(--text-weak)',
        }}
      >
        {option.label}
      </span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  step = 0.5,
  min = 0.5,
  max = 10,
  unit = 'T',
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const btn = (label: string, fn: () => void, disabled: boolean, aria: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={fn}
      aria-label={aria}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: 'var(--fill)',
        color: 'var(--text)',
        fontSize: 22,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {btn('−', () => onChange(Math.max(min, +(value - step).toFixed(1))), value <= min, '감소')}
      <div
        style={{ minWidth: 64, textAlign: 'center', fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}
      >
        {value}
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-weak)', marginLeft: 2 }}>{unit}</span>
      </div>
      {btn('+', () => onChange(Math.min(max, +(value + step).toFixed(1))), value >= max, '증가')}
    </div>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxH = '86%',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxH?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    } else {
      setShow(false);
      const t = setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', opacity: show ? 1 : 0, transition: 'opacity .28s ease' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'relative',
          background: 'var(--bg)',
          borderRadius: '24px 24px 0 0',
          maxHeight: maxH,
          display: 'flex',
          flexDirection: 'column',
          transform: show ? 'translateY(0)' : 'translateY(102%)',
          transition: 'transform .3s cubic-bezier(.32,.72,0,1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
          <div style={{ width: 40, height: 5, borderRadius: 99, background: 'var(--border)' }} />
        </div>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 6px' }}>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.5, whiteSpace: 'nowrap' }}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--fill)',
                color: 'var(--text-weak)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        )}
        <div className="screen-scroll" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '6px 20px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SegTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--fill)', borderRadius: 14 }}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 11,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: -0.3,
            background: value === t.value ? 'var(--card)' : 'transparent',
            color: value === t.value ? 'var(--text-strong)' : 'var(--text-weaker)',
            boxShadow: value === t.value ? 'var(--shadow-sm)' : 'none',
            transition: 'all .15s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 96,
        transform: 'translateX(-50%)',
        zIndex: 300,
        background: 'rgba(25,31,40,0.94)',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: 14,
        fontSize: 14.5,
        fontWeight: 600,
        letterSpacing: -0.3,
        whiteSpace: 'nowrap',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        animation: 'toastIn .25s ease',
      }}
    >
      {msg}
    </div>
  );
}

export interface ZoomPill {
  itemName: string;
  color?: string;
  drugShape?: string;
  marking?: string;
  imageUrl?: string;
}

export function Lightbox({ pill, onClose }: { pill: ZoomPill | null; onClose: () => void }) {
  const [show, setShow] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    if (pill) {
      setImgFailed(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    } else setShow(false);
  }, [pill]);
  if (!pill) return null;
  const ap = [pill.color, pill.drugShape, pill.marking].filter(Boolean).join(' · ');
  const realImg = pill.imageUrl && !imgFailed ? proxiedImg(pill.imageUrl) : undefined;
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="이미지 확대"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 400,
        background: 'rgba(8,9,12,0.94)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
        opacity: show ? 1 : 0,
        transition: 'opacity .2s ease',
        padding: 24,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        style={{
          position: 'absolute',
          top: 'max(54px, env(safe-area-inset-top))',
          right: 18,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.16)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="x" size={22} />
      </button>
      <div style={{ transform: show ? 'scale(1)' : 'scale(0.86)', transition: 'transform .26s cubic-bezier(.32,.72,0,1)' }}>
        {realImg ? (
          <img
            src={realImg}
            alt={pill.itemName}
            onError={() => setImgFailed(true)}
            style={{ width: 280, height: 280, maxWidth: '80vw', maxHeight: '50vh', objectFit: 'contain', borderRadius: 20, background: '#fff' }}
          />
        ) : (
          <PillGlyph color={pill.color} shape={pill.drugShape} marking={pill.marking} size={228} />
        )}
      </div>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>{pill.itemName}</div>
        {ap && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginTop: 6 }}>{ap}</div>}
        {pill.imageUrl && (
          <a
            href={proxiedImg(pill.imageUrl)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-block', marginTop: 12, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'underline', opacity: 0.9 }}
          >
            실물 사진 새 탭에서 보기 ↗
          </a>
        )}
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 14 }}>
          아무 곳이나 탭하면 닫혀요
        </div>
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  autoFocus,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
} & Record<string, unknown>) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        height: 54,
        padding: '0 16px',
        borderRadius: 'var(--r-btn)',
        border: '1.5px solid var(--border)',
        background: 'var(--fill)',
        color: 'var(--text)',
        fontSize: 16,
        fontFamily: 'inherit',
        fontWeight: 600,
        letterSpacing: -0.3,
        outline: 'none',
      }}
      {...rest}
    />
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone?: 'primary' }) {
  const styles =
    tone === 'primary'
      ? { background: 'var(--primary-weak)', color: 'var(--primary-ink)' }
      : { background: 'var(--fill)', color: 'var(--text-weak)' };
  return (
    <span
      style={{ fontSize: 12.5, fontWeight: 700, padding: '3px 9px', borderRadius: 8, letterSpacing: -0.2, whiteSpace: 'nowrap', ...styles }}
    >
      {children}
    </span>
  );
}

export const STATUS_TOP = 'max(20px, env(safe-area-inset-top))';

export function PageHeader({
  title,
  sub,
  onBack,
  right,
  onTitleClick,
}: {
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: ReactNode;
  onTitleClick?: () => void;
}) {
  return (
    <div style={{ padding: `calc(${STATUS_TOP} + 8px) 20px 8px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40 }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로"
            style={{
              width: 40,
              height: 40,
              marginLeft: -8,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon name="back" size={26} />
          </button>
        ) : (
          <div style={{ width: 32, height: 40 }} />
        )}
        <div style={{ display: 'flex', gap: 6 }}>{right}</div>
      </div>
      {onTitleClick ? (
        <button
          type="button"
          onClick={onTitleClick}
          aria-label="이름 수정"
          style={{
            margin: '6px 0 0',
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--text-strong)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 27, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.25 }}>{title}</span>
          <Icon name="chevron" size={22} style={{ color: 'var(--text-weaker)', marginTop: 3 }} />
        </button>
      ) : (
        <h1 style={{ margin: '6px 0 0', fontSize: 27, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.8, lineHeight: 1.25 }}>
          {title}
        </h1>
      )}
      {sub && <p style={{ margin: '7px 0 0', fontSize: 15, color: 'var(--text-weak)', letterSpacing: -0.3, lineHeight: 1.45 }}>{sub}</p>}
    </div>
  );
}

export function IconBtn({ name, onClick, active, label }: { name: string; onClick?: () => void; active?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--primary-weak)' : 'var(--fill)',
        color: active ? 'var(--primary-ink)' : 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon name={name} size={21} />
    </button>
  );
}
