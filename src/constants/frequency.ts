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

/**
 * 저장된 용법 문자열이 어느 비정형 칩 계열인지 판정.
 * 자유 텍스트("필요시 통증시" 등)도 접두로 매칭해 칩 하이라이트를 유지한다.
 */
export function freqDetailFamily(freq: string): string | null {
  if (STANDARD_FREQ.has(freq)) return null;
  if (freq === 'QW' || freq.startsWith('주 1회') || freq.startsWith('QW')) return 'QW';
  if (freq === 'QOD' || freq.startsWith('격일')) return 'QOD';
  if (freq === 'PRN' || freq.startsWith('필요시')) return 'PRN';
  return freq ? 'ETC' : null; // 그 외 비표준 텍스트는 '기타'
}

/** 용법 칩의 선택 표시 여부 */
export function isFreqChipSelected(code: string, freq: string): boolean {
  if (STANDARD_FREQ.has(code)) return freq === code;
  return freqDetailFamily(freq) === code;
}

/**
 * 인계/표시용 비표준 용법 태그.
 * - 표준(QD/BID/TID/QID/HS): 시점 헤더로 충분하므로 빈 문자열.
 * - 비표준: 저장된 설명을 압축. "주 1회(월)"→"주1회·월", "필요시(통증 시)"→"필요시·통증 시".
 *   괄호 없는 자유입력(기타·"필요시")은 그대로 둔다.
 */
export function freqShareTag(frequency: string): string {
  const f = (frequency || '').trim();
  if (!f || STANDARD_FREQ.has(f)) return '';
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
