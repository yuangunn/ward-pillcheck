import type { SortMode } from '../../domain/models';

interface Props {
  mode: SortMode;
  onChange: (mode: SortMode) => void;
}

const MODE_LABEL: Record<SortMode, string> = {
  manual: '수동 정렬',
  byFrequency: '용법순',
  byTiming: '복용시점순',
};

/** 자동정렬 2버튼 + 현재 정렬 모드 표시. 드래그하면 수동 정렬로 고정됨. */
export function SortControls({ mode, onChange }: Props) {
  return (
    <div className="med-toolbar">
      <span className="sort-status" aria-live="polite">
        {MODE_LABEL[mode]}
      </span>
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
