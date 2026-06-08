import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, PillGlyph, MarkGlyph, ShapeOutline, SplitLineGlyph, type MarkOpt } from './Icon';
import { Btn, Chip, BottomSheet, FieldLabel, TextField, Stepper } from './ui';
import { COLOR_OPTIONS, SHAPE_OPTIONS } from '../constants/appearance';
import {
  FREQUENCY_PRESETS,
  freqMeta,
  FREQ_DETAIL_CODES,
  freqDetailFamily,
  isFreqChipSelected,
} from '../constants/frequency';
import { TIMING_PRESETS, timingOrder } from '../constants/timing';
import { blindLabel, buildListText, cleanMarking, tidyText } from '../domain/format';
import { shapeLabel } from '../domain/shape';
import { splitLineKind, SPLIT_LINE_LABEL } from '../domain/splitLine';
import type { MedItem, Patient } from '../domain/models';
import { drugApi, getMarkOptions, isInjectionName, proxiedImg, type DrugDetail, type MarkOption, type PillResult } from '../api';
import { useWorkerReachable } from '../state/connectivity';
import { ensureMarkFeatures, featuresFromCanvas, rankFeaturesMulti, type RankedMark } from '../api';
import { getEmbedMode, ensureMarkEmbeddings, rankByEmbedding } from '../api/markEmbed';
import { analyzeInteractions, fetchDurMap, type InteractionResult } from '../api/dur';
import { getTeamsTarget, setTeamsTarget, teamsDeepLink, isAllowedTeamsTarget, TEAMS_TARGET_GUIDE } from '../state/teamsTarget';
import { getShareOptions, setShareOptions, type ShareOptions } from '../state/shareOptions';

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
  memo?: string;
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

const FREQ_MODAL_TITLE: Record<string, string> = {
  QW: '어느 요일에 투여하나요?',
  QOD: '투여 스케줄이 어떻게 되나요?',
  PRN: '어떨 때 복용하는 약인가요?',
  ETC: '기타 용법 입력',
};

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const QOD_OPTS = ['홀수일', '짝수일'];

/** initial 용법 문자열에서 괄호 안 상세값 추출. 예) 주 1회(월) → 월 */
function parseFreqDetail(initial: string): string {
  const m = /\((.+)\)\s*$/.exec(initial);
  return m ? m[1].trim() : '';
}

/** 비정형 용법(주1회=요일 / 격일=홀짝 / 필요시=사유 / 기타=자유)의 상세 입력 모달 */
function FreqDetailModal({
  code,
  initial,
  onCancel,
  onConfirm,
}: {
  code: string;
  initial: string;
  onCancel: () => void;
  onConfirm: (text: string) => void;
}) {
  const preset = parseFreqDetail(initial);
  const [choice, setChoice] = useState(preset); // QW(요일)·QOD(홀짝)
  const [text, setText] = useState(code === 'ETC' ? initial : preset); // PRN(사유)·ETC(자유)

  const result = (): string => {
    if (code === 'QW') return choice ? `주 1회(${choice})` : '주 1회';
    if (code === 'QOD') return choice ? `격일(${choice})` : '격일';
    if (code === 'PRN') return text.trim() ? `필요시(${text.trim()})` : '필요시';
    return text.trim(); // ETC
  };
  const canConfirm = code === 'QW' || code === 'QOD' ? !!choice : code === 'PRN' ? true : !!text.trim();

  const chip = (val: string, sel: boolean, onClick: () => void) => (
    <button
      key={val}
      type="button"
      aria-pressed={sel}
      onClick={onClick}
      style={{
        flex: code === 'QOD' ? 1 : '0 0 auto',
        minWidth: code === 'QOD' ? 0 : 44,
        padding: '11px 14px',
        borderRadius: 'var(--r-chip)',
        border: sel ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
        background: sel ? 'var(--primary-weak)' : 'var(--card)',
        color: sel ? 'var(--primary-ink)' : 'var(--text-weak)',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: -0.3,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {val}
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={FREQ_MODAL_TITLE[code] || '용법 입력'}
      style={{ position: 'absolute', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 340, background: 'var(--bg)', borderRadius: 20, padding: 20, boxShadow: '0 12px 44px rgba(0,0,0,0.32)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>
          {FREQ_MODAL_TITLE[code] || '용법 입력'}
        </h3>

        {code === 'QW' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {WEEKDAYS.map((d) => chip(d, choice === d, () => setChoice(d)))}
          </div>
        )}
        {code === 'QOD' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {QOD_OPTS.map((o) => chip(o, choice === o, () => setChoice(o)))}
          </div>
        )}
        {(code === 'PRN' || code === 'ETC') && (
          <TextField
            value={text}
            onChange={setText}
            placeholder={code === 'PRN' ? '예) 통증 시, 혈압 높을 때 (비워도 됨)' : '예) 5일 복용 2일 휴약'}
            autoFocus
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' && canConfirm) onConfirm(result());
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Btn variant="ghost" full onClick={onCancel}>
            취소
          </Btn>
          <Btn variant="primary" full onClick={() => onConfirm(result())} disabled={!canConfirm}>
            확인
          </Btn>
        </div>
      </div>
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

  // 워커(인터넷) 연결 안 되면(인트라넷) 실물사진은 프록시로 못 받으니 시도하지 않고 글리프 표시.
  const online = useWorkerReachable() !== false;
  const photo = online ? proxiedImg(pill.itemImage) : undefined;
  const isInjection = isInjectionName(pill.itemName); // 주사제는 식별용 사진이 원본에 없음
  // 사진 없는 일반 약은 글리프(모양/색) 확대가 유용하지만, 주사제는 보여줄 게 없어 확대 비활성화
  const canZoom = !!onZoom && (!!photo || !isInjection);
  const ingredient = pill.ingredient || detail?.ingredient; // 번들 성분 우선, 없으면 라이브
  // 외형/분류 기본 정보(상세가 없어도 항상 제공)
  const basics = ([
    ['분류', pill.className],
    ['구분', pill.etcOtcName],
    ['제형', pill.formCodeName],
    ['색상', pill.colorClass1],
    ['모양', shapeLabel(pill)],
  ] as [string, string | undefined][])
    .map(([k, v]) => [k, fieldVal(v)] as [string, string])
    .filter(([, v]) => v);
  const imprint = frontBack(pill.printFront, pill.printBack);
  const lineKind = splitLineKind(pill.lineFront, pill.lineBack);

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
              onClick={canZoom ? onZoom : undefined}
              aria-label={canZoom ? '사진 크게 보기' : undefined}
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
                cursor: canZoom ? 'zoom-in' : 'default',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {photo && !imgFail ? (
                <img src={photo} alt={pill.itemName} loading="lazy" onError={() => setImgFail(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : isInjection ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'var(--text-weaker)', textAlign: 'center', padding: 4 }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>💉</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1.15 }}>사진<br />미제공</span>
                </div>
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
              {lineKind !== 'none' && (
                <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4, alignItems: 'center' }}>
                  <span style={{ flexShrink: 0, width: 38, color: 'var(--text-weaker)', fontWeight: 700 }}>분할선</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontWeight: 600, letterSpacing: -0.3 }}>
                    <SplitLineGlyph kind={lineKind} size={16} />
                    {SPLIT_LINE_LABEL[lineKind]}
                  </span>
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
          {!online && (
            <div style={{ marginBottom: 12, padding: '8px 11px', borderRadius: 10, background: 'var(--fill)', fontSize: 12, fontWeight: 600, color: 'var(--text-weaker)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
              📡 인터넷 미연결 — 받아둔 효능·용법·주의만 표시돼요. (상호작용·이상반응·보관 등 온라인 보충정보는 생략)
            </div>
          )}
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
                    <dd style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.55, letterSpacing: -0.3, whiteSpace: 'pre-line' }}>{tidyText(v || '')}</dd>
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
          {/* 약명 헤더 고정 — 스크롤 컨테이너 상단 패딩(6px)까지 덮어 비침 방지(iOS sticky) */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--bg)',
              margin: '-6px -20px 0',
              padding: '8px 20px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
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
  const [memo, setMemo] = useState('');
  const [showAppear, setShowAppear] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [freqModal, setFreqModal] = useState<{ code: string; initial: string } | null>(null);

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
      setMarking(cleanMarking(source.marking || ''));
      setMemo(source.memo || '');
    } else if (source.__kind === 'manual') {
      setCount(1);
      setDoseUnit(source.defaultUnit || 'T');
      setNameInput(source.itemName || '');
      setFreq('QD');
      setTimings(['아침식후']);
      setColor('');
      setShape('');
      setMarking('');
      setMemo('');
    } else {
      setCount(1);
      setDoseUnit(source.formCodeName?.includes('캡슐') ? 'C' : 'T');
      setNameInput(source.itemName);
      setFreq('QD');
      setTimings(['아침식후']);
      setColor(source.colorClass1 || '');
      setShape(source.drugShape || '');
      // 글리프 가독성: 앞면 각인 우선(없으면 뒷면). 분할선 대시 런·연속 공백까지 정리.
      setMarking(cleanMarking(source.printFront || source.printBack || ''));
      setMemo('');
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

  // 약 상세 정보: 실제 itemSeq 가 있으면 표시(추가·편집 모두) — 낱알·주사·외용약 + 리스트에서 수정 시.
  const detailPill: PillResult | null = !seq
    ? null
    : source.__kind === 'pill'
      ? source
      : source.__kind === 'manual'
        ? { itemSeq: seq, itemName: source.itemName, entpName: '', itemImage: source.imageUrl }
        : source.__kind === 'med'
          ? {
              itemSeq: seq,
              itemName: source.name,
              entpName: '',
              colorClass1: source.color,
              drugShape: source.shape,
              printFront: source.marking,
              itemImage: source.imageUrl,
            }
          : null;
  const showDetail = !!detailPill;

  const changeFreq = (code: string) => {
    setFreq(code);
    // 취침전(HS)은 자기전만 자동 체크. 그 외 표준 용법은 횟수만큼 기본 시점.
    if (code === 'HS') setTimings(['자기전']);
    else setTimings((TIMING_DEFAULTS[freqMeta(code).slots] || ['아침식후']).slice());
  };
  // 비정형 용법(주1회·격일·필요시·기타) 칩은 바로 적용하지 않고 상세 입력 모달을 띄운다.
  const onFreqChip = (code: string) => {
    if (FREQ_DETAIL_CODES.has(code)) {
      const initial = freqDetailFamily(freq) === code ? freq : '';
      setFreqModal({ code, initial });
    } else {
      changeFreq(code);
    }
  };
  const confirmFreqModal = (value: string) => {
    const code = freqModal?.code ?? 'ETC';
    setFreq(value || '기타');
    // 필요시는 '필요시' 시점 자동 체크, 그 외 비정형은 시점 1칸 기본.
    setTimings(code === 'PRN' ? ['필요시'] : ['아침식후']);
    setFreqModal(null);
  };
  // 용법에 맞춰 투약시점 선택 제한: 1회=라디오(교체), N회=최대 N개까지.
  const pickTiming = (code: string) =>
    setTimings((ts) => {
      if (ts.includes(code)) return ts.filter((c) => c !== code); // 해제
      const max = freqMeta(freq).slots;
      if (max <= 1) return [code]; // 라디오(1개만)
      if (ts.length >= max) return ts; // 상한 도달 — 무시
      return [...ts, code].sort((a, b) => timingOrder(a) - timingOrder(b));
    });
  const toggleTiming = pickTiming;
  const addCustomTiming = () => {
    const v = customInput.trim();
    if (!v) return;
    pickTiming(v);
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
      marking: cleanMarking(marking),
      doseUnit,
      imageUrl: source.__kind === 'pill' ? source.itemImage : source.imageUrl,
      tabletCount: count,
      frequency: freq,
      timings: timings.length ? timings : ['필요시'],
      memo: memo.trim() || undefined,
    });
  };

  return (
    <>
    <BottomSheet open={open} onClose={onClose} maxH="92%" title={isManual ? '직접 입력' : isEdit ? '약 수정' : '리스트에 추가'}>
      {/* 약명·제약사·상세버튼은 상단 고정 — 상세를 펼쳐 길어져도 무슨 약인지 유지 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
          // 스크롤 컨테이너의 상단 패딩(6px) 위로 끌어올려 그 틈으로 콘텐츠가 비치지 않게(iOS sticky)
          margin: '-6px -20px 0',
          padding: '8px 20px 12px',
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
            <Chip key={f.code} selected={isFreqChipSelected(f.code, freq)} onClick={() => onFreqChip(f.code)}>
              {f.label}
              {f.sub && <span style={{ opacity: 0.6, marginLeft: 5, fontSize: 12.5 }}>{f.sub}</span>}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="투약시점">
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-weaker)', margin: '-4px 0 12px', lineHeight: 1.45 }}>
          {slots <= 1 ? '한 가지 시점만 선택돼요 (용법에 연동)' : `최대 ${slots}개까지 선택돼요 (용법에 연동)`}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TIMING_PRESETS.map((t) => {
            const sel = timings.includes(t.code);
            const capped = slots > 1 && !sel && timings.length >= slots; // 상한 도달 시 비활성 느낌
            return (
              <Chip
                key={t.code}
                selected={sel}
                onClick={() => toggleTiming(t.code)}
                style={{ padding: '9px 14px', fontSize: 14.5, opacity: capped ? 0.4 : 1 }}
              >
                {t.code}
              </Chip>
            );
          })}
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

      <Section label="메모 (특이사항)">
        <TextField
          value={memo}
          onChange={setMemo}
          placeholder="예) SBP 130 이상시 복용, 아침약만 6:30am"
          aria-label="복약 메모"
        />
        <div style={{ fontSize: 12, color: 'var(--text-weaker)', fontWeight: 600, margin: '6px 2px 0', letterSpacing: -0.2 }}>
          인계 복사 시 약 뒤에 <b>※메모</b> 로 함께 나가요.
        </div>
      </Section>

      <button
        type="button"
        onClick={() => setShowAppear((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 0', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>겉모습 (색·모양·각인)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-weak)', fontSize: 13.5, fontWeight: 700, overflow: 'hidden' }}>
          {[color, shape, cleanMarking(marking)].filter(Boolean).join('/') || '없음'}
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
              <Chip
                key={s}
                selected={shape === s}
                onClick={() => setShape(shape === s ? '' : s)}
                style={{ flexShrink: 0, padding: '8px 13px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ShapeOutline shape={s} size={17} sw={7} />
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
    {freqModal && (
      <FreqDetailModal
        code={freqModal.code}
        initial={freqModal.initial}
        onCancel={() => setFreqModal(null)}
        onConfirm={confirmFreqModal}
      />
    )}
    </>
  );
}

/** Teams 대상(공용계정/본인) 이메일 입력 팝업 — 미지정 상태로 보내기 시도 시 노출 */
function TeamsTargetPrompt({
  onSave,
  onSkip,
  onCancel,
}: {
  onSave: (email: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState('');
  const trimmed = val.trim();
  const ok = isAllowedTeamsTarget(trimmed);
  const showGuide = trimmed.length > 0 && !ok; // 입력은 했는데 허용 도메인이 아님
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Teams 대상 입력"
      style={{ position: 'absolute', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 360, background: 'var(--bg)', borderRadius: 20, padding: 20, boxShadow: '0 12px 44px rgba(0,0,0,0.32)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.4 }}>
          어디로 보낼까요?
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-weak)', fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.5 }}>
          우리 <b style={{ color: 'var(--text-strong)' }}>병동 공용 Teams 계정</b>이나 <b style={{ color: 'var(--text-strong)' }}>본인 병원 Teams 이메일</b>을 입력하면 그 대화방이 열려요. (설정 ⚙️에서 언제든 바꿀 수 있어요)
        </p>
        <TextField
          value={val}
          onChange={setVal}
          placeholder="예) ward7@hospital.ac.kr"
          autoFocus
          type="email"
          inputMode="email"
          aria-label="Teams 대상 이메일"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && ok) onSave(trimmed);
          }}
        />
        {showGuide && (
          <p role="alert" style={{ margin: '8px 2px 0', fontSize: 12.5, color: 'var(--danger)', fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.45 }}>
            {TEAMS_TARGET_GUIDE}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Btn variant="ghost" full onClick={onSkip}>
            새 채팅으로 열기
          </Btn>
          <Btn variant="primary" full onClick={() => ok && onSave(trimmed)} disabled={!ok} style={{ background: '#5b5fc7' }}>
            저장하고 보내기
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** 범용 확인 팝업(예/아니오). 개인정보 유출 경고 등에 사용. */
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'absolute', inset: 0, zIndex: 270, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 340, background: 'var(--bg)', borderRadius: 20, padding: 20, boxShadow: '0 12px 44px rgba(0,0,0,0.32)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: 'var(--danger)', letterSpacing: -0.4, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="warn" size={19} /> {title}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--text-weak)', fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.55 }}>{body}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" full onClick={onCancel}>
            취소
          </Btn>
          <Btn variant="primary" full onClick={onConfirm}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** 공유 상세설정의 토글 행(체크박스 스타일) */
function ShareToggle({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 'var(--r-card)', background: 'var(--fill)', border: 'none', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 7,
          border: on ? 'none' : '1.5px solid var(--border)',
          background: on ? 'var(--primary)' : 'transparent',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {on && <Icon name="check" size={15} stroke="#fff" sw={2.6} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.3 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-weaker)', letterSpacing: -0.2, marginTop: 1 }}>{hint}</span>
      </span>
    </button>
  );
}

export function CopySheet({ open, onClose, label, meds }: { open: boolean; onClose: () => void; label: string; meds: MedItem[] }) {
  const [copied, setCopied] = useState(false);
  const [teamsTarget, setTeamsTargetState] = useState('');
  const [teamsPrompt, setTeamsPrompt] = useState(false);
  const [opts, setOpts] = useState<ShareOptions>(getShareOptions);
  const [optsOpen, setOptsOpen] = useState(false);
  const [confirmShare, setConfirmShare] = useState<null | 'copy' | 'share'>(null);
  // 외부 복사·공유는 항상 마스킹 강제(환자명 가림). Teams(원내)만 원문 라벨 전송.
  const baseOpts = { ingredient: opts.ingredient, appearance: opts.appearance };
  const maskedText = useMemo(() => buildListText(label, meds, { ...baseOpts, mask: true }), [label, meds, opts.ingredient, opts.appearance]);
  const teamsText = useMemo(() => buildListText(label, meds, { ...baseOpts, mask: false }), [label, meds, opts.ingredient, opts.appearance]);
  useEffect(() => {
    if (open) {
      setTeamsTargetState(getTeamsTarget());
      setOpts(getShareOptions());
    } else {
      setCopied(false);
      setTeamsPrompt(false);
      setOptsOpen(false);
      setConfirmShare(null);
    }
  }, [open]);
  const toggleOpt = (key: keyof ShareOptions) => {
    const next = { ...opts, [key]: !opts[key] };
    setOpts(next);
    setShareOptions(next);
  };
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const launchTeams = (target?: string) => {
    const url = teamsDeepLink(teamsText, target); // 원내 전송 = 원문(마스킹 안 함)
    let w: Window | null = null;
    try {
      w = window.open(url, '_blank'); // noopener 없이 열어 핸들 확보(빈 탭 정리용)
    } catch {
      /* 아래 폴백 */
    }
    if (w) {
      // Teams 앱으로 핸드오프된 직후 빈 탭 정리(best-effort — 브라우저 정책상 항상 닫히진 않음)
      setTimeout(() => {
        try {
          w?.close();
        } catch {
          /* ignore */
        }
      }, 1200);
    } else {
      window.location.href = url; // 팝업 차단 시 같은 탭으로 폴백
    }
  };
  const openTeams = () => {
    if (!getTeamsTarget()) {
      setTeamsPrompt(true); // 대상 미지정 → 입력 팝업
      return;
    }
    launchTeams();
  };
  const saveTeamsTarget = (email: string) => {
    setTeamsTarget(email);
    setTeamsTargetState(email);
    setTeamsPrompt(false);
    launchTeams(email);
  };
  // 복사/공유는 개인정보 유출 확인 팝업을 거친 뒤 실행(항상 마스킹된 텍스트).
  const runShare = async (kind: 'copy' | 'share') => {
    setConfirmShare(null);
    if (kind === 'copy') {
      try {
        await navigator.clipboard.writeText(maskedText);
      } catch {
        /* ignore */
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      try {
        if (navigator.share) await navigator.share({ text: maskedText });
      } catch {
        /* ignore */
      }
    }
  };
  return (
    <>
    <BottomSheet open={open} onClose={onClose} title="인계용 텍스트" maxH="78%">
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--text-weak)', fontWeight: 600, letterSpacing: -0.3 }}>그대로 복사해 인계 메모/메신저에 붙여넣으세요.</p>
      <pre style={{ margin: 0, padding: 16, borderRadius: 'var(--r-card)', background: 'var(--fill)', color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 280, overflowY: 'auto' }}>
        {maskedText}
      </pre>

      <button
        type="button"
        onClick={() => setOptsOpen((v) => !v)}
        aria-expanded={optsOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 12, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.3 }}>공유 상세설정</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--text-weaker)' }}>
          {[opts.ingredient && '성분명', opts.appearance && '겉모습'].filter(Boolean).join('·') || '기본'}
          <Icon name={optsOpen ? 'chevDown' : 'chevron'} size={16} />
        </span>
      </button>
      {optsOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          <ShareToggle label="성분명 표시" hint="예) 트라젠타정(리나글립틴)" on={opts.ingredient} onToggle={() => toggleOpt('ingredient')} />
          <ShareToggle label="겉모습 표시" hint="색·모양·각인 예) (하양/원형/Bayer)" on={opts.appearance} onToggle={() => toggleOpt('appearance')} />
        </div>
      )}

      <p style={{ margin: '10px 2px 0', fontSize: 12, color: 'var(--text-weaker)', fontWeight: 600, lineHeight: 1.45 }}>
        복사·공유 시 환자명은 <b>자동으로 가려서</b>(예: {blindLabel(label) || '환*1'}) 나가요.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {canShare && <Btn variant="ghost" icon="share" onClick={() => setConfirmShare('share')} style={{ flex: '0 0 auto', width: 54, padding: 0 }} />}
        <Btn variant="primary" full icon={copied ? 'check' : 'copy'} onClick={() => setConfirmShare('copy')}>
          {copied ? '복사됐어요' : '복사하기'}
        </Btn>
      </div>
      <Btn variant="primary" full icon="send" onClick={openTeams} style={{ marginTop: 8, background: '#5b5fc7' }}>
        Teams로 보내기 (원내)
      </Btn>
      <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--text-weaker)', fontWeight: 600, lineHeight: 1.45 }}>
        {teamsTarget
          ? `대상: ${teamsTarget} — 원내 전송이라 환자 이름 그대로 보내요(보내기만 탭).`
          : '“Teams로 보내기”를 누르면 보낼 대상을 물어봐요. (설정 ⚙️에서도 지정 가능)'}
      </p>
    </BottomSheet>
    {confirmShare && (
      <ConfirmDialog
        title="개인정보 유출 주의"
        body="환자명은 가려서 나가지만, 카카오톡·문자·이메일 등 외부로 공유하면 처방·복약 정보가 유출될 수 있어요. 병원 인계 용도로만 사용하세요."
        confirmLabel={confirmShare === 'copy' ? '가린 채 복사' : '가린 채 공유'}
        onConfirm={() => runShare(confirmShare)}
        onCancel={() => setConfirmShare(null)}
      />
    )}
    {teamsPrompt && (
      <TeamsTargetPrompt
        onSave={saveTeamsTarget}
        onSkip={() => {
          setTeamsPrompt(false);
          launchTeams(''); // 대상 없이 새 채팅으로
        }}
        onCancel={() => setTeamsPrompt(false)}
      />
    )}
    </>
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
      <FieldLabel>이름</FieldLabel>
      <TextField value={name} onChange={setName} placeholder="예) 홍길동" aria-label="환자 이름" />
      <p style={{ margin: '10px 2px 0', fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600 }}>이름은 이 기기에만 저장되고, 밖으로 공유할 땐 자동으로 가려져요.</p>
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

/** 새 환자 추가 시 이름 입력 시트. 이름은 기기에만 저장(공유 시 마스킹). 비우면 기본 라벨(환자N). */
export function NewPatientSheet({
  open,
  onClose,
  defaultLabel,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  defaultLabel: string;
  onAdd: (label: string) => void;
}) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!open) return;
    setName('');
    // 시트가 다 올라온 뒤(슬라이드 ~0.3s) 포커스. 화면 밖(translateY)으로 마운트된 입력칸에
    // 즉시 autoFocus 하면 브라우저가 그 칸을 보이려 스크롤을 당겨 시트가 튀어오르는 글리치가 난다.
    const t = setTimeout(() => {
      (document.getElementById('new-patient-name') as HTMLInputElement | null)?.focus({ preventScroll: true });
    }, 340);
    return () => clearTimeout(t);
  }, [open]);
  const submit = () => {
    onAdd(name.trim() || defaultLabel);
    onClose();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="새 환자" maxH="56%">
      <FieldLabel>환자 이름</FieldLabel>
      <TextField
        value={name}
        onChange={setName}
        placeholder="예) 홍길동"
        aria-label="환자 이름"
        id="new-patient-name"
        onKeyDown={(e: { key: string }) => e.key === 'Enter' && submit()}
      />
      <p style={{ margin: '10px 2px 0', fontSize: 12.5, color: 'var(--text-weaker)', fontWeight: 600, lineHeight: 1.5 }}>
        이름은 이 기기에만 저장되고, 밖으로 공유할 땐 자동으로 가려져요. 비워두면 <b>{defaultLabel}</b>로 추가돼요.
      </p>
      <div style={{ marginTop: 20 }}>
        <Btn variant="primary" full icon="plus" onClick={submit}>
          추가
        </Btn>
      </div>
    </BottomSheet>
  );
}

export function MarkGallerySheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: MarkOption) => void }) {
  const [input, setInput] = useState(''); // 입력 중 값(타이핑마다 검색하지 않음)
  const [query, setQuery] = useState(''); // 적용된 검색어(검색 버튼/엔터로만 갱신)
  const [opts, setOpts] = useState<MarkOption[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setInput('');
    setQuery('');
    setOpts(null);
    let alive = true;
    getMarkOptions().then((o) => alive && setOpts(o));
    return () => {
      alive = false;
    };
  }, [open]);
  const runSearch = () => setQuery(input.trim());
  const filtered = (opts || []).filter((o) => !query || o.code.toLowerCase().includes(query.toLowerCase()));
  return (
    <BottomSheet open={open} onClose={onClose} title="마크로 찾기" maxH="84%">
      {/* 설명 + 검색창 고정(스크롤해도 상단 유지) */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
          margin: '-6px -20px 0',
          padding: '6px 20px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-weak)', fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.45 }}>
          약에 새겨진 <b style={{ color: 'var(--text-strong)' }}>그림(마크)</b>과 가장 비슷한 것을 골라주세요.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch();
            }}
            placeholder="마크 코드로 거르기 (예: D, P, dk)"
            aria-label="마크 코드 검색"
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 'var(--r-btn)', border: '1.5px solid var(--border)', background: 'var(--fill)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, letterSpacing: -0.3, outline: 'none' }}
          />
          <button
            type="button"
            onClick={runSearch}
            aria-label="검색"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, padding: '0 18px', borderRadius: 'var(--r-btn)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: -0.3, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >
            <Icon name="search" size={18} stroke="#fff" />
            검색
          </button>
        </div>
      </div>
      <div style={{ height: 14 }} />
      {!opts ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>마크 목록 불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-weak)', fontSize: 14.5, fontWeight: 600 }}>해당하는 마크가 없어요.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {filtered.map((o) => (
            <button
              key={o.img}
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

const BRUSHES: { label: string; w: number }[] = [
  { label: '얇게', w: 4 },
  { label: '보통', w: 6 },
  { label: '굵게', w: 10 },
];
const DRAW_RESULTS_INITIAL = 16; // 처음 보여줄 후보 수('더 보기'로 확장)
const DRAW_RESULTS_MAX = 40; // dedup 후 최대 후보

export function DrawMarkSheet({ open, onPick, onClose }: { open: boolean; onPick: (m: MarkOption) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<ImageData[]>([]); // 획 단위 스냅샷(되돌리기용)
  const [hasInk, setHasInk] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [brush, setBrush] = useState(6);
  const [ready, setReady] = useState(false); // 마크 특징 DB 준비됨
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RankedMark[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  // 흰 배경으로 캔버스 초기화
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    history.current = [];
    setHasInk(false);
    setCanUndo(false);
    setResults(null);
    setShowAll(false);
  };

  // 한 획 되돌리기: 마지막 스냅샷(획 직전 상태)으로 복원
  const undo = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !history.current.length) return;
    const prev = history.current.pop()!;
    ctx.putImageData(prev, 0, 0);
    const remaining = history.current.length;
    setCanUndo(remaining > 0);
    setHasInk(remaining > 0);
    if (remaining === 0) setResults(null);
  };

  const embedMode = getEmbedMode(); // 실험: ONNX 임베딩 매칭(옵트인)
  // 열릴 때: 캔버스 초기화 + 마크 특징 DB 준비(최초 1회, 이후 캐시). 모드별로 다른 DB.
  useEffect(() => {
    if (!open) return;
    setReady(false);
    setProgress(0);
    setResults(null);
    setShowAll(false);
    requestAnimationFrame(clearCanvas);
    let alive = true;
    const prep = embedMode
      ? ensureMarkEmbeddings((d, t) => alive && setProgress(t ? Math.round((d / t) * 100) : 0))
      : ensureMarkFeatures((d, t) => alive && setProgress(t ? Math.round((d / t) * 100) : 0));
    prep
      .then(() => alive && setReady(true))
      .catch(() => alive && setReady(true)); // 모델 다운로드 실패해도 UI 멈춤 방지
    return () => {
      alive = false;
    };
  }, [open, embedMode]);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height };
  };
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    // 획 직전 상태를 스냅샷(되돌리기). 메모리 보호용으로 최근 24획만 보관.
    history.current.push(ctx.getImageData(0, 0, c.width, c.height));
    if (history.current.length > 24) history.current.shift();
    c.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    setHasInk(true);
    setCanUndo(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !last.current) return;
    const p = pos(e);
    ctx.strokeStyle = '#16181d';
    ctx.lineWidth = brush;
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
    const q = featuresFromCanvas(c); // 잉크 유무 판정 겸용
    if (!q) {
      setResults([]);
      return;
    }
    setBusy(true);
    // 모드별 후보 랭킹: 기본=HOG(획·비트맵), 실험=ONNX 임베딩.
    const ranked = embedMode
      ? await rankByEmbedding(c, 160).catch(() => [] as RankedMark[])
      : rankFeaturesMulti(q, await ensureMarkFeatures(), 160);
    // 같은 마크 이미지는 가장 닮은 1장만(이미지 id 기준 중복 제거): "삼각형 A/B" 별개 유지.
    const seen = new Set<string>();
    const deduped: RankedMark[] = [];
    for (const r of ranked) {
      if (seen.has(r.imgId)) continue;
      seen.add(r.imgId);
      deduped.push(r);
      if (deduped.length >= DRAW_RESULTS_MAX) break;
    }
    setShowAll(false);
    setResults(deduped);
    setBusy(false);
  };

  const shown = results ? (showAll ? results : results.slice(0, DRAW_RESULTS_INITIAL)) : [];

  return (
    <BottomSheet open={open} onClose={onClose} title="그려서 마크 찾기" maxH="92%">
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--text-weak)', fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.45 }}>
        약에 새겨진 <b style={{ color: 'var(--text-strong)' }}>그림(마크)</b>을 <b style={{ color: 'var(--text-strong)' }}>화면 가득 크게</b> 그려보세요. 닮은 마크를 찾아드려요.
        <br />
        <span style={{ fontSize: 12.5, color: 'var(--text-weaker)' }}>마크가 있는 약만 검색돼요 · 결과는 “닮은 후보”예요.</span>
        {embedMode && (
          <span style={{ display: 'inline-block', marginLeft: 6, fontSize: 11, fontWeight: 800, color: 'var(--warn-ink)', background: 'var(--warn-weak)', padding: '1px 7px', borderRadius: 8 }}>
            AI 임베딩(실험)
          </span>
        )}
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

      {/* 펜 굵기 선택 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-weaker)', flexShrink: 0 }}>펜 굵기</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {BRUSHES.map((b) => (
            <Chip key={b.w} selected={brush === b.w} onClick={() => setBrush(b.w)}>
              {b.label}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Btn variant="ghost" icon="undo" ariaLabel="되돌리기" onClick={undo} disabled={!canUndo} style={{ height: 48, padding: '0 16px' }} />
        <Btn variant="ghost" icon="trash" ariaLabel="지우기" onClick={clearCanvas} disabled={!hasInk} style={{ height: 48, padding: '0 16px' }} />
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
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {shown.map((o, i) => (
                  <button
                    key={o.img}
                    type="button"
                    onClick={() => {
                      onPick({ code: o.code, img: o.img, imgId: o.imgId, count: 0 });
                      onClose();
                    }}
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 'var(--r-card)', background: 'var(--card)', border: i === 0 ? '1.5px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                  >
                    {i === 0 && (
                      <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 10.5, fontWeight: 800, color: '#fff', background: 'var(--primary)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                        가장 닮음
                      </span>
                    )}
                    <MarkGlyph option={o as MarkOpt} size={48} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-weak)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{o.code}</span>
                  </button>
                ))}
              </div>
              {!showAll && results.length > DRAW_RESULTS_INITIAL && (
                <Btn variant="ghost" full icon="chevDown" onClick={() => setShowAll(true)} style={{ height: 44, marginTop: 10 }}>
                  더 보기 ({results.length - DRAW_RESULTS_INITIAL}개)
                </Btn>
              )}
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
