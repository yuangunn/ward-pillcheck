import type { MedItem, SortMode } from './models';
import { frequencyOrder } from '../constants/frequency';
import { timingOrder } from '../constants/timing';

/**
 * 정렬 모드에 따라 약물 리스트의 표시 순서를 반환.
 * - manual: 저장된 순서 그대로(사용자 드래그 결과)
 * - byFrequency: 용법(1일 횟수) 오름차순, 동순위는 복용시점 시간순
 * - byTiming: 복용시점 시간순, 동순위는 용법순
 * 원본 배열은 변경하지 않는다.
 */
export function sortMeds(meds: MedItem[], mode: SortMode): MedItem[] {
  if (mode === 'manual') return meds;

  const byFreq = (a: MedItem, b: MedItem) => frequencyOrder(a.frequency) - frequencyOrder(b.frequency);
  const byTime = (a: MedItem, b: MedItem) => timingOrder(a.timing) - timingOrder(b.timing);

  const comparator =
    mode === 'byFrequency'
      ? (a: MedItem, b: MedItem) => byFreq(a, b) || byTime(a, b)
      : (a: MedItem, b: MedItem) => byTime(a, b) || byFreq(a, b);

  // 안정 정렬을 위해 createdAt 으로 최종 tie-break
  return [...meds].sort((a, b) => comparator(a, b) || a.createdAt - b.createdAt);
}
