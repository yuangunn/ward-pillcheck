import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { AppState, MedItem, Patient, SortMode } from '../domain/models';
import { initialState, loadState, saveState } from './persist';

// 앱 전역 상태: Context + useReducer + localStorage 동기화.

type Action =
  | { type: 'ADD_PATIENT' }
  | { type: 'REMOVE_PATIENT'; patientId: string }
  | { type: 'RENAME_PATIENT'; patientId: string; label: string }
  | { type: 'SELECT_PATIENT'; patientId: string }
  | { type: 'ADD_MED'; patientId: string; med: MedItem }
  | { type: 'UPDATE_MED'; patientId: string; med: MedItem }
  | { type: 'REMOVE_MED'; patientId: string; medId: string }
  | { type: 'REORDER_MEDS'; patientId: string; meds: MedItem[] } // 드래그 결과(수동)
  | { type: 'SET_SORT_MODE'; patientId: string; mode: SortMode };

function uid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function nextPatientLabel(patients: Patient[]): string {
  // "환자N" 중 사용되지 않은 가장 작은 N
  const used = new Set(
    patients
      .map((p) => /^환자(\d+)$/.exec(p.label)?.[1])
      .filter((n): n is string => !!n)
      .map(Number),
  );
  let n = 1;
  while (used.has(n)) n += 1;
  return `환자${n}`;
}

function createPatient(existing: Patient[]): Patient {
  return {
    id: uid(),
    label: nextPatientLabel(existing),
    meds: [],
    sortMode: 'manual',
  };
}

function mapPatient(
  state: AppState,
  patientId: string,
  fn: (p: Patient) => Patient,
): AppState {
  return {
    ...state,
    patients: state.patients.map((p) => (p.id === patientId ? fn(p) : p)),
  };
}

/**
 * 초기 상태 보정: 환자가 하나도 없으면 기본 환자 1명을 시드.
 * useReducer 초기화 단계에서 실행되므로 StrictMode 의 effect 중복 호출과 무관하다.
 */
function seedState(state: AppState): AppState {
  if (state.patients.length > 0) return state;
  const patient = createPatient([]);
  return { ...state, patients: [patient], activePatientId: patient.id };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_PATIENT': {
      const patient = createPatient(state.patients);
      return {
        ...state,
        patients: [...state.patients, patient],
        activePatientId: patient.id,
      };
    }
    case 'REMOVE_PATIENT': {
      const patients = state.patients.filter((p) => p.id !== action.patientId);
      const activePatientId =
        state.activePatientId === action.patientId
          ? (patients[0]?.id ?? null)
          : state.activePatientId;
      return { ...state, patients, activePatientId };
    }
    case 'RENAME_PATIENT':
      return mapPatient(state, action.patientId, (p) => ({
        ...p,
        label: action.label.trim() || p.label,
      }));
    case 'SELECT_PATIENT':
      return { ...state, activePatientId: action.patientId };
    case 'ADD_MED':
      // 새 항목 추가 시 수동 순서 흐트러짐 방지를 위해 끝에 append만 함
      return mapPatient(state, action.patientId, (p) => ({
        ...p,
        meds: [...p.meds, action.med],
      }));
    case 'UPDATE_MED':
      return mapPatient(state, action.patientId, (p) => ({
        ...p,
        meds: p.meds.map((m) => (m.id === action.med.id ? action.med : m)),
      }));
    case 'REMOVE_MED':
      return mapPatient(state, action.patientId, (p) => ({
        ...p,
        meds: p.meds.filter((m) => m.id !== action.medId),
      }));
    case 'REORDER_MEDS':
      // 드래그로 순서 변경 → 수동 정렬 모드로 고정
      return mapPatient(state, action.patientId, (p) => ({
        ...p,
        meds: action.meds,
        sortMode: 'manual',
      }));
    case 'SET_SORT_MODE':
      return mapPatient(state, action.patientId, (p) => ({
        ...p,
        sortMode: action.mode,
      }));
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  activePatient: Patient | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, () =>
    seedState(loadState()),
  );

  // 상태 변경 시 localStorage 동기화
  useEffect(() => {
    saveState(state);
  }, [state]);

  const activePatient = useMemo(
    () => state.patients.find((p) => p.id === state.activePatientId) ?? null,
    [state.patients, state.activePatientId],
  );

  const value = useMemo(
    () => ({ state, dispatch, activePatient }),
    [state, activePatient],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// 테스트에서 순수 함수 단위로 검증할 수 있도록 export
export { uid, reducer, seedState, createPatient };
export type { Action };
