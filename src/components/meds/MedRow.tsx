import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MedItem } from '../../domain/models';
import { formatTabletCount, formatAppearance } from '../../domain/format';

interface Props {
  med: MedItem;
  draggable: boolean; // 수동 정렬 모드에서만 드래그 핸들 활성
  onEdit: (med: MedItem) => void;
}

/**
 * 약물 한 줄. 드래그 핸들 + 본문(탭 시 편집).
 * 표시: [품목명] [정수]T [용법] [복용시점] ([색]/[모양]/[각인])
 */
export function MedRow({ med, draggable, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: med.id, disabled: !draggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const appearance = formatAppearance(med);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`card med-item${isDragging ? ' med-dragging' : ''}`}
    >
      {draggable && (
        // dnd-kit attributes 가 role="button"/tabIndex 등 a11y 속성을 주입한다.
        <span className="med-handle" aria-label="순서 변경 핸들" {...attributes} {...listeners}>
          ⠿
        </span>
      )}
      <button type="button" className="med-line" onClick={() => onEdit(med)}>
        <div className="med-name">
          {med.name} {formatTabletCount(med.tabletCount)}T {med.frequency} {med.timing}
        </div>
        {appearance && <div className="med-meta">{appearance}</div>}
      </button>
    </li>
  );
}
