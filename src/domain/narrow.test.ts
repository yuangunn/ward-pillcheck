import { describe, it, expect } from 'vitest';
import { narrowResults } from './narrow';
import type { PillResult } from '../api/types';

const mk = (o: Partial<PillResult>): PillResult => ({
  itemSeq: 's',
  itemName: '',
  entpName: '',
  ...o,
});

const data: PillResult[] = [
  mk({ itemSeq: '1', itemName: '타이레놀정500mg', entpName: '한국얀센', ingredient: '아세트아미노펜', printFront: 'TYLENOL' }),
  mk({ itemSeq: '2', itemName: '노바스크정5mg', entpName: '한국화이자', ingredient: '암로디핀베실산염', printFront: '5' }),
  mk({ itemSeq: '3', itemName: '아스피린프로텍트정100mg', entpName: '바이엘코리아', ingredient: '아세틸살리실산', printFront: 'BAYER', printBack: 'ASP' }),
];

const seqs = (r: PillResult[]) => r.map((p) => p.itemSeq);

describe('narrowResults (결과 내 재검색)', () => {
  it('빈 검색어면 원본을 그대로 돌려준다', () => {
    expect(narrowResults(data, '')).toHaveLength(3);
    expect(narrowResults(data, '   ')).toHaveLength(3);
  });

  it('품목명 부분일치로 좁힌다', () => {
    expect(seqs(narrowResults(data, '타이'))).toEqual(['1']);
  });

  it('업체명으로 좁힌다', () => {
    expect(seqs(narrowResults(data, '화이자'))).toEqual(['2']);
  });

  it('주성분으로 좁힌다', () => {
    expect(seqs(narrowResults(data, '살리실산'))).toEqual(['3']);
  });

  it('각인은 대소문자를 무시한다', () => {
    expect(seqs(narrowResults(data, 'bayer'))).toEqual(['3']);
    expect(seqs(narrowResults(data, 'asp'))).toEqual(['3']); // 뒤 각인
  });

  it('공백으로 나눈 여러 토큰은 모두 포함(AND)해야 한다', () => {
    // '정'은 셋 다, '100'은 3번만 → 교집합 [3]
    expect(seqs(narrowResults(data, '정 100'))).toEqual(['3']);
  });

  it('매칭이 없으면 빈 배열', () => {
    expect(narrowResults(data, '존재하지않는약')).toEqual([]);
  });

  it('성분·각인이 없는 결과도 안전하게 처리한다', () => {
    const sparse = [mk({ itemSeq: 'x', itemName: '게보린정', entpName: '삼진제약' })];
    expect(seqs(narrowResults(sparse, '게보린'))).toEqual(['x']);
    expect(narrowResults(sparse, 'zzz')).toEqual([]);
  });
});
