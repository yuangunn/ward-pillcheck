import { useState } from 'react';
import type { Patient } from '../../domain/models';
import { useStore } from '../../state/store';
import { BottomSheet } from '../ui/BottomSheet';

interface Props {
  patient: Patient | null; // null이면 닫힘
  onClose: () => void;
}

/** 현재 환자 라벨 변경 / 삭제 관리 시트. 실명 입력 금지(익명 라벨만). */
export function PatientManageSheet({ patient, onClose }: Props) {
  const { dispatch } = useStore();
  const [label, setLabel] = useState(patient?.label ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!patient) return null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (trimmed && trimmed !== patient.label) {
      dispatch({ type: 'RENAME_PATIENT', patientId: patient.id, label: trimmed });
    }
    onClose();
  };

  const remove = () => {
    dispatch({ type: 'REMOVE_PATIENT', patientId: patient.id });
    onClose();
  };

  return (
    <BottomSheet open title="환자 관리" onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="patient-label">환자 라벨 (실명 입력 금지)</label>
          <input
            id="patient-label"
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예) 환자1, 3호실A"
            maxLength={20}
            autoComplete="off"
          />
        </div>

        {!confirmDelete ? (
          <div className="sheet-footer">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmDelete(true)}
            >
              환자 삭제
            </button>
            <button type="submit" className="btn btn-primary btn-block">
              저장
            </button>
          </div>
        ) : (
          <div>
            <div className="banner banner-warn" role="alert" style={{ margin: '0 0 12px' }}>
              ‘{patient.label}’의 약물 리스트가 모두 삭제됩니다. 계속할까요?
            </div>
            <div className="sheet-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
              >
                취소
              </button>
              <button type="button" className="btn btn-danger btn-block" onClick={remove}>
                삭제 확인
              </button>
            </div>
          </div>
        )}
      </form>
    </BottomSheet>
  );
}
