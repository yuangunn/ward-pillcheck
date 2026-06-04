import { useDataset } from '../state/useDataset';

// 번들 데이터셋 상태 표시 + 수동 업데이트. (VITE_API_BASE 설정 시에만 노출)

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ko-KR');
}

export function DatasetBar() {
  const { enabled, status, meta, update } = useDataset();
  if (!enabled) return null;

  const label =
    status === 'loading'
      ? '약품 데이터 준비 중…'
      : status === 'ready'
        ? `약품 데이터 ${meta?.count?.toLocaleString() ?? ''}건 · ${fmtDate(meta?.builtAt)}`
        : status === 'error'
          ? '데이터를 불러오지 못했습니다'
          : status === 'empty'
            ? '데이터가 비어 있습니다(빌드 필요)'
            : '';

  return (
    <div className="dataset-bar">
      <span className="dataset-info">{label}</span>
      <button
        type="button"
        className="dataset-update"
        onClick={() => void update()}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? '…' : '데이터 업데이트'}
      </button>
    </div>
  );
}
