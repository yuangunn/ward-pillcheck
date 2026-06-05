import { describe, it, expect } from 'vitest';
import {
  FREQUENCY_PRESETS,
  FREQ_DETAIL_CODES,
  freqDetailFamily,
  isFreqChipSelected,
} from './frequency';

describe('frequency 비정형 용법', () => {
  it('QW·기타(ETC) 프리셋이 추가됨', () => {
    const codes = FREQUENCY_PRESETS.map((f) => f.code);
    expect(codes).toContain('QW');
    expect(codes).toContain('ETC');
  });

  it('상세 입력 모달 대상은 QW·QOD·PRN·ETC', () => {
    expect([...FREQ_DETAIL_CODES].sort()).toEqual(['ETC', 'PRN', 'QOD', 'QW']);
  });

  it('표준 용법은 계열 없음(null)', () => {
    for (const c of ['QD', 'BID', 'TID', 'QID', 'HS']) {
      expect(freqDetailFamily(c)).toBeNull();
    }
  });

  it('자유 텍스트도 접두로 계열 판정', () => {
    expect(freqDetailFamily('필요시 통증시')).toBe('PRN');
    expect(freqDetailFamily('격일 저녁')).toBe('QOD');
    expect(freqDetailFamily('주 1회 (월)')).toBe('QW');
    expect(freqDetailFamily('5일 복용 2일 휴약')).toBe('ETC');
  });

  it('칩 선택: 표준은 정확 일치, 비정형은 계열 일치', () => {
    expect(isFreqChipSelected('QD', 'QD')).toBe(true);
    expect(isFreqChipSelected('QD', 'BID')).toBe(false);
    expect(isFreqChipSelected('PRN', '필요시 통증시')).toBe(true);
    expect(isFreqChipSelected('ETC', '5일 복용 2일 휴약')).toBe(true);
    expect(isFreqChipSelected('ETC', 'QD')).toBe(false);
  });
});
