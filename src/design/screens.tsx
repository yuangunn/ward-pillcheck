import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, PillGlyph, MarkGlyph } from './Icon';
import { Btn, Chip, ColorChip, SegTabs, FieldLabel, TextField, Tag, PageHeader, IconBtn, STATUS_TOP } from './ui';
import { COLOR_OPTIONS, SHAPE_OPTIONS, FORM_OPTIONS } from '../constants/appearance';
import { freqMeta } from '../constants/frequency';
import { sortMeds } from '../domain/sort';
import type { MedItem, Patient, SortMode } from '../domain/models';
import { drugApi, proxiedImg, searchInjections, isInjectionName, type PermitDrug, type PillResult, type PillSearchQuery } from '../api';
import { useDataset } from '../state/useDataset';

/** PermitDrug(주사제·외용약) → 상세보기용 PillResult 형태 매핑 */
export function permitToPill(d: PermitDrug): PillResult {
  return { itemSeq: d.itemSeq, itemName: d.itemName, entpName: d.entpName, itemImage: d.itemImage, etcOtcName: d.etcOtcName, ingredient: d.ingredient };
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ko-KR');
}

const AVATAR_TINTS = ['#2f6bff', '#11b386', '#7c5cff', '#ff7a3d', '#e84393', '#0fa3b1'];
const avatarTint = (i: number) => AVATAR_TINTS[i % AVATAR_TINTS.length];

// ── 홈 / 환자 목록 ───────────────────────────────────────────
export function HomeScreen({
  patients,
  dark,
  topTab,
  onTopTab,
  onOpenPatient,
  onNewPatient,
  onToggleTheme,
  onOpenDetail,
  onOpenSettings,
  onFlash,
}: {
  patients: Patient[];
  dark: boolean;
  topTab: 'patients' | 'lookup';
  onTopTab: (t: 'patients' | 'lookup') => void;
  onOpenPatient: (id: string) => void;
  onNewPatient: () => void;
  onToggleTheme: () => void;
  onOpenDetail: (pill: PillResult) => void;
  onOpenSettings: () => void;
  onFlash?: (m: string) => void;
}) {
  const totalMeds = patients.reduce((s, p) => s + p.meds.length, 0);
  const ds = useDataset();
  const runUpdate = async () => {
    const s = await ds.update();
    onFlash?.(s === 'ready' ? '약품 데이터 최신화 완료' : '업데이트에 실패했어요');
  };
  return (
    <div style={{ paddingBottom: 120 }}>
      {/* 상단: [지참약 식별 | 의약품 검색] 탭 + 테마 토글(같은 줄에 정렬) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `calc(${STATUS_TOP} + 8px) 16px 14px` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SegTabs
            tabs={[
              { value: 'patients', label: '지참약 식별' },
              { value: 'lookup', label: '의약품 검색' },
            ]}
            value={topTab}
            onChange={onTopTab}
          />
        </div>
        <IconBtn name="settings" label="설정" onClick={onOpenSettings} />
        <IconBtn name={dark ? 'sun' : 'moon'} label="테마 전환" onClick={onToggleTheme} />
      </div>

      {topTab === 'lookup' ? (
        <LookupBody onOpenDetail={onOpenDetail} />
      ) : (
        <PatientsBody
          patients={patients}
          totalMeds={totalMeds}
          ds={ds}
          runUpdate={runUpdate}
          onOpenPatient={onOpenPatient}
          onNewPatient={onNewPatient}
        />
      )}
    </div>
  );
}

function PatientsBody({
  patients,
  totalMeds,
  ds,
  runUpdate,
  onOpenPatient,
  onNewPatient,
}: {
  patients: Patient[];
  totalMeds: number;
  ds: ReturnType<typeof useDataset>;
  runUpdate: () => void;
  onOpenPatient: (id: string) => void;
  onNewPatient: () => void;
}) {
  return (
    <>
      <div
        style={{
          margin: '4px 20px 22px',
          padding: 'var(--card-py) 16px',
          borderRadius: 'var(--r-card)',
          background: 'var(--primary-weak)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="lock" size={19} />
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--primary-ink)', fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.4 }}>
          모든 기록은 <b>이 기기에만</b> 저장돼요.
          <br />
          이름·식별정보는 받지 않아요.
        </div>
      </div>

      {ds.enabled && (
        <div
          style={{
            margin: '0 20px 22px',
            padding: '14px 16px',
            borderRadius: 'var(--r-card)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>약품 데이터베이스</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, marginTop: 3 }}>
              {ds.status === 'loading'
                ? '불러오는 중…'
                : ds.meta
                  ? `${ds.meta.count.toLocaleString()}건 · 업데이트 ${fmtDate(ds.meta.builtAt)}`
                  : '데이터 없음'}
            </div>
          </div>
          <button
            type="button"
            onClick={runUpdate}
            disabled={ds.status === 'loading'}
            style={{
              flexShrink: 0,
              height: 40,
              padding: '0 16px',
              borderRadius: 999,
              border: '1.5px solid var(--border)',
              background: 'var(--fill)',
              color: 'var(--text)',
              fontSize: 13.5,
              fontWeight: 700,
              letterSpacing: -0.3,
              cursor: ds.status === 'loading' ? 'default' : 'pointer',
              opacity: ds.status === 'loading' ? 0.6 : 1,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {ds.status === 'loading' ? '…' : '업데이트'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 24px 14px' }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>
          환자 {patients.length}명
        </span>
        <span style={{ fontSize: 13.5, color: 'var(--text-weaker)', fontWeight: 600 }}>지참약 {totalMeds}건</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--list-gap)', padding: '0 16px' }}>
        {patients.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpenPatient(p.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 'var(--card-py) 16px',
              borderRadius: 'var(--r-card)',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                flexShrink: 0,
                background: avatarTint(i) + '22',
                color: avatarTint(i),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {p.label.replace(/[^0-9]/g, '') || p.label.slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>{p.label}</div>
              <div style={{ fontSize: 14, color: 'var(--text-weak)', fontWeight: 600, marginTop: 2 }}>
                {p.meds.length === 0 ? '등록된 약 없음' : `지참약 ${p.meds.length}건`}
              </div>
            </div>
            <Icon name="chevron" size={20} style={{ color: 'var(--text-weaker)' }} />
          </button>
        ))}
      </div>

      <FloatingCTA icon="plus" label="새 환자 추가" onClick={onNewPatient} />
    </>
  );
}

function FloatingCTA({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 16px 30px',
        background: 'linear-gradient(to top, var(--bg) 62%, transparent)',
        zIndex: 50,
      }}
    >
      <Btn variant="primary" full icon={icon} onClick={onClick}>
        {label}
      </Btn>
    </div>
  );
}

// ── 의약품 검색(읽기 전용): 경구약 / 주사제 / 외용약 ──────────────
function LookupCentered({ children }: { children: ReactNode }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>{children}</div>;
}

function LookupRow({ name, sub, meta, glyph, img, onClick }: { name: string; sub?: string; meta?: string; glyph?: ReactNode; img?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 'var(--card-py) 16px', borderRadius: 'var(--r-card)', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', width: '100%', textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
    >
      {glyph ?? (
        <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 14, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: 'var(--text-weaker)' }}>
          {img ? <img src={img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Icon name="pill" size={24} />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        {sub && <div style={{ fontSize: 13.5, color: 'var(--text-weak)', fontWeight: 600, marginTop: 2 }}>{sub}</div>}
        {meta && <div style={{ fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</div>}
      </div>
      <Icon name="chevron" size={18} style={{ color: 'var(--text-weaker)', flexShrink: 0 }} />
    </button>
  );
}

function LookupBody({ onOpenDetail }: { onOpenDetail: (pill: PillResult) => void }) {
  const [tab, setTab] = useState<'oral' | 'injection' | 'external'>('oral');
  const [name, setName] = useState('');
  const [pills, setPills] = useState<PillResult[]>([]);
  const [perm, setPerm] = useState<PermitDrug[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const q = name.trim();
    if (!q) {
      setPills([]);
      setPerm([]);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    if (tab === 'oral') {
      drugApi
        .searchPills({ itemName: q })
        .then((r) => id === reqId.current && (setPills(r), setLoading(false)))
        .catch(() => id === reqId.current && (setPills([]), setLoading(false)));
    } else {
      searchInjections(q).then((r) => {
        if (id !== reqId.current) return;
        setPerm(r.filter((d) => (tab === 'injection') === isInjectionName(d.itemName)));
        setLoading(false);
      });
    }
  }, [name, tab]);

  const placeholder = tab === 'oral' ? '예) 타이레놀, 노바스크' : tab === 'injection' ? '예) 란투스, 인슐린' : '예) 벤토린, 둘코락스좌약';
  const empty = tab === 'oral' ? pills.length === 0 : perm.length === 0;

  return (
    <div style={{ padding: '0 20px 28px' }}>
      <SegTabs
        tabs={[
          { value: 'oral', label: '경구약' },
          { value: 'injection', label: '주사제' },
          { value: 'external', label: '외용약' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div style={{ height: 16 }} />
      <TextField value={name} onChange={setName} placeholder={placeholder} aria-label="의약품 이름 검색" />
      <p style={{ margin: '10px 2px 0', fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, lineHeight: 1.45 }}>
        이름으로 검색하고 약을 누르면 상세 정보를 볼 수 있어요.
      </p>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 'var(--list-gap)' }}>
        {name.trim() && loading && <LookupCentered>검색 중…</LookupCentered>}
        {name.trim() && !loading && empty && <LookupCentered>결과가 없어요. 이름을 바꿔보세요.</LookupCentered>}
        {!loading && tab === 'oral' &&
          pills.map((p) => (
            <LookupRow
              key={p.itemSeq}
              name={p.itemName}
              sub={p.entpName}
              meta={[p.colorClass1, p.drugShape, p.formCodeName].filter(Boolean).join(' · ')}
              glyph={<PillGlyph color={p.colorClass1} shape={p.drugShape} marking={p.printFront} size={48} />}
              onClick={() => onOpenDetail(p)}
            />
          ))}
        {!loading && tab !== 'oral' &&
          perm.map((d) => (
            <LookupRow key={d.itemSeq} name={d.itemName} sub={d.entpName} meta={d.ingredient} img={proxiedImg(d.itemImage)} onClick={() => onOpenDetail(permitToPill(d))} />
          ))}
      </div>
    </div>
  );
}

// ── 복약 리스트 ──────────────────────────────────────────────
const SORT_TABS: { value: SortMode; label: string }[] = [
  { value: 'manual', label: '기본순' },
  { value: 'byFrequency', label: '용법순' },
  { value: 'byTiming', label: '시점순' },
];

export function MedListScreen({
  patient,
  onBack,
  onAddMed,
  onEditMed,
  onSetSort,
  onManage,
  onCopy,
  onDur,
  onDetail,
}: {
  patient: Patient;
  onBack: () => void;
  onAddMed: () => void;
  onEditMed: (m: MedItem) => void;
  onSetSort: (mode: SortMode) => void;
  onManage: () => void;
  onCopy: () => void;
  onDur: () => void;
  onDetail: (m: MedItem) => void;
}) {
  const displayed = useMemo(() => sortMeds(patient.meds, patient.sortMode), [patient.meds, patient.sortMode]);
  return (
    <div style={{ paddingBottom: 150 }}>
      <PageHeader
        title={patient.label}
        sub={patient.meds.length ? `지참약 ${patient.meds.length}건` : '지참약을 추가해 보세요'}
        onBack={onBack}
        onTitleClick={onManage}
        right={<IconBtn name="dots" label="환자 관리" onClick={onManage} />}
      />
      {patient.meds.length > 1 && (
        <div style={{ padding: '6px 20px 14px' }}>
          <SegTabs tabs={SORT_TABS} value={patient.sortMode} onChange={onSetSort} />
        </div>
      )}
      {patient.meds.length === 0 ? (
        <EmptyMedState onAdd={onAddMed} />
      ) : (
        <ul className="med-list" style={{ listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--list-gap)', padding: '0 16px' }}>
          {displayed.map((m) => (
            <li key={m.id}>
              <MedRow med={m} onClick={() => onEditMed(m)} onDetail={() => onDetail(m)} />
            </li>
          ))}
        </ul>
      )}
      {patient.meds.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '12px 16px 30px',
            background: 'linear-gradient(to top, var(--bg) 60%, transparent)',
            zIndex: 50,
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Btn variant="ghost" full icon="copy" onClick={onCopy} style={{ height: 48, fontSize: 15 }}>
              인계 복사
            </Btn>
            <Btn variant="ghost" full icon="shield" onClick={onDur} style={{ height: 48, fontSize: 15 }}>
              금기 점검
            </Btn>
          </div>
          <Btn variant="primary" full icon="plus" onClick={onAddMed}>
            약 추가
          </Btn>
        </div>
      )}
    </div>
  );
}

function EmptyMedState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: 'var(--fill)',
          color: 'var(--text-weaker)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
        }}
      >
        <Icon name="pill" size={36} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>
        아직 추가된 약이 없어요
      </div>
      <div style={{ fontSize: 14.5, color: 'var(--text-weak)', marginTop: 6, lineHeight: 1.5 }}>
        환자가 가져온 약을 색·모양으로
        <br />
        검색해 리스트를 만들어 보세요.
      </div>
      <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
        <Btn variant="primary" icon="search" onClick={onAdd} style={{ padding: '0 28px' }}>
          약 검색해서 추가
        </Btn>
      </div>
    </div>
  );
}

function MedRow({ med, onClick, onDetail }: { med: MedItem; onClick: () => void; onDetail: () => void }) {
  const fm = freqMeta(med.frequency);
  return (
    <div
      className="med-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: 'var(--card-py) 16px',
        borderRadius: 'var(--r-card)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        onClick={onDetail}
        aria-label="약 상세 정보"
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
      >
        <PillGlyph color={med.color} shape={med.shape} marking={med.marking} size={50} />
      </button>
      <button
        type="button"
        onClick={onClick}
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        <div
          className="med-name"
          style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {med.name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
          <Tag tone="primary">{med.tabletCount}{med.doseUnit || 'T'}</Tag>
          <Tag tone="primary">{fm.sub || fm.label}</Tag>
          {(med.timings || []).map((t, i) => (
            <Tag key={i}>{t}</Tag>
          ))}
        </div>
      </button>
      <Icon name="chevron" size={18} style={{ color: 'var(--text-weaker)', flexShrink: 0 }} />
    </div>
  );
}

// ── 검색 화면 ────────────────────────────────────────────────
export interface PickedMark {
  code: string;
  img?: string;
}

export function SearchScreen({
  existingSeqs,
  pickedMark,
  onOpenGallery,
  onOpenDraw,
  onClearMark,
  onZoom,
  onBack,
  onPick,
  onManual,
  onPickInjection,
}: {
  existingSeqs: string[];
  pickedMark: PickedMark | null;
  onOpenGallery: () => void;
  onOpenDraw: () => void;
  onClearMark: () => void;
  onZoom: (pill: PillResult) => void;
  onBack: () => void;
  onPick: (pill: PillResult) => void;
  onManual: () => void;
  onPickInjection: (d: PermitDrug) => void;
}) {
  const [mode, setMode] = useState<'visual' | 'name' | 'injection'>('visual');
  const [colors, setColors] = useState<string[]>([]);
  const [shape, setShape] = useState('');
  const [forms, setForms] = useState<string[]>([]);
  const [marking, setMarking] = useState('');
  const [name, setName] = useState('');
  const [results, setResults] = useState<PillResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [injResults, setInjResults] = useState<PermitDrug[]>([]);
  const [injLoading, setInjLoading] = useState(false);

  const toggleColor = (c: string) => setColors((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const toggleForm = (f: string) => setForms((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]));

  const active = mode === 'visual' ? !!(colors.length || shape || forms.length || marking || pickedMark) : !!name.trim();
  const query: PillSearchQuery =
    mode === 'visual'
      ? {
          colors: colors.length ? colors : undefined,
          drugShape: shape || undefined,
          forms: forms.length ? forms : undefined,
          printFront: marking || undefined,
          markCode: pickedMark?.code,
        }
      : { itemName: name.trim() || undefined };

  const reqId = useRef(0);
  const key = JSON.stringify(query);
  useEffect(() => {
    if (mode === 'injection' || !active) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    drugApi
      .searchPills(query)
      .then((r) => {
        if (id === reqId.current) {
          setResults(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (id === reqId.current) {
          setResults([]);
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, mode]);

  // 주사제(허가정보 이름검색)
  useEffect(() => {
    if (mode !== 'injection' || !name.trim()) {
      setInjResults([]);
      setInjLoading(false);
      return;
    }
    const id = ++reqId.current;
    setInjLoading(true);
    searchInjections(name).then((r) => {
      if (id === reqId.current) {
        setInjResults(r);
        setInjLoading(false);
      }
    });
  }, [mode, name]);

  const reset = () => {
    setColors([]);
    setShape('');
    setForms([]);
    setMarking('');
    onClearMark();
  };

  return (
    <div style={{ paddingBottom: 30 }}>
      <PageHeader title="약 검색" sub="색·모양·각인·마크 / 외용·주사제는 이름으로" onBack={onBack} />
      <div style={{ padding: '4px 20px 0' }}>
        <SegTabs
          tabs={[
            { value: 'visual', label: '실물 검색' },
            { value: 'name', label: '이름 검색' },
            { value: 'injection', label: '외용·주사제' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {mode === 'injection' ? (
        <div style={{ padding: '20px 20px 8px' }}>
          <FieldLabel>외용약·주사제 이름</FieldLabel>
          <TextField value={name} onChange={setName} placeholder="예) 벤토린, 둘코락스좌약, 란투스, 인슐린" aria-label="외용·주사제 이름" autoFocus />
          <p style={{ margin: '10px 2px 0', fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, lineHeight: 1.45 }}>
            흡입제·좌약·연고·점안 등 외용약과 주사제는 낱알 모양이 없어 이름으로 찾아요 (식약처 허가정보).
          </p>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 'var(--list-gap)' }}>
            {name.trim() && injLoading && (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>검색 중…</div>
            )}
            {name.trim() && !injLoading && injResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>
                결과가 없어요. 이름을 바꿔보세요.
              </div>
            )}
            {!injLoading &&
              injResults.map((d) => (
                <InjectionCard key={d.itemSeq} drug={d} added={existingSeqs.includes(d.itemSeq)} onClick={() => onPickInjection(d)} />
              ))}
          </div>
          <button
            type="button"
            onClick={onManual}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 16, height: 50, borderRadius: 'var(--r-btn)', border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 700, letterSpacing: -0.3, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >
            <Icon name="edit" size={18} />
            목록에 없으면 직접 입력
          </button>
        </div>
      ) : mode === 'visual' ? (
        <div style={{ padding: '20px 20px 8px' }}>
          <FieldLabel>색상 <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-weaker)' }}>(여러 개 선택 가능)</span></FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 22 }}>
            {COLOR_OPTIONS.map((o) => (
              <ColorChip key={o.label} option={o} selected={colors.includes(o.label)} onClick={() => toggleColor(o.label)} />
            ))}
          </div>
          <FieldLabel>모양</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            {SHAPE_OPTIONS.map((s) => (
              <Chip key={s} selected={shape === s} onClick={() => setShape(shape === s ? '' : s)}>
                {s}
              </Chip>
            ))}
          </div>
          <FieldLabel>제형</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            {FORM_OPTIONS.map((o) => (
              <Chip key={o.match} selected={forms.includes(o.match)} onClick={() => toggleForm(o.match)}>
                {o.label}
              </Chip>
            ))}
          </div>
          <FieldLabel>앞면 각인</FieldLabel>
          <TextField value={marking} onChange={setMarking} placeholder="예) Bayer, 500, MF" aria-label="각인" />

          <div style={{ height: 22 }} />
          <FieldLabel>마크 (그림 식별표시)</FieldLabel>
          {pickedMark ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 'var(--r-card)',
                background: 'var(--primary-weak)',
                border: '1.5px solid var(--primary)',
              }}
            >
              <MarkGlyph option={pickedMark} size={40} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--primary-ink)', letterSpacing: -0.3 }}>
                마크 «{pickedMark.code}»
              </span>
              <button
                type="button"
                onClick={onClearMark}
                style={{ border: 'none', background: 'transparent', color: 'var(--primary-ink)', fontSize: 14, fontWeight: 800, cursor: 'pointer', padding: '6px 8px' }}
              >
                해제
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onOpenGallery}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  height: 54,
                  borderRadius: 'var(--r-btn)',
                  border: '1.5px dashed var(--border)',
                  background: 'var(--fill)',
                  color: 'var(--text-weak)',
                  fontSize: 14.5,
                  fontWeight: 700,
                  letterSpacing: -0.3,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Icon name="search" size={18} />
                골라서 찾기
              </button>
              <button
                type="button"
                onClick={onOpenDraw}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  height: 54,
                  borderRadius: 'var(--r-btn)',
                  border: '1.5px solid var(--primary)',
                  background: 'var(--primary-weak)',
                  color: 'var(--primary-ink)',
                  fontSize: 14.5,
                  fontWeight: 800,
                  letterSpacing: -0.3,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Icon name="edit" size={18} />
                그려서 찾기
              </button>
            </div>
          )}
          {active && (
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--text-weaker)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              조건 초기화
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '20px 20px 8px' }}>
          <FieldLabel>약 이름</FieldLabel>
          <TextField value={name} onChange={setName} placeholder="예) 타이레놀, 노바스크" aria-label="품목명" autoFocus />
        </div>
      )}

      <div style={{ padding: '8px 16px 0', display: mode === 'injection' ? 'none' : 'block' }}>
        {active && !loading && (
          <div style={{ padding: '0 4px 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--text-weaker)' }}>{results.length}개 찾음</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--list-gap)' }}>
          {active && loading && (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>검색 중…</div>
          )}
          {active && !loading && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>
              조건에 맞는 약이 없어요.
              <br />
              색·모양을 바꿔보세요.
            </div>
          )}
          {!loading &&
            results.map((p) => (
              <ResultCard
                key={p.itemSeq}
                pill={p}
                added={existingSeqs.includes(p.itemSeq)}
                onClick={() => onPick(p)}
                onZoom={() => onZoom(p)}
                highlight={mode === 'visual' ? marking : ''}
              />
            ))}
        </div>

        {/* 찾는 약이 없거나 주사약(인슐린 등) → 직접 입력 */}
        <button
          type="button"
          onClick={onManual}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            marginTop: 16,
            height: 50,
            borderRadius: 'var(--r-btn)',
            border: '1.5px dashed var(--border)',
            background: 'transparent',
            color: 'var(--text-weak)',
            fontSize: 14.5,
            fontWeight: 700,
            letterSpacing: -0.3,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Icon name="edit" size={18} />
          직접 입력 (주사약·인슐린 등)
        </button>
      </div>
    </div>
  );
}

function Highlighted({ text, term }: { text?: string; term?: string }): ReactNode {
  const t = (term || '').trim();
  const s = text || '';
  if (!t) return s;
  const i = s.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return s;
  return (
    <>
      {s.slice(0, i)}
      <mark style={{ background: 'var(--primary-weak)', color: 'var(--primary-ink)', borderRadius: 4, padding: '0 2px', fontWeight: 800 }}>
        {s.slice(i, i + t.length)}
      </mark>
      {s.slice(i + t.length)}
    </>
  );
}

function lineText(front?: string, back?: string): string | null {
  const norm = (v?: string) => {
    const x = (v || '').trim();
    return x && x !== '-' && x !== '없음' ? x : '';
  };
  const f = norm(front);
  const b = norm(back);
  if (!f && !b) return null;
  const parts: string[] = [];
  if (f) parts.push(`앞 ${f}`);
  if (b) parts.push(`뒤 ${b}`);
  return `분할선 ${parts.join(' / ')}`;
}

function ResultCard({
  pill,
  added,
  onClick,
  onZoom,
  highlight,
}: {
  pill: PillResult;
  added: boolean;
  onClick: () => void;
  onZoom: () => void;
  highlight: string;
}) {
  const line = lineText(pill.lineFront, pill.lineBack);
  const markImg = proxiedImg(pill.markFrontImg || pill.markBackImg);
  return (
    <div
      className="result-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: 'var(--card-py) 16px',
        borderRadius: 'var(--r-card)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        onClick={onZoom}
        aria-label="이미지 확대"
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'zoom-in', borderRadius: 14, position: 'relative', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
      >
        <PillGlyph color={pill.colorClass1} shape={pill.drugShape} marking={pill.printFront} size={52} />
        <span
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-weak)',
          }}
        >
          <Icon name="search" size={12} sw={2.4} />
        </span>
      </button>
      <button
        type="button"
        onClick={onClick}
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="result-name" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pill.itemName}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-weak)', fontWeight: 600, marginTop: 2 }}>{pill.entpName}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, marginTop: 3 }}>
          {[pill.colorClass1, pill.drugShape, pill.formCodeName].filter(Boolean).join(' · ')}
        </div>
        {(pill.printFront || pill.printBack) && (
          <div style={{ fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, marginTop: 3 }}>
            각인 {pill.printFront && <>앞 <Highlighted text={pill.printFront} term={highlight} /></>}
            {pill.printFront && pill.printBack ? ' / ' : ''}
            {pill.printBack && <>뒤 <Highlighted text={pill.printBack} term={highlight} /></>}
          </div>
        )}
        {markImg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, marginTop: 4 }}>
            마크 <MarkGlyph option={{ code: '', img: markImg }} size={22} />
            {(pill.markFrontAnal || pill.markBackAnal) && <span>{pill.markFrontAnal || pill.markBackAnal}</span>}
          </div>
        )}
        {line && <div style={{ fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, marginTop: 3 }}>{line}</div>}
      </button>
      <button
        type="button"
        onClick={onClick}
        aria-label="추가"
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
      >
        {added ? (
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-ink)', background: 'var(--primary-weak)', padding: '4px 9px', borderRadius: 8 }}>추가됨</span>
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-weak)', color: 'var(--primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={20} />
          </div>
        )}
      </button>
    </div>
  );
}

// 주사제 결과 카드 (제품이미지 + 성분)
function InjectionCard({ drug, added, onClick }: { drug: PermitDrug; added: boolean; onClick: () => void }) {
  const img = proxiedImg(drug.itemImage);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: 'var(--card-py) 16px',
        borderRadius: 'var(--r-card)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          flexShrink: 0,
          background: 'var(--fill)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          color: 'var(--text-weaker)',
        }}
      >
        {img ? (
          <img src={img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <Icon name="pill" size={26} />
        )}
      </div>
      <button
        type="button"
        onClick={onClick}
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="med-name" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {drug.itemName}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-weak)', fontWeight: 600, marginTop: 2 }}>{drug.entpName}</div>
        {drug.ingredient && (
          <div style={{ fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {drug.ingredient}
          </div>
        )}
      </button>
      <button type="button" onClick={onClick} aria-label="추가" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>
        {added ? (
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-ink)', background: 'var(--primary-weak)', padding: '4px 9px', borderRadius: 8 }}>추가됨</span>
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-weak)', color: 'var(--primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={20} />
          </div>
        )}
      </button>
    </div>
  );
}
