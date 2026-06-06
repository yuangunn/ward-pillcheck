import { describe, it, expect } from 'vitest';
import { refineShape, shapeLabel } from './shape';

describe('refineShape', () => {
  it('성상에서 특수 모양 추출', () => {
    expect(refineShape('양쪽에 절취하는 홈이 있는 볼록한 심장형의 순백색필름코팅정제')).toBe('하트');
    expect(refineShape('흰색의 방패 모양 정제')).toBe('방패');
    expect(refineShape('노란색 눈사람 모양 정제')).toBe('눈사람');
  });
  it('성상이 표준 모양을 적었으면 그 모양', () => {
    expect(refineShape('담홍색의 장방형 정제.')).toBe('장방형');
  });
  it('단서 없으면 빈 문자열', () => {
    expect(refineShape('흰색 정제')).toBe('');
    expect(refineShape(undefined)).toBe('');
  });
});

describe('shapeLabel', () => {
  it('표준 모양은 그대로', () => {
    expect(shapeLabel({ drugShape: '원형', chart: '원형의 흰색 정제' })).toBe('원형');
  });
  it("'기타'는 성상으로 세분화", () => {
    expect(shapeLabel({ drugShape: '기타', chart: '볼록한 심장형의 순백색…' })).toBe('기타 · 하트');
  });
  it("'기타'인데 단서 없으면 그냥 기타", () => {
    expect(shapeLabel({ drugShape: '기타', chart: '흰색 정제' })).toBe('기타');
    expect(shapeLabel({ drugShape: '기타' })).toBe('기타');
  });
});
