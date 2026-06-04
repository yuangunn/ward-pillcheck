import type { FrequencyCode } from '../domain/models';

/** 용법 프리셋 정의 */
export interface FrequencyPreset {
  code: FrequencyCode;
  label: string; // 한글 설명 (예: 1일 1회)
  sub: string; // 약어 (예: QD)
  order: number; // 정렬 가중치(오름차순). 비정형은 뒤로.
  slots: number; // 보통 복용시점 칸 수
}

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { code: 'QD', label: '1일 1회', sub: 'QD', order: 1, slots: 1 },
  { code: 'BID', label: '1일 2회', sub: 'BID', order: 2, slots: 2 },
  { code: 'TID', label: '1일 3회', sub: 'TID', order: 3, slots: 3 },
  { code: 'QID', label: '1일 4회', sub: 'QID', order: 4, slots: 4 },
  { code: 'HS', label: '취침전', sub: 'HS', order: 90, slots: 1 },
  { code: 'QOD', label: '격일', sub: 'QOD', order: 91, slots: 1 },
  { code: 'PRN', label: '필요시', sub: 'PRN', order: 99, slots: 1 },
];

/** 용법 코드의 메타(없으면 기본값) */
export function freqMeta(code: FrequencyCode): FrequencyPreset {
  return (
    FREQUENCY_PRESETS.find((f) => f.code === code) ?? {
      code,
      label: code,
      sub: '',
      order: 95,
      slots: 1,
    }
  );
}

/** 용법 정렬 가중치. 프리셋 외 자유입력은 뒤로(95). */
export function frequencyOrder(code: FrequencyCode): number {
  return freqMeta(code).order;
}

/** 용법에 따른 복용시점 입력 칸 수(QD=1, BID=2, TID=3, QID=4, 그 외 1). */
export function timingSlotsForFrequency(code: FrequencyCode): number {
  return freqMeta(code).slots;
}
