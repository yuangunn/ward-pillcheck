import { useEffect } from 'react';
import { isMockMode } from './api';
import { useStore } from './state/store';
import { PatientBar } from './components/patient/PatientBar';
import { SearchSection } from './components/search/SearchSection';
import { MedList } from './components/meds/MedList';

export default function App() {
  const { state, dispatch, activePatient } = useStore();

  // 최초 진입 시 환자가 없으면 "환자1" 자동 생성 → 단계 최소화
  useEffect(() => {
    if (state.patients.length === 0) dispatch({ type: 'ADD_PATIENT' });
  }, [state.patients.length, dispatch]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>병동 지참약 식별</h1>
      </header>

      {isMockMode && (
        <div className="banner">
          데모(목) 모드입니다. 실제 검색은 <code>VITE_API_BASE</code>(Cloudflare Worker)
          설정 후 동작합니다.
        </div>
      )}

      <PatientBar />

      {activePatient ? (
        <>
          <SearchSection />
          <MedList patient={activePatient} />
        </>
      ) : (
        <div className="center-state">환자를 추가하세요.</div>
      )}
    </div>
  );
}
