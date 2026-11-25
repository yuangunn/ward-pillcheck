import { describe, it, expect } from 'vitest';
import type { MedItem } from '../domain/models';
import { buildPrintModel, formatDrugClass, formatPrintDate, printFileName } from './model';

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

const at = new Date(2026, 10, 11, 14, 32);

describe('buildPrintModel', () => {
  it('환자 라벨·점검 결과를 담지 않는다', () => {
    const m = buildPrintModel([med({ name: '아스피린장용정100mg' })], {}, { createdAt: at });
    expect(JSON.stringify(m)).not.toMatch(/환자|병상/);
    expect(m).not.toHaveProperty('safety');
  });

  it('Teams 인계와 같은 시점 묶음·순서, 번호는 묶음을 넘어 이어진다', () => {
    const meds = [
      med({ name: 'B', frequency: 'BID', timings: ['아침식후', '저녁식후'] }),
      med({ name: 'A', timings: ['아침식후'] }),
      med({ name: 'W', frequency: '주 1회(월)', timings: ['아침식후'] }),
      med({ name: 'P', frequency: '필요시(통증 시)', timings: ['필요시'] }),
    ];
    const m = buildPrintModel(meds, {}, { createdAt: at });
    expect(m.groups.map((g) => g.title)).toEqual(['8am', '8am 6pm', 'QW/월 8am', 'PRN/통증 시']);
    expect(m.groups.map((g) => g.meds.map((x) => `${x.no}${x.name}`))).toEqual([['1A'], ['2B'], ['3W'], ['4P']]);
    expect(m.groups[1].note).toBe('아침식후 · 저녁식후');
    expect(m.groups[2]).toMatchObject({ special: true, note: '주 1회 — 매일 주지 않도록 주의 · 아침식후' });
    expect(m.groups[3]).toMatchObject({ special: true, note: '필요시에만' });
    expect(m.groups[2].meds[0].freq).toBe('QW/월');
  });

  it('성분·영문·겉모습·용량을 채운다(분할분쇄 등 점검 표시는 없음)', () => {
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
        cls: new Map([['1', '동맥경화용제']]),
      },
      { createdAt: at },
    );
    const [lip] = m.groups[0].meds;
    expect(lip).toMatchObject({
      name: '리피토정10밀리그램', // 성분 줄이 있으면 괄호 성분은 뺀다
      sub: '아토르바스타틴칼슘삼수화물 · Lipitor Tab. 10mg',
      cls: '동맥경화용제',
      appearance: '하양 / 원형 / ATV 10',
      memo: '금식 시 보류',
      dose: '1T',
    });
    expect(lip).not.toHaveProperty('warn');
    expect(lip.glyph).toEqual({ color: '하양', shape: '원형', marking: 'ATV----10' }); // 사진 대체 그림 재료
    const [lan] = m.groups[1].meds;
    expect(lan).toMatchObject({ name: '란투스주솔로스타', sub: '', cls: '', appearance: '', dose: '10U' });
    expect(lan.glyph).toBeUndefined(); // 색·모양 없는 주사제는 그림 없이 글자만
  });

  it('성분 정보가 없으면 품목명 괄호를 그대로 둔다', () => {
    const m = buildPrintModel([med({ name: '트라젠타정(리나글립틴)' })], {}, { createdAt: at });
    expect(m.groups[0].meds[0].name).toBe('트라젠타정(리나글립틴)');
  });
});

describe('표기', () => {
  it('식약처 분류명은 점을 가운뎃점으로', () => {
    expect(formatDrugClass('해열.진통.소염제')).toBe('해열·진통·소염제');
    expect(formatDrugClass(' 혈압강하제 ')).toBe('혈압강하제');
    expect(formatDrugClass(undefined)).toBe('');
  });

  it('작성일시·파일명(환자 정보 없음)', () => {
    expect(formatPrintDate(at)).toBe('2026-11-11 (수) 14:32');
    expect(printFileName(at)).toBe('지참약식별표_20261111_1432.jpg');
    expect(printFileName(at, 2, 3)).toBe('지참약식별표_20261111_1432_2of3.jpg');
    expect(printFileName(at, 1, 3, 'pdf')).toBe('지참약식별표_20261111_1432.pdf'); // PDF 는 한 파일
  });
});
