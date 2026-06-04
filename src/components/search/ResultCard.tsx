import { useState } from 'react';
import { drugApi, type DrugDetail, type PillResult } from '../../api';
import { Spinner, ErrorState } from '../ui/States';
import { ImageLightbox } from '../ui/ImageLightbox';

interface Props {
  pill: PillResult;
  onAdd: (pill: PillResult) => void;
  /** 실물검색에서 입력한 각인(앞/뒤 중 어디에 매칭됐는지 강조용) */
  highlight?: string;
}

/** 검색어와 일치하는 부분을 <mark>로 강조 */
function Highlighted({ text, term }: { text: string; term?: string }) {
  const t = term?.trim();
  if (!t) return <>{text}</>;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="hl">{text.slice(i, i + t.length)}</mark>
      {text.slice(i + t.length)}
    </>
  );
}

type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; detail: DrugDetail | null }
  | { status: 'error' };

/** 분할선 표시용: "-"/없음/빈값은 숨기고 의미있는 값만 */
export function lineText(front?: string, back?: string): string | null {
  const norm = (v?: string) => {
    const t = (v ?? '').trim();
    return t && t !== '-' && t !== '없음' ? t : '';
  };
  const f = norm(front);
  const b = norm(back);
  if (!f && !b) return null;
  const parts: string[] = [];
  if (f) parts.push(`앞 ${f}`);
  if (b) parts.push(`뒤 ${b}`);
  return `분할선 ${parts.join(' / ')}`;
}

/** 검색 결과 카드. 탭 시 e약은요 상세를 선택적(lazy)으로 로드. */
export function ResultCard({ pill, onAdd, highlight }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DetailState>({ status: 'idle' });
  const [imgError, setImgError] = useState(false); // 낱알이미지 로드 실패 시 폴백
  const [zoom, setZoom] = useState(false); // 이미지 확대 보기

  const loadDetail = async () => {
    setDetail({ status: 'loading' });
    try {
      const d = await drugApi.getDetail(pill.itemSeq);
      setDetail({ status: 'loaded', detail: d });
    } catch {
      setDetail({ status: 'error' });
    }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && detail.status === 'idle') void loadDetail();
  };

  const basic = [pill.colorClass1, pill.drugShape, pill.formCodeName]
    .filter(Boolean)
    .join(' · ');
  const hasImage = !!pill.itemImage && !imgError;
  const line = lineText(pill.lineFront, pill.lineBack);
  // 각인 앞/뒤 모두 표시 (검색어가 뒷면에 매칭돼도 보이도록)
  const imprintSides: { label: string; text: string }[] = [];
  if (pill.printFront) imprintSides.push({ label: '앞', text: pill.printFront });
  if (pill.printBack) imprintSides.push({ label: '뒤', text: pill.printBack });

  return (
    <div className="card result-card">
      <div className="result-main">
        {hasImage ? (
          <button
            type="button"
            className="result-img-btn"
            aria-label="이미지 확대"
            onClick={() => setZoom(true)}
          >
            <img
              className="result-img"
              src={pill.itemImage}
              alt=""
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </button>
        ) : (
          <div className="result-img-placeholder">이미지 없음</div>
        )}
        <button
          type="button"
          className="result-info-btn"
          onClick={toggle}
          aria-expanded={expanded}
        >
          <div className="result-name">{pill.itemName}</div>
          <div className="result-sub">{pill.entpName}</div>
          {basic && <div className="result-sub">{basic}</div>}
          {imprintSides.length > 0 && (
            <div className="result-sub">
              각인{' '}
              {imprintSides.map((s, i) => (
                <span key={s.label}>
                  {i > 0 && ' / '}
                  {s.label} <Highlighted text={s.text} term={highlight} />
                </span>
              ))}
            </div>
          )}
          {line && <div className="result-sub">{line}</div>}
        </button>
      </div>

      {expanded && (
        <div className="result-detail">
          {detail.status === 'loading' && <Spinner label="상세 정보 불러오는 중…" />}
          {detail.status === 'error' && (
            <ErrorState message="상세 정보를 불러오지 못했습니다." onRetry={loadDetail} />
          )}
          {detail.status === 'loaded' && <DetailBody detail={detail.detail} pill={pill} />}
        </div>
      )}

      <div className="result-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => onAdd(pill)}>
          환자 리스트에 추가
        </button>
      </div>

      {zoom && hasImage && (
        <ImageLightbox src={pill.itemImage!} alt={pill.itemName} onClose={() => setZoom(false)} />
      )}
    </div>
  );
}

function DetailBody({ detail, pill }: { detail: DrugDetail | null; pill: PillResult }) {
  const rows: [string, string | undefined][] = detail
    ? [
        ['효능', detail.efcy],
        ['용법', detail.useMethod],
        ['주의', detail.atpn],
        ['상호작용', detail.intrc],
        ['부작용', detail.se],
        ['보관법', detail.deposit],
      ]
    : [];
  const visible = rows.filter(([, v]) => v && v.trim());

  // e약은요·허가정보 모두 없으면 낱알식별 정보 + 검색 링크로 폴백
  if (visible.length === 0) return <FallbackDetail pill={pill} />;

  return (
    <div>
      {detail?.source && <div className="detail-source">출처: {detail.source}</div>}
      <dl>
        {visible.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** e약은요 상세가 없을 때: 가진 기본 정보 + 의약품안전나라 검색 링크 */
function FallbackDetail({ pill }: { pill: PillResult }) {
  const nedrug = `https://nedrug.mfds.go.kr/searchDrug?searchYn=true&keyword=${encodeURIComponent(
    pill.itemName,
  )}`;
  const rows: [string, string | undefined][] = [
    ['분류', pill.className],
    ['구분', pill.etcOtcName],
    ['제형', pill.formCodeName],
  ];
  const visible = rows.filter(([, v]) => v && v.trim());
  return (
    <div>
      <div className="result-sub" style={{ marginBottom: 8 }}>
        e약은요 상세 정보가 없는 약입니다(전문의약품 등 다수). 기본 정보:
      </div>
      {visible.length > 0 && (
        <dl>
          {visible.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <a className="detail-link" href={nedrug} target="_blank" rel="noopener noreferrer">
        의약품안전나라에서 더 찾기 ↗
      </a>
    </div>
  );
}
