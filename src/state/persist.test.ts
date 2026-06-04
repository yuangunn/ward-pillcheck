import { describe, it, expect } from 'vitest';
import { loadState } from './persist';

describe('persist 마이그레이션 (v1 → v2)', () => {
  it('단일 timing 문자열을 timings 배열로 변환하고 schemaVersion 을 올린다', () => {
    const v1 = {
      schemaVersion: 1,
      activePatientId: 'p1',
      patients: [
        {
          id: 'p1',
          label: '환자1',
          sortMode: 'manual',
          meds: [
            {
              id: 'm1',
              itemSeq: '1',
              name: '아스피린장용정100mg',
              tabletCount: 1,
              frequency: 'QD',
              timing: '아침식후', // 구버전 단일 필드
              createdAt: 0,
            },
          ],
        },
      ],
    };
    localStorage.setItem('ward-pillcheck:v1', JSON.stringify(v1));

    const s = loadState();
    expect(s.schemaVersion).toBe(2);
    const med = s.patients[0].meds[0];
    expect(med.timings).toEqual(['아침식후']);
    expect((med as unknown as { timing?: string }).timing).toBeUndefined();
  });

  it('이미 timings 가 있으면 그대로 둔다', () => {
    const v2 = {
      schemaVersion: 2,
      activePatientId: 'p1',
      patients: [
        {
          id: 'p1',
          label: '환자1',
          sortMode: 'manual',
          meds: [
            {
              id: 'm1',
              itemSeq: '1',
              name: '메트포르민',
              tabletCount: 1,
              frequency: 'BID',
              timings: ['아침식후', '저녁식후'],
              createdAt: 0,
            },
          ],
        },
      ],
    };
    localStorage.setItem('ward-pillcheck:v1', JSON.stringify(v2));

    const s = loadState();
    expect(s.patients[0].meds[0].timings).toEqual(['아침식후', '저녁식후']);
  });
});
