import type { MedItem } from '../domain/models';
import {
  cleanMarking,
  formatEnglishName,
  formatTabletCount,
  groupMedsByTiming,
  stripIngredient,
} from '../domain/format';
import { freqDetailFamily, freqShareTag, isStandardFreq } from '../constants/frequency';
import { splitCrushCaution } from '../domain/formulation';
import type { SafetyResult } from '../api/safety';

// A4 출력용 지참약 확인표의 내용 모델(순수 함수).
// ⚠ 환자 이름·병상번호(라벨)는 입력으로 받지 않는다 — PDF 는 폰 공유 창(외부 앱 포함)으로
//    나가므로 환자 식별정보를 담지 않고, 종이에 환자 바코드를 직접 붙여 식별한다.

export interface PrintMed {
  no: number; // 1부터, 표 전체 일련번호
  name: string; // 품목명(성분 괄호는 성분 줄로 옮김)
  sub: string; // 한글 성분 · 영문 품목명
  memo: string; // 메모(특이사항)
  warn: string; // 분할·분쇄 금지 배지 문구('' = 없음)
  appearance: string; // '하양 / 원형 / Bayer' (없으면 '')
  dose: string; // 1회 용량 예) 1T, 10U
  freq: string; // 용법 예) QD, BID, QW/월, PRN/통증 시
  imageUrl?: string; // 식약처 낱알 사진(원본 URL)
}

export interface PrintGroup {
  title: string; // 인계 텍스트 헤더와 같은 표기 예) 8am 6pm, QW/월 8am
  note: string; // 한글 보조 설명 예) 아침식후 · 저녁식후
  special: boolean; // 비표준 용법(QW/QOD/PRN/기타) — 강조 테두리
  meds: PrintMed[];
}

export interface PrintSafetyItem {
  tag: string; // 병용금기 / 성분중복 / 분할·분쇄 주의 / 노인주의 …
  strong: boolean; // 반전(검정) 태그 — 위험도 높음
  title: string;
  body: string;
}

export interface PrintSafety {
  level: 'issues' | 'clear' | 'unchecked';
  headline: string; // 확인 필요 2건 / 특이사항 없음 / DUR 미점검
  sub: string; // 점검 범위·시각
  items: PrintSafetyItem[];
}

export interface PrintModel {
  createdAt: Date;
  medCount: number;
  groups: PrintGroup[];
  safety: PrintSafety;
  dbDate?: string; // 식약처 데이터 기준일(YYYY-MM-DD)
}

export interface PrintLookups {
  ingrKo?: Map<string, string>; // itemSeq → 한글 주성분
  eng?: Map<string, string>; // itemSeq → 영문 품목명
  forms?: Map<string, string>; // itemSeq → 제형명(분할·분쇄 판정)
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** 2026-11-11 (수) 14:32 */
export function formatPrintDate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} (${WEEKDAY[d.getDay()]}) ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** 14:31 */
export function formatClock(d: Date): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** PDF 파일명 — 환자 정보 없이 작성 시각만. 예) 지참약확인표_20261111_1432.pdf */
export function printFileName(d: Date): string {
  return `지참약확인표_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.pdf`;
}

const FAMILY_NOTE: Record<string, string> = {
  QW: '주 1회 — 매일 주지 않도록 주의',
  QOD: '격일 — 매일 주지 않도록 주의',
  PRN: '필요시에만',
  ETC: '비정형 용법 — 처방 확인',
};

function toPrintMed(med: MedItem, no: number, lk: PrintLookups): PrintMed {
  const ingrKo = (lk.ingrKo?.get(med.itemSeq) ?? '').split('/').map((s) => s.trim()).filter(Boolean).join(' + ');
  const eng = formatEnglishName(lk.eng?.get(med.itemSeq));
  // 성분 줄이 있으면 품목명의 성분 괄호는 빼서 중복을 줄인다.
  const name = ingrKo ? stripIngredient(med.name) || med.name : med.name;
  const caution = splitCrushCaution(lk.forms?.get(med.itemSeq));
  const freq = isStandardFreq(med.frequency) ? med.frequency : freqShareTag(med.frequency) || med.frequency;
  return {
    no,
    name,
    sub: [ingrKo, eng].filter(Boolean).join(' · '),
    memo: med.memo?.trim() ?? '',
    warn: caution ? `분할·분쇄 금지(${caution.kind === '서방정' ? '서방' : '장용'})` : '',
    appearance: [med.color, med.shape, cleanMarking(med.marking)]
      .map((v) => (v ?? '').trim())
      .filter(Boolean)
      .join(' / '),
    dose: `${formatTabletCount(med.tabletCount)}${med.doseUnit || 'T'}`,
    freq,
    imageUrl: med.imageUrl || undefined,
  };
}

const FLAG_KINDS = ['임부금기', '노인주의', '연령금기', '효능군중복'] as const;

/**
 * 점검 결과 → 출력용 요약. DurSheet 와 같은 순서(병용금기→성분중복→분할분쇄→약별 주의).
 * 종이 한 장에 담기 위해: 리스트 안의 문제(병용금기·성분중복·분할분쇄)는 한 건씩,
 * 약 자체의 DUR 속성(임부·노인·연령·효능군)은 종류별로 한 줄에 약 이름만 모은다(상세는 앱 안전점검).
 */
export function buildPrintSafety(safety: SafetyResult | null): PrintSafety {
  if (!safety) {
    return {
      level: 'unchecked',
      headline: '점검 못 함',
      sub: '금기·중복 점검을 하지 못했어요 — 앱의 안전점검에서 확인',
      items: [],
    };
  }
  const short = (name: string) => stripIngredient(name) || name;
  const strong: PrintSafetyItem[] = [
    ...safety.dur.combos.map((c) => ({ tag: '병용금기', strong: true, title: `${short(c.aName)} + ${short(c.bName)}`, body: c.content ?? '' })),
    ...safety.overlaps.map((o) => ({
      tag: '성분중복',
      strong: true,
      title: o.medNames.map(short).join(' + '),
      body: `같은 성분(${o.ingredient}) — 중복투약 여부 확인`,
    })),
    ...safety.splitCrush.map((s) => ({ tag: '분할·분쇄 주의', strong: true, title: short(s.medName), body: s.reason })),
  ];
  const perKind: PrintSafetyItem[] = FLAG_KINDS.map((kind) => {
    const names = safety.dur.flags.filter((f) => f.kinds.some((k) => k.type === kind)).map((f) => short(f.name));
    return { tag: kind, strong: false, title: '', body: [...new Set(names)].join(', ') };
  }).filter((it) => it.body);
  const items = [...strong, ...perKind];
  const at = formatClock(new Date(safety.checkedAt));
  const durLabel =
    safety.durStatus === 'bundle'
      ? 'DUR(기기 데이터)'
      : safety.durStatus === 'online'
        ? 'DUR(온라인)'
        : safety.durStatus === 'partial'
          ? 'DUR(일부 조회 실패)'
          : 'DUR 미점검(데이터 없음)';
  const sub = `${durLabel} · 성분중복 · 분할분쇄 · ${at} 점검`;
  if (strong.length) return { level: 'issues', headline: `확인 필요 ${strong.length}건`, sub, items };
  if (items.length) return { level: 'issues', headline: `약별 주의 ${safety.dur.flags.length}종`, sub, items };
  if (safety.durStatus === 'unavailable') {
    return { level: 'unchecked', headline: 'DUR 미점검', sub: `${sub} — 성분중복·분할분쇄는 특이사항 없음`, items };
  }
  return { level: 'clear', headline: '특이사항 없음', sub, items };
}

/**
 * 환자 약 리스트 → 출력 모델.
 * 묶음·순서는 화면·Teams 인계 텍스트와 같은 groupMedsByTiming 을 써서 종이와 텍스트를 맞춰 보기 쉽게 한다.
 */
export function buildPrintModel(
  meds: MedItem[],
  lookups: PrintLookups,
  safety: SafetyResult | null,
  opts: { createdAt: Date; dbDate?: string },
): PrintModel {
  let no = 0;
  const groups = groupMedsByTiming(meds).map<PrintGroup>((g) => {
    const special = !!g.freqLabel;
    const timingsKo = g.timings.filter((t) => t !== '시점미정' && t !== '필요시').join(' · ');
    const family = special ? freqDetailFamily(g.meds[0].frequency) ?? 'ETC' : '';
    const note = special ? [FAMILY_NOTE[family] ?? FAMILY_NOTE.ETC, timingsKo].filter(Boolean).join(' · ') : timingsKo;
    return { title: g.header, note, special, meds: g.meds.map((m) => toPrintMed(m, (no += 1), lookups)) };
  });
  return {
    createdAt: opts.createdAt,
    medCount: meds.length,
    groups,
    safety: buildPrintSafety(safety),
    dbDate: opts.dbDate,
  };
}
