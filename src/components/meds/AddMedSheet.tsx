import type { PillResult } from '../../api';
import type { MedItem } from '../../domain/models';
import { uid } from '../../state/store';
import { BottomSheet } from '../ui/BottomSheet';
import { MedForm, type MedFormValue } from './MedForm';

interface Props {
  pill: PillResult | null; // null이면 닫힘
  onClose: () => void;
  onAdd: (med: MedItem) => void;
}

/** 검색 결과 → 환자 리스트 추가 바텀시트. API 값 자동 채움. */
export function AddMedSheet({ pill, onClose, onAdd }: Props) {
  if (!pill) return null;

  const initial: MedFormValue = {
    name: pill.itemName,
    tabletCount: 1,
    frequency: 'QD',
    timing: '아침식후',
    color: pill.colorClass1 ?? '',
    shape: pill.drugShape ?? '',
    marking: pill.printFront ?? '',
  };

  const handleSubmit = (v: MedFormValue) => {
    const med: MedItem = {
      id: uid(),
      itemSeq: pill.itemSeq,
      name: v.name,
      imageUrl: pill.itemImage,
      color: v.color || undefined,
      shape: v.shape || undefined,
      marking: v.marking || undefined,
      tabletCount: v.tabletCount,
      frequency: v.frequency,
      timing: v.timing,
      createdAt: Date.now(),
    };
    onAdd(med);
    onClose();
  };

  return (
    <BottomSheet open title="환자 리스트에 추가" onClose={onClose}>
      <MedForm initial={initial} submitLabel="추가" onSubmit={handleSubmit} />
    </BottomSheet>
  );
}
