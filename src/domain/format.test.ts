import { describe, it, expect } from 'vitest';
import { formatMedLine, formatAppearance, formatTabletCount } from './format';
import type { MedItem } from './models';

const base: MedItem = {
  id: '1',
  itemSeq: '195700020',
  name: '아스피린장용정100mg',
  tabletCount: 1,
  frequency: 'QD',
  timing: '아침식후',
  color: '흰',
  shape: '원형',
  marking: 'Bayer',
  createdAt: 0,
};

describe('formatTabletCount', () => {
  it('정수는 그대로', () => {
    expect(formatTabletCount(1)).toBe('1');
    expect(formatTabletCount(2)).toBe('2');
  });
  it('소수는 소수점 유지', () => {
    expect(formatTabletCount(0.5)).toBe('0.5');
    expect(formatTabletCount(1.5)).toBe('1.5');
  });
});

describe('formatAppearance', () => {
  it('색/모양/각인 모두 있으면 괄호로 묶음', () => {
    expect(formatAppearance(base)).toBe('(흰/원형/Bayer)');
  });
  it('일부만 있으면 있는 것만', () => {
    expect(formatAppearance({ color: '흰', shape: '', marking: undefined })).toBe('(흰)');
  });
  it('아무 것도 없으면 빈 문자열', () => {
    expect(formatAppearance({ color: '', shape: '', marking: '' })).toBe('');
    expect(formatAppearance({})).toBe('');
  });
});

describe('formatMedLine', () => {
  it('명세 예시 포맷과 일치', () => {
    expect(formatMedLine(base)).toBe('아스피린장용정100mg 1T QD 아침식후 (흰/원형/Bayer)');
  });
  it('소수 정제 + 외형 일부', () => {
    const med: MedItem = {
      ...base,
      name: '자나팜 0.25mg',
      tabletCount: 0.5,
      timing: '자기전',
      color: '흰',
      shape: '타원',
      marking: 'MYUNGIN 25',
    };
    expect(formatMedLine(med)).toBe('자나팜 0.25mg 0.5T QD 자기전 (흰/타원/MYUNGIN 25)');
  });
  it('외형 정보가 전혀 없으면 괄호 없이 끝남', () => {
    const med: MedItem = { ...base, color: undefined, shape: undefined, marking: undefined };
    expect(formatMedLine(med)).toBe('아스피린장용정100mg 1T QD 아침식후');
  });
});
