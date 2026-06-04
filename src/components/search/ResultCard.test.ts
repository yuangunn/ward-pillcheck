import { describe, it, expect } from 'vitest';
import { lineText } from './ResultCard';

describe('lineText (분할선 표시)', () => {
  it('앞/뒤 모두 있으면 둘 다', () => {
    expect(lineText('+', '-')).toBe('분할선 앞 +');
    expect(lineText('+', '＋')).toBe('분할선 앞 + / 뒤 ＋');
  });
  it('앞만 있으면 앞만', () => {
    expect(lineText('+', undefined)).toBe('분할선 앞 +');
  });
  it('"-"/"없음"/빈값은 무시', () => {
    expect(lineText('-', '없음')).toBeNull();
    expect(lineText('', '   ')).toBeNull();
    expect(lineText(undefined, undefined)).toBeNull();
  });
});
