// 실물 역방향 검색용 색/모양 칩 프리셋.
// 식약처 낱알식별 API의 color_class1 / drug_shape 값과 동일한 한글 문자열을 사용.

/** 색상 칩: label = 화면표시, value = API color_class1 파라미터 값 */
export interface ColorOption {
  label: string;
  value: string;
  /** 칩 미리보기용 색(가독성을 위해 근사치) */
  swatch: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { label: '하양', value: '하양', swatch: '#ffffff' },
  { label: '노랑', value: '노랑', swatch: '#f4d03f' },
  { label: '주황', value: '주황', swatch: '#e67e22' },
  { label: '분홍', value: '분홍', swatch: '#f1948a' },
  { label: '빨강', value: '빨강', swatch: '#e74c3c' },
  { label: '갈색', value: '갈색', swatch: '#8d6e63' },
  { label: '연두', value: '연두', swatch: '#a3d977' },
  { label: '초록', value: '초록', swatch: '#27ae60' },
  { label: '청록', value: '청록', swatch: '#16a085' },
  { label: '파랑', value: '파랑', swatch: '#3498db' },
  { label: '남색', value: '남색', swatch: '#34495e' },
  { label: '자주', value: '자주', swatch: '#8e44ad' },
  { label: '보라', value: '보라', swatch: '#9b59b6' },
  { label: '회색', value: '회색', swatch: '#95a5a6' },
  { label: '검정', value: '검정', swatch: '#2c3e50' },
  { label: '투명', value: '투명', swatch: '#e8eef0' },
];

/**
 * 비슷한 계열 색상 묶음(실물검색 색칩 다중선택용).
 * 지참약은 낱알만 오므로 색을 정확히 집기 어렵다(형광등·마모로 분홍↔주황↔빨강,
 * 연두↔초록↔청록이 특히 헷갈림). 계열 색을 한 번에 켜 두면 놓치는 후보를 줄인다.
 * 각 색은 최대 한 계열에만 속한다(서로소). 계열에 없는 색(무채색·노랑·갈색 등)은 단독.
 */
export const COLOR_FAMILIES: string[][] = [
  ['분홍', '주황', '빨강'], // 붉은 계열
  ['연두', '초록', '청록'], // 초록 계열
  ['파랑', '남색'], // 파랑 계열
  ['자주', '보라'], // 보라 계열
];

/** 색 value 가 속한 계열(없으면 자기 자신만 담은 배열). */
export function colorFamily(value: string): string[] {
  return COLOR_FAMILIES.find((f) => f.includes(value)) ?? [value];
}

/**
 * 색칩 클릭 결과 계산(순수 함수).
 * - 아직 선택 안 된 색을 누르면 → 같은 계열 색까지 한 번에 추가(기존 선택 유지, 중복 없이).
 * - 이미 선택된 색을 누르면 → 그 색만 개별 해제(계열 나머지는 유지).
 * "켜기는 계열 통째로, 끄기는 하나씩" — 오검색을 줄이면서도 미세조정은 가능.
 */
export function toggleColorSelection(current: string[], clicked: string): string[] {
  if (current.includes(clicked)) return current.filter((c) => c !== clicked);
  const add = colorFamily(clicked).filter((c) => !current.includes(c));
  return [...current, ...add];
}

/** 모양 칩: API drug_shape 파라미터 값 */
export const SHAPE_OPTIONS: string[] = [
  '원형',
  '타원형',
  '장방형',
  '삼각형',
  '사각형',
  '마름모형',
  '오각형',
  '육각형',
  '팔각형',
  '반원형',
  '기타',
];

/** 제형 칩: label = 화면표시, match = FORM_CODE_NAME 부분일치 키워드 */
export interface FormOption {
  label: string;
  match: string;
}
export const FORM_OPTIONS: FormOption[] = [
  { label: '정제', match: '정' },
  { label: '경질캡슐', match: '경질' },
  { label: '연질캡슐', match: '연질' },
];
