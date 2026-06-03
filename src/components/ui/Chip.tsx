import type { ReactNode } from 'react';

interface ChipProps {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** 색 미리보기 스와치 색상(선택) */
  swatch?: string;
}

/** 선택형 칩 (색/모양/프리셋 공용). 토글 동작. */
export function Chip({ selected, onToggle, children, swatch }: ChipProps) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={selected}
      onClick={onToggle}
    >
      {swatch && <span className="chip-swatch" style={{ background: swatch }} />}
      {children}
    </button>
  );
}
