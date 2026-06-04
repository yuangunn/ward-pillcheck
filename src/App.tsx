import { useEffect, useMemo, useState } from 'react';
import { useStore, uid } from './state/store';
import { buildTokens, useTheme } from './design/theme';
import { HomeScreen, MedListScreen, SearchScreen, type PickedMark } from './design/screens';
import { AddMedSheet, CopySheet, DurSheet, PatientManageSheet, MarkGallerySheet, DrawMarkSheet, type MedFormData } from './design/sheets';
import { Toast, Lightbox, type ZoomPill } from './design/ui';
import { sortMeds } from './domain/sort';
import type { MedItem, Patient, SortMode } from './domain/models';
import type { MarkOption, PillResult } from './api';

type Route = { name: 'home' | 'patient' | 'search'; patientId: string | null };
const DEPTH: Record<Route['name'], number> = { home: 0, patient: 1, search: 2 };

type AddSource =
  | (PillResult & { __kind: 'pill' })
  | (MedItem & { __kind: 'med' })
  | { __kind: 'manual'; itemSeq: string; itemName: string; defaultUnit?: string; imageUrl?: string };

export default function App() {
  const { state, dispatch } = useStore();
  const { dark, toggle } = useTheme();
  const tokens = useMemo(() => buildTokens(dark), [dark]);

  const [route, setRoute] = useState<Route>({ name: 'home', patientId: null });
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [toast, setToast] = useState('');
  const [navNew, setNavNew] = useState(false);

  const [addState, setAddState] = useState<{ open: boolean; source: AddSource | null; mode: 'add' | 'edit' }>({ open: false, source: null, mode: 'add' });
  const [copyOpen, setCopyOpen] = useState(false);
  const [durOpen, setDurOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [pickedMark, setPickedMark] = useState<PickedMark | null>(null);
  const [zoomPill, setZoomPill] = useState<ZoomPill | null>(null);

  const patients = state.patients;
  const activePatient: Patient | null = patients.find((p) => p.id === route.patientId) ?? null;

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 1700);
  };
  const go = (next: Route) => {
    setDir(DEPTH[next.name] >= DEPTH[route.name] ? 'fwd' : 'back');
    if (next.name !== 'search') {
      setPickedMark(null);
      setGalleryOpen(false);
      setDrawOpen(false);
    }
    setRoute(next);
  };

  // 새 환자 추가 → 생성 후 해당 환자 화면으로
  const newPatient = () => {
    dispatch({ type: 'ADD_PATIENT' });
    setNavNew(true);
  };
  useEffect(() => {
    if (navNew && state.activePatientId) {
      go({ name: 'patient', patientId: state.activePatientId });
      setNavNew(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navNew, state.activePatientId]);

  const existingSeqs = activePatient ? activePatient.meds.map((m) => m.itemSeq) : [];
  const isDup = !!(addState.source && addState.mode === 'add' && existingSeqs.includes(addState.source.itemSeq));

  const submitMed = (data: MedFormData) => {
    const pid = route.patientId;
    if (!pid) return;
    if (addState.mode === 'edit' && addState.source?.__kind === 'med') {
      const med: MedItem = { ...(addState.source as MedItem), ...data };
      dispatch({ type: 'UPDATE_MED', patientId: pid, med });
      flash('수정했어요');
    } else {
      const med: MedItem = { id: uid(), createdAt: Date.now(), ...data };
      dispatch({ type: 'ADD_MED', patientId: pid, med });
      flash('리스트에 추가했어요');
    }
    setAddState({ open: false, source: null, mode: 'add' });
    if (route.name === 'search') go({ name: 'patient', patientId: pid });
  };

  let screen = null;
  if (route.name === 'home') {
    screen = (
      <HomeScreen
        patients={patients}
        dark={dark}
        onOpenPatient={(id) => go({ name: 'patient', patientId: id })}
        onNewPatient={newPatient}
        onToggleTheme={toggle}
        onFlash={flash}
      />
    );
  } else if (route.name === 'patient' && activePatient) {
    screen = (
      <MedListScreen
        patient={activePatient}
        onBack={() => go({ name: 'home', patientId: null })}
        onAddMed={() => go({ name: 'search', patientId: activePatient.id })}
        onEditMed={(m) => setAddState({ open: true, source: { ...m, __kind: 'med' }, mode: 'edit' })}
        onSetSort={(mode: SortMode) => dispatch({ type: 'SET_SORT_MODE', patientId: activePatient.id, mode })}
        onManage={() => setManageOpen(true)}
        onCopy={() => setCopyOpen(true)}
        onDur={() => setDurOpen(true)}
        onZoom={(m) => setZoomPill({ itemName: m.name, color: m.color, drugShape: m.shape, marking: m.marking, imageUrl: m.imageUrl })}
      />
    );
  } else if (route.name === 'search' && activePatient) {
    screen = (
      <SearchScreen
        existingSeqs={existingSeqs}
        pickedMark={pickedMark}
        onOpenGallery={() => setGalleryOpen(true)}
        onOpenDraw={() => setDrawOpen(true)}
        onClearMark={() => setPickedMark(null)}
        onZoom={(pill) => setZoomPill({ itemName: pill.itemName, color: pill.colorClass1, drugShape: pill.drugShape, marking: pill.printFront, imageUrl: pill.itemImage })}
        onBack={() => go({ name: 'patient', patientId: activePatient.id })}
        onPick={(pill) => setAddState({ open: true, source: { ...pill, __kind: 'pill' }, mode: 'add' })}
        onManual={() => setAddState({ open: true, source: { __kind: 'manual', itemSeq: '', itemName: '' }, mode: 'add' })}
        onPickInjection={(d) =>
          setAddState({
            open: true,
            source: { __kind: 'manual', itemSeq: d.itemSeq, itemName: d.itemName, defaultUnit: 'U', imageUrl: d.itemImage },
            mode: 'add',
          })
        }
      />
    );
  } else {
    // 활성 환자가 사라진 경우 홈으로 폴백
    screen = (
      <HomeScreen
        patients={patients}
        dark={dark}
        onOpenPatient={(id) => go({ name: 'patient', patientId: id })}
        onNewPatient={newPatient}
        onToggleTheme={toggle}
        onFlash={flash}
      />
    );
  }

  const routeKey = route.name + (route.patientId || '');

  return (
    <div
      style={{
        ...(tokens as React.CSSProperties),
        ['--list-gap' as string]: '10px',
        ['--card-py' as string]: '14px',
        fontFamily: 'var(--font)',
        width: '100%',
        maxWidth: 520,
        margin: '0 auto',
        height: '100%',
        position: 'relative',
        background: 'var(--bg)',
        color: 'var(--text)',
        overflow: 'hidden',
      }}
    >
      <div
        key={routeKey}
        className="screen-scroll"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          animation: `${dir === 'fwd' ? 'slideFwd' : 'slideBack'} .28s cubic-bezier(.32,.72,0,1)`,
        }}
      >
        {screen}
      </div>

      <AddMedSheet
        open={addState.open}
        source={addState.source}
        mode={addState.mode}
        duplicate={isDup}
        onClose={() => setAddState({ open: false, source: null, mode: 'add' })}
        onSubmit={submitMed}
        onDelete={() => {
          if (route.patientId && addState.source?.__kind === 'med') {
            dispatch({ type: 'REMOVE_MED', patientId: route.patientId, medId: (addState.source as MedItem).id });
          }
          setAddState({ open: false, source: null, mode: 'add' });
          flash('삭제했어요');
        }}
      />
      <CopySheet
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        label={activePatient?.label || ''}
        meds={activePatient ? sortMeds(activePatient.meds, activePatient.sortMode) : []}
      />
      <DurSheet open={durOpen} onClose={() => setDurOpen(false)} meds={activePatient?.meds || []} />
      <PatientManageSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        patient={activePatient}
        onRename={(label) => activePatient && dispatch({ type: 'RENAME_PATIENT', patientId: activePatient.id, label })}
        onDelete={() => {
          if (activePatient) {
            dispatch({ type: 'REMOVE_PATIENT', patientId: activePatient.id });
            go({ name: 'home', patientId: null });
          }
        }}
      />
      <MarkGallerySheet open={galleryOpen} onClose={() => setGalleryOpen(false)} onPick={(m: MarkOption) => setPickedMark({ code: m.code, img: m.img })} />
      <DrawMarkSheet open={drawOpen} onClose={() => setDrawOpen(false)} onPick={(m: MarkOption) => setPickedMark({ code: m.code, img: m.img })} />
      <Lightbox pill={zoomPill} onClose={() => setZoomPill(null)} />

      <Toast msg={toast} />
    </div>
  );
}
