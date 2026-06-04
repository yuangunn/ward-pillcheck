import { describe, it, expect } from 'vitest';
import { filterRecords, type PillRecord } from './dataset';

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
});
