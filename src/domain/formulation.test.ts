import { describe, it, expect } from 'vitest';
import { splitCrushCaution, analyzeSplitCrush } from './formulation';

describe('splitCrushCaution', () => {
  it('서방형 제형은 서방정 주의', () => {
    expect(splitCrushCaution('서방성필름코팅정')?.kind).toBe('서방정');
    expect(splitCrushCaution('서방정')?.kind).toBe('서방정');
    expect(splitCrushCaution('서방성다층정')?.kind).toBe('서방정');
    expect(splitCrushCaution('지속성캡슐')?.kind).toBe('서방정');
  });
  it('장용형 제형은 장용정 주의', () => {
    expect(splitCrushCaution('장용성필름코팅정')?.kind).toBe('장용정');
    expect(splitCrushCaution('장용정')?.kind).toBe('장용정');
    expect(splitCrushCaution('장용성캡슐제, 펠렛')?.kind).toBe('장용정');
  });
  it('일반 제형은 주의 없음(null)', () => {
    expect(splitCrushCaution('필름코팅정')).toBeNull();
    expect(splitCrushCaution('나정')).toBeNull();
    expect(splitCrushCaution('연질캡슐')).toBeNull();
    expect(splitCrushCaution('구강붕해정')).toBeNull(); // 입에서 녹는 정제는 분쇄 주의 대상 아님
    expect(splitCrushCaution('')).toBeNull();
    expect(splitCrushCaution(undefined)).toBeNull();
  });
});

describe('analyzeSplitCrush', () => {
  const med = (id: string, name: string, itemSeq: string) => ({ id, name, itemSeq });
  it('주의 제형만 골라낸다', () => {
    const meds = [
      med('1', '아스피린장용정', 'A'),
      med('2', '딜티아젬서방정', 'B'),
      med('3', '타이레놀정', 'C'),
    ];
    const forms = new Map<string, string>([
      ['A', '장용성필름코팅정'],
      ['B', '서방성필름코팅정'],
      ['C', '필름코팅정'],
    ]);
    const res = analyzeSplitCrush(meds, forms);
    expect(res.map((r) => [r.medName, r.kind])).toEqual([
      ['아스피린장용정', '장용정'],
      ['딜티아젬서방정', '서방정'],
    ]);
  });
  it('제형 정보 없는 약은 무시', () => {
    const meds = [med('1', '직접입력약', 'A')];
    expect(analyzeSplitCrush(meds, new Map())).toEqual([]);
  });
});
