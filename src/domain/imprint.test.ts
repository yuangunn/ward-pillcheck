import { describe, it, expect } from 'vitest';
import { imprintFlip180, imprintHas, imprintCanonical } from './imprint';

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
  it('그대로 포함이면 flipped/fuzzy=false', () => {
    expect(imprintHas('TYLENOL 500', 'TYLENOL')).toEqual({ hit: true, flipped: false, fuzzy: false });
  });
  it('뒤집어야만 일치하면 flipped=true', () => {
    expect(imprintHas('SIH', 'HIS')).toEqual({ hit: true, flipped: true, fuzzy: false });
  });
  it('그대로 일치가 뒤집힘보다 우선', () => {
    expect(imprintHas('HIS SIH', 'HIS')).toEqual({ hit: true, flipped: false, fuzzy: false });
  });
  it('회전 불가 검색어는 뒤집힘 매칭 안 함', () => {
    expect(imprintHas('RAP', 'PAR')).toEqual({ hit: false, flipped: false, fuzzy: false });
  });
  it('빈 검색어는 미일치', () => {
    expect(imprintHas('SIH', '')).toEqual({ hit: false, flipped: false, fuzzy: false });
  });
  it('fuzzy 옵션 없으면 혼동문자 매칭 안 함', () => {
    expect(imprintHas('DLT', '0LT')).toEqual({ hit: false, flipped: false, fuzzy: false });
  });
  it('fuzzy 옵션이면 혼동문자(0↔O↔D, L↔1) 매칭 → fuzzy=true', () => {
    expect(imprintHas('DLT', '0LT', { fuzzy: true })).toEqual({ hit: true, flipped: false, fuzzy: true });
    expect(imprintHas('SOH', '50H', { fuzzy: true })).toEqual({ hit: true, flipped: false, fuzzy: true });
  });
  it('fuzzy 라도 정확/뒤집힘 일치가 우선(fuzzy=false)', () => {
    expect(imprintHas('DLT', 'DLT', { fuzzy: true })).toEqual({ hit: true, flipped: false, fuzzy: false });
    expect(imprintHas('SIH', 'HIS', { fuzzy: true })).toEqual({ hit: true, flipped: true, fuzzy: false });
  });
});

describe('imprintCanonical', () => {
  it('혼동문자를 대표문자로 치환', () => {
    expect(imprintCanonical('DLT')).toBe('01T');
    expect(imprintCanonical('0LT')).toBe('01T');
    expect(imprintCanonical('SOH')).toBe('50H');
    expect(imprintCanonical('B2G')).toBe('826'); // B→8, 2 그대로, G→6
  });
  it('혼동 대상 아닌 글자는 그대로', () => {
    expect(imprintCanonical('AMK')).toBe('AMK');
  });
});
