import { useStore } from '../../state/store';

/** 상단 환자 탭 바: 전환 + 추가 + (롱프레스 대신) 라벨변경/삭제는 길게 탭. */
export function PatientBar() {
  const { state, dispatch } = useStore();

  const rename = (id: string, current: string) => {
    const label = window.prompt('환자 라벨 변경 (실명 입력 금지)', current);
    if (label !== null) dispatch({ type: 'RENAME_PATIENT', patientId: id, label });
  };

  const remove = (id: string, label: string) => {
    if (window.confirm(`${label}의 약물 리스트를 삭제할까요?`)) {
      dispatch({ type: 'REMOVE_PATIENT', patientId: id });
    }
  };

  return (
    <div className="patient-bar">
      {state.patients.map((p) => {
        const active = p.id === state.activePatientId;
        return (
          <button
            key={p.id}
            type="button"
            className="patient-tab"
            aria-current={active}
            onClick={() =>
              active ? rename(p.id, p.label) : dispatch({ type: 'SELECT_PATIENT', patientId: p.id })
            }
            onContextMenu={(e) => {
              e.preventDefault();
              remove(p.id, p.label);
            }}
          >
            {p.label}
          </button>
        );
      })}
      <button
        type="button"
        className="patient-add"
        aria-label="환자 추가"
        onClick={() => dispatch({ type: 'ADD_PATIENT' })}
      >
        +
      </button>
    </div>
  );
}
