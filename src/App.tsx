import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, uid, nextPatientLabel } from './state/store';
import { useWorkerReachable } from './state/connectivity';
import { durBundleStatus } from './api';
import { buildTokens, useTheme, setThemeColor } from './design/theme';
import { HomeScreen, MedListScreen, SearchScreen, type PickedMark } from './design/screens';
import { AddMedSheet, CopySheet, DurSheet, PatientManageSheet, NewPatientSheet, MarkGallerySheet, DrawMarkSheet, DrugDetailSheet, type MedFormData } from './design/sheets';
import { SettingsSheet } from './design/SettingsSheet';
import { Onboarding, isStandalone } from './design/Onboarding';
import { InstallGuide } from './design/InstallGuide';
import { InAppBrowserBanner, detectInApp } from './design/InAppBrowserBanner';
import { DisclaimerGate } from './design/DisclaimerGate';

const ONBOARDED_KEY = 'ward-pillcheck:onboarded';
const DISCLAIMER_KEY = 'ward-pillcheck:disclaimer-v1';
import { Toast, Lightbox, Btn, type ZoomPill } from './design/ui';
import type { MedItem, Patient } from './domain/models';
import type { MarkOption, PillResult } from './api';

const pillToZoom = (p: PillResult): ZoomPill => ({ itemName: p.itemName, color: p.colorClass1, drugShape: p.drugShape, marking: p.printFront, markingBack: p.printBack, imageUrl: p.itemImage });

// 하단 고정 액션바 래퍼. 그라데이션(투명) 영역은 스크롤 터치를 막지 않도록 pointerEvents 차단,
// 실제 버튼 영역만 auto 로 되살린다.
const BAR_WRAP: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 60,
  padding: '14px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
  background: 'linear-gradient(to top, var(--bg) 62%, transparent)',
  pointerEvents: 'none',
};

type Route = { name: 'home' | 'patient' | 'search'; patientId: string | null };
const DEPTH: Record<Route['name'], number> = { home: 0, patient: 1, search: 2 };

type AddSource =
  | (PillResult & { __kind: 'pill' })
  | (MedItem & { __kind: 'med' })
  | { __kind: 'manual'; itemSeq: string; itemName: string; defaultUnit?: string; imageUrl?: string };

export default function App() {
  const { state, dispatch } = useStore();
  const { dark, toggle } = useTheme();
  // 외부 워커 연결 여부(인트라넷 판별). false 면 워커 전용 기능(금기점검 등)을 숨김.
  const online = useWorkerReachable() !== false;
  const tokens = useMemo(() => buildTokens(dark), [dark]);

  const [route, setRoute] = useState<Route>({ name: 'home', patientId: null });
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [toast, setToast] = useState('');
  const [navNew, setNavNew] = useState(false);

  const [addState, setAddState] = useState<{ open: boolean; source: AddSource | null; mode: 'add' | 'edit' }>({ open: false, source: null, mode: 'add' });
  const [copyOpen, setCopyOpen] = useState(false);
  const [durOpen, setDurOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [pickedMark, setPickedMark] = useState<PickedMark | null>(null);
  const [zoomPill, setZoomPill] = useState<ZoomPill | null>(null);
  const [topTab, setTopTab] = useState<'patients' | 'lookup'>('patients');
  const [detailPill, setDetailPill] = useState<PillResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // DUR 번들을 받아뒀으면 오프라인에서도 금기점검 가능 → 워커 연결 없어도 버튼 노출
  const [durReady, setDurReady] = useState(false);
  const checkDur = () => durBundleStatus().then((s) => setDurReady(s.downloaded));
  useEffect(() => {
    checkDur();
  }, []);
  // 인앱 브라우저(카카오톡 등) 감지 — 상단 "외부 브라우저로 열기" 배너 표시용.
  const inAppInfo = useMemo(() => detectInApp(), []);
  const [inAppDismissed, setInAppDismissed] = useState(false);
  const [bannerH, setBannerH] = useState(0);
  const showInApp = inAppInfo.inApp && !isStandalone() && !inAppDismissed;
  // 첫 실행 인트로 분기: PWA 설치 가능(지원 브라우저·미설치·인앱 아님)이면 설치 가이드를,
  // 그 외(이미 설치된 standalone·인앱 등)는 기능 온보딩을 띄운다.
  const [intro, setIntro] = useState<'none' | 'onboarding' | 'install'>(() => {
    let onboarded = false;
    try {
      onboarded = !!localStorage.getItem(ONBOARDED_KEY);
    } catch {
      /* ignore */
    }
    if (onboarded) return 'none';
    const installable =
      !isStandalone() && !inAppInfo.inApp && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    return installable ? 'install' : 'onboarding';
  });
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  // 첫 실행 면책·로딩 게이트(동의 전까지 최상위 노출). 동의해야 데이터 로딩 완료 + 진입.
  const [disclaimerAcked, setDisclaimerAcked] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(DISCLAIMER_KEY);
    } catch {
      return false;
    }
  });
  const ackDisclaimer = () => {
    try {
      localStorage.setItem(DISCLAIMER_KEY, '1');
    } catch {
      /* ignore */
    }
    setDisclaimerAcked(true);
  };
  // 복약 리스트 글자 크기(접근성): 0 보통 / 1 크게 / 2 아주 크게. localStorage 영속.
  const [textSizeIdx, setTextSizeIdx] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('wpc:textSize') || '', 10) || 0;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('wpc:textSize', String(textSizeIdx));
    } catch {
      /* ignore */
    }
  }, [textSizeIdx]);
  const cycleTextSize = () => {
    const n = (textSizeIdx + 1) % 3;
    setTextSizeIdx(n);
    flash('글자 ' + ['보통', '크게', '아주 크게'][n]);
  };
  const textScale = [1, 1.18, 1.36][textSizeIdx] || 1;

  // 상태줄(theme-color) 기본값을 앱 배경색에 맞춘다. 온보딩 파란 화면은 Onboarding 이 직접 제어.
  const appBg = dark ? '#16181d' : '#ffffff';
  const onboardingActive = disclaimerAcked && intro === 'onboarding';
  useEffect(() => {
    if (!onboardingActive) setThemeColor(appBg);
  }, [appBg, onboardingActive]);
  const finishIntro = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* ignore */
    }
    setIntro('none');
  };

  const patients = state.patients;
  const activePatient: Patient | null = patients.find((p) => p.id === route.patientId) ?? null;

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current); // 연타 시 이전 타이머가 새 토스트를 일찍 지우지 않게
    toastTimer.current = setTimeout(() => setToast(''), 1700);
  };
  const go = (next: Route) => {
    setDir(DEPTH[next.name] >= DEPTH[route.name] ? 'fwd' : 'back');
    if (next.name !== 'search') {
      setPickedMark(null);
      setGalleryOpen(false);
      setDrawOpen(false);
    }
    setDetailPill(null);
    setRoute(next);
  };

  // 새 환자 추가 → 라벨 입력 시트 → 생성 후 해당 환자 화면으로
  const addPatient = (label: string) => {
    dispatch({ type: 'ADD_PATIENT', label });
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
        onToggleTheme={toggle}
        onOpenDetail={(pill) => setDetailPill(pill)}
        onOpenSettings={() => setSettingsOpen(true)}
        onFlash={flash}
        standalone={isStandalone()}
        onInstallGuide={() => setInstallGuideOpen(true)}
      />
    );
  } else if (route.name === 'patient' && activePatient) {
    screen = (
      <MedListScreen
        patient={activePatient}
        onBack={() => go({ name: 'home', patientId: null })}
        onAddMed={() => go({ name: 'search', patientId: activePatient.id })}
        onEditMed={(m) => setAddState({ open: true, source: { ...m, __kind: 'med' }, mode: 'edit' })}
        onManage={() => setManageOpen(true)}
        textScale={textScale}
        sizeIdx={textSizeIdx}
        onCycleTextSize={cycleTextSize}
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
        onZoom={(pill) => setZoomPill(pillToZoom(pill))}
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
        onToggleTheme={toggle}
        onOpenDetail={(pill) => setDetailPill(pill)}
        onOpenSettings={() => setSettingsOpen(true)}
        onFlash={flash}
        standalone={isStandalone()}
        onInstallGuide={() => setInstallGuideOpen(true)}
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
      {/* 인앱 브라우저(카카오톡 등) 최상단 배너 — 화면을 배너 높이만큼 아래로 민다. */}
      {showInApp && (
        <InAppBrowserBanner
          info={inAppInfo}
          onFlash={flash}
          onHeight={setBannerH}
          onDismiss={() => setInAppDismissed(true)}
        />
      )}

      {/* 화면 컨테이너는 스크롤하지 않음(레이어 분리). 각 화면이 헤더(고정) +
          ScrollArea(리스트만 스크롤) 구조를 가진다. 전환 애니메이션만 담당. */}
      <div
        key={routeKey}
        style={{
          position: 'absolute',
          top: showInApp ? bannerH : 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: `${dir === 'fwd' ? 'slideFwd' : 'slideBack'} .28s cubic-bezier(.32,.72,0,1)`,
        }}
      >
        {screen}
      </div>

      {/* 하단 액션바 — 화면 컨테이너 밖(앱 루트)에 고정. */}
      {route.name === 'home' && topTab === 'patients' && (
        <div style={BAR_WRAP}>
          <div style={{ pointerEvents: 'auto' }}>
            <Btn variant="primary" full icon="plus" onClick={() => setNewPatientOpen(true)}>
              새 환자 추가
            </Btn>
          </div>
        </div>
      )}
      {route.name === 'patient' && activePatient && activePatient.meds.length > 0 && (
        <div style={BAR_WRAP}>
          <div style={{ pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <Btn variant="primary" full icon="send" onClick={() => setCopyOpen(true)} style={{ height: 48, fontSize: 15, background: '#5b5fc7' }}>
                공유하기
              </Btn>
              {/* 금기점검(DUR): 워커 연결되거나 DUR 번들을 받아뒀으면(오프라인 가능) 노출 */}
              {(online || durReady) && (
                <Btn variant="ghost" full icon="shield" onClick={() => setDurOpen(true)} style={{ height: 48, fontSize: 15 }}>
                  금기 점검
                </Btn>
              )}
            </div>
            <Btn variant="primary" full icon="plus" onClick={() => go({ name: 'search', patientId: activePatient.id })}>
              약 추가
            </Btn>
          </div>
        </div>
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
        meds={activePatient?.meds || []}
      />
      <DurSheet open={durOpen} onClose={() => setDurOpen(false)} meds={activePatient?.meds || []} />
      <NewPatientSheet
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        defaultLabel={nextPatientLabel(patients)}
        onAdd={addPatient}
      />
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
      <MarkGallerySheet open={galleryOpen} onClose={() => setGalleryOpen(false)} onPick={(m: MarkOption) => setPickedMark({ code: m.code, img: m.img, imgId: m.imgId })} />
      <DrawMarkSheet open={drawOpen} onClose={() => setDrawOpen(false)} onPick={(m: MarkOption) => setPickedMark({ code: m.code, img: m.img, imgId: m.imgId })} />
      <DrugDetailSheet open={!!detailPill} pill={detailPill} onClose={() => setDetailPill(null)} onZoom={(p) => setZoomPill(pillToZoom(p))} />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          checkDur();
        }}
        onFlash={flash}
        onShowGuide={() => {
          setSettingsOpen(false);
          setIntro('onboarding');
        }}
      />
      {/* 인트로(온보딩/설치 가이드)는 면책 동의 후에만 노출 */}
      {disclaimerAcked && intro === 'onboarding' && <Onboarding onClose={finishIntro} bg={appBg} />}
      <InstallGuide
        open={disclaimerAcked && (installGuideOpen || intro === 'install')}
        onClose={() => {
          setInstallGuideOpen(false);
          if (intro === 'install') finishIntro();
        }}
      />
      <Lightbox pill={zoomPill} onClose={() => setZoomPill(null)} />

      {/* 첫 실행 면책·로딩 게이트 — 모든 오버레이 위. 동의 전까지 진입 차단. */}
      {!disclaimerAcked && <DisclaimerGate onAck={ackDisclaimer} />}

      <Toast msg={toast} />
    </div>
  );
}
