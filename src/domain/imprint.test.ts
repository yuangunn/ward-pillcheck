import { describe, it, expect } from 'vitest';
import { imprintFlip180, imprintHas } from './imprint';

describe('imprintFlip180', () => {
  it('대칭 글자만으로 된 각인은 순서가 뒤집힌다 (SIH ↔ HIS)', () => {
    expect(imprintFlip180('SIH')).toBe('HIS');
    expect(imprintFlip180('HIS')).toBe('SIH');
  });
  it('6↔9, M↔W 회전 매핑', () => {
    expect(imprintFlip180('69')).toBe('69'); // 6→9 prepend, 9→6 → "69"
    expect(imprintFlip180('MW')).toBe('MW'); // M→W prepend, W→M → "MW"
    expect(imprintFlip180('M')).toBe('W');
  });
  it('소문자도 대문자로 정규화', () => {
    expect(imprintFlip180('sih')).toBe('HIS');
  });
  it('회전 불가 글자가 섞이면 null (오매칭 방지)', () => {
    expect(imprintFlip180('PAR')).toBeNull(); // P,R,A 회전 불가
    expect(imprintFlip180('25')).toBeNull();
    expect(imprintFlip180('BAYER')).toBeNull();
  });
  it('빈 문자열은 null', () => {
    expect(imprintFlip180('')).toBeNull();
    expect(imprintFlip180('   ')).toBeNull();
  });
});

describe('imprintHas', () => {
  it('그대로 포함이면 flipped=false', () => {
    expect(imprintHas('TYLENOL 500', 'TYLENOL')).toEqual({ hit: true, flipped: false });
  });
  it('뒤집어야만 일치하면 flipped=true', () => {
    expect(imprintHas('SIH', 'HIS')).toEqual({ hit: true, flipped: true });
  });
  it('그대로 일치가 뒤집힘보다 우선', () => {
    // hay 에 둘 다 있을 때 그대로 매칭을 먼저 잡는다
    expect(imprintHas('HIS SIH', 'HIS')).toEqual({ hit: true, flipped: false });
  });
  it('회전 불가 검색어는 뒤집힘 매칭 안 함', () => {
    expect(imprintHas('RAP', 'PAR')).toEqual({ hit: false, flipped: false });
  });
  it('빈 검색어는 미일치', () => {
    expect(imprintHas('SIH', '')).toEqual({ hit: false, flipped: false });
  });
});
