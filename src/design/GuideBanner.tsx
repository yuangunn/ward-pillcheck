// 온보딩 직후 '직접 해보기' 가이드 — 실제 앱을 단계대로 따라 하도록 안내.
// 단계는 App 의 실제 상태(라우트/시트 열림/약 개수)에서 파생되어 자동으로 진행된다.
import { Icon } from './Icon';

export type TourStep = 'patient' | 'search' | 'pick' | 'add' | 'export';

export const TOUR_ORDER: TourStep[] = ['patient', 'search', 'pick', 'add', 'export'];

const COPY: Record<TourStep, { title: string; body: string }> = {
  patient: { title: '환자 추가', body: '아래 “새 환자 추가”를 눌러 익명 환자를 만들어요.' },
  search: { title: '지참약 식별', body: '“약 검색해서 추가”를 눌러 가져온 약을 찾기 시작해요.' },
  pick: { title: '약 찾기', body: '이름·색·모양·각인·마크로 검색해 해당 약을 선택해요.' },
  add: { title: '투약 용법 입력', body: '용량·용법·투약시점을 정하고 “환자 리스트에 추가”를 눌러요.' },
  export: { title: 'Teams로 내보내기', body: '“내보내기”를 눌러 인계 내용을 Teams로 보내봐요.' },
};

export function GuideBanner({ step, onSkip }: { step: TourStep; onSkip: () => void }) {
  const idx = TOUR_ORDER.indexOf(step);
  const c = COPY[step];
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        left: 12,
        right: 12,
        zIndex: 210,
        background: 'var(--primary)',
        color: '#fff',
        borderRadius: 16,
        padding: '12px 14px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        animation: 'toastIn .22s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {idx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.3 }}>{c.title}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.92, letterSpacing: -0.3, lineHeight: 1.4, marginTop: 1 }}>{c.body}</div>
        </div>
        <button
          type="button"
          onClick={onSkip}
          aria-label="가이드 그만하기"
          style={{
            flexShrink: 0,
            border: 'none',
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            borderRadius: 9,
            padding: '6px 10px',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          그만하기
        </button>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 9 }}>
        {TOUR_ORDER.map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background: i <= idx ? '#fff' : 'rgba(255,255,255,0.32)',
              transition: 'background .2s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function GuideDone({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        left: 12,
        right: 12,
        zIndex: 210,
        background: 'var(--primary)',
        color: '#fff',
        borderRadius: 16,
        padding: '12px 14px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        animation: 'toastIn .22s ease',
      }}
    >
      <Icon name="check" size={20} />
      <div style={{ flex: 1, fontSize: 14, fontWeight: 800, letterSpacing: -0.3 }}>다 익혔어요! 이제 실제로 사용해보세요.</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="가이드 닫기"
        style={{ border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 9, padding: '6px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
      >
        닫기
      </button>
    </div>
  );
}
