import { describe, it, expect } from 'vitest';
import { COLOR_FAMILIES, COLOR_OPTIONS, colorFamily, toggleColorSelection } from './appearance';

describe('COLOR_FAMILIES', () => {
  it('각 색은 최대 한 계열에만 속한다(서로소)', () => {
    const seen = new Set<string>();
    for (const fam of COLOR_FAMILIES) {
      for (const c of fam) {
        expect(seen.has(c)).toBe(false);
        seen.add(c);
      }
    }
  });
  it('계열의 모든 색은 실제 색칩(COLOR_OPTIONS) value 여야 한다', () => {
    const values = new Set(COLOR_OPTIONS.map((o) => o.value));
    for (const fam of COLOR_FAMILIES) {
      for (const c of fam) expect(values.has(c)).toBe(true);
    }
  });
});

describe('colorFamily', () => {
  it('계열 색은 계열 전체를 돌려준다', () => {
    expect(colorFamily('분홍')).toEqual(['분홍', '주황', '빨강']);
    expect(colorFamily('빨강')).toEqual(['분홍', '주황', '빨강']);
    expect(colorFamily('초록')).toEqual(['연두', '초록', '청록']);
  });
  it('계열 없는 색은 자기 자신만', () => {
    expect(colorFamily('하양')).toEqual(['하양']);
    expect(colorFamily('노랑')).toEqual(['노랑']);
    expect(colorFamily('갈색')).toEqual(['갈색']);
  });
});

describe('toggleColorSelection', () => {
  it('미선택 색을 누르면 계열 전체가 한 번에 켜진다', () => {
    expect(toggleColorSelection([], '분홍')).toEqual(['분홍', '주황', '빨강']);
    expect(toggleColorSelection([], '청록')).toEqual(['연두', '초록', '청록']);
  });
  it('계열 없는 색은 자기 자신만 켜진다', () => {
    expect(toggleColorSelection([], '하양')).toEqual(['하양']);
    expect(toggleColorSelection(['하양'], '검정')).toEqual(['하양', '검정']);
  });
  it('이미 선택된 색을 누르면 그 색만 개별 해제(계열 나머지는 유지)', () => {
    // 분홍 계열 전체 선택된 상태에서 빨강만 끄기
    expect(toggleColorSelection(['분홍', '주황', '빨강'], '빨강')).toEqual(['분홍', '주황']);
    // 남은 상태에서 빨강을 다시 누르면 계열 나머지는 이미 있으니 빨강만 다시 추가
    expect(toggleColorSelection(['분홍', '주황'], '빨강')).toEqual(['분홍', '주황', '빨강']);
  });
  it('일부만 선택된 계열에서 계열 색을 누르면 빠진 색만 추가(중복 없음)', () => {
    expect(toggleColorSelection(['주황'], '분홍')).toEqual(['주황', '분홍', '빨강']);
  });
  it('다른 계열 선택은 보존한 채 새 계열을 통째로 추가', () => {
    expect(toggleColorSelection(['파랑', '남색'], '초록')).toEqual(['파랑', '남색', '연두', '초록', '청록']);
  });
});
