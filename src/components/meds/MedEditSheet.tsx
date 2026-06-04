import type { MedItem } from '../../domain/models';
import { BottomSheet } from '../ui/BottomSheet';
import { MedForm, type MedFormValue } from './MedForm';

interface Props {
  med: MedItem | null; // null이면 닫힘
  onClose: () => void;
  onSave: (med: MedItem) => void;
  onDelete: (medId: string) => void;
}

/** 저장된 항목 편집/삭제 바텀시트. */
export function MedEditSheet({ med, onClose, onSave, onDelete }: Props) {
  if (!med) return null;

  const initial: MedFormValue = {
    name: med.name,
    tabletCount: med.tabletCount,
    frequency: med.frequency,
    timings: med.timings,
    color: med.color ?? '',
    shape: med.shape ?? '',
    marking: med.marking ?? '',
  };

  const handleSubmit = (v: MedFormValue) => {
    onSave({
      ...med,
      name: v.name,
      tabletCount: v.tabletCount,
      frequency: v.frequency,
      timings: v.timings,
      color: v.color || undefined,
      shape: v.shape || undefined,
      marking: v.marking || undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(med.id);
    onClose();
  };

  return (
    <BottomSheet open title="항목 편집" onClose={onClose}>
      <MedForm
        initial={initial}
        submitLabel="저장"
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </BottomSheet>
  );
}
