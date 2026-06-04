import { useRef, useState } from 'react';
import {
  drugApi,
  DrugApiError,
  type PillResult,
  type PillSearchQuery,
} from '../../api';
import type { MedItem } from '../../domain/models';
import { useStore } from '../../state/store';
import { Spinner, ErrorState, EmptyState } from '../ui/States';
import { VisualSearch } from './VisualSearch';
import { NameSearch } from './NameSearch';
import { ResultCard } from './ResultCard';
import { AddMedSheet } from '../meds/AddMedSheet';

type Mode = 'visual' | 'name';

type ResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; results: PillResult[] }
  | { status: 'error'; message: string };

/** 검색 영역: 모드 탭 + 검색 폼 + 결과 + 추가 시트. */
export function SearchSection() {
  const { state, dispatch } = useStore();
  // 실물 역방향 검색을 기본 탭으로
  const [mode, setMode] = useState<Mode>('visual');
  const [results, setResults] = useState<ResultsState>({ status: 'idle' });
  const [lastQuery, setLastQuery] = useState<PillSearchQuery | null>(null);
  const [adding, setAdding] = useState<PillResult | null>(null);
  // 빠른 연속 검색 시 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않도록 요청 토큰 부여
  const reqIdRef = useRef(0);

  const runSearch = async (query: PillSearchQuery) => {
    const reqId = ++reqIdRef.current;
    setLastQuery(query);
    setResults({ status: 'loading' });
    try {
      const res = await drugApi.searchPills(query);
      if (reqId !== reqIdRef.current) return; // 최신 요청이 아니면 무시
      setResults({ status: 'loaded', results: res });
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      const message =
        e instanceof DrugApiError ? e.message : '검색 중 오류가 발생했습니다.';
      setResults({ status: 'error', message });
    }
  };

  const activePatient = state.patients.find((p) => p.id === state.activePatientId) ?? null;
  // 추가하려는 약이 이미 현재 환자 리스트에 있는지(같은 품목기준코드)
  const isDuplicate = !!adding && !!activePatient?.meds.some((m) => m.itemSeq === adding.itemSeq);

  const handleAdd = (med: MedItem) => {
    if (state.activePatientId) {
      dispatch({ type: 'ADD_MED', patientId: state.activePatientId, med });
    }
  };

  return (
    <section>
      <div className="mode-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="mode-tab"
          aria-selected={mode === 'visual'}
          onClick={() => setMode('visual')}
        >
          실물 검색
        </button>
        <button
          type="button"
          role="tab"
          className="mode-tab"
          aria-selected={mode === 'name'}
          onClick={() => setMode('name')}
        >
          이름 검색
        </button>
      </div>

      {mode === 'visual' ? (
        <VisualSearch onSearch={runSearch} />
      ) : (
        <NameSearch onSearch={runSearch} />
      )}

      <div className="results">
        {results.status === 'loading' && <Spinner label="검색 중…" />}
        {results.status === 'error' && (
          <ErrorState
            message={results.message}
            onRetry={lastQuery ? () => runSearch(lastQuery) : undefined}
          />
        )}
        {results.status === 'loaded' &&
          (results.results.length === 0 ? (
            <EmptyState message="검색 결과가 없습니다. 조건을 바꿔보세요." />
          ) : (
            results.results.map((pill) => (
              <ResultCard
                key={pill.itemSeq}
                pill={pill}
                onAdd={setAdding}
                highlight={lastQuery?.printFront}
              />
            ))
          ))}
      </div>

      <AddMedSheet
        pill={adding}
        duplicate={isDuplicate}
        onClose={() => setAdding(null)}
        onAdd={handleAdd}
      />
    </section>
  );
}
