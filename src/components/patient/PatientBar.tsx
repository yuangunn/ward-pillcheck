import { useState } from 'react';
import { useStore } from '../../state/store';
import { PatientManageSheet } from './PatientManageSheet';

/** 상단 환자 탭 바: 전환 + 추가 + 관리(이름변경/삭제) 시트. */
export function PatientBar() {
  const { state, dispatch, activePatient } = useStore();
  const [managing, setManaging] = useState(false);

  return (
    <>
      <div className="patient-bar">
        {state.patients.map((p) => (
          <button
            key={p.id}
            type="button"
            className="patient-tab"
            aria-current={p.id === state.activePatientId}
            onClick={() => dispatch({ type: 'SELECT_PATIENT', patientId: p.id })}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className="patient-add"
          aria-label="환자 추가"
          onClick={() => dispatch({ type: 'ADD_PATIENT' })}
        >
          +
        </button>
        {activePatient && (
          <button
            type="button"
            className="patient-manage"
            aria-label="환자 관리"
            onClick={() => setManaging(true)}
          >
            ⋯
          </button>
        )}
      </div>

      {managing && (
        <PatientManageSheet patient={activePatient} onClose={() => setManaging(false)} />
      )}
    </>
  );
}
