import type { AppState } from '../domain/models';

// localStorage 영속화. 외부 서버 전송 없음 — 데이터는 기기에만 존재.

const STORAGE_KEY = 'ward-pillcheck:v1';
export const SCHEMA_VERSION = 1;

export const initialState: AppState = {
  schemaVersion: SCHEMA_VERSION,
  patients: [],
  activePatientId: null,
};

/** localStorage 에서 상태 로드. 없거나 손상 시 초기값. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as AppState;
    if (typeof parsed !== 'object' || !Array.isArray(parsed.patients)) {
      return initialState;
    }
    // 향후 schemaVersion 분기 마이그레이션 지점
    return { ...initialState, ...parsed, schemaVersion: SCHEMA_VERSION };
  } catch {
    return initialState;
  }
}

/** 상태 저장 (best-effort). 용량 초과 등 실패는 조용히 무시. */
export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // QuotaExceeded 등 — 저장 실패해도 앱은 계속 동작
  }
}
