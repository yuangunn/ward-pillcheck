import { describe, it, expect } from 'vitest';
import { createMockClient } from './mockClient';

const api = createMockClient();

describe('mockClient.searchPills', () => {
  it('색 + 모양 조합으로 필터', async () => {
    const res = await api.searchPills({ colorClass1: '하양', drugShape: '팔각형' });
    expect(res.map((r) => r.itemName)).toEqual(['노바스크정5mg']);
  });

  it('각인은 대소문자 무시 부분일치', async () => {
    const res = await api.searchPills({ printFront: 'bayer' });
    expect(res).toHaveLength(1);
    expect(res[0].itemSeq).toBe('195700020');
  });

  it('이름 부분일치', async () => {
    const res = await api.searchPills({ itemName: '타이레놀' });
    expect(res[0].itemName).toBe('타이레놀정500mg');
  });

  it('조건에 맞는 결과가 없으면 빈 배열', async () => {
    const res = await api.searchPills({ colorClass1: '검정', drugShape: '삼각형' });
    expect(res).toEqual([]);
  });

  it('색만 주면 해당 색 전부', async () => {
    const res = await api.searchPills({ colorClass1: '하양' });
    expect(res.length).toBeGreaterThan(1);
    expect(res.every((r) => r.colorClass1 === '하양')).toBe(true);
  });
});

describe('mockClient.getDetail', () => {
  it('상세가 있는 itemSeq', async () => {
    const d = await api.getDetail('195700020');
    expect(d?.efcy).toContain('혈전');
  });
  it('상세가 없는 itemSeq 는 null', async () => {
    const d = await api.getDetail('does-not-exist');
    expect(d).toBeNull();
  });
});
