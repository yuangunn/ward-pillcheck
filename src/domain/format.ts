import type { MedItem } from './models';

/** 정제 수 표시: 0.5 → "0.5", 1 → "1" (불필요한 소수점 제거) */
export function formatTabletCount(count: number): string {
  return Number.isInteger(count) ? String(count) : String(count);
}

/**
 * 저장 항목 한 줄 표시 포맷:
 *   [품목명] [정수]T [용법] [복용시점] ([색]/[모양]/[각인])
 * 예) 아스피린장용정100mg 1T QD 아침식후 (흰/원형/Bayer)
 */
export function formatMedLine(med: MedItem): string {
  const timing = med.timings.join(',');
  const unit = med.doseUnit || 'T';
  const head = `${med.name} ${formatTabletCount(med.tabletCount)}${unit} ${med.frequency} ${timing}`;
  const appearance = formatAppearance(med);
  return appearance ? `${head} ${appearance}` : head;
}

/**
 * 환자 복약 리스트를 인계용 텍스트로 직렬화.
 * 첫 줄은 [환자라벨], 이후 각 약물을 한 줄 포맷으로. (전달받은 순서 그대로)
 */
export function buildListText(label: string, meds: MedItem[]): string {
  return [`[${label}]`, ...meds.map(formatMedLine)].join('\n');
}

/** (색/모양/각인) 괄호 묶음. 값이 하나도 없으면 빈 문자열. */
export function formatAppearance(med: Pick<MedItem, 'color' | 'shape' | 'marking'>): string {
  const parts = [med.color, med.shape, med.marking].filter(
    (v): v is string => !!v && v.trim() !== '',
  );
  return parts.length ? `(${parts.join('/')})` : '';
}
