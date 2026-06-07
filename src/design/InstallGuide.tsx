import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Btn } from './ui';

// PWA 설치 가이드 — UA로 브라우저(사파리/삼성인터넷/안드로이드 크롬)를 감지해
// 단계별 그림으로 '홈 화면에 추가/앱 설치'를 안내. (비standalone에서 배너 탭 시 오픈)

export type BrowserKind = 'ios' | 'samsung' | 'android' | 'auto';

export function detectBrowser(): Exclude<BrowserKind, 'auto'> {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'ios';
}
const BROWSER_LABEL: Record<string, string> = {
  ios: '아이폰 사파리(Safari)',
  samsung: '삼성 인터넷',
  android: '안드로이드 크롬(Chrome)',
};

// 홈화면 아이콘 재현용 로고
function IgLogo({ size = 48, radius }: { size?: number; radius?: number }) {
  const r = radius != null ? radius : size * 0.23;
  const lensCx = 232,
    lensCy = 224,
    lensR = 132,
    ringW = 36;
  const ang = Math.PI / 4,
    hS = lensR + ringW / 2 - 8,
    hE = lensR + ringW / 2 + 70;
  const hx1 = lensCx + Math.cos(ang) * hS,
    hy1 = lensCy + Math.sin(ang) * hS;
  const hx2 = lensCx + Math.cos(ang) * hE,
    hy2 = lensCy + Math.sin(ang) * hE;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: 'block', borderRadius: r }} aria-hidden>
      <defs>
        <linearGradient id={`iglg${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b78ff" />
          <stop offset="1" stopColor="#2360ee" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx={512 * (r / size)} fill={`url(#iglg${size})`} />
      <line x1={hx1.toFixed(1)} y1={hy1.toFixed(1)} x2={hx2.toFixed(1)} y2={hy2.toFixed(1)} stroke="#fff" strokeWidth="46" strokeLinecap="round" />
      <circle cx={lensCx} cy={lensCy} r={lensR - ringW / 2 - 2} fill="#fff" />
      <g transform={`rotate(-38 ${lensCx} ${lensCy})`}>
        <rect x={lensCx - 86} y={lensCy - 30} width="172" height="60" rx="30" fill="#bcd2ff" />
        <path d={`M ${lensCx - 86} ${lensCy - 30} h 86 v 60 h -86 a30 30 0 0 1 -30 -30 a30 30 0 0 1 30 -30 z`} fill="#fff" />
      </g>
      <circle cx={lensCx} cy={lensCy} r={lensR} fill="none" stroke="#fff" strokeWidth={ringW} />
    </svg>
  );
}

function ShareIcon({ size = 26, color = '#2f6bff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v13" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  );
}
function TapRing({ style }: { style?: CSSProperties }) {
  return <span style={{ position: 'absolute', width: 54, height: 54, borderRadius: '50%', border: '3px solid #f04452', boxShadow: '0 0 0 4px rgba(240,68,82,0.18)', ...style }} />;
}
function Ic({ d, size = 22, color = '#c8cad0' }: { d: ReactNode; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

// ── iOS Safari ──────────────────────────────────────────────
function StepShot1() {
  return (
    <div style={{ position: 'relative', background: '#1c1c1e', borderRadius: 16, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.8)' }}>‹</div>
      <div style={{ flex: 1, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.75)', fontSize: 13, fontWeight: 600 }}>yuangunn.github.io</div>
      <div style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShareIcon size={22} color="#2f6bff" />
        <TapRing style={{ left: -8, top: -8 }} />
      </div>
    </div>
  );
}
function StepShot2() {
  const row = (icon: ReactNode, label: string, hi?: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 10, background: hi ? 'rgba(240,68,82,0.12)' : 'transparent', border: hi ? '2px solid #f04452' : '2px solid transparent' }}>
      <span style={{ fontSize: 14, fontWeight: hi ? 800 : 600, color: hi ? '#f04452' : '#e8eaed', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: hi ? '#f04452' : '#8a8d93', display: 'flex' }}>{icon}</span>
    </div>
  );
  const plus = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
  const star = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4l2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 16l-4.6 2.4.9-5.1L4.6 9.5l5.2-.8z" />
    </svg>
  );
  const book = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 5h11a2 2 0 012 2v12H7a2 2 0 01-2-2z" />
    </svg>
  );
  return (
    <div style={{ position: 'relative', background: '#2a2a2c', borderRadius: 16, padding: 8 }}>
      {row(star, '즐겨찾기에 추가')}
      {row(book, '책갈피 추가')}
      {row(plus, '홈 화면에 추가', true)}
    </div>
  );
}
function StepShot3() {
  return (
    <div style={{ position: 'relative', background: '#2a2a2c', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#8a8d93' }}>취소</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>홈 화면에 추가</span>
        <span style={{ position: 'relative', fontSize: 14, fontWeight: 800, color: '#f04452' }}>
          추가
          <TapRing style={{ left: -16, top: -16, width: 46, height: 46 }} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px' }}>
        <IgLogo size={44} radius={10} />
        <div style={{ flex: 1, height: 34, borderRadius: 8, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', padding: '0 12px', color: '#fff', fontSize: 13, fontWeight: 700 }}>지참약 식별</div>
      </div>
    </div>
  );
}
function StepShot4() {
  const ghost = (i: number) => <div key={i} style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(255,255,255,.16)' }} />;
  return (
    <div style={{ position: 'relative', background: 'linear-gradient(160deg,#5b7cc4,#3a5a9e)', borderRadius: 16, padding: '16px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px 14px', justifyItems: 'center' }}>
        {ghost(0)}
        {ghost(1)}
        {ghost(2)}
        {ghost(3)}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <IgLogo size={46} radius={11} />
          <TapRing style={{ top: -4, left: '50%', marginLeft: -27, width: 54, height: 54 }} />
        </div>
        {ghost(5)}
        {ghost(6)}
        {ghost(7)}
      </div>
      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.92)' }}>지참약 식별</div>
    </div>
  );
}

// ── 삼성 인터넷 ─────────────────────────────────────────────
function SamShot1() {
  const ic = (d: ReactNode) => <Ic d={d} color="rgba(255,255,255,.8)" />;
  return (
    <div style={{ position: 'relative', background: '#1c1c1e', borderRadius: 16, padding: '14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {ic(<path d="M15 5l-7 7 7 7" />)}
      {ic(<path d="M9 5l7 7-7 7" />)}
      {ic(
        <>
          <path d="M4 11l8-7 8 7" />
          <path d="M6 10v9h12v-9" />
        </>,
      )}
      {ic(
        <>
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M9 9h6v6H9z" />
        </>,
      )}
      <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <TapRing style={{ right: -8, top: -8 }} />
      </div>
    </div>
  );
}
function SamShot2() {
  const cell = (label: string, hi: boolean, d: ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 12, background: hi ? 'rgba(240,68,82,0.12)' : 'transparent', border: hi ? '2px solid #f04452' : '2px solid transparent', position: 'relative' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={hi ? '#f04452' : '#c8cad0'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {d}
      </svg>
      <span style={{ fontSize: 11, fontWeight: hi ? 800 : 600, color: hi ? '#f04452' : '#c8cad0', whiteSpace: 'nowrap', lineHeight: 1.2, textAlign: 'center', wordBreak: 'keep-all' }}>{label}</span>
      {hi && <TapRing style={{ right: 2, top: 2, width: 44, height: 44 }} />}
    </div>
  );
  return (
    <div style={{ background: '#2a2a2c', borderRadius: 16, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
      {cell('새 탭', false, <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 9v6M9 12h6" /></>)}
      {cell('북마크', false, <path d="M6 4h12v16l-6-4-6 4z" />)}
      {cell('다운로드', false, <><path d="M12 4v10M8 11l4 4 4-4" /><path d="M5 19h14" /></>)}
      {cell('현재 페이지 추가', true, <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7" /><path d="M16 3h5v5M21 3l-7 7" /></>)}
      {cell('기록', false, <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>)}
      {cell('설정', false, <><circle cx="12" cy="12" r="3" /><path d="M5 12H3M21 12h-2M12 5V3M12 21v-2" /></>)}
    </div>
  );
}
function SamShot3() {
  return (
    <div style={{ background: '#2a2a2c', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#fff', borderBottom: '1px solid rgba(255,255,255,.1)' }}>페이지 추가</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(240,68,82,0.12)', border: '2px solid #f04452', borderRadius: 12, margin: 8, position: 'relative' }}>
        <IgLogo size={34} radius={8} />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#f04452' }}>홈 화면</span>
        <TapRing style={{ left: -6, top: -6, width: 44, height: 44 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 14px 22px' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#c8cad0' }}>빠른 실행 / 북마크</span>
      </div>
    </div>
  );
}

// ── 안드로이드 크롬 ─────────────────────────────────────────
function ChromeShot1() {
  const dots = (
    <>
      <circle cx="12" cy="5" r="1.5" fill="#202124" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="#202124" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="#202124" stroke="none" />
    </>
  );
  return (
    <div style={{ position: 'relative', background: '#202124', borderRadius: 16, padding: '12px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0, height: 30, borderRadius: 15, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', padding: '0 12px', color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap' }}>yuangunn.github.io</div>
      <Ic d={<path d="M12 4l2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 16l-4.6 2.4.9-5.1L4.6 9.5l5.2-.8z" />} size={20} color="rgba(255,255,255,.7)" />
      <Ic d={<><path d="M12 3v13" /><path d="M8 7l4-4 4 4" /><path d="M6 13v6a2 2 0 002 2h8a2 2 0 002-2v-6" /></>} size={20} color="rgba(255,255,255,.7)" />
      <div style={{ position: 'relative', width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24">{dots}</svg>
        <TapRing style={{ right: -9, top: -9 }} />
      </div>
    </div>
  );
}
function ChromeShot2() {
  const row = (label: string, d: ReactNode, hi?: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: hi ? 'rgba(240,68,82,0.12)' : 'transparent', border: hi ? '2px solid #f04452' : '2px solid transparent', position: 'relative' }}>
      <Ic d={d} size={20} color={hi ? '#f04452' : '#c8cad0'} />
      <span style={{ fontSize: 13.5, fontWeight: hi ? 800 : 600, color: hi ? '#f04452' : '#e8eaed', whiteSpace: 'nowrap' }}>{label}</span>
      {hi && <TapRing style={{ left: 4, top: -7, width: 44, height: 44 }} />}
    </div>
  );
  return (
    <div style={{ background: '#2a2a2c', borderRadius: 16, padding: 8 }}>
      {row('다운로드', <><path d="M12 4v10M8 11l4 4 4-4" /><path d="M5 19h14" /></>, false)}
      {row('북마크', <path d="M6 4h12v16l-6-4-6 4z" />, false)}
      {row('홈 화면에 추가', <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M12 8v6M9 11l3 3 3-3" /></>, true)}
      {row('설정', <><circle cx="12" cy="12" r="3" /><path d="M5 12H3M21 12h-2M12 5V3" /></>, false)}
    </div>
  );
}
function ChromeShot3() {
  return (
    <div style={{ background: '#2a2a2c', borderRadius: 16, overflow: 'hidden', padding: 8 }}>
      <div style={{ textAlign: 'center', padding: '8px 0 12px', fontSize: 13, fontWeight: 700, color: '#fff' }}>홈 화면에 추가</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, background: 'rgba(240,68,82,0.12)', border: '2px solid #f04452' }}>
        <IgLogo size={32} radius={8} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#f04452' }}>설치</span>
        <span style={{ color: '#f04452', fontSize: 18 }}>›</span>
        <TapRing style={{ left: -4, top: -6, width: 44, height: 44 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
        <IgLogo size={32} radius={8} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e8eaed' }}>바로가기 만들기</span>
          <br />
          <span style={{ fontSize: 11, color: '#8a8d93' }}>Chrome에서 바로가기 열기</span>
        </span>
        <span style={{ color: '#8a8d93', fontSize: 18 }}>›</span>
      </div>
    </div>
  );
}
function ChromeShot4() {
  return (
    <div style={{ background: '#2a2a2c', borderRadius: 16, padding: '16px 16px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>앱 설치</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <IgLogo size={38} radius={9} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>병동 지참약 식별</div>
          <div style={{ fontSize: 11.5, color: '#8a8d93', marginTop: 2 }}>yuangunn.github.io</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 24 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#8a8d93' }}>취소</span>
        <span style={{ position: 'relative', fontSize: 13.5, fontWeight: 800, color: '#f04452' }}>
          설치
          <TapRing style={{ left: -16, top: -16, width: 46, height: 46 }} />
        </span>
      </div>
    </div>
  );
}

interface Step {
  shot: () => ReactNode;
  title: string;
  body: string;
}
const IG_STEPS_IOS: Step[] = [
  { shot: StepShot1, title: '아래 ‘공유’ 버튼을 누르세요', body: '화면 맨 아래(또는 위) 줄에 있는 🔼 네모에 위 화살표 모양 버튼이에요.' },
  { shot: StepShot2, title: '‘홈 화면에 추가’를 누르세요', body: '목록이 나오면 손가락으로 위로 쓸어올려 찾으세요. ⊕ 모양 옆에 있어요.' },
  { shot: StepShot3, title: '오른쪽 위 ‘추가’를 누르세요', body: '이름은 그대로 두고 오른쪽 위 파란 ‘추가’만 누르면 돼요.' },
  { shot: StepShot4, title: '홈 화면 아이콘으로 여세요', body: '이제 홈 화면에 ‘지참약 식별’ 아이콘이 생겼어요. 다음부터는 이 아이콘으로 열면 앱처럼 빠르게 켜져요.' },
];
const IG_STEPS_SAMSUNG: Step[] = [
  { shot: SamShot1, title: '아래 ‘메뉴(≡)’를 누르세요', body: '화면 맨 아래 줄 오른쪽 끝의 줄 세 개(≡) 모양 버튼이에요.' },
  { shot: SamShot2, title: '‘현재 페이지 추가’를 누르세요', body: '메뉴가 열리면 아이콘 중에서 ‘현재 페이지 추가’를 찾아 누르세요.' },
  { shot: SamShot3, title: '‘홈 화면’을 고르고 추가하세요', body: '추가할 위치 중 ‘홈 화면’을 고른 뒤 ‘추가’를 누르면 돼요.' },
  { shot: StepShot4, title: '홈 화면 아이콘으로 여세요', body: '이제 홈 화면에 ‘지참약 식별’ 아이콘이 생겼어요. 다음부터는 이 아이콘으로 열면 앱처럼 빠르게 켜져요.' },
];
const IG_STEPS_ANDROID: Step[] = [
  { shot: ChromeShot1, title: '오른쪽 위 ‘⋮ 메뉴’를 누르세요', body: '주소창 오른쪽 끝에 있는 점 세 개(⋮) 모양 버튼이에요.' },
  { shot: ChromeShot2, title: '‘홈 화면에 추가’를 누르세요', body: '메뉴 목록을 위로 쓸어올려 ‘홈 화면에 추가’를 찾아 누르세요.' },
  { shot: ChromeShot3, title: '‘설치’를 누르세요', body: '두 가지가 나오면 위쪽 ‘설치’를 누르세요. 앱처럼 전체 화면으로 켜져요.' },
  { shot: ChromeShot4, title: '‘앱 설치’ 창에서 ‘설치’', body: '마지막으로 팝업의 오른쪽 ‘설치’를 누르면, 홈 화면과 앱 목록에 추가돼요.' },
];

export function InstallGuide({ open, onClose, browser }: { open: boolean; onClose: () => void; browser?: BrowserKind }) {
  const b = browser && browser !== 'auto' ? browser : detectBrowser();
  const [tab, setTab] = useState<Exclude<BrowserKind, 'auto'>>(b);
  if (!open) return null;
  const steps = tab === 'samsung' ? IG_STEPS_SAMSUNG : tab === 'android' ? IG_STEPS_ANDROID : IG_STEPS_IOS;
  return (
    <div role="dialog" aria-modal="true" aria-label="앱 설치 가이드" style={{ position: 'absolute', inset: 0, zIndex: 280, background: 'var(--bg)', display: 'flex', flexDirection: 'column', animation: 'slideFwd .3s cubic-bezier(.32,.72,0,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--danger-weak)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="download" size={19} />
          </div>
          <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.5, whiteSpace: 'nowrap' }}>앱으로 설치하기</span>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--fill)', color: 'var(--text-weak)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={20} />
        </button>
      </div>

      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '16px 20px 24px' }}>
        {/* 브라우저 선택 칩(자동 감지 + 수동 전환) */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 16 }}>
          {(['ios', 'samsung', 'android'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              style={{
                flex: 1,
                padding: '9px 6px',
                borderRadius: 'var(--r-chip)',
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: -0.3,
                cursor: 'pointer',
                border: tab === k ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                background: tab === k ? 'var(--primary-weak)' : 'var(--card)',
                color: tab === k ? 'var(--primary-ink)' : 'var(--text-weak)',
                WebkitTapHighlightColor: 'transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {k === 'ios' ? '사파리' : k === 'samsung' ? '삼성인터넷' : '크롬'}
            </button>
          ))}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: -0.4, lineHeight: 1.5, wordBreak: 'keep-all' }}>
          <b style={{ color: 'var(--text-strong)' }}>{BROWSER_LABEL[tab]}</b> 기준이에요.
          <br />
          아래 <b style={{ color: 'var(--danger)' }}>빨간 표시</b>를 순서대로 따라 누르면 끝나요.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }}>
          {steps.map((s, i) => {
            const Shot = s.shot;
            return (
              <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow-sm)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                  <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.5, lineHeight: 1.25, wordBreak: 'keep-all' }}>{s.title}</span>
                </div>
                <Shot />
                <p style={{ margin: '12px 2px 0', fontSize: 14, fontWeight: 600, color: 'var(--text-weak)', letterSpacing: -0.3, lineHeight: 1.55, wordBreak: 'keep-all' }}>{s.body}</p>
              </div>
            );
          })}
        </div>
        {tab === 'samsung' && (
          <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 'var(--r-card)', background: 'var(--danger-weak)', fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            <b style={{ color: 'var(--danger)' }}>⚠️ “안전하지 않은 앱 차단됨” 경고가 떠도 괜찮아요</b>
            <br />
            삼성 인터넷이 만든 설치 파일이 <b>오래된 안드로이드 기준</b>으로 표시돼 Google Play 프로텍트가 띄우는 <b>정상 경고</b>예요(이 웹사이트를 감싼 것뿐, 위험한 앱이 아니에요).
            <br />→ <b>‘무시하고 설치하기’</b>를 누르면 설치돼요. 경고 없이 설치하려면 위에서 <b>‘크롬’</b> 탭으로 설치하세요.
          </div>
        )}
        <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 'var(--r-card)', background: 'var(--primary-weak)', fontSize: 13, fontWeight: 600, color: 'var(--primary-ink)', lineHeight: 1.55, wordBreak: 'keep-all' }}>
          💡 다른 브라우저는 메뉴에서 <b>‘홈 화면에 추가’</b> 또는 <b>‘앱 설치’</b>를 누르면 돼요. (아이폰은 사파리, 갤럭시는 <b>크롬 권장</b> · 삼성인터넷도 가능)
        </div>
      </div>

      <div style={{ padding: '8px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)', borderTop: '1px solid var(--border)' }}>
        <Btn variant="primary" full icon="check" onClick={onClose}>
          따라 했어요 · 닫기
        </Btn>
      </div>
    </div>
  );
}
