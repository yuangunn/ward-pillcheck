import type { FrequencyCode } from '../domain/models';

/** 용법 프리셋 정의 */
export interface FrequencyPreset {
  code: FrequencyCode;
  label: string; // 칩에 표시할 한글 설명
  /** 1일 투여 횟수 기반 정렬 가중치(오름차순). 비정형은 뒤로(99). */
  order: number;
}

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { code: 'QD', label: 'QD · 1일 1회', order: 1 },
  { code: 'BID', label: 'BID · 1일 2회', order: 2 },
  { code: 'TID', label: 'TID · 1일 3회', order: 3 },
  { code: 'QID', label: 'QID · 1일 4회', order: 4 },
  { code: 'HS', label: 'HS · 취침전', order: 90 },
  { code: 'QOD', label: 'QOD · 격일', order: 91 },
  { code: 'PRN', label: 'PRN · 필요시', order: 99 },
];

const FREQ_ORDER = new Map(FREQUENCY_PRESETS.map((p) => [p.code, p.order]));

/** 용법 정렬 가중치. 프리셋 외 자유입력은 뒤로(95). */
export function frequencyOrder(code: FrequencyCode): number {
  return FREQ_ORDER.get(code) ?? 95;
}
