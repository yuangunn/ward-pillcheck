import type { MedItem } from './models';

// 분할·분쇄 주의 제형 판정.
// 서방정(서방성·지속성)·장용정(장용성)은 쪼개거나 갈면 약효가 급변하거나 위장 자극이 생겨
// 분할·분쇄하면 안 된다(가루약·반알 처방, 콧줄/경관 투여 시 특히 위험).
// 제형명(formCodeName)으로 판정하며 완전 오프라인. 식별 보조이며 최종 판단은 의료진 책임.

export interface SplitCrushCaution {
  kind: '서방정' | '장용정';
  reason: string;
}

/**
 * 제형명이 분할·분쇄 주의 대상인지 판정. 아니면 null.
 * - 서방/지속성: 부수면 약물이 한꺼번에 방출 → 과량 위험
 * - 장용성: 부수면 위산 분해로 위장 자극·약효 저하
 */
export function splitCrushCaution(form: string | undefined | null): SplitCrushCaution | null {
  if (!form) return null;
  // 서방성필름코팅정·서방정·서방성다층정·지속성 등
  if (/서방|지속성/.test(form)) {
    return { kind: '서방정', reason: '쪼개거나 갈면 약물이 한꺼번에 방출돼 위험해요(서방형)' };
  }
  // 장용성필름코팅정·장용정·장용성캡슐 등
  if (/장용/.test(form)) {
    return { kind: '장용정', reason: '쪼개거나 갈면 위장 자극·약효 저하 우려가 있어요(장용형)' };
  }
  return null;
}

/** 분할·분쇄 주의 1건 — 환자 약과 사유. */
export interface SplitCrushFlag {
  medId: string;
  medName: string;
  kind: SplitCrushCaution['kind'];
  reason: string;
}

type MedLike = Pick<MedItem, 'id' | 'name' | 'itemSeq'>;

/**
 * 환자 약 리스트에서 분할·분쇄 주의 제형을 찾는다(순수 함수).
 * @param formBySeq itemSeq → 제형명(번들/mock 데이터에서 조회)
 */
export function analyzeSplitCrush(meds: MedLike[], formBySeq: Map<string, string>): SplitCrushFlag[] {
  const out: SplitCrushFlag[] = [];
  for (const m of meds) {
    if (!m.itemSeq) continue;
    const c = splitCrushCaution(formBySeq.get(m.itemSeq));
    if (c) out.push({ medId: m.id, medName: m.name, kind: c.kind, reason: c.reason });
  }
  return out;
}
