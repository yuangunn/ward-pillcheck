import { describe, it, expect } from 'vitest';
import type { MedItem } from '../domain/models';
import { buildPrintModel } from './model';
import { BODY_BOTTOM, FONTS, layoutDocument, wrapText, type Measure } from './layout';
import type { SafetyResult } from '../api/safety';

// 캔버스 없이: 글자 폭 = 글자 수 × 크기 × 0.6 (한글 전각 근사)
const measure: Measure = (t, f) => [...t].length * f.size * 0.6;

const clean: SafetyResult = {
  dur: { combos: [], flags: [] },
  durStatus: 'bundle',
  overlaps: [],
  splitCrush: [],
  checkedAt: 0,
};

const TIMINGS: [MedItem['frequency'], string[]][] = [
  ['QD', ['아침식후']],
  ['BID', ['아침식후', '저녁식후']],
  ['QD', ['자기전']],
  ['TID', ['아침식후', '점심식후', '저녁식후']],
];
const makeMeds = (n: number): MedItem[] =>
  Array.from({ length: n }, (_, i) => {
    const [frequency, timings] = TIMINGS[i % TIMINGS.length];
    return {
      id: `m${i}`,
      itemSeq: String(i),
      name: `테스트약${i + 1}정10밀리그램`,
      color: '하양',
      shape: '원형',
      marking: `T${i}`,
      tabletCount: 1,
      frequency,
      timings,
      memo: i % 5 === 0 ? '혈압 낮으면 보류' : undefined,
      createdAt: i,
    };
  });

describe('wrapText', () => {
  const f = FONTS.cell; // size ≈ 2.96mm → 글자당 ≈ 1.78mm
  it('공백 단위로 줄을 나눈다', () => {
    expect(wrapText('하양 / 원형 / Bayer', 14, f, measure)).toEqual(['하양 / 원형 /', 'Bayer']);
  });
  it('공백 없는 긴 토큰은 글자 단위로 끊는다', () => {
    const lines = wrapText('아토르바스타틴칼슘삼수화물', 10, f, measure);
    expect(lines.join('')).toBe('아토르바스타틴칼슘삼수화물');
    lines.forEach((l) => expect(measure(l, f)).toBeLessThanOrEqual(10));
  });
  it('최대 줄 수를 넘으면 마지막 줄을 …로 줄인다', () => {
    const lines = wrapText('가 나 다 라 마 바 사 아 자 차 카 타', 5, f, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(measure(lines[1], f)).toBeLessThanOrEqual(5);
  });
  it('줄마다 다른 폭(첫 줄 좁게)', () => {
    const lines = wrapText('가가가 나나나 다다다', [4, 100], f, measure);
    expect(lines[0]).toBe('가가');
  });
  it('빈 문자열은 빈 배열', () => {
    expect(wrapText('  ', 10, f, measure)).toEqual([]);
  });
});

describe('layoutDocument (쪽 나눔)', () => {
  const at = new Date(2026, 10, 11, 14, 32);

  it('7종은 1쪽', () => {
    const doc = layoutDocument(buildPrintModel(makeMeds(7), {}, clean, { createdAt: at }), measure);
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0]).toMatchObject({ first: true, noFrom: 1, noTo: 7 });
  });

  it('20종은 2쪽 — 모든 약이 한 번씩, 표가 바닥글을 넘지 않는다', () => {
    const doc = layoutDocument(buildPrintModel(makeMeds(20), {}, clean, { createdAt: at }), measure);
    expect(doc.pages).toHaveLength(2);
    const nos = doc.pages.flatMap((p) => p.rows.filter((r) => r.kind === 'med').map((r) => (r.kind === 'med' ? r.med.no : 0)));
    expect(nos).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const p of doc.pages) {
      const last = p.rows[p.rows.length - 1];
      expect(last.y + last.h).toBeLessThanOrEqual(BODY_BOTTOM + 1e-6);
      expect(p.rows[0].kind).toBe('group'); // 쪽마다 묶음 머리로 시작
    }
    expect(doc.pages[1]).toMatchObject({ first: false, noFrom: doc.pages[0].noTo + 1, noTo: 20 });
  });

  it('쪽을 넘어간 묶음은 다음 쪽에 (계속) 머리를 다시 단다', () => {
    const doc = layoutDocument(buildPrintModel(makeMeds(20), {}, clean, { createdAt: at }), measure);
    const p2first = doc.pages[1].rows[0];
    const p1groups = doc.pages[0].rows.filter((r) => r.kind === 'group').map((r) => (r.kind === 'group' ? r.group.title : ''));
    if (p2first.kind !== 'group') throw new Error('group expected');
    // 2쪽 첫 묶음이 1쪽에도 있었다면 cont=true
    expect(p2first.cont).toBe(p1groups.includes(p2first.group.title));
  });

  it('묶음 머리만 쪽 끝에 홀로 남지 않는다', () => {
    for (const n of [12, 16, 20, 30, 45]) {
      const doc = layoutDocument(buildPrintModel(makeMeds(n), {}, clean, { createdAt: at }), measure);
      for (const p of doc.pages) expect(p.rows[p.rows.length - 1].kind).toBe('med');
    }
  });

  it('리스트 문제가 많으면 1쪽 표가 내려가고 8건까지만 표시(나머지는 "외 n건")', () => {
    const many: SafetyResult = {
      ...clean,
      splitCrush: Array.from({ length: 12 }, (_, i) => ({ medId: `m${i}`, medName: `약${i}`, kind: '서방정' as const, reason: '부수면 안 됨' })),
    };
    const a = layoutDocument(buildPrintModel(makeMeds(5), {}, clean, { createdAt: at }), measure);
    const b = layoutDocument(buildPrintModel(makeMeds(5), {}, many, { createdAt: at }), measure);
    expect(b.pages[0].tableTop).toBeGreaterThan(a.pages[0].tableTop);
    expect(b.pages[0].safety!.items).toHaveLength(8);
    expect(b.pages[0].safety!.more).toBe(4);
  });

  it('약별 DUR 주의는 종류별 한 줄로 접혀 상자가 커지지 않는다', () => {
    const flags: SafetyResult = {
      ...clean,
      dur: {
        combos: [],
        flags: Array.from({ length: 12 }, (_, i) => ({ medId: `m${i}`, name: `약${i}`, kinds: [{ type: '노인주의' as const, content: '65세 이상 신중 투여' }] })),
      },
    };
    const doc = layoutDocument(buildPrintModel(makeMeds(5), {}, flags, { createdAt: at }), measure);
    expect(doc.pages[0].safety!.items).toHaveLength(1);
    expect(doc.pages[0].safety!.items[0].body.join(' ')).toContain('약0, 약1');
  });
});
