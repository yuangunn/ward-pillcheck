import type { SortMode } from '../../domain/models';

interface Props {
  mode: SortMode;
  onChange: (mode: SortMode) => void;
}

/** 자동정렬 2버튼. 수동 정렬 상태면 둘 다 해제 표시. */
export function SortControls({ mode, onChange }: Props) {
  return (
    <div className="med-toolbar">
      <button
        type="button"
        className="sort-btn"
        aria-pressed={mode === 'byFrequency'}
        onClick={() => onChange('byFrequency')}
      >
        용법순
      </button>
      <button
        type="button"
        className="sort-btn"
        aria-pressed={mode === 'byTiming'}
        onClick={() => onChange('byTiming')}
      >
        복용시점순
      </button>
    </div>
  );
}
