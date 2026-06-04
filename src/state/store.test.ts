import { describe, it, expect } from 'vitest';
import { reducer, seedState, type Action } from './store';
import { initialState } from './persist';
import type { AppState, MedItem } from '../domain/models';

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

function sampleMed(id: string): MedItem {
  return {
    id,
    itemSeq: id,
    name: `약${id}`,
    tabletCount: 1,
    frequency: 'QD',
    timings: ['아침식후'],
    createdAt: Date.now(),
  };
}

describe('seedState', () => {
  it('환자가 없으면 기본 환자 1명을 시드하고 active 로 설정', () => {
    const s = seedState(initialState);
    expect(s.patients).toHaveLength(1);
    expect(s.patients[0].label).toBe('환자1');
    expect(s.activePatientId).toBe(s.patients[0].id);
  });
  it('이미 환자가 있으면 그대로 둔다', () => {
    const seeded = seedState(initialState);
    expect(seedState(seeded)).toBe(seeded);
  });
});

describe('환자 관리', () => {
  it('ADD_PATIENT 은 빈 번호를 채워 라벨 증가', () => {
    const s = run(initialState, { type: 'ADD_PATIENT' }, { type: 'ADD_PATIENT' });
    expect(s.patients.map((p) => p.label)).toEqual(['환자1', '환자2']);
    expect(s.activePatientId).toBe(s.patients[1].id); // 새 환자가 active
  });

  it('중간 환자 삭제 후 ADD 하면 빈 번호 재사용', () => {
    let s = run(initialState, { type: 'ADD_PATIENT' }, { type: 'ADD_PATIENT' });
    s = reducer(s, { type: 'REMOVE_PATIENT', patientId: s.patients[0].id }); // 환자1 삭제
    s = reducer(s, { type: 'ADD_PATIENT' });
    expect(s.patients.map((p) => p.label).sort()).toEqual(['환자1', '환자2']);
  });

  it('active 환자 삭제 시 남은 첫 환자로 active 이동', () => {
    let s = run(initialState, { type: 'ADD_PATIENT' }, { type: 'ADD_PATIENT' });
    const active = s.activePatientId!;
    s = reducer(s, { type: 'REMOVE_PATIENT', patientId: active });
    expect(s.activePatientId).toBe(s.patients[0].id);
  });

  it('마지막 환자 삭제 시 active 는 null', () => {
    let s = run(initialState, { type: 'ADD_PATIENT' });
    s = reducer(s, { type: 'REMOVE_PATIENT', patientId: s.patients[0].id });
    expect(s.patients).toHaveLength(0);
    expect(s.activePatientId).toBeNull();
  });

  it('RENAME_PATIENT, 빈 라벨은 무시', () => {
    let s = run(initialState, { type: 'ADD_PATIENT' });
    const id = s.patients[0].id;
    s = reducer(s, { type: 'RENAME_PATIENT', patientId: id, label: '창가 환자' });
    expect(s.patients[0].label).toBe('창가 환자');
    s = reducer(s, { type: 'RENAME_PATIENT', patientId: id, label: '   ' });
    expect(s.patients[0].label).toBe('창가 환자'); // 공백은 무시
  });
});

describe('약물 관리', () => {
  function withPatient(): { state: AppState; pid: string } {
    const state = reducer(initialState, { type: 'ADD_PATIENT' });
    return { state, pid: state.patients[0].id };
  }

  it('ADD_MED 는 끝에 추가', () => {
    const { state, pid } = withPatient();
    const s = run(
      state,
      { type: 'ADD_MED', patientId: pid, med: sampleMed('a') },
      { type: 'ADD_MED', patientId: pid, med: sampleMed('b') },
    );
    expect(s.patients[0].meds.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('UPDATE_MED 는 해당 항목만 교체', () => {
    const { state, pid } = withPatient();
    let s = reducer(state, { type: 'ADD_MED', patientId: pid, med: sampleMed('a') });
    s = reducer(s, {
      type: 'UPDATE_MED',
      patientId: pid,
      med: { ...sampleMed('a'), tabletCount: 0.5, frequency: 'BID' },
    });
    expect(s.patients[0].meds[0].tabletCount).toBe(0.5);
    expect(s.patients[0].meds[0].frequency).toBe('BID');
  });

  it('REMOVE_MED', () => {
    const { state, pid } = withPatient();
    let s = run(
      state,
      { type: 'ADD_MED', patientId: pid, med: sampleMed('a') },
      { type: 'ADD_MED', patientId: pid, med: sampleMed('b') },
    );
    s = reducer(s, { type: 'REMOVE_MED', patientId: pid, medId: 'a' });
    expect(s.patients[0].meds.map((m) => m.id)).toEqual(['b']);
  });

  it('REORDER_MEDS 는 순서 적용 + 수동 정렬 모드로 고정', () => {
    const { state, pid } = withPatient();
    let s = run(
      state,
      { type: 'ADD_MED', patientId: pid, med: sampleMed('a') },
      { type: 'ADD_MED', patientId: pid, med: sampleMed('b') },
      { type: 'SET_SORT_MODE', patientId: pid, mode: 'byFrequency' },
    );
    expect(s.patients[0].sortMode).toBe('byFrequency');
    s = reducer(s, {
      type: 'REORDER_MEDS',
      patientId: pid,
      meds: [s.patients[0].meds[1], s.patients[0].meds[0]],
    });
    expect(s.patients[0].meds.map((m) => m.id)).toEqual(['b', 'a']);
    expect(s.patients[0].sortMode).toBe('manual'); // 드래그 시 수동 고정
  });
});
