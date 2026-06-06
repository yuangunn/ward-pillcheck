// 분할선(score line) 분류. 식약처 LINE_FRONT/LINE_BACK 값:
//   '-' = 일자(한 줄), '+' = 십자, '기타' = 기타(일자에 포함), 그 외/빈값 = 없음.
// 데이터에 가로/세로 방향 정보는 없으므로 단일선은 모두 '일자(—)'로 본다.

export type SplitLineKind = 'none' | 'single' | 'cross';

function kindOf(v?: string): SplitLineKind {
  const x = (v || '').trim();
  if (x === '+') return 'cross';
  if (x === '-' || x === '기타') return 'single';
  return 'none';
}

/** 앞/뒤 분할선 값을 합쳐 종류 판정(십자 우선). */
export function splitLineKind(front?: string, back?: string): SplitLineKind {
  const f = kindOf(front);
  const b = kindOf(back);
  if (f === 'cross' || b === 'cross') return 'cross';
  if (f === 'single' || b === 'single') return 'single';
  return 'none';
}

export const SPLIT_LINE_LABEL: Record<SplitLineKind, string> = {
  none: '없음',
  single: '일자',
  cross: '십자',
};

/** 일자=—, 십자=+ (텍스트 표기용) */
export const SPLIT_LINE_SYMBOL: Record<SplitLineKind, string> = {
  none: '',
  single: '—',
  cross: '+',
};

/** 검색 필터 칩(없음/일자/십자) */
export const SPLIT_LINE_OPTIONS: { value: Exclude<SplitLineKind, 'none'> | 'none'; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'single', label: '일자' },
  { value: 'cross', label: '십자' },
];
