import { BottomSheet } from '../ui/BottomSheet';
import type { InteractionResult } from '../../api/dur';

interface Props {
  open: boolean;
  loading: boolean;
  result: InteractionResult | null;
  onClose: () => void;
}

/** DUR 점검 결과: 병용금기 쌍 + 약별 주의/금기. */
export function InteractionSheet({ open, loading, result, onClose }: Props) {
  if (!open) return null;

  const nothing =
    !loading && result && result.combos.length === 0 && result.flags.length === 0;

  return (
    <BottomSheet open title="금기·중복 점검" onClose={onClose}>
      {loading && <div className="center-state">DUR 데이터 조회 중…</div>}

      {nothing && (
        <div className="banner" role="status">
          현재 리스트에서 확인된 병용금기·주의 항목이 없습니다. (DUR 데이터 기준이며 임상
          판단을 대체하지 않습니다.)
        </div>
      )}

      {!loading && result && result.combos.length > 0 && (
        <section className="dur-section">
          <h3 className="dur-h dur-danger">⛔ 병용금기 ({result.combos.length})</h3>
          {result.combos.map((c, i) => (
            <div key={i} className="dur-item dur-danger-box">
              <div className="dur-pair">
                {c.aName} ✕ {c.bName}
              </div>
              {c.content && <div className="dur-content">{c.content}</div>}
            </div>
          ))}
        </section>
      )}

      {!loading && result && result.flags.length > 0 && (
        <section className="dur-section">
          <h3 className="dur-h">⚠️ 약별 주의·금기</h3>
          {result.flags.map((f) => (
            <div key={f.medId} className="dur-item">
              <div className="dur-name">{f.name}</div>
              <div className="dur-tags">
                {f.kinds.map((k) => (
                  <span key={k.type} className="dur-tag">
                    {k.type}
                  </span>
                ))}
              </div>
              {f.kinds.map(
                (k) => k.content && <div key={k.type} className="dur-content">[{k.type}] {k.content}</div>,
              )}
            </div>
          ))}
        </section>
      )}

      {!loading && (
        <p className="dur-foot">
          식약처 DUR 데이터 기반 자동 점검입니다. 최종 판단은 의·약사가 확인하세요.
        </p>
      )}
    </BottomSheet>
  );
}
