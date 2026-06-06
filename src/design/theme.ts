// Toss 스타일 디자인 토큰 (디자인 핸드오프 반영). 라이트/다크 CSS 변수 + 테마 훅.
import { useEffect, useState } from 'react';

const PRIMARY = '#2f6bff';

/**
 * 상태줄(iOS 16.4+ standalone PWA·브라우저 chrome) 색을 현재 화면색과 맞춘다.
 * theme-color 메타를 동적으로 갱신 → 온보딩 파란 화면 등에서 상태줄과 경계가 안 생김.
 */
export function setThemeColor(color: string): void {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** 테마에 따른 CSS 변수 묶음 (앱 셸 style 에 펼쳐 적용) */
export function buildTokens(dark: boolean): Record<string, string> {
  const p = PRIMARY;
  const base = {
    '--font':
      "'Pretendard Variable', Pretendard, -apple-system, system-ui, 'Apple SD Gothic Neo', sans-serif",
    '--r-card': '20px',
    '--r-btn': '16px',
    '--r-chip': '12px',
    '--primary': dark ? lighten(p, 0.12) : p,
    '--primary-weak': dark ? rgba(p, 0.22) : rgba(p, 0.1),
    '--primary-ink': dark ? lighten(p, 0.3) : p,
  };
  const light = {
    '--bg': '#ffffff',
    '--card': '#ffffff',
    '--fill': '#f2f4f6',
    '--border': '#edeff2',
    '--text-strong': '#191f28',
    '--text': '#333d4b',
    '--text-weak': '#6b7684',
    '--text-weaker': '#98a0ab',
    '--danger': '#f04452',
    '--danger-weak': '#fdecee',
    '--warn': '#f59e0b',
    '--warn-ink': '#b45c00',
    '--warn-weak': '#fff5e6',
    '--ok': '#12b886',
    '--ok-weak': '#e6f8f1',
    '--shadow-sm': `0 1px 2px ${rgba('#191f28', 0.04)}, 0 4px 16px ${rgba('#191f28', 0.05)}`,
  };
  const darkTok = {
    '--bg': '#16181d',
    '--card': '#1f222a',
    '--fill': '#262a33',
    '--border': 'rgba(255,255,255,0.09)',
    '--text-strong': '#f3f5f8',
    '--text': '#d6dbe2',
    '--text-weak': '#9aa3af',
    '--text-weaker': '#6c7480',
    '--danger': '#ff6b78',
    '--danger-weak': 'rgba(240,68,82,0.18)',
    '--warn': '#fbb454',
    '--warn-ink': '#fbb454',
    '--warn-weak': 'rgba(245,158,11,0.16)',
    '--ok': '#34d39e',
    '--ok-weak': 'rgba(18,184,134,0.16)',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.18), 0 6px 18px rgba(0,0,0,0.22)',
  };
  return { ...base, ...(dark ? darkTok : light) };
}

const THEME_KEY = 'ward-pillcheck:theme';

export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });
  useEffect(() => {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#16181d' : '#ffffff');
    document.body.style.background = dark ? '#16181d' : '#ffffff';
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}
