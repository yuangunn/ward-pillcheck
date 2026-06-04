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
