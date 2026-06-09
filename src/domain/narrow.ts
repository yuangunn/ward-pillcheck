import type { PillResult } from '../api/types';

// 결과 내 재검색(client-side): 이미 받아온 검색 결과를 키워드로 좁힌다(서버 재조회 없음).
// 공백으로 나눈 토큰을 "모두 포함(AND)"하는 결과만 남긴다.
// 매칭 필드: 품목명·업체명·주성분·앞/뒤 각인. 대소문자 무시(한글은 그대로 부분일치).
// 검색어가 비어 있으면 원본을 그대로 돌려준다.
export function narrowResults(results: PillResult[], term: string): PillResult[] {
  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return results;
  return results.filter((p) => {
    const hay = [p.itemName, p.entpName, p.ingredient, p.printFront, p.printBack]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}
