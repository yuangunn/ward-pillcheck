import { useEffect, useRef, useState } from 'react';
import { BottomSheet, Btn } from './ui';
import { Icon } from './Icon';
import {
  detailsStatus,
  downloadDetails,
  clearDetails,
  durBundleStatus,
  downloadDur,
  clearDur,
  downloadPhotos,
  cachedPhotoCount,
  clearPhotos,
} from '../api';
import { useDataset } from '../state/useDataset';

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

export function SettingsSheet({ open, onClose, onFlash }: { open: boolean; onClose: () => void; onFlash?: (m: string) => void }) {
  const ds = useDataset();
  const [det, setDet] = useState<Stat | null>(null);
  const [dur, setDur] = useState<Stat | null>(null);
  const [usage, setUsage] = useState('');
  const [busy, setBusy] = useState('');
  const [photos, setPhotos] = useState(0);
  const [photoProg, setPhotoProg] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);

  const refresh = async () => {
    setDet(await detailsStatus());
    setDur(await durBundleStatus());
    setPhotos(await cachedPhotoCount());
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
    try {
      setBusy('검색 데이터 최신화…');
      await ds.update();
      setBusy('허가사항 상세 받는 중…');
      await downloadDetails();
      setBusy('금기점검(DUR) 받는 중…');
      await downloadDur();
      setBusy('');
      await refresh();
      onFlash?.('오프라인 데이터 다운로드 완료');
    } catch {
      setBusy('');
      onFlash?.('다운로드 실패 — 네트워크를 확인하세요');
    }
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
        받아두면 <b style={{ color: 'var(--text-strong)' }}>인터넷 없이(인트라넷)</b> 도 검색·상세·금기점검이 됩니다. (실물사진 제외)
      </p>

      <div style={{ padding: '4px 14px', borderRadius: 'var(--r-card)', background: 'var(--fill)', marginBottom: 16 }}>
        <Row label="약품 검색(낱알·주사·외용·마크)" value={ds.meta ? `${ds.meta.count.toLocaleString()}건` : ds.enabled ? '미수신' : '데모'} ok={!!ds.meta?.count} />
        <Row label="허가사항 상세(효능·용법·주의)" value={det?.downloaded ? `${det.count.toLocaleString()}건 · ${fmtDate(det.builtAt)}` : '미다운로드'} ok={!!det?.downloaded} />
        <Row label="금기점검(DUR) 룰셋" value={dur?.downloaded ? `${dur.count.toLocaleString()}품목` : '미다운로드'} ok={!!dur?.downloaded} />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-weaker)' }}>
          <span>기기 사용 용량</span>
          <span>{usage || '—'}</span>
        </div>
      </div>

      <Btn variant="primary" full icon="download" onClick={downloadAll} disabled={!!busy || !ds.enabled}>
        {busy || '전체 의약품 데이터 받기 (오프라인용)'}
      </Btn>
      {!ds.enabled && (
        <p style={{ margin: '10px 2px 0', fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600 }}>데모 모드에선 받을 데이터가 없어요(배포본에서 동작).</p>
      )}

      <button
        type="button"
        onClick={clearAll}
        disabled={!!busy}
        style={{ display: 'block', width: '100%', marginTop: 12, padding: '12px 0', background: 'none', border: 'none', color: 'var(--danger)', fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        오프라인 상세·DUR 캐시 비우기
      </button>

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
        <Btn variant="ghost" full icon="download" onClick={getPhotos} disabled={!!busy || !ds.enabled}>
          실물사진 받기 (대용량)
        </Btn>
      )}
      {photos > 0 && !photoProg && (
        <button type="button" onClick={removePhotos} style={{ display: 'block', width: '100%', marginTop: 10, padding: '8px 0', background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          실물사진 캐시 비우기
        </button>
      )}

      <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 'var(--r-card)', background: 'var(--primary-weak)', fontSize: 12.5, color: 'var(--primary-ink)', fontWeight: 600, lineHeight: 1.55 }}>
        💡 병동 인트라넷에서 쓰려면: 인터넷이 되는 곳에서 위 버튼으로 한 번 받아두면, 이후 폐쇄망/오프라인에서도 그대로 동작해요.
      </div>
    </BottomSheet>
  );
}
