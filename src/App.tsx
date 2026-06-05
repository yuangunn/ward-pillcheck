import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, uid } from './state/store';
import { buildTokens, useTheme } from './design/theme';
import { HomeScreen, MedListScreen, SearchScreen, type PickedMark } from './design/screens';
import { AddMedSheet, CopySheet, DurSheet, PatientManageSheet, MarkGallerySheet, DrawMarkSheet, DrugDetailSheet, type MedFormData } from './design/sheets';
import { SettingsSheet } from './design/SettingsSheet';
import { Onboarding } from './design/Onboarding';

const ONBOARDED_KEY = 'ward-pillcheck:onboarded';
import { Toast, Lightbox, type ZoomPill } from './design/ui';
import { Icon } from './design/Icon';
import { sortMeds } from './domain/sort';
import type { MedItem, Patient, SortMode } from './domain/models';
import type { MarkOption, PillResult } from './api';

const pillToZoom = (p: PillResult): ZoomPill => ({ itemName: p.itemName, color: p.colorClass1, drugShape: p.drugShape, marking: p.printFront, imageUrl: p.itemImage });
const medToPill = (m: MedItem): PillResult => ({ itemSeq: m.itemSeq, itemName: m.name, entpName: '', colorClass1: m.color, drugShape: m.shape, printFront: m.marking, itemImage: m.imageUrl });

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
  const [topTab, setTopTab] = useState<'patients' | 'lookup'>('patients');
  const [detailPill, setDetailPill] = useState<PillResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDED_KEY);
    } catch {
      return false;
    }
  });
  const closeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* ignore */
    }
    setOnboardOpen(false);
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

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
    setDetailPill(null);
    setShowTop(false);
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
  // 직접입력 약은 itemSeq 가 빈 문자열 → 빈 seq 끼리 중복으로 오판하지 않도록 truthy 가드
  const isDup = !!(addState.source && addState.mode === 'add' && addState.source.itemSeq && existingSeqs.includes(addState.source.itemSeq));

  const submitMed = (data: MedFormData) => {
    const pid = route.patientId;
    if (!pid) return;
    if (addState.mode === 'edit' && addState.source?.__kind === 'med') {
      const med: MedItem = { ...(addState.source as MedItem), ...data };
      delete (med as { __kind?: unknown }).__kind; // 편집 소스의 판별 태그 제거(영속 상태 오염 방지)
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
        topTab={topTab}
        onTopTab={setTopTab}
        onOpenPatient={(id) => go({ name: 'patient', patientId: id })}
        onNewPatient={newPatient}
        onToggleTheme={toggle}
        onOpenDetail={(pill) => setDetailPill(pill)}
        onOpenSettings={() => setSettingsOpen(true)}
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
        onDetail={(m) => setDetailPill(medToPill(m))}
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
        topTab={topTab}
        onTopTab={setTopTab}
        onOpenPatient={(id) => go({ name: 'patient', patientId: id })}
        onNewPatient={newPatient}
        onToggleTheme={toggle}
        onOpenDetail={(pill) => setDetailPill(pill)}
        onOpenSettings={() => setSettingsOpen(true)}
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
        ref={scrollRef}
        className="screen-scroll"
        onScroll={(e) => setShowTop((e.target as HTMLDivElement).scrollTop > 500)}
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

      {showTop && (
        <button
          type="button"
          aria-label="맨 위로"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 150,
            zIndex: 60,
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--text)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Icon name="chevDown" size={22} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}

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
      <DrugDetailSheet open={!!detailPill} pill={detailPill} onClose={() => setDetailPill(null)} onZoom={(p) => setZoomPill(pillToZoom(p))} />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onFlash={flash}
        onShowGuide={() => {
          setSettingsOpen(false);
          setOnboardOpen(true);
        }}
      />
      {onboardOpen && <Onboarding onClose={closeOnboarding} />}
      <Lightbox pill={zoomPill} onClose={() => setZoomPill(null)} />

      <Toast msg={toast} />
    </div>
  );
}
