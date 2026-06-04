import { describe, it, expect } from 'vitest';
import { analyzeInteractions, type DurInfo } from './dur';
import type { MedItem } from '../domain/models';

function med(id: string, itemSeq: string, name: string): MedItem {
  return {
    id,
    itemSeq,
    name,
    tabletCount: 1,
    frequency: 'QD',
    timings: ['아침식후'],
    createdAt: 0,
  };
}

const blank = (seq: string): DurInfo => ({
  itemSeq: seq,
  combo: [],
  pregnancy: [],
  elderly: [],
  age: [],
  dup: [],
});

describe('analyzeInteractions', () => {
  it('리스트 내 두 약이 서로 병용금기면 쌍으로 경고(중복 제거)', () => {
    const meds = [med('a', '100', '와파린'), med('b', '200', '아스피린')];
    const map = new Map<string, DurInfo>([
      ['100', { ...blank('100'), combo: [{ seq: '200', name: '아스피린', content: '출혈 위험' }] }],
      // 반대쪽도 병용금기 등록되어 있어도 한 쌍으로만
      ['200', { ...blank('200'), combo: [{ seq: '100', name: '와파린', content: '출혈 위험' }] }],
    ]);
    const r = analyzeInteractions(meds, map);
    expect(r.combos).toHaveLength(1);
    expect(r.combos[0]).toMatchObject({ aName: '와파린', bName: '아스피린', content: '출혈 위험' });
  });

  it('병용금기 상대가 리스트에 없으면 경고 없음', () => {
    const meds = [med('a', '100', '와파린')];
    const map = new Map([['100', { ...blank('100'), combo: [{ seq: '999', name: '뭔가', content: 'x' }] }]]);
    expect(analyzeInteractions(meds, map).combos).toEqual([]);
  });

  it('약별 임부/노인/연령/효능군중복 플래그', () => {
    const meds = [med('a', '100', '약A')];
    const map = new Map([
      [
        '100',
        {
          ...blank('100'),
          pregnancy: [{ content: '임부 금기' }],
          dup: [{ content: '동일 효능군' }],
        },
      ],
    ]);
    const r = analyzeInteractions(meds, map);
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0].kinds.map((k) => k.type)).toEqual(['임부금기', '효능군중복']);
  });

  it('DUR 정보 없는 약은 무시', () => {
    const meds = [med('a', '100', '약A')];
    const r = analyzeInteractions(meds, new Map());
    expect(r).toEqual({ combos: [], flags: [] });
  });

  it('seq 없이 이름만 있는 병용금기는 이름 부분일치로 매칭', () => {
    const meds = [med('a', '100', '와파린정'), med('b', '200', '아스피린장용정')];
    const map = new Map([
      ['100', { ...blank('100'), combo: [{ seq: '', name: '아스피린', content: '출혈' }] }],
    ]);
    expect(analyzeInteractions(meds, map).combos).toHaveLength(1);
  });
});
