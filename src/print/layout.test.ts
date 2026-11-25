import { describe, it, expect } from 'vitest';
import type { MedItem } from '../domain/models';
import { buildPrintModel } from './model';
import { BODY_BOTTOM, MAX_PER_PAGE, ROW_MAX, ROW_MIN, TEAMS, inlineInfo, layoutDocument, wrapText, type FontSpec, type Measure } from './layout';
import type { PrintMed } from './model';

// 캔버스 없이: 글자 폭 = 글자 수 × 크기 × 0.6 (한글 전각 근사)
const measure: Measure = (t, f) => [...t].length * f.size * 0.6;

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
  const f: FontSpec = { size: 2.96, weight: 400 }; // 글자당 ≈ 1.78mm
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

describe('layoutDocument (쪽 나눔 · 적응형 줄 높이)', () => {
  const at = new Date(2026, 10, 11, 14, 32);
  const doc = (n: number) => layoutDocument(buildPrintModel(makeMeds(n), {}, { createdAt: at }), measure);
  const medRows = (p: ReturnType<typeof doc>['pages'][number]) => p.rows.filter((r) => r.kind === 'med');

  it('20종까지 한 쪽 — 시점 묶음 머리줄과 함께', () => {
    for (const n of [1, 7, 10, 11, 15, 20]) {
      const d = doc(n);
      expect(d.pages).toHaveLength(1);
      expect(d.pages[0]).toMatchObject({ first: true, noFrom: 1, noTo: n });
      expect(d.pages[0].rows[0].kind).toBe('group');
    }
  });

  it('약이 많을수록 줄이 낮아진다(상한 ROW_MAX, 하한 ROW_MIN)', () => {
    const hs = [5, 10, 11, 15, 20].map((n) => doc(n).pages[0].rowH);
    for (let i = 1; i < hs.length; i += 1) expect(hs[i]).toBeLessThanOrEqual(hs[i - 1]);
    expect(hs[0]).toBe(ROW_MAX);
    expect(hs[hs.length - 1]).toBeGreaterThanOrEqual(ROW_MIN);
    expect(hs[hs.length - 1]).toBeLessThan(hs[0]);
  });

  it('21종부터 다음 쪽, 모든 약이 번호 순으로 한 번씩, 표가 바닥글을 넘지 않는다', () => {
    expect(doc(21).pages).toHaveLength(2);
    for (const n of [21, 33, 45]) {
      const d = doc(n);
      const nos = d.pages.flatMap((p) => medRows(p).map((r) => (r.kind === 'med' ? r.med.no : 0)));
      expect(nos).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      for (const p of d.pages) {
        expect(medRows(p).length).toBeLessThanOrEqual(MAX_PER_PAGE);
        expect(p.rows[0].kind).toBe('group'); // 쪽마다 묶음 머리로 시작
        const last = p.rows[p.rows.length - 1];
        expect(last.y + last.h).toBeLessThanOrEqual(BODY_BOTTOM + 1e-6);
      }
      d.pages.slice(1).forEach((p, i) => expect(p).toMatchObject({ first: false, noFrom: d.pages[i].noTo + 1 }));
    }
  });

  it('쪽을 넘어간 묶음은 다음 쪽에 (계속) 머리를 단다', () => {
    const d = doc(30);
    const p2first = d.pages[1].rows[0];
    const p1groups = d.pages[0].rows.filter((r) => r.kind === 'group').map((r) => (r.kind === 'group' ? r.group.title : ''));
    if (p2first.kind !== 'group') throw new Error('group expected');
    expect(p2first.cont).toBe(p1groups.includes(p2first.group.title));
  });

  it('묶음이 너무 많아 줄이 ROW_MIN 아래로 내려가면 그 쪽 약을 줄인다', () => {
    const meds = makeMeds(20).map((m, i) => ({ ...m, frequency: 'QD' as const, timings: [i % 2 ? '아침식후' : '자기전', `자유${i}`] }));
    const d = layoutDocument(buildPrintModel(meds, {}, { createdAt: at }), measure);
    for (const p of d.pages) expect(p.rowH).toBeGreaterThanOrEqual(ROW_MIN);
  });

  it('사진 칸은 식약처 사진 비율(≈1.83:1), 줄 높이 안에 든다', () => {
    for (const n of [3, 12, 20]) {
      const p = doc(n).pages[0];
      expect(p.photo.w / p.photo.h).toBeCloseTo(1.83, 1);
      expect(p.photo.h).toBeLessThanOrEqual(p.rowH);
    }
  });

  it('긴 이름은 성분 줄을 빼서라도 두 줄로 다 싣는다', () => {
    const meds = makeMeds(20);
    meds[0] = { ...meds[0], name: '콘서타OROS서방정18밀리그램메틸페니데이트' };
    const d = layoutDocument(buildPrintModel(meds, { ingrKo: new Map([['0', '메틸페니데이트염산염']]) }, { createdAt: at }), measure);
    const r = d.pages[0].rows.find((x) => x.kind === 'med' && x.med.no === 1);
    if (!r || r.kind !== 'med') throw new Error('med expected');
    expect(r.name.join('')).toBe('콘서타OROS서방정18밀리그램메틸페니데이트');
  });
});

describe('성분·분류·메모 한 줄 이어쓰기(줄이 모자랄 때)', () => {
  const at = new Date(2026, 10, 11, 14, 32);
  const pm = (over: Partial<PrintMed>): PrintMed => ({
    no: 1, name: '약', sub: '', cls: '', memo: '', appearance: '', dose: '1T', freq: 'QD', ...over,
  });

  it('20종 쪽에서는 성분·분류·메모가 빠지지 않고 이름 아래 한 줄로 이어진다', () => {
    const meds = makeMeds(20);
    const d = layoutDocument(
      buildPrintModel(meds, { ingrKo: new Map([['0', '성분가']]), cls: new Map([['0', '혈압강하제']]) }, { createdAt: at }),
      measure,
    );
    const r = d.pages[0].rows.find((x) => x.kind === 'med' && x.med.no === 1);
    if (!r || r.kind !== 'med') throw new Error('med expected');
    expect(r.info.map((x) => x.text)).toEqual(['성분가', '혈압강하제', '※ 혈압 낮으면 보류']);
    expect([r.sub, r.cls, r.memo]).toEqual([[], [], []]);
  });

  it('넘치면 성분부터 …로 줄이고 분류·메모는 남긴다', () => {
    const segs = inlineInfo(pm({ sub: '아주긴성분이름'.repeat(6), cls: '혈압강하제', memo: '보류' }), 3, 60, measure);
    expect(segs.map((x) => x.text).slice(1)).toEqual(['혈압강하제', '※ 보류']);
    expect(segs[0].text.endsWith('…')).toBe(true);
    const w = segs.reduce((s, x) => s + measure(x.text, x.font), 0) + measure(' · ', segs[0].font) * (segs.length - 1);
    expect(w).toBeLessThanOrEqual(60 + 1e-6);
  });

  it('성분 자리가 너무 좁으면 성분은 빼고 분류·메모만', () => {
    const segs = inlineInfo(pm({ sub: '성분', cls: '기타의 중추신경용약', memo: '혈압 100 미만이면 보류' }), 3, 56, measure);
    expect(segs.map((x) => x.text)).toEqual(['기타의 중추신경용약', '※ 혈압 100 미만이면 보류']);
  });
});

describe('Teams 프로필(724×1024 — 긴 변 1024px 제한)', () => {
  const at = new Date(2026, 10, 11, 14, 32);
  const doc = (n: number) => layoutDocument(buildPrintModel(makeMeds(n), {}, { createdAt: at }), measure, TEAMS);

  it('한 쪽 최대 6종, 모든 약이 번호 순으로 한 번씩, 바닥글을 넘지 않는다', () => {
    for (const n of [1, 6, 7, 11, 20]) {
      const d = doc(n);
      const nos = d.pages.flatMap((p) => p.rows.filter((r) => r.kind === 'med').map((r) => (r.kind === 'med' ? r.med.no : 0)));
      expect(nos).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      for (const p of d.pages) {
        expect(p.rows.filter((r) => r.kind === 'med').length).toBeLessThanOrEqual(TEAMS.maxPerPage);
        const last = p.rows[p.rows.length - 1];
        expect(last.y + last.h).toBeLessThanOrEqual(BODY_BOTTOM + 1e-6);
        expect(p.rowH).toBeGreaterThanOrEqual(TEAMS.rowMin);
      }
    }
  });

  it('겉모습은 이름 칸, 용법은 1회 칸으로 합쳐 4열 — 글자는 종이보다 크다', () => {
    const t = doc(6);
    const paper = layoutDocument(buildPrintModel(makeMeds(6), {}, { createdAt: at }), measure);
    expect(t.merged).toBe(true);
    expect(t.pages[0].cols.map((c) => c.key)).toEqual(['no', 'photo', 'name', 'dose']);
    expect(t.pages[0].fonts.name.size).toBeGreaterThan(paper.pages[0].fonts.name.size * 1.4);
    const r = t.pages[0].rows.find((x) => x.kind === 'med');
    if (!r || r.kind !== 'med') throw new Error('med expected');
    expect(r.look.join(' ')).toContain('T0'); // 각인
    expect(r.freq.length).toBeGreaterThan(0);
  });
});
