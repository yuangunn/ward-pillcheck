// 로딩/에러/빈 결과 공용 표시 컴포넌트.

export function Spinner({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="center-state">
      <div className="spinner" aria-hidden />
      <div>{label}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="center-state">
      <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
      <div style={{ marginBottom: 12 }}>{message}</div>
      {onRetry && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="center-state">{message}</div>;
}
