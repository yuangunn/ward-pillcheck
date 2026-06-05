import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, PillGlyph, MarkGlyph, type MarkOpt } from './Icon';
import { Btn, Chip, BottomSheet, FieldLabel, TextField, Stepper } from './ui';
import { COLOR_OPTIONS, SHAPE_OPTIONS } from '../constants/appearance';
import { FREQUENCY_PRESETS, freqMeta } from '../constants/frequency';
import { TIMING_PRESETS, timingOrder } from '../constants/timing';
import { buildListText } from '../domain/format';
import type { MedItem, Patient } from '../domain/models';
import { drugApi, getMarkOptions, proxiedImg, type DrugDetail, type MarkOption, type PillResult } from '../api';
import { ensureMarkFeatures, featureFromCanvas, rankFeatures, type RankedMark } from '../api';
import { analyzeInteractions, fetchDurMap, type InteractionResult } from '../api/dur';

const TIMING_DEFAULTS: Record<number, string[]> = {
  1: ['아침식후'],
  2: ['아침식후', '저녁식후'],
  3: ['아침식후', '점심식후', '저녁식후'],
  4: ['아침식후', '점심식후', '저녁식후', '자기전'],
};

// 용량 단위(개수/부피). 한 줄 포맷에 붙는 접미사 = value.
const DOSE_UNITS: { value: string; label: string }[] = [
  { value: 'T', label: '정 (T)' },
  { value: 'C', label: '캡슐 (C)' },
  { value: 'mL', label: '시럽·내용액 (mL)' },
  { value: 'U', label: '단위 (U)' },
  { value: '시린지', label: '시린지 (프리필드)' },
  { value: '앰플', label: '앰플' },
  { value: '바이알', label: '바이알' },
  { value: '펜', label: '펜' },
  { value: '포', label: '포 (산제·과립)' },
  { value: '패치', label: '패치' },
  { value: '방울', label: '방울 (점안·점이)' },
  { value: '회분', label: '회분' },
];
const HALF_STEP_UNITS = new Set(['T', 'mL']); // 0.5 단위 허용(정·내용액)

export interface MedFormData {
  itemSeq: string;
  name: string;
  color?: string;
  shape?: string;
  marking?: string;
  imageUrl?: string;
  tabletCount: number;
  doseUnit?: string;
  frequency: string;
  timings: string[];
}

export type ManualSource = {
  __kind: 'manual';
  itemSeq: string;
  itemName: string;
  defaultUnit?: string;
  imageUrl?: string;
};
type AddSource = (PillResult & { __kind: 'pill' }) | (MedItem & { __kind: 'med' }) | ManualSource;

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, marginBottom: 12 }}>{label}</div>
      {children}
    </div>
  );
}

/** 빈/의미없는 값('-','없음') 정리 */
function fieldVal(v?: string): string {
  const x = (v || '').trim();
  return x && x !== '-' && x !== '없음' ? x : '';
}
/** 앞/뒤 한 줄 표기 ("앞 X / 뒤 Y") */
function frontBack(front?: string, back?: string): string {
  return [fieldVal(front) && `앞 ${fieldVal(front)}`, fieldVal(back) && `뒤 ${fieldVal(back)}`].filter(Boolean).join(' / ');
}

/** 상세 정보 본문(펼침 상태에서만 마운트 → 마운트 시 1회 로드). 토글 버튼은 상위 고정 헤더에. */
function DetailPanel({ seq, pill, onZoom }: { seq: string; pill: PillResult; onZoom?: () => void }) {
  const [detail, setDetail] = useState<DrugDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [imgFail, setImgFail] = useState(false);
  useEffect(() => {
    let alive = true;
    drugApi
      .getDetail(seq, pill.itemName)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [seq, pill.itemName]);

  const photo = proxiedImg(pill.itemImage);
  const ingredient = pill.ingredient || detail?.ingredient; // 번들 성분 우선, 없으면 라이브
  // 외형/분류 기본 정보(상세가 없어도 항상 제공)
  const basics = ([
    ['분류', pill.className],
    ['구분', pill.etcOtcName],
    ['제형', pill.formCodeName],
    ['색상', pill.colorClass1],
    ['모양', pill.drugShape],
  ] as [string, string | undefined][])
    .map(([k, v]) => [k, fieldVal(v)] as [string, string])
    .filter(([, v]) => v);
  const imprint = frontBack(pill.printFront, pill.printBack);
  const splitLine = frontBack(pill.lineFront, pill.lineBack);

  const rows = detail
    ? ([
        ['효능·효과', detail.efcy],
        ['용법·용량', detail.useMethod],
        ['주의사항', detail.atpn],
        ['상호작용', detail.intrc],
        ['이상반응', detail.se],
        ['보관법', detail.deposit],
      ] as [string, string | undefined][]).filter(([, v]) => fieldVal(v))
    : [];

  return (
    <div style={{ padding: '14px 4px 4px' }}>
      {/* 실물 사진 + 외형/분류 요약 (항상 표시) */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <button
              type="button"
              onClick={onZoom}
              aria-label={onZoom ? '사진 크게 보기' : undefined}
              style={{
                width: 84,
                height: 84,
                flexShrink: 0,
                borderRadius: 16,
                padding: 0,
                background: '#fff',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: onZoom ? 'zoom-in' : 'default',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {photo && !imgFail ? (
                <img src={photo} alt={pill.itemName} loading="lazy" onError={() => setImgFail(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <PillGlyph color={pill.colorClass1} shape={pill.drugShape} marking={pill.printFront} size={72} />
              )}
            </button>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ingredient && (
                <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ flexShrink: 0, width: 38, color: 'var(--text-weaker)', fontWeight: 700 }}>성분</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700, letterSpacing: -0.3 }}>{ingredient}</span>
                </div>
              )}
              {basics.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ flexShrink: 0, width: 38, color: 'var(--text-weaker)', fontWeight: 700 }}>{k}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, letterSpacing: -0.3 }}>{v}</span>
                </div>
              ))}
              {imprint && (
                <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ flexShrink: 0, width: 38, color: 'var(--text-weaker)', fontWeight: 700 }}>각인</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, letterSpacing: -0.3 }}>{imprint}</span>
                </div>
              )}
              {splitLine && (
                <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ flexShrink: 0, width: 38, color: 'var(--text-weaker)', fontWeight: 700 }}>분할선</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, letterSpacing: -0.3 }}>{splitLine}</span>
                </div>
              )}
            </div>
          </div>

          {photo && (
            <a
              href={photo}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', marginBottom: 14, fontSize: 12.5, fontWeight: 700, color: 'var(--primary-ink)', textDecoration: 'none' }}
            >
              {onZoom ? '사진 크게 보기 (또는 사진 탭) ↗' : '실물 사진 새 탭에서 보기 ↗'}
            </a>
          )}

          {/* 식약처 상세(효능/용법/주의/상호작용/이상반응/보관) */}
          {!loaded ? (
            <div style={{ fontSize: 13.5, color: 'var(--text-weak)' }}>상세 정보 불러오는 중…</div>
          ) : rows.length ? (
            <>
              {detail?.source && (
                <span style={{ display: 'inline-block', marginBottom: 12, fontSize: 11.5, fontWeight: 800, color: 'var(--primary-ink)', background: 'var(--primary-weak)', padding: '3px 9px', borderRadius: 999 }}>
                  출처 · {detail.source}
                </span>
              )}
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--primary-ink)', marginBottom: 3 }}>{k}</dt>
                    <dd style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.55, letterSpacing: -0.3, whiteSpace: 'pre-line' }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <div style={{ fontSize: 13.5, color: 'var(--text-weak)', lineHeight: 1.5 }}>
              효능·용법 등 상세 설명은 등록돼 있지 않아요 (전문의약품 등 다수).
              <br />
              <span style={{ color: 'var(--text-weaker)' }}>위 외형·분류 정보를 참고하거나 실물 사진을 확인하세요.</span>
            </div>
          )}
        </div>
  );
}

/** 읽기 전용 약 상세 보기 시트 (의약품 검색 결과·환자 약 그림 탭). 사진 탭 시 onZoom 으로 확대. */
export function DrugDetailSheet({
  open,
  pill,
  onClose,
  onZoom,
}: {
  open: boolean;
  pill: PillResult | null;
  onClose: () => void;
  onZoom: (p: PillResult) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="약 상세 정보" maxH="92%">
      {pill && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '2px 0 8px' }}>
            <PillGlyph color={pill.colorClass1} shape={pill.drugShape} marking={pill.printFront} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>{pill.itemName}</div>
              {pill.entpName && <div style={{ fontSize: 13.5, color: 'var(--text-weak)', fontWeight: 600, marginTop: 2 }}>{pill.entpName}</div>}
            </div>
          </div>
          <DetailPanel seq={pill.itemSeq} pill={pill} onZoom={() => onZoom(pill)} />
        </>
      )}
    </BottomSheet>
  );
}

export function AddMedSheet({
  open,
  onClose,
  source,
  mode,
  duplicate,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  source: AddSource | null;
  mode: 'add' | 'edit';
  duplicate: boolean;
  onSubmit: (data: MedFormData) => void;
  onDelete: () => void;
}) {
  const isEdit = mode === 'edit';
  const isManual = source?.__kind === 'manual';
  const [count, setCount] = useState(1);
  const [doseUnit, setDoseUnit] = useState('T');
  const [nameInput, setNameInput] = useState('');
  const [freq, setFreq] = useState('QD');
  const [timings, setTimings] = useState<string[]>(['아침식후']);
  const [color, setColor] = useState('');
  const [shape, setShape] = useState('');
  const [marking, setMarking] = useState('');
  const [showAppear, setShowAppear] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!open || !source) return;
    if (source.__kind === 'med') {
      setCount(source.tabletCount);
      setDoseUnit(source.doseUnit || 'T');
      setNameInput(source.name);
      setFreq(source.frequency);
      setTimings(source.timings?.length ? source.timings : ['아침식후']);
      setColor(source.color || '');
      setShape(source.shape || '');
      setMarking(source.marking || '');
    } else if (source.__kind === 'manual') {
      setCount(1);
      setDoseUnit(source.defaultUnit || 'T');
      setNameInput(source.itemName || '');
      setFreq('QD');
      setTimings(['아침식후']);
      setColor('');
      setShape('');
      setMarking('');
    } else {
      setCount(1);
      setDoseUnit(source.formCodeName?.includes('캡슐') ? 'C' : 'T');
      setNameInput(source.itemName);
      setFreq('QD');
      setTimings(['아침식후']);
      setColor(source.colorClass1 || '');
      setShape(source.drugShape || '');
      // 글리프 가독성: 앞면 각인 우선(없으면 뒷면), 끝의 구분자는 제거
      setMarking((source.printFront || source.printBack || '').replace(/^[\s/\-,]+|[\s/\-,]+$/g, ''));
    }
    setShowAppear(false);
    setShowCustom(false);
    setCustomInput('');
    setDetailOpen(false);
  }, [open, source]);

  if (!source) return null;
  const seq = source.itemSeq;
  const name = source.__kind === 'med' ? source.name : source.__kind === 'manual' ? nameInput : source.itemName;
  const entp = source.__kind === 'med' || source.__kind === 'manual' ? undefined : source.entpName;
  const slots = freqMeta(freq).slots;

  // 약 상세 정보: 추가(편집X)이고 실제 itemSeq 가 있으면 표시 — 낱알뿐 아니라 주사·외용약도.
  const detailPill: PillResult | null =
    isEdit || !seq
      ? null
      : source.__kind === 'pill'
        ? source
        : source.__kind === 'manual'
          ? { itemSeq: seq, itemName: source.itemName, entpName: '', itemImage: source.imageUrl }
          : null;
  const showDetail = !!detailPill;

  const changeFreq = (code: string) => {
    setFreq(code);
    setTimings((TIMING_DEFAULTS[freqMeta(code).slots] || ['필요시']).slice());
  };
  const toggleTiming = (code: string) =>
    setTimings((ts) => (ts.includes(code) ? ts.filter((c) => c !== code) : [...ts, code]).sort((a, b) => timingOrder(a) - timingOrder(b)));
  const addCustomTiming = () => {
    const v = customInput.trim();
    if (!v) return;
    setTimings((ts) => (ts.includes(v) ? ts : [...ts, v].sort((a, b) => timingOrder(a) - timingOrder(b))));
    setCustomInput('');
  };
  const finalName = (isManual ? nameInput : name).trim();
  const submit = () => {
    if (!finalName) return;
    onSubmit({
      itemSeq: seq,
      name: finalName,
      color,
      shape,
      marking,
      doseUnit,
      imageUrl: source.__kind === 'pill' ? source.itemImage : source.imageUrl,
      tabletCount: count,
      frequency: freq,
      timings: timings.length ? timings : ['필요시'],
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={isManual ? '직접 입력' : isEdit ? '약 수정' : '리스트에 추가'}>
      {/* 약명·제약사·상세버튼은 상단 고정 — 상세를 펼쳐 길어져도 무슨 약인지 유지 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--bg)',
          margin: '0 -20px',
          padding: '2px 20px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: showDetail ? '6px 0 12px' : '6px 0 2px' }}>
          <PillGlyph color={color} shape={shape} marking={marking} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {isManual ? (
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="약 이름 (예: 란투스주, 휴마로그퀵펜)"
                aria-label="약 이름"
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', borderRadius: 'var(--r-btn)', border: '1.5px solid var(--border)', background: 'var(--fill)', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', fontWeight: 700, letterSpacing: -0.3, outline: 'none' }}
              />
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                {entp && <div style={{ fontSize: 13.5, color: 'var(--text-weak)', fontWeight: 600, marginTop: 2 }}>{entp}</div>}
              </>
            )}
          </div>
        </div>
        {showDetail && (
          <button
            type="button"
            onClick={() => setDetailOpen((v) => !v)}
            aria-expanded={detailOpen}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', borderRadius: 'var(--r-card)', background: 'var(--fill)', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>약 상세 정보</span>
            <Icon name={detailOpen ? 'chevDown' : 'chevron'} size={18} style={{ color: 'var(--text-weak)' }} />
          </button>
        )}
      </div>

      {duplicate && !isEdit && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 14, background: 'var(--warn-weak)', margin: '16px 0' }}>
          <Icon name="warn" size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, color: 'var(--warn-ink)', fontWeight: 700, letterSpacing: -0.3 }}>이미 리스트에 있는 약이에요. 추가하면 중복돼요.</span>
        </div>
      )}

      {showDetail && detailOpen && detailPill && <DetailPanel seq={detailPill.itemSeq} pill={detailPill} />}

      <Section label="용량">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 280 }}>
            <select
              value={doseUnit}
              onChange={(e) => {
                const u = e.target.value;
                setDoseUnit(u);
                // 단위에 맞춰 수량 정규화: 정수화(반정 허용 단위 제외) + 새 단위 상한으로 클램프
                const max = u === 'mL' ? 1000 : u === 'T' ? 20 : 200;
                let next = HALF_STEP_UNITS.has(u) ? count : Math.round(count);
                next = Math.min(Math.max(next, HALF_STEP_UNITS.has(u) ? 0.5 : 1), max);
                if (next !== count) setCount(next);
              }}
              aria-label="용량 단위"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 48,
                padding: '0 38px 0 14px',
                borderRadius: 'var(--r-btn)',
                border: '1.5px solid var(--border)',
                background: 'var(--fill)',
                color: 'var(--text)',
                fontSize: 15,
                fontFamily: 'inherit',
                fontWeight: 700,
                letterSpacing: -0.3,
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none',
                cursor: 'pointer',
              }}
            >
              {DOSE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-weaker)', display: 'flex' }}>
              <Icon name="chevDown" size={18} />
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <Stepper
            value={count}
            onChange={setCount}
            unit={doseUnit}
            step={HALF_STEP_UNITS.has(doseUnit) ? 0.5 : 1}
            min={HALF_STEP_UNITS.has(doseUnit) ? 0.5 : 1}
            max={doseUnit === 'mL' ? 1000 : doseUnit === 'T' ? 20 : 200}
          />
        </div>
      </Section>

      <Section label="용법">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FREQUENCY_PRESETS.map((f) => (
            <Chip key={f.code} selected={freq === f.code} onClick={() => changeFreq(f.code)}>
              {f.label}
              <span style={{ opacity: 0.6, marginLeft: 5, fontSize: 12.5 }}>{f.sub}</span>
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="복용시점">
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-weaker)', margin: '-4px 0 12px', lineHeight: 1.45 }}>
          {freqMeta(freq).label} 기준 보통 {slots}회 · 해당하는 시점을 모두 선택하세요
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TIMING_PRESETS.map((t) => (
            <Chip key={t.code} selected={timings.includes(t.code)} onClick={() => toggleTiming(t.code)} style={{ padding: '9px 14px', fontSize: 14.5 }}>
              {t.code}
            </Chip>
          ))}
          {timings
            .filter((t) => !TIMING_PRESETS.some((p) => p.code === t))
            .map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTiming(t)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 12px 9px 14px',
                  fontSize: 14.5,
                  fontWeight: 600,
                  letterSpacing: -0.3,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  borderRadius: 'var(--r-chip)',
                  border: '1.5px solid var(--primary)',
                  background: 'var(--primary-weak)',
                  color: 'var(--primary-ink)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {t}
                <Icon name="x" size={15} />
              </button>
            ))}
          <Chip selected={showCustom} onClick={() => setShowCustom((v) => !v)} style={{ padding: '9px 14px', fontSize: 14.5 }}>
            + 직접입력
          </Chip>
        </div>
        {showCustom && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomTiming()}
              placeholder="예) 오전 9시, 식간"
              autoFocus
              style={{ flex: 1, minWidth: 0, height: 48, padding: '0 14px', borderRadius: 'var(--r-btn)', border: '1.5px solid var(--border)', background: 'var(--fill)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, letterSpacing: -0.3, outline: 'none' }}
            />
            <Btn variant="secondary" onClick={addCustomTiming} style={{ height: 48, padding: '0 18px', fontSize: 15, flexShrink: 0 }}>
              추가
            </Btn>
          </div>
        )}
      </Section>

      <button
        type="button"
        onClick={() => setShowAppear((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 0', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>겉모습 (색·모양·각인)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-weak)', fontSize: 13.5, fontWeight: 700, overflow: 'hidden' }}>
          {[color, shape, marking].filter(Boolean).join('/') || '없음'}
          <Icon name={showAppear ? 'chevDown' : 'chevron'} size={17} />
        </span>
      </button>
      {showAppear && (
        <div style={{ paddingBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-weaker)', margin: '4px 0 8px' }}>색상</div>
          <div className="screen-scroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
            {COLOR_OPTIONS.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setColor(color === o.label ? '' : o.label)}
                title={o.label}
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: o.swatch, cursor: 'pointer', border: color === o.label ? '3px solid var(--primary)' : '1.5px solid var(--border)' }}
              />
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-weaker)', margin: '14px 0 8px' }}>모양</div>
          <div className="screen-scroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
            {SHAPE_OPTIONS.map((s) => (
              <Chip key={s} selected={shape === s} onClick={() => setShape(shape === s ? '' : s)} style={{ flexShrink: 0, padding: '8px 13px', fontSize: 14 }}>
                {s}
              </Chip>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-weaker)', margin: '14px 0 8px' }}>각인</div>
          <TextField value={marking} onChange={setMarking} placeholder="앞면 각인" />
        </div>
      )}

      <div style={{ paddingTop: 8 }}>
        <Btn variant="primary" full onClick={submit} disabled={!finalName}>
          {isEdit ? '수정 저장' : '환자 리스트에 추가'}
        </Btn>
        {isEdit && (
          <div style={{ marginTop: 10 }}>
            <Btn variant="line" full icon="trash" onClick={onDelete} style={{ color: 'var(--danger)', borderColor: 'var(--danger-weak)' }}>
              리스트에서 삭제
            </Btn>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

export function CopySheet({ open, onClose, label, meds }: { open: boolean; onClose: () => void; label: string; meds: MedItem[] }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => buildListText(label, meds), [label, meds]);
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const doShare = async () => {
    try {
      if (navigator.share) await navigator.share({ text });
    } catch {
      /* ignore */
    }
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="인계용 텍스트" maxH="78%">
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--text-weak)', fontWeight: 600, letterSpacing: -0.3 }}>그대로 복사해 인계 메모/메신저에 붙여넣으세요.</p>
      <pre style={{ margin: 0, padding: 16, borderRadius: 'var(--r-card)', background: 'var(--fill)', color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 280, overflowY: 'auto' }}>
        {text}
      </pre>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {canShare && <Btn variant="ghost" icon="share" onClick={doShare} style={{ flex: '0 0 auto', width: 54, padding: 0 }} />}
        <Btn variant="primary" full icon={copied ? 'check' : 'copy'} onClick={doCopy}>
          {copied ? '복사됐어요' : '복사하기'}
        </Btn>
      </div>
    </BottomSheet>
  );
}

function DurCard({ tone, tag, title, body }: { tone: 'danger' | 'warn'; tag: string; title: string; body?: string }) {
  const c = tone === 'danger' ? { bg: 'var(--danger-weak)', ink: 'var(--danger)' } : { bg: 'var(--warn-weak)', ink: 'var(--warn-ink)' };
  return (
    <div style={{ padding: '14px 16px', borderRadius: 'var(--r-card)', background: 'var(--card)', border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: c.ink, background: c.bg, padding: '3px 9px', borderRadius: 8 }}>{tag}</span>
      <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4, margin: '10px 0 4px' }}>{title}</div>
      {body && <div style={{ fontSize: 13.5, color: 'var(--text-weak)', lineHeight: 1.5, letterSpacing: -0.3 }}>{body}</div>}
    </div>
  );
}

export function DurSheet({ open, onClose, meds }: { open: boolean; onClose: () => void; meds: MedItem[] }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<InteractionResult | null>(null);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setResult(null);
    let alive = true;
    fetchDurMap(meds)
      .then((map) => alive && (setResult(analyzeInteractions(meds, map)), setLoading(false)))
      .catch(() => alive && (setResult({ combos: [], flags: [] }), setLoading(false)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const total = result ? result.combos.length + result.flags.length : 0;
  return (
    <BottomSheet open={open} onClose={onClose} title="금기·중복 점검" maxH="80%">
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div className="dur-spin" style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 14.5, color: 'var(--text-weak)', fontWeight: 700 }}>식약처 DUR 점검 중…</div>
        </div>
      ) : total === 0 ? (
        <div style={{ padding: '32px 0 16px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--ok-weak)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Icon name="check" size={34} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>특이사항이 없어요</div>
          <div style={{ fontSize: 14, color: 'var(--text-weak)', marginTop: 6 }}>병용금기·중복·연령 주의가 발견되지 않았어요.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-ink)', background: 'var(--warn-weak)', padding: '12px 14px', borderRadius: 14, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <Icon name="warn" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: 1.45 }}>
              확인이 필요한 항목 {total}건
              <br />— 최종 판단은 의료진 책임이에요.
            </span>
          </div>
          {result!.combos.map((c, i) => (
            <DurCard key={'c' + i} tone="danger" tag="병용금기" title={`${c.aName} + ${c.bName}`} body={c.content} />
          ))}
          {result!.flags.map((f, i) => (
            <DurCard key={'f' + i} tone="warn" tag={f.kinds.map((k) => k.type).join('·')} title={f.name} body={f.kinds.map((k) => k.content).filter(Boolean).join(' / ')} />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

export function PatientManageSheet({
  open,
  onClose,
  patient,
  onRename,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (open && patient) {
      setName(patient.label);
      setConfirm(false);
    }
  }, [open, patient]);
  if (!patient) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="환자 관리" maxH="60%">
      <FieldLabel>라벨</FieldLabel>
      <TextField value={name} onChange={setName} placeholder="환자 라벨" aria-label="환자 라벨" />
      <p style={{ margin: '10px 2px 0', fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600 }}>실명·식별정보는 입력하지 마세요.</p>
      <div style={{ marginTop: 20 }}>
        <Btn variant="primary" full onClick={() => { onRename(name.trim() || patient.label); onClose(); }}>
          저장
        </Btn>
      </div>
      <div style={{ marginTop: 10 }}>
        {confirm ? (
          <Btn variant="danger" full icon="trash" onClick={() => { onDelete(); onClose(); }}>
            정말 삭제할까요? 다시 누르면 삭제
          </Btn>
        ) : (
          <Btn variant="line" full icon="trash" onClick={() => setConfirm(true)} style={{ color: 'var(--danger)', borderColor: 'var(--danger-weak)' }}>
            환자 삭제
          </Btn>
        )}
      </div>
    </BottomSheet>
  );
}

export function MarkGallerySheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: MarkOption) => void }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<MarkOption[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setQ('');
    setOpts(null);
    let alive = true;
    getMarkOptions().then((o) => alive && setOpts(o));
    return () => {
      alive = false;
    };
  }, [open]);
  const filtered = (opts || []).filter((o) => !q.trim() || o.code.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <BottomSheet open={open} onClose={onClose} title="마크로 찾기" maxH="84%">
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--text-weak)', fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.45 }}>
        약에 새겨진 <b style={{ color: 'var(--text-strong)' }}>그림(마크)</b>과 가장 비슷한 것을 골라주세요.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="마크 코드로 거르기 (예: D, P, dk)"
        style={{ width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 'var(--r-btn)', border: '1.5px solid var(--border)', background: 'var(--fill)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, letterSpacing: -0.3, outline: 'none', marginBottom: 14 }}
      />
      {!opts ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>마크 목록 불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>해당하는 마크가 없어요.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {filtered.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => { onPick(o); onClose(); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 'var(--r-card)', background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            >
              <MarkGlyph option={o as MarkOpt} size={48} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-weak)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{o.code}</span>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

// ── 그려서 마크 찾기 (온디바이스 형상 유사도) ──────────────────
// 캔버스에 그린 그림을 번들 마크 이미지와 비교해 닮은 순으로 후보를 낸다.
// 마크가 있는 약만 대상(고른 마크코드로 검색).
const CANVAS_SIZE = 300;

export function DrawMarkSheet({ open, onPick, onClose }: { open: boolean; onPick: (m: MarkOption) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [ready, setReady] = useState(false); // 마크 특징 DB 준비됨
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RankedMark[] | null>(null);
  const [busy, setBusy] = useState(false);

  // 흰 배경으로 캔버스 초기화
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    setHasInk(false);
    setResults(null);
  };

  // 열릴 때: 캔버스 초기화 + 마크 특징 DB 준비(최초 1회 디코딩, 이후 캐시)
  useEffect(() => {
    if (!open) return;
    setReady(false);
    setProgress(0);
    setResults(null);
    requestAnimationFrame(clearCanvas);
    let alive = true;
    ensureMarkFeatures((d, t) => alive && setProgress(t ? Math.round((d / t) * 100) : 0)).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height };
  };
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    setHasInk(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !last.current) return;
    const p = pos(e);
    ctx.strokeStyle = '#16181d';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  const runSearch = async () => {
    const c = canvasRef.current;
    if (!c) return;
    const q = featureFromCanvas(c);
    if (!q) {
      setResults([]);
      return;
    }
    setBusy(true);
    const feats = await ensureMarkFeatures();
    setResults(rankFeatures(q, feats, 16));
    setBusy(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="그려서 마크 찾기" maxH="92%">
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--text-weak)', fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.45 }}>
        약에 새겨진 <b style={{ color: 'var(--text-strong)' }}>그림(마크)</b>을 <b style={{ color: 'var(--text-strong)' }}>화면 가득 크게</b> 그려보세요. 닮은 마크를 찾아드려요.
        <br />
        <span style={{ fontSize: 12.5, color: 'var(--text-weaker)' }}>마크가 있는 약만 검색돼요 · 결과는 “닮은 후보”예요.</span>
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label="마크 그리기 캔버스"
          style={{
            width: 'min(78vw, 300px)',
            height: 'min(78vw, 300px)',
            borderRadius: 20,
            border: '1.5px solid var(--border)',
            background: '#fff',
            touchAction: 'none',
            cursor: 'crosshair',
            boxShadow: 'var(--shadow-sm)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Btn variant="ghost" full icon="trash" onClick={clearCanvas} disabled={!hasInk} style={{ height: 48 }}>
          지우기
        </Btn>
        <Btn variant="primary" full icon="search" onClick={runSearch} disabled={!hasInk || !ready || busy} style={{ height: 48 }}>
          {ready ? '닮은 마크 찾기' : `준비 중 ${progress}%`}
        </Btn>
      </div>

      {results && (
        <div style={{ paddingBottom: 8 }}>
          <FieldLabel>닮은 마크 {results.length}개</FieldLabel>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-weak)', fontSize: 14, fontWeight: 600 }}>
              닮은 마크를 못 찾았어요. 다시 그려보세요.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {results.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => {
                    onPick({ code: o.code, img: o.img, count: 0 });
                    onClose();
                  }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 'var(--r-card)', background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                >
                  <MarkGlyph option={o as MarkOpt} size={48} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-weak)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{o.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
