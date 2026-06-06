import type { MedItem } from './models';

/** 정제 수 표시: 0.5 → "0.5", 1 → "1" (불필요한 소수점 제거) */
export function formatTabletCount(count: number): string {
  return Number.isInteger(count) ? String(count) : String(count);
}

/** (색/모양/각인) 괄호 묶음. 값이 하나도 없으면 빈 문자열. */
export function formatAppearance(med: Pick<MedItem, 'color' | 'shape' | 'marking'>): string {
  const parts = [med.color, med.shape, med.marking].filter(
    (v): v is string => !!v && v.trim() !== '',
  );
  return parts.length ? `(${parts.join('/')})` : '';
}

/**
 * 저장 항목 한 줄 표시 포맷(상세형):
 *   [품목명] [정수]T [용법] [투약시점] ([색]/[모양]/[각인])
 * 예) 아스피린장용정100mg 1T QD 아침식후 (흰/원형/Bayer)
 */
export function formatMedLine(med: MedItem): string {
  const timing = med.timings.join(',');
  const unit = med.doseUnit || 'T';
  const head = `${med.name} ${formatTabletCount(med.tabletCount)}${unit} ${med.frequency} ${timing}`;
  const appearance = formatAppearance(med);
  return appearance ? `${head} ${appearance}` : head;
}

// ── 인계 공유 포맷(개인정보 보호 + 시점 범주화) ────────────────

/**
 * 환자 라벨 가운데를 가린다(실명 저장 대비). 첫·끝 글자만 남기고 나머지는 *.
 * 예) 환자1 → 환*1, 김철수 → 김*수
 */
export function blindLabel(label: string): string {
  const s = label.trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + '*';
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}

/** 품목명에서 성분 괄호(…)를 제거. 예) 트라젠타정(리나글립틴) → 트라젠타정 */
export function stripIngredient(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * 허가사항 본문 가독성 정리: 줄 끝 공백 제거 + 빈 줄 2줄 이상을 1줄로 압축 + 양끝 트림.
 * (허가/e약은요 원문은 블록 태그가 줄바꿈으로 풀리며 빈 줄이 과도하게 쌓이는 경우가 많음)
 */
export function tidyText(s: string): string {
  return (s || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t ]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 투약시점 → 시계 표기 및 정렬용 분(minute). 매핑 없는 시점(필요시/자유입력)은 라벨 그대로·맨 뒤.
const TIMING_CLOCK: Record<string, string> = {
  아침식전: '7am',
  아침식후: '8am',
  점심식전: '12pm',
  점심식후: '1pm',
  저녁식전: '5pm',
  저녁식후: '6pm',
  자기전: '9pm',
};
const TIMING_MIN: Record<string, number> = {
  아침식전: 7 * 60,
  아침식후: 8 * 60,
  점심식전: 12 * 60,
  점심식후: 13 * 60,
  저녁식전: 17 * 60,
  저녁식후: 18 * 60,
  자기전: 21 * 60,
};
const LATE = 99999; // 매핑 없는 시점 정렬 위치(맨 뒤)

const clockLabel = (t: string): string => TIMING_CLOCK[t] ?? t;
const clockMin = (t: string): number => TIMING_MIN[t] ?? LATE;

/** 공유용 약 한 줄: 성분·용법·시점 제거, 이름/용량/겉모습만 */
function shareMedLine(med: MedItem): string {
  const unit = med.doseUnit || 'T';
  const head = `${stripIngredient(med.name)} ${formatTabletCount(med.tabletCount)}${unit}`;
  const appearance = formatAppearance(med);
  return appearance ? `${head} ${appearance}` : head;
}

interface ShareGroup {
  header: string; // 예) "8am 1pm 6pm"
  min: number; // 가장 이른 시점(분)
  count: number; // 시점 개수
  order: number; // 첫 등장 순서(동률 tie-break)
  lines: string[];
}

/**
 * 환자 복약 리스트를 인계용 텍스트로 직렬화.
 * - 라벨 가운데 블라인드 처리
 * - 시점 패턴(시계 표기)별로 묶어 시간순 정렬해 출력
 * - 성분명·용법코드·시점목록은 생략(헤더가 시점을 대신함)
 */
export function buildListText(label: string, meds: MedItem[]): string {
  const head = `[${blindLabel(label)}]`;
  if (!meds.length) return head;

  const groups = new Map<string, ShareGroup>();
  meds.forEach((m, idx) => {
    const slots = m.timings.length ? m.timings : ['시점미정'];
    const sorted = [...new Set(slots)].sort((a, b) => clockMin(a) - clockMin(b));
    const header = sorted.map(clockLabel).join(' ');
    let g = groups.get(header);
    if (!g) {
      g = { header, min: clockMin(sorted[0]), count: sorted.length, order: idx, lines: [] };
      groups.set(header, g);
    }
    g.lines.push(shareMedLine(m));
  });

  const ordered = [...groups.values()].sort(
    (a, b) => a.min - b.min || a.count - b.count || a.order - b.order,
  );
  const blocks = ordered.map((g) => `<${g.header}>\n${g.lines.join('\n')}`);
  return `${head}\n${blocks.join('\n\n')}`;
}
