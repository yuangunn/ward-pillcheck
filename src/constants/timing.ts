import type { TimingCode } from '../domain/models';

/** 복용시점 프리셋 (시간 순서대로 나열) */
export interface TimingPreset {
  code: TimingCode;
  /** 시간 순서 가중치(아침→점심→저녁→자기전, 같은 끼니는 식전→식후). 필요시는 맨 뒤. */
  order: number;
}

export const TIMING_PRESETS: TimingPreset[] = [
  { code: '아침식전', order: 1 },
  { code: '아침식후', order: 2 },
  { code: '점심식전', order: 3 },
  { code: '점심식후', order: 4 },
  { code: '저녁식전', order: 5 },
  { code: '저녁식후', order: 6 },
  { code: '자기전', order: 7 },
  { code: '필요시', order: 99 },
];

const TIMING_ORDER = new Map(TIMING_PRESETS.map((p) => [p.code, p.order]));

/** 복용시점 정렬 가중치. 프리셋 외 자유입력은 자기전 직후(8). */
export function timingOrder(code: TimingCode): number {
  return TIMING_ORDER.get(code) ?? 8;
}
