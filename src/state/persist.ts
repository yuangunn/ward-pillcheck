import type { AppState } from '../domain/models';

// localStorage 영속화. 외부 서버 전송 없음 — 데이터는 기기에만 존재.

const STORAGE_KEY = 'ward-pillcheck:v1';
export const SCHEMA_VERSION = 2;

/** 구버전(v1) 약물 항목의 단일 timing 을 timings 배열로 마이그레이션 */
function migrate(state: AppState): AppState {
  return {
    ...state,
    patients: (state.patients ?? []).map((p) => {
      const meds = (p.meds ?? []).map((m) => {
        const legacy = m as unknown as { timing?: string; timings?: string[] };
        if (Array.isArray(legacy.timings)) return m;
        const { timing, ...rest } = legacy;
        return { ...(rest as object), timings: timing ? [timing] : [] } as typeof m;
      });
      // updatedAt 미보유(구버전) 환자는 보유 약 중 가장 최근 createdAt 으로 backfill
      const updatedAt =
        p.updatedAt ?? (meds.length ? Math.max(...meds.map((m) => m.createdAt || 0)) : 0);
      return { ...p, meds, updatedAt };
    }),
  };
}

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
    // 구버전 데이터는 timings 배열로 마이그레이션
    const migrated = migrate({ ...initialState, ...parsed });
    return { ...migrated, schemaVersion: SCHEMA_VERSION };
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
