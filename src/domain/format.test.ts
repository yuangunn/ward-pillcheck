import { describe, it, expect } from 'vitest';
import {
  formatMedLine,
  formatAppearance,
  formatTabletCount,
  buildListText,
  blindLabel,
  stripIngredient,
  tidyText,
} from './format';
import type { MedItem } from './models';

const base: MedItem = {
  id: '1',
  itemSeq: '195700020',
  name: '아스피린장용정100mg',
  tabletCount: 1,
  frequency: 'QD',
  timings: ['아침식후'],
  color: '흰',
  shape: '원형',
  marking: 'Bayer',
  createdAt: 0,
};

describe('formatTabletCount', () => {
  it('정수는 그대로', () => {
    expect(formatTabletCount(1)).toBe('1');
    expect(formatTabletCount(2)).toBe('2');
  });
  it('소수는 소수점 유지', () => {
    expect(formatTabletCount(0.5)).toBe('0.5');
    expect(formatTabletCount(1.5)).toBe('1.5');
  });
});

describe('formatAppearance', () => {
  it('색/모양/각인 모두 있으면 괄호로 묶음', () => {
    expect(formatAppearance(base)).toBe('(흰/원형/Bayer)');
  });
  it('일부만 있으면 있는 것만', () => {
    expect(formatAppearance({ color: '흰', shape: '', marking: undefined })).toBe('(흰)');
  });
  it('아무 것도 없으면 빈 문자열', () => {
    expect(formatAppearance({ color: '', shape: '', marking: '' })).toBe('');
    expect(formatAppearance({})).toBe('');
  });
});

describe('formatMedLine', () => {
  it('명세 예시 포맷과 일치', () => {
    expect(formatMedLine(base)).toBe('아스피린장용정100mg 1T QD 아침식후 (흰/원형/Bayer)');
  });
  it('소수 정제 + 외형 일부', () => {
    const med: MedItem = {
      ...base,
      name: '자나팜 0.25mg',
      tabletCount: 0.5,
      timings: ['자기전'],
      color: '흰',
      shape: '타원',
      marking: 'MYUNGIN 25',
    };
    expect(formatMedLine(med)).toBe('자나팜 0.25mg 0.5T QD 자기전 (흰/타원/MYUNGIN 25)');
  });
  it('외형 정보가 전혀 없으면 괄호 없이 끝남', () => {
    const med: MedItem = { ...base, color: undefined, shape: undefined, marking: undefined };
    expect(formatMedLine(med)).toBe('아스피린장용정100mg 1T QD 아침식후');
  });
  it('복용시점이 여러 개면 콤마로 연결', () => {
    const med: MedItem = {
      ...base,
      name: '메트포르민500mg',
      frequency: 'BID',
      timings: ['아침식후', '저녁식후'],
      color: undefined,
      shape: undefined,
      marking: undefined,
    };
    expect(formatMedLine(med)).toBe('메트포르민500mg 1T BID 아침식후,저녁식후');
  });
});

describe('blindLabel', () => {
  it('가운데를 *로 가림(첫·끝만 노출)', () => {
    expect(blindLabel('환자1')).toBe('환*1');
    expect(blindLabel('김철수')).toBe('김*수');
    expect(blindLabel('김철수민')).toBe('김**민');
    expect(blindLabel('김수')).toBe('김*');
    expect(blindLabel('김')).toBe('김');
  });
});

describe('stripIngredient', () => {
  it('성분 괄호 제거', () => {
    expect(stripIngredient('트라젠타정(리나글립틴)')).toBe('트라젠타정');
    expect(stripIngredient('스틸녹스CR정6.25밀리그램(졸피뎀타르타르산염)')).toBe('스틸녹스CR정6.25밀리그램');
    expect(stripIngredient('아스피린프로텍트정100밀리그람')).toBe('아스피린프로텍트정100밀리그람');
  });
});

describe('tidyText', () => {
  it('빈 줄 3개 이상을 1개로 압축', () => {
    expect(tidyText('A\n\n\n\nB')).toBe('A\n\nB');
  });
  it('한 줄 간격(\\n\\n)은 유지', () => {
    expect(tidyText('1) 정맥주사\n\n성인...\n\n2) 근육주사')).toBe('1) 정맥주사\n\n성인...\n\n2) 근육주사');
  });
  it('줄 끝 공백·양끝 공백 제거, CRLF 처리', () => {
    expect(tidyText('  A  \r\n\r\n\r\nB \n\n')).toBe('A\n\nB');
  });
  it('빈 입력은 빈 문자열', () => {
    expect(tidyText('')).toBe('');
  });
});

describe('buildListText (블라인드 + 시점 범주화)', () => {
  it('약이 없으면 블라인드 헤더만', () => {
    expect(buildListText('환자2', [])).toBe('[환*2]');
  });

  it('옵션: 성분명 포함 / 겉모습 제외', () => {
    const med: MedItem = {
      ...base,
      name: '트라젠타정(리나글립틴)',
      timings: ['아침식후'],
      color: '분홍',
      shape: '원형',
      marking: '마크',
    };
    // 기본(성분 제외·겉모습 포함)
    expect(buildListText('환자1', [med])).toBe('[환*1]\n<8am>\n트라젠타정 1T (분홍/원형/마크)');
    // 성분명 ON
    expect(buildListText('환자1', [med], { ingredient: true })).toBe(
      '[환*1]\n<8am>\n트라젠타정(리나글립틴) 1T (분홍/원형/마크)',
    );
    // 겉모습 OFF
    expect(buildListText('환자1', [med], { appearance: false })).toBe('[환*1]\n<8am>\n트라젠타정 1T');
    // 둘 다: 성분 ON + 겉모습 OFF
    expect(buildListText('환자1', [med], { ingredient: true, appearance: false })).toBe(
      '[환*1]\n<8am>\n트라젠타정(리나글립틴) 1T',
    );
  });

  it('명세 예시와 일치: 시점 패턴별 그룹·시간순 정렬', () => {
    const mk = (
      id: string,
      name: string,
      timings: string[],
      color: string,
      shape: string,
      marking: string,
    ): MedItem => ({ ...base, id, name, timings, color, shape, marking, frequency: 'QD' });
    const meds: MedItem[] = [
      mk('1', '아스피린프로텍트정100밀리그람', ['아침식후'], '하양', '원형', 'Bayer'),
      mk('2', '트라젠타정(리나글립틴)', ['아침식후'], '분홍', '원형', '마크'),
      mk('3', '캐롤에프정(이부프로펜아르기닌)', ['아침식후', '저녁식후'], '분홍', '타원형', 'ID C·F'),
      mk('4', '모티리톤정', ['아침식후', '점심식후', '저녁식후'], '분홍', '타원형', 'MTL'),
      mk('5', '스틸녹스CR정6.25밀리그램(졸피뎀타르타르산염)', ['자기전'], '분홍', '원형', 'ZMR'),
    ];
    expect(buildListText('환자1', meds)).toBe(
      [
        '[환*1]',
        '<8am>',
        '아스피린프로텍트정100밀리그람 1T (하양/원형/Bayer)',
        '트라젠타정 1T (분홍/원형/마크)',
        '',
        '<8am 6pm>',
        '캐롤에프정 1T (분홍/타원형/ID C·F)',
        '',
        '<8am 1pm 6pm>',
        '모티리톤정 1T (분홍/타원형/MTL)',
        '',
        '<9pm>',
        '스틸녹스CR정6.25밀리그램 1T (분홍/원형/ZMR)',
      ].join('\n'),
    );
  });
});
