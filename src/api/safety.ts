import type { MedItem } from '../domain/models';
import { drugApi } from './index';
import { analyzeInteractions, fetchDurMapChecked, type DurStatus, type InteractionResult } from './dur';
import { analyzeIngredientOverlap, type IngredientOverlap } from '../domain/ingredient';
import { analyzeSplitCrush, type SplitCrushFlag } from '../domain/formulation';

// 금기·중복 점검 묶음 — 안전점검 시트(DurSheet)와 A4 출력물이 같은 결과를 쓰도록 한 곳에 모은다.
// 성분중복·분할분쇄는 번들/mock 데이터로 완전 오프라인, DUR 은 받아둔 번들 → 워커 순.

export interface SafetyResult {
  dur: InteractionResult;
  durStatus: DurStatus;
  overlaps: IngredientOverlap[];
  splitCrush: SplitCrushFlag[];
  checkedAt: number; // ms
}

export async function runSafetyCheck(meds: MedItem[]): Promise<SafetyResult> {
  const seqs = [...new Set(meds.map((m) => m.itemSeq).filter(Boolean))];
  const overlapP = drugApi.getIngredients
    ? drugApi.getIngredients(seqs).then((ingr) => analyzeIngredientOverlap(meds, ingr)).catch(() => [])
    : Promise.resolve<IngredientOverlap[]>([]);
  const splitP = drugApi.getForms
    ? drugApi.getForms(seqs).then((forms) => analyzeSplitCrush(meds, forms)).catch(() => [])
    : Promise.resolve<SplitCrushFlag[]>([]);
  const durP = fetchDurMapChecked(meds)
    .then(({ map, status }) => ({ dur: analyzeInteractions(meds, map), status }))
    .catch(() => ({ dur: { combos: [], flags: [] } as InteractionResult, status: 'unavailable' as DurStatus }));
  const [dur, overlaps, splitCrush] = await Promise.all([durP, overlapP, splitP]);
  return { dur: dur.dur, durStatus: dur.status, overlaps, splitCrush, checkedAt: Date.now() };
}
