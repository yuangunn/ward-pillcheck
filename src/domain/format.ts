import type { MedItem } from './models';
import {
  freqShareTag,
  freqDetailFamily,
  frequencyOrder,
  isStandardFreq,
} from '../constants/frequency';

/** 정제 수 표시: 1 → "1", 0.5 → "0.5" (JS String 이 이미 불필요한 소수점 없이 처리) */
export function formatTabletCount(count: number): string {
  return String(count);
}

/** 각인 텍스트 정리: 분할선/구분용 대시·언더바 런 → 공백, 연속 공백 → 1칸, 양끝 구분자 제거.
 *  예) "Neurontin®----------300mgVLE" → "Neurontin® 300mgVLE", "DW분할선FX      40" → "DW분할선FX 40" */
export function cleanMarking(s?: string): string {
  if (!s) return '';
  return s
    .replace(/[-_]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s/\-,]+|[\s/\-,]+$/g, '')
    .trim();
}

/** (색/모양/각인) 괄호 묶음. 값이 하나도 없으면 빈 문자열. */
export function formatAppearance(med: Pick<MedItem, 'color' | 'shape' | 'marking'>): string {
  const parts = [med.color, med.shape, cleanMarking(med.marking)].filter(
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
 * 환자 이름/라벨 가운데를 가린다(외부 공유 시 마스킹). 첫·끝 글자만 남기고 나머지는 *.
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

/** 인계 공유 옵션: 성분명·겉모습 포함 여부, 환자 라벨 가리기 */
export interface ShareOpts {
  ingredient?: boolean; // 품목명의 성분 괄호(…) 포함
  appearance?: boolean; // 겉모습(색/모양/각인) 포함
  mask?: boolean; // 환자 라벨 가운데 가리기. 미지정/true=가림(기본), false=원문 노출
}

/** 공유용 약 한 줄: 이름/용량(+옵션에 따라 성분·겉모습) + 메모.
 *  용법(표준 시점 / 비표준 QW·QOD·PRN)은 그룹 헤더가 전담하므로 줄에는 넣지 않는다. */
function shareMedLine(med: MedItem, opts: ShareOpts): string {
  const unit = med.doseUnit || 'T';
  const name = opts.ingredient ? med.name : stripIngredient(med.name);
  const head = `${name} ${formatTabletCount(med.tabletCount)}${unit}`;
  const appearance = opts.appearance === false ? '' : formatAppearance(med);
  const body = appearance ? `${head} ${appearance}` : head;
  const memo = med.memo?.trim() ? ` ※${med.memo.trim()}` : '';
  return `${body}${memo}`;
}

/** 복용시점/용법 패턴으로 묶은 그룹. 화면 텍스트 뷰와 인계 공유가 함께 사용한다. */
export interface TimingGroup {
  timings: string[]; // 정렬된 한글 시점 — 화면 헤더용. 예) ['아침식후','저녁식후']
  header: string; // 인계 텍스트 헤더. 표준 "8am 6pm" / 비표준 "QW/월 8am"
  freqLabel?: string; // 비표준 용법 약어(QW/월 등). 표준 그룹은 없음.
  min: number; // 가장 이른 시점(분) — 그룹 정렬 키
  count: number; // 시점 개수 — 동률 tie-break
  order: number; // 첫 등장 순서 — 동률 tie-break
  meds: MedItem[];
}

/** 표준 용법(QD~QID/HS): 복용시점 패턴별로 묶음. */
function groupByTiming(meds: MedItem[]): TimingGroup[] {
  const groups = new Map<string, TimingGroup>();
  meds.forEach((m, idx) => {
    const slots = m.timings.length ? m.timings : ['시점미정'];
    const sorted = [...new Set(slots)].sort((a, b) => clockMin(a) - clockMin(b));
    const key = sorted.join('|');
    let g = groups.get(key);
    if (!g) {
      g = {
        timings: sorted,
        header: sorted.map(clockLabel).join(' '),
        min: clockMin(sorted[0]),
        count: sorted.length,
        order: idx,
        meds: [],
      };
      groups.set(key, g);
    }
    g.meds.push(m);
  });
  return [...groups.values()].sort(
    (a, b) => a.min - b.min || a.count - b.count || a.order - b.order,
  );
}

/**
 * 비표준 용법(QW/QOD/PRN/기타): 용법 약어별로 별도 섹션 분리.
 * 끼니 시점 그룹에 섞이지 않게 따로 빼서, 주1회 약을 매일 주는 사고를 막는다.
 * 헤더 = 용법 약어 + 복용시점(예 "QW/월 8am"). 필요시/시점미정은 헤더에서 생략.
 */
function groupBySpecialFreq(meds: MedItem[]): TimingGroup[] {
  const groups = new Map<string, TimingGroup>();
  meds.forEach((m, idx) => {
    const tag = freqShareTag(m.frequency) || '기타';
    const slots = m.timings.length ? m.timings : ['시점미정'];
    const sorted = [...new Set(slots)].sort((a, b) => clockMin(a) - clockMin(b));
    const shown = sorted.filter((t) => t !== '필요시' && t !== '시점미정');
    const clock = shown.map(clockLabel).join(' ');
    const key = `${tag}|${sorted.join('|')}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        timings: shown,
        header: clock ? `${tag} ${clock}` : tag,
        freqLabel: tag,
        min: clockMin(sorted[0]),
        count: sorted.length,
        order: idx,
        meds: [],
      };
      groups.set(key, g);
    }
    g.meds.push(m);
  });
  // 용법 순서(QW→QOD→PRN→기타) 후 시점 순.
  const ord = (m: MedItem) => frequencyOrder(freqDetailFamily(m.frequency) ?? m.frequency);
  return [...groups.values()].sort(
    (a, b) => ord(a.meds[0]) - ord(b.meds[0]) || a.min - b.min || a.order - b.order,
  );
}

/**
 * 복약 리스트를 그룹으로 묶어 정렬해 반환.
 * 화면(복약 리스트 텍스트 뷰)과 인계 공유(buildListText)가 동일하게 사용 →
 * "화면에서 보던 그대로" 인계 텍스트가 나간다.
 * 표준 용법은 시점 그룹(앞), 비표준(QW/QOD/PRN/기타)은 용법별 별도 섹션(뒤).
 */
export function groupMedsByTiming(meds: MedItem[]): TimingGroup[] {
  return [
    ...groupByTiming(meds.filter((m) => isStandardFreq(m.frequency))),
    ...groupBySpecialFreq(meds.filter((m) => !isStandardFreq(m.frequency))),
  ];
}

/**
 * 환자 복약 리스트를 인계용 텍스트로 직렬화.
 * - 라벨 가운데 블라인드 처리
 * - 시점 패턴(시계 표기)별로 묶어 시간순 정렬해 출력(화면과 동일한 groupMedsByTiming)
 * - 성분명·용법코드·시점목록은 생략(헤더가 시점을 대신함)
 */
export function buildListText(label: string, meds: MedItem[], opts: ShareOpts = {}): string {
  const head = `[${opts.mask === false ? label.trim() : blindLabel(label)}]`;
  if (!meds.length) return head;
  const blocks = groupMedsByTiming(meds).map(
    (g) => `<${g.header}>\n${g.meds.map((m) => shareMedLine(m, opts)).join('\n')}`,
  );
  return `${head}\n${blocks.join('\n\n')}`;
}
