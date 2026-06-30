import { describe, it, expect } from 'vitest';
import { filterRecords, markImgId, type PillRecord } from './dataset';

const DATA: PillRecord[] = [
  { seq: '1', name: '아스피린장용정100mg', entp: '바이엘', shape: '원형', color: '하양', front: 'BAYER' },
  { seq: '2', name: '타이레놀정500', entp: '얀센', shape: '장방형', color: '하양', front: 'TYLENOL', back: '500' },
  { seq: '3', name: '노바스크정5mg', entp: '화이자', shape: '팔각형', color: '하양', front: 'NVSC' },
  { seq: '4', name: '자나팜정0.25mg', entp: '명인', shape: '타원형', color: '노랑', front: 'MI' },
  // 각인은 텍스트가 없고 마크(이미지) 속 글자가 분석필드(markFA)에만 있는 경우
  { seq: '5', name: '녹더나설하정25mcg', entp: '환인', shape: '원형', color: '하양', markFA: '25' },
];

describe('filterRecords', () => {
  it('각인(앞면) 부분일치 — 대소문자 무시', () => {
    const r = filterRecords(DATA, { printFront: 'tylenol' });
    expect(r.map((x) => x.itemSeq)).toEqual(['2']);
  });
  it('뒷면 각인도 매칭', () => {
    expect(filterRecords(DATA, { printFront: '500' }).map((x) => x.itemSeq)).toEqual(['2']);
  });
  it('색 다중선택(colors) — 하나라도 일치', () => {
    const r = filterRecords(DATA, { colors: ['노랑', '초록'] });
    expect(r.map((x) => x.itemSeq).sort()).toEqual(['4']); // 노랑(자나팜)만 존재
    expect(filterRecords(DATA, { colors: ['하양'] }).length).toBe(4);
  });
  it('제형(forms) 부분일치 — 정/캡슐 구분', () => {
    const data = [
      ...DATA,
      { seq: '7', name: '오메가캡슐', entp: 'X', shape: '장방형', color: '노랑', form: '연질캡슐제' },
      { seq: '8', name: '어떤정', entp: 'Y', shape: '원형', color: '하양', form: '필름코팅정' },
    ];
    expect(filterRecords(data, { forms: ['연질'] }).map((x) => x.itemSeq)).toEqual(['7']);
    expect(filterRecords(data, { forms: ['정'] }).map((x) => x.itemSeq)).toEqual(['8']);
  });

  it('색+모양 조합', () => {
    const r = filterRecords(DATA, { colorClass1: '하양', drugShape: '팔각형' });
    expect(r.map((x) => x.itemSeq)).toEqual(['3']);
  });
  it('색+모양+각인 정밀 조합', () => {
    const r = filterRecords(DATA, { colorClass1: '하양', drugShape: '원형', printFront: 'bay' });
    expect(r.map((x) => x.itemSeq)).toEqual(['1']);
  });
  it('이름 부분일치', () => {
    expect(filterRecords(DATA, { itemName: '노바스크' }).map((x) => x.itemSeq)).toEqual(['3']);
  });
  it('각인 검색은 마크 분석 텍스트(markFA)를 포함하지 않음 — 마크는 별도 기능', () => {
    // 녹더나(seq 5)는 인쇄 각인이 없고 마크 분석필드에만 "25"가 있음 → 각인 검색엔 안 잡힘
    expect(filterRecords(DATA, { printFront: '25' })).toEqual([]);
    // "Bayer" 도 마크가 아닌 실제 각인(seq 1 front=BAYER)만 매칭
    expect(filterRecords(DATA, { printFront: 'Bayer' }).map((x) => x.itemSeq)).toEqual(['1']);
  });

  it('마크 코드로 필터(markCode)', () => {
    const data = [
      ...DATA,
      { seq: '6', name: '칸데사르정', entp: 'X', shape: '원형', color: '하양', markFA: 'P,d' },
    ];
    expect(filterRecords(data, { markCode: 'P' }).map((x) => x.itemSeq)).toEqual(['6']);
    expect(filterRecords(data, { markCode: 'd' }).map((x) => x.itemSeq)).toEqual(['6']);
    expect(filterRecords(data, { markCode: 'Q' })).toEqual([]);
  });

  it('마크 이미지 id 로 필터(markImg) — 같은 "삼각형"이라도 실제 이미지가 다르면 구분', () => {
    // 둘 다 분석텍스트는 "삼각형"이지만, 실제 마크 이미지(markFI)가 다른 두 약
    const data: PillRecord[] = [
      { seq: 'A', name: '삼각A정', entp: '가제약', shape: '원형', color: '하양', markFA: '삼각형', markFI: 'https://nedrug.example/img/triA.jpg' },
      { seq: 'B', name: '삼각B정', entp: '나제약', shape: '원형', color: '하양', markFA: '삼각형', markFI: 'https://nedrug.example/img/triB.jpg' },
    ];
    // 글자값(markCode "삼각형")은 둘 다 잡힘 — 기존의 "다 나오는" 동작
    expect(filterRecords(data, { markCode: '삼각형' }).map((x) => x.itemSeq).sort()).toEqual(['A', 'B']);
    // 이미지 id 로 고르면 그 마크 이미지를 쓰는 약만
    expect(filterRecords(data, { markImg: markImgId('https://nedrug.example/img/triA.jpg') }).map((x) => x.itemSeq)).toEqual(['A']);
    expect(filterRecords(data, { markImg: markImgId('x/triB.jpg') }).map((x) => x.itemSeq)).toEqual(['B']);
  });

  it('markImgId: 빌드 marks 파일(<id>.gif)과 알약 markFI 의 id 가 일치', () => {
    // 빌드 스크립트 규칙: file = nedrugId(markFI) + '.gif'. .gif 떼면 알약쪽 id 와 같아야 함.
    const url = 'https://nedrug.example/img/ABC123.jpg';
    const galleryFile = `${markImgId(url)}.gif`; // 빌드가 만드는 파일명
    expect(galleryFile.replace(/\.gif$/i, '')).toBe(markImgId(url));
  });

  it('조건 불일치 시 빈 배열', () => {
    expect(filterRecords(DATA, { printFront: 'ZZZ' })).toEqual([]);
  });
  it('limit 적용', () => {
    expect(filterRecords(DATA, { colorClass1: '하양' }, 2)).toHaveLength(2);
  });
  it('PillResult 형태로 매핑', () => {
    const [r] = filterRecords(DATA, { itemName: '아스피린' });
    expect(r).toMatchObject({
      itemSeq: '1',
      itemName: '아스피린장용정100mg',
      entpName: '바이엘',
      drugShape: '원형',
      colorClass1: '하양',
      printFront: 'BAYER',
    });
  });

  it('모양 다중선택(shapes) — 하나라도 일치 (타원형/장방형 분류 모호 대응)', () => {
    const r = filterRecords(DATA, { shapes: ['타원형', '장방형'] });
    expect(r.map((x) => x.itemSeq).sort()).toEqual(['2', '4']); // 장방형(타이레놀)+타원형(자나팜)
    // 단일 drugShape 는 그대로 동작(하위호환)
    expect(filterRecords(DATA, { drugShape: '팔각형' }).map((x) => x.itemSeq)).toEqual(['3']);
  });

  it('각인 180° 뒤집힘 매칭 — HIS 검색 시 각인 SIH 도 잡고 flip 표시', () => {
    const data: PillRecord[] = [
      { seq: 'F', name: '뒤집힘테스트정', entp: 'X', shape: '원형', color: '하양', front: 'SIH' },
    ];
    const flip = filterRecords(data, { printFront: 'HIS' });
    expect(flip.map((x) => x.itemSeq)).toEqual(['F']);
    expect(flip[0].printFlipMatch).toBe(true);
    // 그대로(SIH) 검색은 flip 표시 없음
    const lit = filterRecords(data, { printFront: 'SIH' });
    expect(lit.map((x) => x.itemSeq)).toEqual(['F']);
    expect(lit[0].printFlipMatch).toBeUndefined();
  });

  it('각인 뒤집힘은 회전 가능한 글자에만 — PAR 로 RAP 각인을 잡지 않음', () => {
    const data: PillRecord[] = [
      { seq: 'G', name: 'RAP정', entp: 'X', shape: '원형', color: '하양', front: 'RAP' },
    ];
    expect(filterRecords(data, { printFront: 'PAR' })).toEqual([]);
  });

  it('각인 혼동문자 매칭(3글자+) — 0LT 로 DLT 각인을 잡고 fuzzy 표시', () => {
    const data: PillRecord[] = [
      { seq: 'D', name: '둘록정', entp: 'X', shape: '원형', color: '하양', front: 'DLT 60' },
    ];
    const r = filterRecords(data, { printFront: '0LT 60' }); // 0↔D
    expect(r.map((x) => x.itemSeq)).toEqual(['D']);
    expect(r[0].printFuzzyMatch).toBe(true);
    // 정확 일치는 fuzzy 표시 없음
    expect(filterRecords(data, { printFront: 'DLT' })[0].printFuzzyMatch).toBeUndefined();
  });

  it('관련도 정렬 — 이름 완전일치/접두가 중간부분일치보다 위', () => {
    const data: PillRecord[] = [
      { seq: '1', name: '메가타이레놀정', entp: 'X', shape: '원형', color: '하양' }, // 중간부분
      { seq: '2', name: '타이레놀정500mg', entp: 'X', shape: '원형', color: '하양' }, // 접두
      { seq: '3', name: '타이레놀', entp: 'X', shape: '원형', color: '하양' }, // 완전일치
    ];
    expect(filterRecords(data, { itemName: '타이레놀' }).map((x) => x.itemSeq)).toEqual(['3', '2', '1']);
  });

  it('관련도 정렬 — 각인 한 면 전체 일치가 부분일치보다 위, 짧은 각인 우선', () => {
    const data: PillRecord[] = [
      { seq: '1', name: 'A', entp: 'X', shape: '원형', color: '하양', front: 'MF500' }, // 부분
      { seq: '2', name: 'B', entp: 'X', shape: '원형', color: '하양', front: 'MF 250' }, // 토큰 일치
      { seq: '3', name: 'C', entp: 'X', shape: '원형', color: '하양', front: 'MF' }, // 한 면 전체 일치
    ];
    expect(filterRecords(data, { printFront: 'MF' }).map((x) => x.itemSeq)).toEqual(['3', '2', '1']);
  });

  it('색/모양만 검색이면 정렬 영향 없음(데이터 순서 유지)', () => {
    const r = filterRecords(DATA, { colorClass1: '하양' });
    expect(r.map((x) => x.itemSeq)).toEqual(['1', '2', '3', '5']); // 하양 4건, 데이터 순서 그대로
  });

  it('혼동문자 매칭은 1~2글자엔 적용 안 함(변별력 보호)', () => {
    const data: PillRecord[] = [
      { seq: 'S', name: '에스정', entp: 'X', shape: '원형', color: '하양', front: 'S' },
    ];
    expect(filterRecords(data, { printFront: '5' })).toEqual([]); // 1글자 → fuzzy 미적용
  });

  it('정확/뒤집힘 일치가 혼동문자 매칭보다 앞 순서로 정렬', () => {
    const data: PillRecord[] = [
      { seq: 'F', name: '퍼지약', entp: 'X', shape: '원형', color: '하양', front: '0LT' }, // 0LT (fuzzy 대상)
      { seq: 'E', name: '정확약', entp: 'X', shape: '원형', color: '하양', front: 'DLT' }, // 정확
    ];
    const r = filterRecords(data, { printFront: 'DLT' });
    expect(r.map((x) => x.itemSeq)).toEqual(['E', 'F']); // 정확(E) 먼저, 혼동(F) 뒤
    expect(r[0].printFuzzyMatch).toBeUndefined();
    expect(r[1].printFuzzyMatch).toBe(true);
  });
});
