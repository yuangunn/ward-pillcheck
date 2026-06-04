import { useEffect, useState } from 'react';
import { getMarkOptions, type MarkOption } from '../../api';
import { BottomSheet } from '../ui/BottomSheet';
import { Spinner, EmptyState } from '../ui/States';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (opt: MarkOption) => void;
}

/** 마크(그림 식별표시) 갤러리 — 이미지로 보고 골라서 검색. */
export function MarkGallerySheet({ open, onClose, onPick }: Props) {
  const [opts, setOpts] = useState<MarkOption[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setOpts(null);
    getMarkOptions().then((o) => alive && setOpts(o));
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  const filtered = opts?.filter((o) => !query.trim() || o.code.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <BottomSheet open title="마크로 찾기" onClose={onClose}>
      <p className="mark-help">약에 새겨진 그림(마크)과 가장 비슷한 것을 골라주세요.</p>
      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="마크 코드로 거르기 (예: D, dk)"
        autoComplete="off"
        style={{ marginBottom: 12 }}
      />
      {!opts && <Spinner label="마크 목록 불러오는 중…" />}
      {opts && filtered && filtered.length === 0 && <EmptyState message="해당하는 마크가 없습니다." />}
      {filtered && filtered.length > 0 && (
        <div className="mark-grid">
          {filtered.map((o) => (
            <button
              key={o.code}
              type="button"
              className="mark-cell"
              onClick={() => {
                onPick(o);
                onClose();
              }}
            >
              <img className="mark-cell-img" src={o.img} alt={o.code} loading="lazy" />
              <span className="mark-cell-code">{o.code}</span>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
