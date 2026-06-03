import { isMockMode } from './api';
import { useStore } from './state/store';
import { PatientBar } from './components/patient/PatientBar';
import { SearchSection } from './components/search/SearchSection';
import { MedList } from './components/meds/MedList';

export default function App() {
  const { activePatient } = useStore();
  // 환자 시드는 store 초기화 단계에서 보장됨(seedState).

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
