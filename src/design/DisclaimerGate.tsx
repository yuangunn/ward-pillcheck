import { useEffect, useState } from 'react';
import { usesDataset } from '../api';
import { preloadDataset, onDatasetProgress } from '../api/dataset';
import { Icon } from './Icon';

// 첫 실행 게이트: 사용상 주의·면책을 보여주고, 그 사이 약 정보(대용량)를 미리 받는다.
// 로딩이 끝나야(진행바가 다 차면) "이해했습니다"가 활성화된다. — 검은 화면 먹통 방지.

const NOTES: { icon: string; text: string }[] = [
  { icon: 'warn', text: '이 앱은 지참약 식별을 돕는 보조 도구예요. 최종 확인은 약 포장·처방전·약사/의사를 통해 하세요.' },
  { icon: 'search', text: '색·모양·각인으로 찾은 결과는 참고용이며, 실제와 다를 수 있어요.' },
  { icon: 'shield', text: '식약처 공개정보를 가공해 제공하며 최신성·정확성을 보장하지 않아요. 진단·처방·투약 결정을 대체하지 않습니다.' },
  { icon: 'lock', text: '모든 기록은 이 기기에만 저장되고 서버로 보내지 않아요. 공유할 땐 환자 이름이 자동으로 가려지지만(홍*동), 병동·약과 합치면 식별될 수 있어요 — 병원 공식 채널로만 공유하세요.' },
];

export function DisclaimerGate({ onAck }: { onAck: () => void }) {
  const [frac, setFrac] = useState(usesDataset ? 0 : 1);
  const [ready, setReady] = useState(!usesDataset);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!usesDataset) return; // 데모(목) 모드: 받을 데이터 없음 → 즉시 활성화
    const off = onDatasetProgress((f) => setFrac(f));
    let alive = true;
    preloadDataset()
      .then((status) => {
        if (!alive) return;
        if (status === 'error') setFailed(true);
        setFrac(1);
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setFrac(1);
        setReady(true);
      });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const pct = Math.round(frac * 100);
  const statusText = ready
    ? failed
      ? '데이터를 받지 못했어요 — 네트워크 연결 후 다시 시도할 수 있어요'
      : '준비 완료'
    : `약 정보를 준비하고 있어요 · ${pct}%`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사용 전 확인"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 400,
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'calc(env(safe-area-inset-top, 0px) + 28px) 24px calc(env(safe-area-inset-bottom, 0px) + 22px)',
        animation: 'slideFwd .3s cubic-bezier(.32,.72,0,1)',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="screen-scroll">
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-ink)', letterSpacing: 0.2, marginBottom: 6 }}>
          사용 전 꼭 확인하세요
        </div>
        <h1 style={{ margin: '0 0 18px', fontSize: 25, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.6, lineHeight: 1.3 }}>
          안전한 사용을 위한
          <br />
          주의사항·면책
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {NOTES.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: 'var(--fill)', color: 'var(--text-weak)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <Icon name={n.icon} size={18} />
              </div>
              <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3, lineHeight: 1.5, wordBreak: 'keep-all' }}>
                {n.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 진행도 + 동의 버튼 (하단 고정) */}
      <div style={{ flexShrink: 0, paddingTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: failed ? 'var(--danger)' : 'var(--text-weak)', letterSpacing: -0.3 }}>
            {statusText}
          </span>
          {!ready && (
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-ink)' }}>{pct}%</span>
          )}
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          style={{ height: 8, borderRadius: 999, background: 'var(--fill)', overflow: 'hidden', marginBottom: 16 }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 999,
              background: failed ? 'var(--danger)' : 'var(--primary)',
              transition: 'width .25s ease',
            }}
          />
        </div>
        <button
          type="button"
          onClick={onAck}
          disabled={!ready}
          style={{
            width: '100%',
            height: 54,
            borderRadius: 'var(--r-btn)',
            border: 'none',
            cursor: ready ? 'pointer' : 'default',
            fontFamily: 'inherit',
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: -0.3,
            color: '#fff',
            background: ready ? 'var(--primary)' : 'var(--fill)',
            opacity: ready ? 1 : 0.55,
            transition: 'background .2s, opacity .2s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {ready ? '이해했습니다' : '잠시만요…'}
        </button>
      </div>
    </div>
  );
}
