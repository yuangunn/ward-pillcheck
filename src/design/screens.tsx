import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, PillGlyph, MarkGlyph } from './Icon';
import { Btn, Chip, ColorChip, SegTabs, FieldLabel, TextField, Tag, PageHeader, IconBtn } from './ui';
import { COLOR_OPTIONS, SHAPE_OPTIONS } from '../constants/appearance';
import { freqMeta } from '../constants/frequency';
import { sortMeds } from '../domain/sort';
import type { MedItem, Patient, SortMode } from '../domain/models';
import { drugApi, type PillResult, type PillSearchQuery } from '../api';

const AVATAR_TINTS = ['#2f6bff', '#11b386', '#7c5cff', '#ff7a3d', '#e84393', '#0fa3b1'];
const avatarTint = (i: number) => AVATAR_TINTS[i % AVATAR_TINTS.length];

// ── 홈 / 환자 목록 ───────────────────────────────────────────
export function HomeScreen({
  patients,
  dark,
  onOpenPatient,
  onNewPatient,
  onToggleTheme,
}: {
  patients: Patient[];
  dark: boolean;
  onOpenPatient: (id: string) => void;
  onNewPatient: () => void;
  onToggleTheme: () => void;
}) {
  const totalMeds = patients.reduce((s, p) => s + p.meds.length, 0);
  return (
    <div style={{ paddingBottom: 120 }}>
      <PageHeader title="지참약 식별" right={<IconBtn name={dark ? 'sun' : 'moon'} label="테마 전환" onClick={onToggleTheme} />} />
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
    </div>
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
}: {
  patient: Patient;
  onBack: () => void;
  onAddMed: () => void;
  onEditMed: (m: MedItem) => void;
  onSetSort: (mode: SortMode) => void;
  onManage: () => void;
  onCopy: () => void;
  onDur: () => void;
}) {
  const displayed = useMemo(() => sortMeds(patient.meds, patient.sortMode), [patient.meds, patient.sortMode]);
  return (
    <div style={{ paddingBottom: 150 }}>
      <PageHeader
        title={patient.label}
        sub={patient.meds.length ? `지참약 ${patient.meds.length}건` : '지참약을 추가해 보세요'}
        onBack={onBack}
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
              <MedRow med={m} onClick={() => onEditMed(m)} />
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

function MedRow({ med, onClick }: { med: MedItem; onClick: () => void }) {
  const fm = freqMeta(med.frequency);
  return (
    <button
      type="button"
      onClick={onClick}
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
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <PillGlyph color={med.color} shape={med.shape} marking={med.marking} size={50} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="med-name"
          style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {med.name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
          <Tag tone="primary">{med.tabletCount}T</Tag>
          <Tag tone="primary">{fm.sub || fm.label}</Tag>
          {(med.timings || []).map((t, i) => (
            <Tag key={i}>{t}</Tag>
          ))}
        </div>
      </div>
      <Icon name="chevron" size={18} style={{ color: 'var(--text-weaker)', flexShrink: 0 }} />
    </button>
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
  onClearMark,
  onZoom,
  onBack,
  onPick,
}: {
  existingSeqs: string[];
  pickedMark: PickedMark | null;
  onOpenGallery: () => void;
  onClearMark: () => void;
  onZoom: (pill: PillResult) => void;
  onBack: () => void;
  onPick: (pill: PillResult) => void;
}) {
  const [mode, setMode] = useState<'visual' | 'name'>('visual');
  const [color, setColor] = useState('');
  const [shape, setShape] = useState('');
  const [marking, setMarking] = useState('');
  const [name, setName] = useState('');
  const [results, setResults] = useState<PillResult[]>([]);
  const [loading, setLoading] = useState(false);

  const active = mode === 'visual' ? !!(color || shape || marking || pickedMark) : !!name.trim();
  const query: PillSearchQuery =
    mode === 'visual'
      ? { colorClass1: color || undefined, drugShape: shape || undefined, printFront: marking || undefined, markCode: pickedMark?.code }
      : { itemName: name.trim() || undefined };

  const reqId = useRef(0);
  const key = JSON.stringify(query);
  useEffect(() => {
    if (!active) {
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
  }, [key, active]);

  const reset = () => {
    setColor('');
    setShape('');
    setMarking('');
    onClearMark();
  };

  return (
    <div style={{ paddingBottom: 30 }}>
      <PageHeader title="약 검색" sub="색·모양·각인·마크로 거꾸로 찾아요" onBack={onBack} />
      <div style={{ padding: '4px 20px 0' }}>
        <SegTabs
          tabs={[
            { value: 'visual', label: '실물 검색' },
            { value: 'name', label: '이름 검색' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {mode === 'visual' ? (
        <div style={{ padding: '20px 20px 8px' }}>
          <FieldLabel>색상</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 22 }}>
            {COLOR_OPTIONS.map((o) => (
              <ColorChip key={o.label} option={o} selected={color === o.label} onClick={() => setColor(color === o.label ? '' : o.label)} />
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
            <button
              type="button"
              onClick={onOpenGallery}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 54,
                borderRadius: 'var(--r-btn)',
                border: '1.5px dashed var(--border)',
                background: 'var(--fill)',
                color: 'var(--text-weak)',
                fontSize: 15.5,
                fontWeight: 700,
                letterSpacing: -0.3,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Icon name="search" size={19} />
              마크 골라서 찾기
            </button>
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

      <div style={{ padding: '8px 16px 0' }}>
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
  const markImg = pill.markFrontImg || pill.markBackImg;
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
