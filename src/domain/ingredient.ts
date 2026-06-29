import type { MedItem } from './models';

// 성분 중복(중복투약) 점검 — 복합제를 개별 성분으로 분해해, 환자 리스트에서 겹치는
// 활성성분을 찾아낸다. 지참약은 같은 성분을 다른 상품명으로 중복 지참하는 일이 잦다
// (예: 노바스크정[암로디핀] + 아모잘탄정[암로디핀+로사르탄] → 암로디핀 중복).
//
// 식약처 성분 문자열은 영문(INN) 표기이며,
//  - 복합제는 '/' '·' 등으로 여러 성분이 나열됨 → 분해
//  - 각 성분의 염/수화물/제형 접미어를 떼어 '활성성분 기본형'으로 정규화
//    (예: 'Atorvastatin Calcium Trihydrate' → 'atorvastatin')
// 완전 오프라인·순수 함수. 식별 보조이며 최종 판단은 의료진 책임.

/**
 * 떼어낼 염/수화물/제형/수식 토큰(활성성분이 아닌 부가어).
 * 실제 데이터의 토큰 빈도에서 도출. 그 자체가 활성성분일 수 있는 토큰
 * (acid·비타민명: nicotinamide/riboflavin/pyridoxine/cholecalciferol/tocopherol 등,
 *  oxide 처럼 제산제 활성)은 의도적으로 제외해 오축약을 막는다.
 */
const SALT_FORM_TOKENS = new Set<string>([
  // 수화물 / 무수물
  'hydrate', 'monohydrate', 'dihydrate', 'trihydrate', 'tetrahydrate', 'pentahydrate',
  'hemihydrate', 'sesquihydrate', 'anhydrous', 'hydrous',
  // 짝이온(염)
  'hydrochloride', 'dihydrochloride', 'hydrobromide', 'bromide', 'chloride',
  'sodium', 'disodium', 'potassium', 'dipotassium', 'calcium', 'magnesium',
  'besylate', 'besilate', 'mesylate', 'mesilate', 'camsylate', 'camsilate',
  'maleate', 'dimaleate', 'fumarate', 'hemifumarate', 'succinate', 'tartrate', 'bitartrate', 'hemitartrate',
  'citrate', 'acetate', 'phosphate', 'diphosphate', 'sulfate', 'sulphate', 'oxalate', 'nitrate',
  'tosylate', 'pamoate', 'embonate', 'napadisilate', 'edisylate', 'isethionate', 'xinafoate',
  // 제형 / 물리적 수식
  'powder', 'granules', 'granule', 'micronized', 'micronised', 'coated', 'concentrate', 'dried',
]);

/**
 * 성분 1건을 '활성성분 기본형'으로 정규화.
 * 소문자화 → 괄호·숫자·기호 제거 → 토큰화 → 뒤에서부터 염/제형 토큰 제거(최소 1토큰은 보존).
 * 예: 'Atorvastatin Calcium Trihydrate' → 'atorvastatin', 'Valsartan' → 'valsartan',
 *     'Calcium Citrate Hydrate' → 'calcium'.
 */
export function normalizeIngredient(raw: string): string {
  if (!raw) return '';
  let s = raw.toLowerCase();
  s = s.replace(/\([^)]*\)/g, ' '); // 괄호 안 제거
  s = s.replace(/[^a-z\s-]/g, ' '); // 영문·공백·하이픈만 남김(숫자·% 포함 제거)
  const toks = s.split(/[\s-]+/).filter(Boolean);
  // 뒤에서부터 염/수화물/제형 토큰 제거 — 활성 토큰이 최소 1개는 남도록.
  while (toks.length > 1 && SALT_FORM_TOKENS.has(toks[toks.length - 1])) toks.pop();
  return toks.join(' ');
}

/**
 * 성분 문자열(복합제 포함)을 활성성분 기본형 목록으로 분해.
 * 구분자 '/' '·' ',' ';' '|' 로 나누고, 각 성분을 정규화·중복 제거.
 */
export function decomposeIngredients(ingr: string | undefined | null): string[] {
  if (!ingr) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of ingr.split(/[/·,;|]+/)) {
    const base = normalizeIngredient(part);
    if (base && !seen.has(base)) {
      seen.add(base);
      out.push(base);
    }
  }
  return out;
}

/** 표시용: 영문 기본형을 단어별 첫 글자 대문자로(예: 'amlodipine' → 'Amlodipine'). */
function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** 성분 중복 1건 — 두 개 이상의 약이 공유하는 활성성분과 그 약들. */
export interface IngredientOverlap {
  ingredient: string; // 표시용 활성성분 기본형(영문 Title Case)
  medNames: string[]; // 이 성분을 공유하는 약 이름(중복 제거)
}

type MedLike = Pick<MedItem, 'id' | 'name' | 'itemSeq'>;

/**
 * 환자 약 리스트에서 활성성분이 겹치는(중복투약 위험) 조합을 찾는다(순수 함수).
 * @param meds 환자 약 리스트
 * @param ingrBySeq itemSeq → 성분 문자열(번들/mock 데이터에서 조회)
 * @returns 2개 이상의 약이 공유하는 성분별 경고 목록
 */
export function analyzeIngredientOverlap(
  meds: MedLike[],
  ingrBySeq: Map<string, string>,
): IngredientOverlap[] {
  // 활성성분(정규화) → { 표시명, medId→medName }
  const byIngredient = new Map<string, { display: string; meds: Map<string, string> }>();
  for (const m of meds) {
    if (!m.itemSeq) continue;
    for (const base of decomposeIngredients(ingrBySeq.get(m.itemSeq))) {
      const entry = byIngredient.get(base) ?? { display: titleCase(base), meds: new Map() };
      entry.meds.set(m.id, m.name); // 같은 약(동일 id)은 한 번만
      byIngredient.set(base, entry);
    }
  }
  const out: IngredientOverlap[] = [];
  for (const entry of byIngredient.values()) {
    if (entry.meds.size >= 2) out.push({ ingredient: entry.display, medNames: [...entry.meds.values()] });
  }
  // 공유 약이 많은 순 → 성분명 순으로 안정 정렬
  out.sort((a, b) => b.medNames.length - a.medNames.length || a.ingredient.localeCompare(b.ingredient));
  return out;
}
