import type { FrequencyCode } from '../domain/models';

/** 용법 프리셋 정의 */
export interface FrequencyPreset {
  code: FrequencyCode;
  label: string; // 한글 설명 (예: 1일 1회)
  sub: string; // 약어 (예: QD)
  order: number; // 정렬 가중치(오름차순). 비정형은 뒤로.
  slots: number; // 보통 복용시점 칸 수
}

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { code: 'QD', label: '1일 1회', sub: 'QD', order: 1, slots: 1 },
  { code: 'BID', label: '1일 2회', sub: 'BID', order: 2, slots: 2 },
  { code: 'TID', label: '1일 3회', sub: 'TID', order: 3, slots: 3 },
  { code: 'QID', label: '1일 4회', sub: 'QID', order: 4, slots: 4 },
  { code: 'HS', label: '취침전', sub: 'HS', order: 90, slots: 1 },
  { code: 'QW', label: '주 1회', sub: 'QW', order: 91, slots: 1 },
  { code: 'QOD', label: '격일', sub: 'QOD', order: 92, slots: 1 },
  { code: 'PRN', label: '필요시', sub: 'PRN', order: 99, slots: 1 },
  { code: 'ETC', label: '기타', sub: '', order: 100, slots: 1 },
];

/** 탭하면 상세 텍스트 입력 모달을 띄우는 비정형 용법 칩 */
export const FREQ_DETAIL_CODES = new Set(['QW', 'QOD', 'PRN', 'ETC']);

/** 모달 기본값(편집 진입 시 프리필) */
export const FREQ_DETAIL_DEFAULT: Record<string, string> = {
  QW: '주 1회',
  QOD: '격일',
  PRN: '필요시',
  ETC: '',
};

/** 표준 용법 코드(정형, 직접 입력 모달 없이 바로 선택) */
const STANDARD_FREQ = new Set(['QD', 'BID', 'TID', 'QID', 'HS']);

/** 용법 문자열이 표준(QD/BID/TID/QID/HS)인지 — 비표준은 시점 분리·약어 태그 대상. */
export function isStandardFreq(freq: string): boolean {
  return STANDARD_FREQ.has((freq || '').trim());
}

/**
 * 저장된 용법 문자열이 어느 비정형 칩 계열인지 판정.
 * 자유 텍스트("필요시 통증시" 등)도 접두로 매칭해 칩 하이라이트를 유지한다.
 * QOD 계열은 "격일"뿐 아니라 같은 의미의 "홀수일/짝수일/2일에 한번/이틀에 한번"도 포함.
 */
export function freqDetailFamily(freq: string): string | null {
  if (STANDARD_FREQ.has(freq)) return null;
  if (freq === 'QW' || /^주\s*1\s*회/.test(freq) || freq.startsWith('QW') || freq.startsWith('매주'))
    return 'QW';
  if (
    freq === 'QOD' ||
    /^(?:격일|홀수일?|짝수일?|2\s*일에|이틀에)/.test(freq) ||
    freq.startsWith('QOD')
  )
    return 'QOD';
  if (freq === 'PRN' || freq.startsWith('필요시') || /^P\.?R\.?N\.?/i.test(freq)) return 'PRN';
  return freq ? 'ETC' : null; // 그 외 비표준 텍스트는 '기타'
}

/** 용법 칩의 선택 표시 여부 */
export function isFreqChipSelected(code: string, freq: string): boolean {
  if (STANDARD_FREQ.has(code)) return freq === code;
  return freqDetailFamily(freq) === code;
}

/** 비표준 용법 계열별 머릿말(괄호 없는 자유입력에서 떼어내 상세만 남길 때 사용). */
const FREQ_BASE_RE: Record<string, RegExp> = {
  QW: /^(?:매주|주\s*1\s*회|QW)\s*/i,
  // 홀수일/짝수일은 "어느 날 주는지" 정보라 떼지 않고 상세로 남긴다.
  QOD: /^(?:격일|2\s*일에\s*한\s*번?|이틀에\s*한\s*번?|QOD)\s*/i,
  PRN: /^(?:필요시|P\.?R\.?N\.?)\s*/i,
};

/** 비표준 용법에서 상세(요일/사유 등)만 추출. 없으면 ''. */
function freqDetail(freq: string, family: string): string {
  const paren = /\(\s*([^)]+?)\s*\)/.exec(freq); // 괄호가 있으면 그 안이 상세
  if (paren) return paren[1].trim().replace(/\s+/g, ' ');
  const base = FREQ_BASE_RE[family];
  return (base ? freq.replace(base, '') : freq).trim().replace(/\s+/g, ' ');
}

/**
 * 인계/표시용 비표준 용법 태그(약어).
 * - 표준(QD/BID/TID/QID/HS): 시점 헤더로 충분하므로 빈 문자열.
 * - 비표준 약어화: "주 1회(월)"→"QW/월", "격일"→"QOD", "홀수일"→"QOD/홀수일",
 *   "필요시(통증 시)"→"PRN/통증 시". 홀수일/짝수일·2일에한번 등 격일 동의어는 QOD로 통일.
 * - 기타(ETC) 자유입력: 괄호 상세는 '·'로 압축, 그 외엔 원문 유지.
 */
export function freqShareTag(frequency: string): string {
  const f = (frequency || '').trim();
  if (!f || STANDARD_FREQ.has(f)) return '';
  const family = freqDetailFamily(f);
  if (family && family !== 'ETC') {
    const detail = freqDetail(f, family);
    return detail ? `${family}/${detail}` : family;
  }
  const m = /^(.*?)\(\s*(.+?)\s*\)\s*$/.exec(f);
  if (m) return `${m[1].trim().replace(/\s+/g, '')}·${m[2].trim()}`;
  return f;
}

/** 용법 코드의 메타(없으면 기본값) */
export function freqMeta(code: FrequencyCode): FrequencyPreset {
  return (
    FREQUENCY_PRESETS.find((f) => f.code === code) ?? {
      code,
      label: code,
      sub: '',
      order: 95,
      slots: 1,
    }
  );
}

/** 용법 정렬 가중치. 프리셋 외 자유입력은 뒤로(95). */
export function frequencyOrder(code: FrequencyCode): number {
  return freqMeta(code).order;
}

/** 용법에 따른 복용시점 입력 칸 수(QD=1, BID=2, TID=3, QID=4, 그 외 1). */
export function timingSlotsForFrequency(code: FrequencyCode): number {
  return freqMeta(code).slots;
}
