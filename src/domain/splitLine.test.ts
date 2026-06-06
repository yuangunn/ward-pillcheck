import { describe, it, expect } from 'vitest';
import { splitLineKind } from './splitLine';

describe('splitLineKind', () => {
  it('없음: 빈값/하이픈 아님/undefined', () => {
    expect(splitLineKind(undefined, undefined)).toBe('none');
    expect(splitLineKind('', '')).toBe('none');
  });

  it('일자: "-" 또는 "기타"', () => {
    expect(splitLineKind('-', undefined)).toBe('single');
    expect(splitLineKind(undefined, '-')).toBe('single');
    expect(splitLineKind('기타', '')).toBe('single');
  });

  it('십자: "+" 우선', () => {
    expect(splitLineKind('+', undefined)).toBe('cross');
    expect(splitLineKind('-', '+')).toBe('cross'); // 한 면이라도 십자면 십자
  });
});
