import { useEffect, useRef, useState } from 'react';
import { BottomSheet, Btn } from './ui';
import { Icon } from './Icon';
import {
  detailsStatus,
  downloadDetails,
  clearDetails,
  downloadDur,
  durBundleStatus,
  clearDur,
  downloadPhotos,
  cachedPhotoCount,
  clearPhotos,
} from '../api';
import { onDatasetProgress } from '../api/dataset';
import { useWorkerReachable } from '../state/connectivity';
import { useDataset } from '../state/useDataset';
import { getTeamsTarget, setTeamsTarget, getAllowedDomains, setAllowedDomains, isAllowedTeamsTarget, TEAMS_TARGET_GUIDE } from '../state/teamsTarget';
import { getEmbedMode, setEmbedMode } from '../api/markEmbed';
import { getCollectMode, setCollectMode, sampleCount, exportSamples, clearSamples } from '../state/drawSamples';

// 내려받기 용량(배포본 기준 근사) — 사용자 안내용.
const DL_PILLS_MB = 11; // pills.json
const DL_DETAIL_MB = 137; // details.json.gz(압축)
const DL_TOTAL_LABEL = '약 150MB'; // 검색 11MB + 상세 137MB + 금기 룰셋(DUR) 0.7MB
const STORE_TOTAL_LABEL = '약 600MB'; // 해제 후 IndexedDB 사용량 근사

// 오프라인/인트라넷용 설정: 검색 + 허가사항 상세 + DUR 룰셋을 기기에 받아두기.
// 받아두면 워커(공용 인터넷) 없이도 검색·상세·금기점검이 동작한다.

type Stat = { downloaded: boolean; count: number; builtAt?: string };
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '—');

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: ok ? 'var(--primary-ink)' : 'var(--text-weaker)' }}>
        {ok && <Icon name="check" size={15} />}
        {value}
      </span>
    </div>
  );
}

export function SettingsSheet({ open, onClose, onFlash, onShowGuide }: { open: boolean; onClose: () => void; onFlash?: (m: string) => void; onShowGuide?: () => void }) {
  const ds = useDataset();
  const online = useWorkerReachable() !== false; // 워커(인터넷) 연결 — 실물사진 받기 가능 여부
  const [det, setDet] = useState<Stat | null>(null);
  const [dur, setDur] = useState<Stat | null>(null);
  const [usage, setUsage] = useState('');
  const [prog, setProg] = useState<{ label: string; pct: number } | null>(null);
  const [dlErr, setDlErr] = useState<'net' | 'detail' | 'dur' | null>(null);
  const [photos, setPhotos] = useState(0);
  const downloading = !!prog;
  const [photoProg, setPhotoProg] = useState<{ done: number; total: number } | null>(null);
  const [teams, setTeams] = useState(getTeamsTarget());
  const [allowed, setAllowed] = useState(getAllowedDomains().join(', '));
  const teamsInvalid = teams.trim().length > 0 && !isAllowedTeamsTarget(teams);
  const [embed, setEmbed] = useState(getEmbedMode());
  const [collect, setCollect] = useState(getCollectMode());
  const [sampleN, setSampleN] = useState(0);
  const stopRef = useRef(false);

  // 수집한 그림 표본을 JSON 파일로 내려받기(학습 파이프라인 투입용)
  const exportDraw = async () => {
    const samples = await exportSamples();
    if (!samples.length) {
      onFlash?.('수집된 그림이 없어요');
      return;
    }
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), samples }, null, 0)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ward-pillcheck-draw-samples-${samples.length}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onFlash?.(`${samples.length}건 내보냈어요`);
  };

  const refresh = async () => {
    setDet(await detailsStatus());
    setDur(await durBundleStatus());
    setPhotos(await cachedPhotoCount());
    setSampleN(await sampleCount());
    try {
      const e = await navigator.storage?.estimate?.();
      if (e?.usage != null) setUsage(`${(e.usage / 1048576).toFixed(0)} MB`);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const downloadAll = async () => {
    setDlErr(null);
    // 1/3 검색 데이터(낱알 pills.json) — updateDataset 은 실패해도 throw 하지 않고 'error' 반환
    const L1 = '검색 데이터(낱알) 받는 중… (1/3)';
    setProg({ label: L1, pct: 0 });
    const unsub = onDatasetProgress((f) => setProg({ label: L1, pct: Math.round(f * 100) }));
    let pillsOk = false;
    try {
      pillsOk = (await ds.update()) !== 'error';
    } catch {
      pillsOk = false;
    }
    unsub();
    if (!pillsOk) {
      setProg(null);
      setDlErr('net');
      await refresh();
      onFlash?.('받기 실패 — 인터넷 연결을 확인하세요');
      return;
    }
    // 2/3 허가사항 상세(details.json.gz ~137MB)
    try {
      await downloadDetails((f) => setProg({ label: `허가사항 상세 받는 중… (${DL_DETAIL_MB}MB · 2/3)`, pct: Math.round(f * 100) }));
    } catch {
      setProg(null);
      setDlErr('detail');
      await refresh();
      onFlash?.('상세 받기 실패 — 잠시 후 다시 시도해 주세요');
      return;
    }
    // 3/3 금기점검(DUR) 룰셋
    try {
      await downloadDur((f) => setProg({ label: '금기점검(DUR) 룰셋 받는 중… (3/3)', pct: Math.round(f * 100) }));
    } catch {
      setProg(null);
      setDlErr('dur');
      await refresh();
      onFlash?.('금기 룰셋 받기 실패 — 잠시 후 다시 시도해 주세요');
      return;
    }
    setProg(null);
    await refresh();
    onFlash?.('오프라인 데이터 다운로드 완료');
  };
  const clearAll = async () => {
    await clearDetails();
    await clearDur();
    await refresh();
    onFlash?.('오프라인 상세·DUR 캐시를 비웠어요');
  };

  const getPhotos = async () => {
    stopRef.current = false;
    setPhotoProg({ done: 0, total: 0 });
    await downloadPhotos((p) => setPhotoProg(p), () => stopRef.current);
    setPhotoProg(null);
    await refresh();
    onFlash?.(stopRef.current ? '사진 받기를 멈췄어요' : '실물사진 받기 완료');
  };
  const removePhotos = async () => {
    await clearPhotos();
    await refresh();
    onFlash?.('실물사진 캐시를 비웠어요');
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="설정" maxH="90%">
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, marginBottom: 4 }}>오프라인 데이터</div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-weak)', fontWeight: 600, lineHeight: 1.5 }}>
        받아두면 <b style={{ color: 'var(--text-strong)' }}>인터넷 없이(인트라넷)</b> 도 검색·상세·금기점검이 됩니다. (실물사진은 온라인)
      </p>

      <div style={{ padding: '4px 14px', borderRadius: 'var(--r-card)', background: 'var(--fill)', marginBottom: 16 }}>
        <Row label={`약품 검색(낱알·주사·외용·마크) · ${DL_PILLS_MB}MB`} value={ds.meta ? `${ds.meta.count.toLocaleString()}건` : ds.enabled ? '미수신' : '데모'} ok={!!ds.meta?.count} />
        <Row label={`허가사항 상세(효능·용법·주의) · ${DL_DETAIL_MB}MB`} value={det?.downloaded ? `${det.count.toLocaleString()}건 · ${fmtDate(det.builtAt)}` : '미다운로드'} ok={!!det?.downloaded} />
        <Row label="금기점검(DUR) 룰셋" value={dur?.downloaded ? `${dur.count.toLocaleString()}품목 · ${fmtDate(dur.builtAt)}` : '미다운로드'} ok={!!dur?.downloaded} />
        <Row label="실물사진" value="온라인 전용" />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-weaker)' }}>
          <span>기기 사용 용량</span>
          <span>{usage || '—'}</span>
        </div>
      </div>

      {prog ? (
        <div style={{ padding: '14px 16px', borderRadius: 'var(--r-card)', background: 'var(--fill)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{prog.label}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary-ink)' }}>{prog.pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${prog.pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 999, transition: 'width .25s ease' }} />
          </div>
          <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--text-weaker)', fontWeight: 600 }}>받는 중에는 창을 닫지 마세요 · 전체 {DL_TOTAL_LABEL}</p>
        </div>
      ) : (
        <Btn variant="primary" full icon="download" onClick={downloadAll} disabled={downloading || !ds.enabled}>
          전체 의약품 데이터 받기 · {DL_TOTAL_LABEL}
        </Btn>
      )}
      {!ds.enabled && (
        <p style={{ margin: '10px 2px 0', fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600 }}>데모 모드에선 받을 데이터가 없어요(배포본에서 동작).</p>
      )}

      {dlErr && !prog && (
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 'var(--r-card)', background: 'var(--danger-weak)', fontSize: 12.5, color: 'var(--text)', fontWeight: 600, lineHeight: 1.6, wordBreak: 'keep-all' }}>
          {dlErr === 'net' ? (
            <>
              <b style={{ color: 'var(--danger)' }}>❌ 받기 실패 — 데이터 서버(인터넷)에 연결할 수 없어요.</b>
              <br />
              인트라넷·폐쇄망에서는 받을 수 없어요. <b>인터넷이 되는 곳(휴대폰 데이터 등)</b>에서 한 번 받아두면, 이후 인트라넷에서도 동작합니다.
            </>
          ) : dlErr === 'detail' ? (
            <>
              <b style={{ color: 'var(--danger)' }}>❌ 상세({DL_DETAIL_MB}MB) 받기에 실패했어요.</b>
              <br />
              검색 데이터는 받았어요. 연결이 끊겼을 수 있으니 잠시 후 다시 시도해 주세요.
            </>
          ) : (
            <>
              <b style={{ color: 'var(--danger)' }}>❌ 금기점검(DUR) 룰셋 받기에 실패했어요.</b>
              <br />
              검색·상세는 받았어요. 연결이 끊겼을 수 있으니 잠시 후 다시 시도해 주세요.
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={clearAll}
        disabled={downloading}
        style={{ display: 'block', width: '100%', marginTop: 12, padding: '12px 0', background: 'none', border: 'none', color: 'var(--danger)', fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        오프라인 상세·DUR 캐시 비우기
      </button>

      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 'var(--r-card)', background: 'var(--primary-weak)', fontSize: 12.5, color: 'var(--primary-ink)', fontWeight: 600, lineHeight: 1.55, wordBreak: 'keep-all' }}>
        💡 병동 인트라넷에서 쓰려면: <b>인터넷이 되는 곳</b>에서 위 버튼으로 한 번 받아두세요(내려받기 {DL_TOTAL_LABEL} → 기기 저장 {STORE_TOTAL_LABEL}). 이후 폐쇄망/오프라인에서도 검색·상세·금기점검이 동작해요. (실물사진은 온라인에서만)
      </div>

      {/* 선택: 실물사진(대용량) */}
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, margin: '24px 0 4px' }}>실물사진 (선택 · 대용량)</div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-weak)', fontWeight: 600, lineHeight: 1.5 }}>
        본 사진은 자동 저장돼요. 전부 미리 받으면 <b style={{ color: 'var(--text-strong)' }}>수 GB</b> 라 와이파이 권장. 식약처에서 폰으로 직접 받습니다.
        <br />
        <span style={{ color: 'var(--text-weaker)' }}>캐시된 사진 {photos.toLocaleString()}장</span>
      </p>
      {photoProg ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 'var(--r-btn)', background: 'var(--fill)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            받는 중 {photoProg.done.toLocaleString()}{photoProg.total ? ` / ${photoProg.total.toLocaleString()}` : ''}
          </div>
          <Btn variant="danger" onClick={() => (stopRef.current = true)} style={{ height: 50 }}>중단</Btn>
        </div>
      ) : (
        <Btn variant="ghost" full icon="download" onClick={getPhotos} disabled={downloading || !ds.enabled || !online}>
          {online ? '실물사진 받기 (대용량)' : '실물사진 받기 (인터넷 필요)'}
        </Btn>
      )}
      {photos > 0 && !photoProg && (
        <button type="button" onClick={removePhotos} style={{ display: 'block', width: '100%', marginTop: 10, padding: '8px 0', background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          실물사진 캐시 비우기
        </button>
      )}

      {/* Teams 인계 보내기 대상(병동별) */}
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, margin: '24px 0 4px' }}>Teams 인계 보내기</div>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-weak)', fontWeight: 600, lineHeight: 1.5 }}>
        인계 “Teams로 보내기”가 열 <b style={{ color: 'var(--text-strong)' }}>대상 이메일</b>(공용계정/그룹채팅). 병동마다 바꿀 수 있어요.
      </p>
      <input
        type="email"
        inputMode="email"
        value={teams}
        onChange={(e) => {
          const v = e.target.value;
          setTeams(v);
          // 허용 도메인(.ac.kr/.ac 또는 등록 병원 도메인)일 때만 저장. 그 외엔 보관 안 함.
          setTeamsTarget(!v.trim() || isAllowedTeamsTarget(v) ? v : '');
        }}
        placeholder="예) ward3-handover@hospital.ac.kr"
        aria-label="Teams 대상 이메일"
        style={{ width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 'var(--r-btn)', border: `1.5px solid ${teamsInvalid ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--fill)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, letterSpacing: -0.3, outline: 'none' }}
      />
      {teamsInvalid && (
        <p role="alert" style={{ margin: '6px 2px 0', fontSize: 12.5, color: 'var(--danger)', fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.45 }}>
          {TEAMS_TARGET_GUIDE}
        </p>
      )}

      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.3, margin: '14px 0 4px' }}>허용 병원 도메인 추가</div>
      <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--text-weak)', fontWeight: 600, lineHeight: 1.5 }}>
        대학·대학병원(<b>.ac.kr</b>/<b>.ac</b>)은 기본 허용돼요. 그 외 우리 병원 도메인이 있으면 쉼표로 추가하세요. (예: snuh.org)
      </p>
      <input
        type="text"
        inputMode="email"
        value={allowed}
        onChange={(e) => {
          setAllowed(e.target.value);
          setAllowedDomains(e.target.value);
        }}
        placeholder="예) snuh.org, amc.seoul.kr"
        aria-label="허용 병원 도메인"
        style={{ width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 'var(--r-btn)', border: '1.5px solid var(--border)', background: 'var(--fill)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, letterSpacing: -0.3, outline: 'none' }}
      />

      {/* 실험: ONNX 임베딩 마크 매칭 (옵트인) */}
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, margin: '24px 0 4px' }}>실험 기능</div>
      <button
        type="button"
        role="switch"
        aria-checked={embed}
        aria-label="AI 임베딩 마크 매칭"
        onClick={() => { const v = !embed; setEmbed(v); setEmbedMode(v); }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 'var(--r-card)', background: 'var(--fill)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
      >
        <span style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 999, background: embed ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background .2s' }}>
          <span style={{ position: 'absolute', top: 3, left: embed ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>그려서 찾기 — AI 임베딩(ONNX)</span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-weaker)', lineHeight: 1.45, marginTop: 2 }}>
            켜면 그려서찾기가 <b>학습된 온디바이스 AI 모델</b>로 매칭해요. 강화 학습으로 다양·왜곡된 손그림에도 강건(합성 벤치 98%+ vs 기본 HOG 15~32%)하지만 이 수치는 합성 한정이라, 실제 손그림 체감은 확인 중이에요(⚠️ 실험적). 켤 때 모델(~12.6MB) 1회 로드(인터넷 필요).
          </span>
        </span>
      </button>

      {/* 그림 데이터 수집(옵트인) — 향후 학습용 진짜 손그림 모으기 */}
      <button
        type="button"
        role="switch"
        aria-checked={collect}
        aria-label="그림 데이터 수집"
        onClick={() => { const v = !collect; setCollect(v); setCollectMode(v); }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginTop: 10, padding: '12px 14px', borderRadius: 'var(--r-card)', background: 'var(--fill)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
      >
        <span style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 999, background: collect ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background .2s' }}>
          <span style={{ position: 'absolute', top: 3, left: collect ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>그림 데이터 수집(학습용)</span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-weaker)', lineHeight: 1.45, marginTop: 2 }}>
            켜면 그려서찾기에서 그린 그림과 <b>고른 마크</b>를 이 기기에 모아요(개인정보 아님·서버 전송 없음). 모이면 AI 학습에 쓸 수 있어요. 현재 <b>{sampleN}</b>건.
          </span>
        </span>
      </button>
      {sampleN > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Btn variant="secondary" onClick={exportDraw} style={{ flex: 1, height: 44, fontSize: 14 }}>내보내기({sampleN})</Btn>
          <Btn variant="line" onClick={async () => { await clearSamples(); setSampleN(0); onFlash?.('수집 그림을 지웠어요'); }} style={{ flex: '0 0 auto', height: 44, fontSize: 14, color: 'var(--danger)', borderColor: 'var(--danger-weak)' }}>지우기</Btn>
        </div>
      )}

      {onShowGuide && (
        <button
          type="button"
          onClick={onShowGuide}
          style={{ display: 'block', width: '100%', marginTop: 16, padding: '12px 0', background: 'none', border: 'none', color: 'var(--text-weak)', fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          사용 가이드 다시 보기
        </button>
      )}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 12, color: 'var(--text-weaker)', fontWeight: 600, letterSpacing: -0.2 }}>
        Made by{' '}
        <a
          href="https://github.com/yuangunn"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--primary-ink)', fontWeight: 700, textDecoration: 'none' }}
        >
          yuangunn
        </a>
      </div>
    </BottomSheet>
  );
}
