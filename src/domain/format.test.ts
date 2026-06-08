import { describe, it, expect } from 'vitest';
import {
  formatMedLine,
  formatAppearance,
  formatTabletCount,
  buildListText,
  blindLabel,
  cleanMarking,
  stripIngredient,
  tidyText,
} from './format';
import { freqShareTag } from '../constants/frequency';
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

describe('cleanMarking', () => {
  it('분할선 대시 런 → 공백, 연속 공백 → 1칸', () => {
    expect(cleanMarking('Neurontin®----------300mgVLE')).toBe('Neurontin® 300mgVLE');
    expect(cleanMarking('DW분할선FX                          40')).toBe('DW분할선FX 40');
  });
  it('단일 대시는 보존, 양끝 구분자 제거', () => {
    expect(cleanMarking('FX-40')).toBe('FX-40');
    expect(cleanMarking('  /Bayer/ ')).toBe('Bayer');
  });
  it('빈 값은 빈 문자열', () => {
    expect(cleanMarking(undefined)).toBe('');
    expect(cleanMarking('   ')).toBe('');
  });
});

describe('freqShareTag', () => {
  it('표준 용법(QD~QID/HS)은 태그 없음', () => {
    expect(freqShareTag('QD')).toBe('');
    expect(freqShareTag('TID')).toBe('');
    expect(freqShareTag('HS')).toBe('');
  });
  it('비표준 용법은 상세까지 압축', () => {
    expect(freqShareTag('주 1회(월)')).toBe('주1회·월');
    expect(freqShareTag('격일(홀수일)')).toBe('격일·홀수일');
    expect(freqShareTag('필요시(통증 시)')).toBe('필요시·통증 시');
  });
  it('괄호 없는 비표준/자유입력은 그대로', () => {
    expect(freqShareTag('필요시')).toBe('필요시');
    expect(freqShareTag('5일 복용 2일 휴약')).toBe('5일 복용 2일 휴약');
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

  it('옵션: 환자명 가리기 끄면 라벨 원문 노출(기본은 가림)', () => {
    const med: MedItem = { ...base, name: '트라젠타정', timings: ['아침식후'] };
    // 겉모습 OFF 로 깔끔히 비교
    expect(buildListText('김철수', [med], { appearance: false })).toBe('[김*수]\n<8am>\n트라젠타정 1T');
    expect(buildListText('김철수', [med], { appearance: false, mask: true })).toBe('[김*수]\n<8am>\n트라젠타정 1T');
    // mask:false → 원문
    expect(buildListText('김철수', [med], { appearance: false, mask: false })).toBe('[김철수]\n<8am>\n트라젠타정 1T');
    // 약 없을 때도 동일
    expect(buildListText('환자2', [], { mask: false })).toBe('[환자2]');
  });

  it('메모(특이사항)는 약(겉모습) 뒤에 ※로 붙는다', () => {
    const med: MedItem = { ...base, name: '암로디핀정', timings: ['아침식후'], memo: 'SBP 130 이상시 복용' };
    // 겉모습 뒤에 메모
    expect(buildListText('환자1', [med])).toBe('[환*1]\n<8am>\n암로디핀정 1T (흰/원형/Bayer) ※SBP 130 이상시 복용');
    // 겉모습 OFF 면 용량 뒤 바로 메모
    expect(buildListText('환자1', [med], { appearance: false })).toBe('[환*1]\n<8am>\n암로디핀정 1T ※SBP 130 이상시 복용');
    // 공백뿐인 메모는 무시
    expect(buildListText('환자1', [{ ...med, memo: '   ' }], { appearance: false })).toBe('[환*1]\n<8am>\n암로디핀정 1T');
  });

  it('비표준 용법은 줄 앞에 [태그] 로 보존(표준은 태그 없음)', () => {
    const weekly: MedItem = {
      ...base,
      name: '메토트렉세이트정',
      frequency: '주 1회(월)',
      timings: ['아침식후'],
      color: '',
      shape: '',
      marking: '',
    };
    expect(buildListText('환자1', [weekly])).toBe('[환*1]\n<8am>\n[주1회·월] 메토트렉세이트정 1T');
    // 필요시(사유)는 필요시 시점 그룹 + 태그에 사유 보존
    const prn: MedItem = { ...weekly, name: '트리돌정', frequency: '필요시(통증 시)', timings: ['필요시'] };
    expect(buildListText('환자1', [prn])).toBe('[환*1]\n<필요시>\n[필요시·통증 시] 트리돌정 1T');
  });

  it('각인의 분할선 대시·공백 런이 겉모습에서 정리된다', () => {
    const med: MedItem = {
      ...base,
      name: '뉴론틴캡슐',
      frequency: 'QD',
      timings: ['아침식후'],
      color: '노랑',
      shape: '장방형',
      marking: 'Neurontin®----------300mgVLE',
    };
    expect(buildListText('환자1', [med])).toBe('[환*1]\n<8am>\n뉴론틴캡슐 1T (노랑/장방형/Neurontin® 300mgVLE)');
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
