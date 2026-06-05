import { useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './ui';

// 첫 실행 온보딩 — 앱 목적 + 검색법 + 설치/오프라인(인트라넷) 안내.
// localStorage 플래그로 1회만 자동 노출(설정에서 다시 보기 가능).

const STEPS: { icon: string; tint: string; title: string; body: string }[] = [
  {
    icon: 'pill',
    tint: '#2f6bff',
    title: '병동 지참약 식별',
    body: '환자가 가져온 약을 색·모양·각인·마크로 거꾸로 찾고, 환자별 복약 리스트로 정리해요. 모든 기록은 이름 없이 이 기기에만 저장됩니다.',
  },
  {
    icon: 'search',
    tint: '#11b386',
    title: '이렇게 찾아요',
    body: '실물(색·모양·각인·마크 그리기)·이름·주사/외용약으로 검색해요. 상단 “의약품 검색” 탭에선 약 정보만 따로 조회하고, 목록의 약 그림을 누르면 상세·실물사진을 봅니다.',
  },
  {
    icon: 'shield',
    tint: '#7c5cff',
    title: '인계까지 한 번에',
    body: '복약 리스트를 한 줄 포맷으로 복사·공유하고, 병용금기·중복을 자동 점검(DUR)해요. 용법·투약시점·용량 단위(정·캡슐·시린지 등)도 함께 기록합니다.',
  },
  {
    icon: 'download',
    tint: '#ff7a3d',
    title: '설치 & 오프라인',
    body: '홈 화면에 추가하면 앱처럼 써요 (iOS: 공유 → “홈 화면에 추가” / Android: 메뉴 → “앱 설치”). ⚙️ 설정에서 “전체 데이터 받기”를 하면 인터넷 없이(병동 인트라넷)도 검색·상세가 됩니다.',
  },
];

export function Onboarding({ onClose, onStartTour }: { onClose: () => void; onStartTour?: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const s = STEPS[i];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사용 가이드"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 260,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 24px calc(env(safe-area-inset-bottom, 0px) + 24px)',
        animation: 'slideFwd .3s cubic-bezier(.32,.72,0,1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-weaker)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', padding: 8, WebkitTapHighlightColor: 'transparent' }}
        >
          {last ? '' : '건너뛰기'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 24 }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: s.tint + '1f', color: s.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={s.icon} size={48} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.6 }}>{s.title}</h2>
          <p style={{ margin: '14px auto 0', maxWidth: 360, fontSize: 15.5, color: 'var(--text-weak)', fontWeight: 600, lineHeight: 1.6, letterSpacing: -0.3 }}>{s.body}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
        {STEPS.map((_, idx) => (
          <span
            key={idx}
            style={{
              width: idx === i ? 22 : 8,
              height: 8,
              borderRadius: 99,
              background: idx === i ? 'var(--primary)' : 'var(--border)',
              transition: 'all .2s ease',
            }}
          />
        ))}
      </div>

      {last ? (
        <>
          <Btn variant="primary" full icon="check" onClick={() => (onStartTour ? onStartTour() : onClose())}>
            직접 해보기
          </Btn>
          <button
            type="button"
            onClick={onClose}
            style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: 'var(--text-weaker)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', padding: 8, WebkitTapHighlightColor: 'transparent' }}
          >
            바로 시작
          </button>
        </>
      ) : (
        <Btn variant="primary" full onClick={() => setI((v) => v + 1)}>
          다음
        </Btn>
      )}
    </div>
  );
}
