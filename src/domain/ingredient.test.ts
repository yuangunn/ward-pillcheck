import { describe, it, expect } from 'vitest';
import { normalizeIngredient, decomposeIngredients, analyzeIngredientOverlap, koreanActiveIngredient } from './ingredient';

describe('normalizeIngredient', () => {
  it('염·수화물 접미어를 떼고 활성성분만 남긴다', () => {
    expect(normalizeIngredient('Atorvastatin Calcium Trihydrate')).toBe('atorvastatin');
    expect(normalizeIngredient('Amlodipine Besylate')).toBe('amlodipine');
    expect(normalizeIngredient('Amlodipine Camsylate')).toBe('amlodipine');
    expect(normalizeIngredient('Mosapride Citrate Dihydrate')).toBe('mosapride');
    expect(normalizeIngredient('Escitalopram Oxalate')).toBe('escitalopram');
    expect(normalizeIngredient('Losartan Potassium')).toBe('losartan');
  });
  it('염 없는 단일 성분은 그대로(소문자)', () => {
    expect(normalizeIngredient('Valsartan')).toBe('valsartan');
  });
  it('괄호·숫자·퍼센트 제거', () => {
    expect(normalizeIngredient('Tocopherol Acetate Powder 50%')).toBe('tocopherol');
    expect(normalizeIngredient('Rosuvastatin Calcium (as base)')).toBe('rosuvastatin');
  });
  it('활성성분인 acid·비타민명은 떼지 않는다(오축약 방지)', () => {
    expect(normalizeIngredient('Ascorbic Acid Coated')).toBe('ascorbic acid');
    expect(normalizeIngredient('Folic Acid')).toBe('folic acid');
  });
  it('모든 토큰이 염/제형이어도 최소 1개는 보존', () => {
    expect(normalizeIngredient('Calcium Citrate Hydrate')).toBe('calcium');
  });
  it('빈 입력은 빈 문자열', () => {
    expect(normalizeIngredient('')).toBe('');
  });
});

describe('decomposeIngredients', () => {
  it("복합제를 '/' 로 분해하고 각각 정규화", () => {
    expect(decomposeIngredients('Amlodipine Camsylate/Losartan Potassium')).toEqual([
      'amlodipine',
      'losartan',
    ]);
  });
  it("'·' 구분자도 분해", () => {
    expect(decomposeIngredients('Metformin Hydrochloride·Sitagliptin Phosphate Hydrate')).toEqual([
      'metformin',
      'sitagliptin',
    ]);
  });
  it('복합제 내 중복 나열은 1개로', () => {
    expect(decomposeIngredients('Dexibuprofen/Dexibuprofen')).toEqual(['dexibuprofen']);
  });
  it('빈/누락 입력은 빈 배열', () => {
    expect(decomposeIngredients(undefined)).toEqual([]);
    expect(decomposeIngredients('')).toEqual([]);
  });
});

describe('koreanActiveIngredient', () => {
  it('[코드] 접두를 제거하고 한글 성분만 남긴다 (실데이터)', () => {
    expect(koreanActiveIngredient('[M269062]모사프리드시트르산염이수화물')).toBe('모사프리드시트르산염이수화물');
  });
  it("복합·중복 나열('|')은 분해·중복제거 후 '/' 로 결합 (실데이터)", () => {
    expect(
      koreanActiveIngredient('[M088948]은행엽건조엑스|[M088948]은행엽건조엑스|[M088948]은행엽건조엑스'),
    ).toBe('은행엽건조엑스');
    expect(koreanActiveIngredient('[c1]암로디핀캄실산염|[c2]로사르탄칼륨')).toBe('암로디핀캄실산염/로사르탄칼륨');
  });
  it('빈/누락 입력은 빈 문자열', () => {
    expect(koreanActiveIngredient('')).toBe('');
    expect(koreanActiveIngredient(undefined)).toBe('');
    expect(koreanActiveIngredient('[M000]')).toBe(''); // 코드만 있고 이름 없음
  });
});

describe('analyzeIngredientOverlap', () => {
  const med = (id: string, name: string, itemSeq: string) => ({ id, name, itemSeq });

  it('단일약과 복합제가 활성성분을 공유하면 중복으로 잡는다 (암로디핀)', () => {
    const meds = [
      med('1', '노바스크정5mg', 'A'),
      med('2', '아모잘탄정5/50mg', 'B'),
      med('3', '타이레놀정500mg', 'C'),
    ];
    const ingr = new Map<string, string>([
      ['A', 'Amlodipine Besylate'],
      ['B', 'Amlodipine Camsylate/Losartan Potassium'],
      ['C', 'Acetaminophen'],
    ]);
    const res = analyzeIngredientOverlap(meds, ingr);
    expect(res).toEqual([
      { ingredient: 'Amlodipine', medNames: ['노바스크정5mg', '아모잘탄정5/50mg'] },
    ]);
  });

  it('세 약이 같은 성분을 공유하면 모두 묶고 공유 많은 순 정렬', () => {
    const meds = [
      med('1', '리피토정', 'A'),
      med('2', '리피로우정', 'B'),
      med('3', '아토르정', 'C'),
    ];
    const ingr = new Map<string, string>([
      ['A', 'Atorvastatin Calcium Trihydrate'],
      ['B', 'Atorvastatin Calcium'],
      ['C', 'Atorvastatin'],
    ]);
    const res = analyzeIngredientOverlap(meds, ingr);
    expect(res).toHaveLength(1);
    expect(res[0].ingredient).toBe('Atorvastatin');
    expect(res[0].medNames).toEqual(['리피토정', '리피로우정', '아토르정']);
  });

  it('겹치는 성분이 없으면 빈 배열', () => {
    const meds = [med('1', '발사르텔정', 'A'), med('2', '타이레놀정', 'B')];
    const ingr = new Map<string, string>([
      ['A', 'Valsartan'],
      ['B', 'Acetaminophen'],
    ]);
    expect(analyzeIngredientOverlap(meds, ingr)).toEqual([]);
  });

  it('성분 정보 없는 약은 무시(수기 입력 등)', () => {
    const meds = [med('1', '직접입력약', 'A'), med('2', '노바스크', 'B')];
    const ingr = new Map<string, string>([['B', 'Amlodipine Besylate']]);
    expect(analyzeIngredientOverlap(meds, ingr)).toEqual([]);
  });

  it('같은 약(동일 itemSeq)을 두 번 담아도 중복으로 잡는다', () => {
    const meds = [med('1', '노바스크정', 'A'), med('2', '노바스크정', 'A')];
    const ingr = new Map<string, string>([['A', 'Amlodipine Besylate']]);
    const res = analyzeIngredientOverlap(meds, ingr);
    expect(res).toHaveLength(1);
    expect(res[0].medNames).toHaveLength(2);
  });
});
