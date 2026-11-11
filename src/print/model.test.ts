import { describe, it, expect } from 'vitest';
import type { MedItem } from '../domain/models';
import { buildPrintModel, buildPrintSafety, formatPrintDate, printFileName } from './model';
import type { SafetyResult } from '../api/safety';

const med = (over: Partial<MedItem>): MedItem => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  itemSeq: '',
  name: '약',
  tabletCount: 1,
  frequency: 'QD',
  timings: ['아침식후'],
  createdAt: 0,
  ...over,
});

const clean: SafetyResult = {
  dur: { combos: [], flags: [] },
  durStatus: 'bundle',
  overlaps: [],
  splitCrush: [],
  checkedAt: new Date(2026, 10, 11, 14, 31).getTime(),
};

const at = new Date(2026, 10, 11, 14, 32);

describe('buildPrintModel', () => {
  it('환자 라벨을 입력으로 받지 않으며 결과 어디에도 없다', () => {
    const m = buildPrintModel([med({ name: '아스피린장용정100mg' })], {}, clean, { createdAt: at });
    expect(JSON.stringify(m)).not.toMatch(/환자|병상/);
  });

  it('Teams 인계와 같은 시점 묶음·순서, 번호는 묶음을 넘어 이어진다', () => {
    const meds = [
      med({ name: 'B', frequency: 'BID', timings: ['아침식후', '저녁식후'] }),
      med({ name: 'A', timings: ['아침식후'] }),
      med({ name: 'W', frequency: '주 1회(월)', timings: ['아침식후'] }),
      med({ name: 'P', frequency: '필요시(통증 시)', timings: ['필요시'] }),
    ];
    const m = buildPrintModel(meds, {}, clean, { createdAt: at });
    expect(m.groups.map((g) => g.title)).toEqual(['8am', '8am 6pm', 'QW/월 8am', 'PRN/통증 시']);
    expect(m.groups.map((g) => g.meds.map((x) => `${x.no}${x.name}`))).toEqual([['1A'], ['2B'], ['3W'], ['4P']]);
    expect(m.groups[1].note).toBe('아침식후 · 저녁식후');
    expect(m.groups[2]).toMatchObject({ special: true, note: '주 1회 — 매일 주지 않도록 주의 · 아침식후' });
    expect(m.groups[3]).toMatchObject({ special: true, note: '필요시에만' });
    expect(m.groups[2].meds[0].freq).toBe('QW/월');
  });

  it('성분·영문·분할분쇄·겉모습·용량을 채운다', () => {
    const m = buildPrintModel(
      [
        med({
          itemSeq: '1',
          name: '리피토정10밀리그램(아토르바스타틴칼슘삼수화물)',
          color: '하양',
          shape: '원형',
          marking: 'ATV----10',
          memo: ' 금식 시 보류 ',
        }),
        med({ itemSeq: '2', name: '란투스주솔로스타', tabletCount: 10, doseUnit: 'U', timings: ['자기전'] }),
      ],
      {
        ingrKo: new Map([['1', '아토르바스타틴칼슘삼수화물']]),
        eng: new Map([['1', 'Lipitor  Tab. 10mg']]),
        forms: new Map([['1', '서방성필름코팅정']]),
      },
      clean,
      { createdAt: at },
    );
    const [lip] = m.groups[0].meds;
    expect(lip).toMatchObject({
      name: '리피토정10밀리그램', // 성분 줄이 있으면 괄호 성분은 뺀다
      sub: '아토르바스타틴칼슘삼수화물 · Lipitor Tab. 10mg',
      warn: '분할·분쇄 금지(서방)',
      appearance: '하양 / 원형 / ATV 10',
      memo: '금식 시 보류',
      dose: '1T',
    });
    const [lan] = m.groups[1].meds;
    expect(lan).toMatchObject({ name: '란투스주솔로스타', sub: '', warn: '', appearance: '', dose: '10U' });
  });

  it('성분 정보가 없으면 품목명 괄호를 그대로 둔다', () => {
    const m = buildPrintModel([med({ name: '트라젠타정(리나글립틴)' })], {}, clean, { createdAt: at });
    expect(m.groups[0].meds[0].name).toBe('트라젠타정(리나글립틴)');
  });
});

describe('buildPrintSafety', () => {
  it('문제 없음 / DUR 미점검 / 점검 실패를 구분한다', () => {
    expect(buildPrintSafety(clean)).toMatchObject({ level: 'clear', headline: '특이사항 없음' });
    expect(buildPrintSafety(clean).sub).toContain('DUR(기기 데이터)');
    expect(buildPrintSafety({ ...clean, durStatus: 'unavailable' })).toMatchObject({ level: 'unchecked', headline: 'DUR 미점검' });
    expect(buildPrintSafety(null)).toMatchObject({ level: 'unchecked', headline: '점검 못 함' });
  });

  it('항목 순서: 병용금기 → 성분중복 → 분할분쇄 → 약별 주의(종류별 한 줄)', () => {
    const s = buildPrintSafety({
      ...clean,
      dur: {
        combos: [{ aName: 'A정(성분a)', bName: 'B', content: '병용 시 위험' }],
        flags: [
          { medId: 'x', name: 'C정10밀리그램(성분c)', kinds: [{ type: '노인주의', content: '신중' }, { type: '효능군중복' }] },
          { medId: 'z', name: 'E', kinds: [{ type: '노인주의', content: '낙상' }] },
        ],
      },
      overlaps: [{ ingredient: 'Amlodipine', medNames: ['노바스크', '아모잘탄'] }],
      splitCrush: [{ medId: 'y', medName: 'D', kind: '장용정', reason: '부수면 안 됨' }],
    });
    expect(s.level).toBe('issues');
    expect(s.headline).toBe('확인 필요 3건'); // 리스트 안의 문제만 센다
    expect(s.items.map((i) => i.tag)).toEqual(['병용금기', '성분중복', '분할·분쇄 주의', '노인주의', '효능군중복']);
    expect(s.items[0].title).toBe('A정 + B'); // 성분 괄호는 줄여서
    expect(s.items[3]).toMatchObject({ strong: false, title: '', body: 'C정10밀리그램, E' });
    expect(s.items[4]).toMatchObject({ body: 'C정10밀리그램' });
  });

  it('약별 주의만 있으면 그 종 수를 제목으로', () => {
    const s = buildPrintSafety({
      ...clean,
      dur: { combos: [], flags: [{ medId: 'x', name: 'C', kinds: [{ type: '임부금기' }] }] },
    });
    expect(s).toMatchObject({ level: 'issues', headline: '약별 주의 1종' });
  });
});

describe('표기', () => {
  it('작성일시·파일명(환자 정보 없음)', () => {
    expect(formatPrintDate(at)).toBe('2026-11-11 (수) 14:32');
    expect(printFileName(at)).toBe('지참약확인표_20261111_1432.pdf');
  });
});
