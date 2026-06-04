import { useState } from 'react';
import { usesDataset, type PillSearchQuery, type MarkOption } from '../../api';
import { COLOR_OPTIONS, SHAPE_OPTIONS } from '../../constants/appearance';
import { Chip } from '../ui/Chip';
import { MarkGallerySheet } from './MarkGallerySheet';

interface Props {
  onSearch: (q: PillSearchQuery) => void;
}

/**
 * 실물 역방향 검색(기본 탭): 색 + 모양 + 앞면 각인 + 마크 조합.
 * 지참약은 이름을 모르는 경우가 많아 이 모드를 기본으로 둔다.
 */
export function VisualSearch({ onSearch }: Props) {
  const [color, setColor] = useState<string | null>(null);
  const [shape, setShape] = useState<string | null>(null);
  const [printFront, setPrintFront] = useState('');
  const [mark, setMark] = useState<MarkOption | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const canSearch = !!color || !!shape || printFront.trim() !== '' || !!mark;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSearch) return;
    onSearch({
      colorClass1: color ?? undefined,
      drugShape: shape ?? undefined,
      printFront: printFront.trim() || undefined,
      markCode: mark?.code,
    });
  };

  const toggle = <T,>(cur: T | null, val: T, set: (v: T | null) => void) =>
    set(cur === val ? null : val);

  return (
    <form className="search-panel" onSubmit={submit}>
      <div className="field">
        <label>색</label>
        <div className="chip-row">
          {COLOR_OPTIONS.map((c) => (
            <Chip
              key={c.value}
              swatch={c.swatch}
              selected={color === c.value}
              onToggle={() => toggle(color, c.value, setColor)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <label>모양</label>
        <div className="chip-row">
          {SHAPE_OPTIONS.map((s) => (
            <Chip key={s} selected={shape === s} onToggle={() => toggle(shape, s, setShape)}>
              {s}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="print-q">각인 (앞면 문자)</label>
        <input
          id="print-q"
          className="input"
          value={printFront}
          onChange={(e) => setPrintFront(e.target.value)}
          placeholder="예) Bayer, 25, NOVASC"
          enterKeyHint="search"
          autoComplete="off"
        />
      </div>

      {usesDataset && (
        <div className="field">
          <label>마크 (그림 식별표시)</label>
          {mark ? (
            <div className="mark-selected">
              <img className="mark-img" src={mark.img} alt={mark.code} />
              <span>마크 «{mark.code}»</span>
              <button type="button" className="btn btn-ghost mark-clear" onClick={() => setMark(null)}>
                해제
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => setGalleryOpen(true)}
            >
              마크 골라서 찾기
            </button>
          )}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={!canSearch}>
        검색
      </button>

      <MarkGallerySheet
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onPick={setMark}
      />
    </form>
  );
}
