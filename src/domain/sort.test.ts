import { describe, it, expect } from 'vitest';
import { sortMeds } from './sort';
import type { MedItem } from './models';

// timing 단일 문자열 단축 입력 허용 → timings 배열로 변환
function med(
  partial: Partial<Omit<MedItem, 'timings'>> & { id: string; timing?: string; timings?: string[] },
): MedItem {
  const { timing, timings, ...rest } = partial;
  return {
    itemSeq: partial.id,
    name: partial.name ?? `약${partial.id}`,
    tabletCount: 1,
    frequency: 'QD',
    createdAt: 0,
    ...rest,
    timings: timings ?? (timing ? [timing] : ['아침식후']),
  };
}

const ids = (list: MedItem[]) => list.map((m) => m.id);

describe('sortMeds - manual', () => {
  it('manual 모드는 원본 순서를 그대로 반환', () => {
    const meds = [med({ id: 'b', frequency: 'TID' }), med({ id: 'a', frequency: 'QD' })];
    expect(ids(sortMeds(meds, 'manual'))).toEqual(['b', 'a']);
  });
  it('원본 배열을 변형하지 않음', () => {
    const meds = [med({ id: 'b', frequency: 'TID' }), med({ id: 'a', frequency: 'QD' })];
    const snapshot = ids(meds);
    sortMeds(meds, 'byFrequency');
    expect(ids(meds)).toEqual(snapshot);
  });
});

describe('sortMeds - byFrequency', () => {
  it('1일 투여횟수 오름차순(QD→BID→TID→QID)', () => {
    const meds = [
      med({ id: 'qid', frequency: 'QID' }),
      med({ id: 'qd', frequency: 'QD' }),
      med({ id: 'tid', frequency: 'TID' }),
      med({ id: 'bid', frequency: 'BID' }),
    ];
    expect(ids(sortMeds(meds, 'byFrequency'))).toEqual(['qd', 'bid', 'tid', 'qid']);
  });

  it('HS/PRN 등 비정형은 뒤로', () => {
    const meds = [
      med({ id: 'prn', frequency: 'PRN' }),
      med({ id: 'hs', frequency: 'HS' }),
      med({ id: 'qd', frequency: 'QD' }),
    ];
    const out = ids(sortMeds(meds, 'byFrequency'));
    expect(out[0]).toBe('qd');
    expect(out.indexOf('prn')).toBeGreaterThan(out.indexOf('qd'));
  });

  it('동순위(같은 용법)는 복용시점 시간순으로 2차 정렬', () => {
    const meds = [
      med({ id: 'pm', frequency: 'BID', timing: '저녁식후' }),
      med({ id: 'am', frequency: 'BID', timing: '아침식전' }),
    ];
    expect(ids(sortMeds(meds, 'byFrequency'))).toEqual(['am', 'pm']);
  });
});

describe('sortMeds - byTiming', () => {
  it('복용시점 시간순(아침→점심→저녁→자기전), 필요시는 맨 뒤', () => {
    const meds = [
      med({ id: 'sleep', timing: '자기전' }),
      med({ id: 'prn', timing: '필요시' }),
      med({ id: 'morningBefore', timing: '아침식전' }),
      med({ id: 'lunch', timing: '점심식후' }),
    ];
    expect(ids(sortMeds(meds, 'byTiming'))).toEqual([
      'morningBefore',
      'lunch',
      'sleep',
      'prn',
    ]);
  });

  it('같은 끼니는 식전→식후', () => {
    const meds = [
      med({ id: 'after', timing: '아침식후' }),
      med({ id: 'before', timing: '아침식전' }),
    ];
    expect(ids(sortMeds(meds, 'byTiming'))).toEqual(['before', 'after']);
  });

  it('동순위(같은 복용시점)는 용법순으로 2차 정렬', () => {
    const meds = [
      med({ id: 'tid', timing: '아침식후', frequency: 'TID' }),
      med({ id: 'qd', timing: '아침식후', frequency: 'QD' }),
    ];
    expect(ids(sortMeds(meds, 'byTiming'))).toEqual(['qd', 'tid']);
  });
});
