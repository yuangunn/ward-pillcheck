import { useState } from 'react';
import { drugApi, type DrugDetail, type PillResult } from '../../api';
import { Spinner, ErrorState } from '../ui/States';

interface Props {
  pill: PillResult;
  onAdd: (pill: PillResult) => void;
}

type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; detail: DrugDetail | null }
  | { status: 'error' };

/** 검색 결과 카드. 탭 시 e약은요 상세를 선택적(lazy)으로 로드. */
export function ResultCard({ pill, onAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DetailState>({ status: 'idle' });
  const [imgError, setImgError] = useState(false); // 낱알이미지 로드 실패 시 폴백

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

  const sub = [pill.colorClass1, pill.drugShape, pill.printFront]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="card result-card">
      <button type="button" className="result-main" onClick={toggle} aria-expanded={expanded}>
        {pill.itemImage && !imgError ? (
          <img
            className="result-img"
            src={pill.itemImage}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="result-img-placeholder">이미지 없음</div>
        )}
        <div className="result-info">
          <div className="result-name">{pill.itemName}</div>
          <div className="result-sub">{pill.entpName}</div>
          <div className="result-sub">
            {sub}
            {pill.formCodeName ? ` · ${pill.formCodeName}` : ''}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="result-detail">
          {detail.status === 'loading' && <Spinner label="상세 정보 불러오는 중…" />}
          {detail.status === 'error' && (
            <ErrorState message="상세 정보를 불러오지 못했습니다." onRetry={loadDetail} />
          )}
          {detail.status === 'loaded' && <DetailBody detail={detail.detail} />}
        </div>
      )}

      <div className="result-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => onAdd(pill)}>
          환자 리스트에 추가
        </button>
      </div>
    </div>
  );
}

function DetailBody({ detail }: { detail: DrugDetail | null }) {
  if (!detail) return <div className="result-sub">상세(e약은요) 정보가 없습니다.</div>;
  const rows: [string, string | undefined][] = [
    ['효능', detail.efcy],
    ['용법', detail.useMethod],
    ['주의', detail.atpn],
    ['상호작용', detail.intrc],
    ['부작용', detail.se],
    ['보관법', detail.deposit],
  ];
  const visible = rows.filter(([, v]) => v && v.trim());
  if (visible.length === 0)
    return <div className="result-sub">상세(e약은요) 정보가 없습니다.</div>;
  return (
    <dl>
      {visible.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
