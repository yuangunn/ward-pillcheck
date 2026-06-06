import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

// PWA 미지원 인앱 브라우저(카카오톡·네이버앱·인스타 등 웹뷰) 감지 → 외부 브라우저로 열기 유도.
// 인앱 웹뷰는 '홈 화면에 추가/앱 설치'·푸시·일부 저장이 막혀, 기본 브라우저로 빼주는 게 핵심.

export type InAppOs = 'ios' | 'android' | 'other';
type InAppApp =
  | 'kakaotalk'
  | 'naver'
  | 'instagram'
  | 'facebook'
  | 'line'
  | 'daum'
  | 'band'
  | 'kakaostory'
  | 'everytime'
  | null;

export interface InAppInfo {
  inApp: boolean; // 인앱 웹뷰로 판단되는가
  os: InAppOs;
  app: InAppApp; // 식별된 앱(없으면 null)
  label: string; // 사용자 표기용 앱 이름
}

const APP_LABEL: Record<NonNullable<InAppApp>, string> = {
  kakaotalk: '카카오톡',
  naver: '네이버 앱',
  instagram: '인스타그램',
  facebook: '페이스북',
  line: '라인',
  daum: '다음 앱',
  band: '밴드',
  kakaostory: '카카오스토리',
  everytime: '에브리타임',
};

/** UA 기반 인앱 브라우저 + OS 감지. iOS는 오탐 방지를 위해 알려진 앱 토큰만 인정. */
export function detectInApp(): InAppInfo {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const os: InAppOs = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';

  let app: InAppApp = null;
  if (/KAKAOTALK/i.test(ua)) app = 'kakaotalk';
  else if (/KAKAOSTORY/i.test(ua)) app = 'kakaostory';
  else if (/NAVER\(inapp|NAVER\(/i.test(ua)) app = 'naver';
  else if (/Instagram/i.test(ua)) app = 'instagram';
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) app = 'facebook';
  else if (/\bLine\//i.test(ua)) app = 'line';
  else if (/DaumApps/i.test(ua)) app = 'daum';
  else if (/\bBAND\//i.test(ua)) app = 'band';
  else if (/everytimeApp/i.test(ua)) app = 'everytime';

  // 안드로이드 웹뷰('; wv)')는 인앱 신호(크롬 커스텀탭·일반 크롬엔 wv 없음).
  const androidWebView = os === 'android' && /;\s*wv\)/i.test(ua);
  const inApp = !!app || androidWebView;
  const label = app ? APP_LABEL[app] : '인앱';
  return { inApp, os, app, label };
}

function currentUrl(): string {
  return typeof location !== 'undefined' ? location.href : '';
}

/** 안드로이드 intent:// — 특정 브라우저 패키지로 현재 URL 열기(미설치 시 fallback). */
function androidIntent(pkg: string): string {
  const u = new URL(currentUrl());
  const hostPath = `${u.host}${u.pathname}${u.search}`;
  return `intent://${hostPath}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}

async function copyUrl(): Promise<boolean> {
  const url = currentUrl();
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** iOS에서 기본 브라우저(Safari)로 빼기. 직접 호출 스킴이 없어 앱별 우회 + 복사 폴백. */
function openIosDefault(info: InAppInfo, onFlash: (m: string) => void) {
  const url = currentUrl();
  if (info.app === 'kakaotalk' || info.app === 'kakaostory') {
    location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    return;
  }
  if (info.app === 'line') {
    location.href = url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
    return;
  }
  // 그 외 iOS 인앱: Safari 직접 실행 스킴이 없음 → 주소 복사 후 안내
  copyUrl().then((ok) =>
    onFlash(ok ? '주소를 복사했어요. Safari 주소창에 붙여넣어 여세요' : '오른쪽 메뉴(···)에서 “Safari로 열기”를 눌러주세요'),
  );
}

function BannerBtn({
  onClick,
  children,
  primary,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 14.5,
        fontWeight: 800,
        letterSpacing: -0.3,
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: primary ? '#fff' : 'rgba(255,255,255,0.18)',
        color: primary ? '#b54708' : '#fff',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}

/**
 * 인앱 브라우저 상단 안내 배너. OS에 맞는 "외부 브라우저로 열기" 버튼 제공.
 * - iOS: Safari로 열기(카카오/라인은 자동, 그 외 주소 복사)
 * - Android: 삼성 인터넷 / Chrome 으로 열기(intent)
 * onHeight 로 실제 높이를 알려 화면을 그만큼 아래로 민다.
 */
export function InAppBrowserBanner({
  info,
  onFlash,
  onHeight,
  onDismiss,
}: {
  info: InAppInfo;
  onFlash: (m: string) => void;
  onHeight: (h: number) => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onHeight(0);
    };
  }, [onHeight]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="외부 브라우저로 열기 안내"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 150,
        padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 14px',
        background: 'linear-gradient(135deg, #f79009, #e8590c)',
        color: '#fff',
        boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
          <Icon name="warn" size={17} stroke="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.35, wordBreak: 'keep-all' }}>
            {info.label} 안에서는 앱 설치·알림이 안 돼요
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.45, marginTop: 2, opacity: 0.92, wordBreak: 'keep-all' }}>
            아래 버튼으로 기본 브라우저에서 열면 빠르고 안정적이에요.
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="닫기"
          style={{ flexShrink: 0, width: 28, height: 28, marginTop: -2, marginRight: -4, border: 'none', background: 'transparent', color: '#fff', opacity: 0.85, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}
        >
          <Icon name="x" size={18} stroke="#fff" />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {info.os === 'android' ? (
          <>
            <BannerBtn primary onClick={() => (location.href = androidIntent('com.android.chrome'))}>
              <Icon name="share" size={16} stroke="#b54708" /> Chrome으로 열기
            </BannerBtn>
            <BannerBtn onClick={() => (location.href = androidIntent('com.sec.android.app.sbrowser'))}>
              삼성 인터넷으로 열기
            </BannerBtn>
          </>
        ) : info.os === 'ios' ? (
          <BannerBtn primary onClick={() => openIosDefault(info, onFlash)}>
            <Icon name="share" size={16} stroke="#b54708" /> Safari로 열기
          </BannerBtn>
        ) : (
          <BannerBtn primary onClick={() => copyUrl().then((ok) => onFlash(ok ? '주소를 복사했어요. 브라우저에 붙여넣어 여세요' : '브라우저에서 열어주세요'))}>
            <Icon name="copy" size={16} stroke="#b54708" /> 주소 복사해서 열기
          </BannerBtn>
        )}
      </div>
    </div>
  );
}
