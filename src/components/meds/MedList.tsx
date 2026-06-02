import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { MedItem, Patient } from '../../domain/models';
import { sortMeds } from '../../domain/sort';
import { useStore } from '../../state/store';
import { EmptyState } from '../ui/States';
import { SortControls } from './SortControls';
import { MedRow } from './MedRow';
import { MedEditSheet } from './MedEditSheet';

interface Props {
  patient: Patient;
}

/** 환자별 약물 리스트 + 정렬(드래그/자동) + 편집. */
export function MedList({ patient }: Props) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState<MedItem | null>(null);

  // 표시 순서는 정렬 모드에 따라 파생. 수동 모드면 저장 순서 그대로.
  const displayed = sortMeds(patient.meds, patient.sortMode);

  const sensors = useSensors(
    // 모바일 터치: 250ms 길게 눌러야 드래그 시작(스크롤과 구분)
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 드래그는 자동정렬 중에도 허용한다. 현재 "보이는 순서(displayed)"를 기준으로
  // 재배치한 뒤 그 결과를 새로운 수동 순서로 고정(REORDER_MEDS → sortMode='manual').
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = displayed.findIndex((m) => m.id === active.id);
    const newIndex = displayed.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(displayed, oldIndex, newIndex);
    dispatch({ type: 'REORDER_MEDS', patientId: patient.id, meds: reordered });
  };

  return (
    <section>
      <SortControls
        mode={patient.sortMode}
        onChange={(mode) => dispatch({ type: 'SET_SORT_MODE', patientId: patient.id, mode })}
      />

      {patient.meds.length === 0 ? (
        <EmptyState message="아직 추가된 약이 없습니다. 위에서 검색해 추가하세요." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={displayed.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="med-list">
              {displayed.map((med) => (
                <MedRow key={med.id} med={med} draggable onEdit={setEditing} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <MedEditSheet
        med={editing}
        onClose={() => setEditing(null)}
        onSave={(med) => dispatch({ type: 'UPDATE_MED', patientId: patient.id, med })}
        onDelete={(medId) => dispatch({ type: 'REMOVE_MED', patientId: patient.id, medId })}
      />
    </section>
  );
}
