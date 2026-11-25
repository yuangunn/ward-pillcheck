import type { MedItem } from '../domain/models';
import {
  cleanMarking,
  formatEnglishName,
  formatTabletCount,
  groupMedsByTiming,
  stripIngredient,
} from '../domain/format';
import { freqDetailFamily, freqShareTag, isStandardFreq } from '../constants/frequency';

// A4 출력용 지참약 식별표의 내용 모델(순수 함수). 약을 알아보는 데 필요한 것만 담는다
// (사진·이름·성분·겉모습·용량·용법). 금기 점검·서명란 같은 확인 절차용 항목은 넣지 않는다.
// ⚠ 환자 이름·병상번호(라벨)는 입력으로 받지 않는다 — 출력 이미지는 폰 공유 창(외부 앱 포함)으로
//    나가므로 환자 식별정보를 담지 않고, 종이에 환자 바코드를 직접 붙여 식별한다.

export interface PrintMed {
  no: number; // 1부터, 표 전체 일련번호
  name: string; // 품목명(성분 괄호는 성분 줄로 옮김)
  sub: string; // 한글 성분 · 영문 품목명
  memo: string; // 메모(특이사항)
  appearance: string; // '하양 / 원형 / Bayer' (없으면 '')
  dose: string; // 1회 용량 예) 1T, 10U
  freq: string; // 용법 예) QD, BID, QW/월, PRN/통증 시
  imageUrl?: string; // 식약처 낱알 사진(원본 URL)
  /** 사진이 없거나 못 받았을 때 대신 그릴 모양·색 그림 재료(앱 글리프와 같은 도형). 색·모양 둘 다 없으면 없음. */
  glyph?: { color?: string; shape?: string; marking?: string };
}

export interface PrintGroup {
  title: string; // 인계 텍스트 헤더와 같은 표기 예) 8am 6pm, QW/월 8am
  note: string; // 한글 보조 설명 예) 아침식후 · 저녁식후
  special: boolean; // 비표준 용법(QW/QOD/PRN/기타) — 강조 테두리
  meds: PrintMed[];
}

export interface PrintModel {
  createdAt: Date;
  medCount: number;
  groups: PrintGroup[];
  dbDate?: string; // 식약처 데이터 기준일(YYYY-MM-DD)
}

export interface PrintLookups {
  ingrKo?: Map<string, string>; // itemSeq → 한글 주성분
  eng?: Map<string, string>; // itemSeq → 영문 품목명
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** 2026-11-11 (수) 14:32 */
export function formatPrintDate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} (${WEEKDAY[d.getDay()]}) ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/**
 * 쪽 이미지 파일명 — 환자 정보 없이 작성 시각만. 여러 쪽이면 쪽 번호를 붙인다(이름순 = 쪽순).
 * 예) 지참약식별표_20261111_1432.jpg · 지참약식별표_20261111_1432_2of3.jpg
 */
export function printFileName(d: Date, page = 1, total = 1): string {
  const base = `지참약식별표_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
  return total > 1 ? `${base}_${page}of${total}.jpg` : `${base}.jpg`;
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
  const freq = isStandardFreq(med.frequency) ? med.frequency : freqShareTag(med.frequency) || med.frequency;
  return {
    no,
    name,
    sub: [ingrKo, eng].filter(Boolean).join(' · '),
    memo: med.memo?.trim() ?? '',
    appearance: [med.color, med.shape, cleanMarking(med.marking)]
      .map((v) => (v ?? '').trim())
      .filter(Boolean)
      .join(' / '),
    dose: `${formatTabletCount(med.tabletCount)}${med.doseUnit || 'T'}`,
    freq,
    imageUrl: med.imageUrl || undefined,
    glyph: med.color || med.shape ? { color: med.color, shape: med.shape, marking: med.marking } : undefined,
  };
}

/**
 * 환자 약 리스트 → 출력 모델.
 * 묶음·순서는 화면·Teams 인계 텍스트와 같은 groupMedsByTiming 을 써서 종이와 텍스트를 맞춰 보기 쉽게 한다.
 */
export function buildPrintModel(
  meds: MedItem[],
  lookups: PrintLookups,
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
    dbDate: opts.dbDate,
  };
}
