import type { MedItem } from '../domain/models';
import { getBundledDurMap } from './durBundle';

// DUR(의약품안전사용서비스) 점검: 병용금기/임부금기/노인주의/연령금기/효능군중복.
// 받아둔 DUR 번들(오프라인) 우선, 없으면 Worker /api/dur?itemSeq= 품목별 조회.

export interface DurCombo {
  seq: string;
  name: string;
  content?: string;
}
export interface DurNote {
  content?: string;
  name?: string;
}
export interface DurInfo {
  itemSeq: string;
  combo: DurCombo[];
  pregnancy: DurNote[];
  elderly: DurNote[];
  age: DurNote[];
  dup: DurNote[];
}

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
export const durEnabled = !!apiBase;

const empty = (itemSeq: string): DurInfo => ({
  itemSeq,
  combo: [],
  pregnancy: [],
  elderly: [],
  age: [],
  dup: [],
});

/** 한 품목 DUR 조회 (실패 시 빈 결과) */
export async function fetchDur(itemSeq: string): Promise<DurInfo> {
  if (!apiBase) return empty(itemSeq);
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/dur?itemSeq=${encodeURIComponent(itemSeq)}`);
    if (!res.ok) return empty(itemSeq);
    const d = (await res.json()) as { body?: { dur?: Partial<DurInfo> } };
    const dur = d.body?.dur ?? {};
    return {
      itemSeq,
      combo: dur.combo ?? [],
      pregnancy: dur.pregnancy ?? [],
      elderly: dur.elderly ?? [],
      age: dur.age ?? [],
      dup: dur.dup ?? [],
    };
  } catch {
    return empty(itemSeq);
  }
}

/** 리스트의 모든 품목 DUR 조회 — 받아둔 번들(오프라인) 우선, 없으면 워커 품목별 조회 */
export async function fetchDurMap(meds: Pick<MedItem, 'itemSeq'>[]): Promise<Map<string, DurInfo>> {
  const seqs = [...new Set(meds.map((m) => m.itemSeq).filter(Boolean))];
  const bundled = await getBundledDurMap(seqs);
  if (bundled) return bundled; // 다운로드됨 → 오프라인 매칭
  const infos = await Promise.all(seqs.map(fetchDur));
  return new Map(infos.map((i) => [i.itemSeq, i]));
}

export interface ComboWarning {
  aName: string;
  bName: string;
  content?: string;
}
export interface MedFlag {
  medId: string;
  name: string;
  kinds: { type: '임부금기' | '노인주의' | '연령금기' | '효능군중복'; content?: string }[];
}
export interface InteractionResult {
  combos: ComboWarning[];
  flags: MedFlag[];
}

type MedLike = Pick<MedItem, 'id' | 'name' | 'itemSeq'>;

/**
 * 환자 약 리스트 + DUR 데이터로 경고를 계산(순수 함수).
 * - combos: 리스트 내 두 약이 서로 병용금기인 쌍
 * - flags: 약별 임부/노인/연령 금기·효능군 중복
 */
export function analyzeInteractions(meds: MedLike[], durMap: Map<string, DurInfo>): InteractionResult {
  const combos: ComboWarning[] = [];
  const seenPair = new Set<string>();

  for (const a of meds) {
    const info = durMap.get(a.itemSeq);
    if (!info) continue;
    for (const c of info.combo) {
      const b = meds.find(
        (m) =>
          m.id !== a.id &&
          ((c.seq && m.itemSeq === c.seq) || (!c.seq && c.name && m.name.includes(c.name))),
      );
      if (!b) continue;
      const key = [a.id, b.id].sort().join('|');
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      combos.push({ aName: a.name, bName: b.name, content: c.content });
    }
  }

  const flags: MedFlag[] = [];
  for (const a of meds) {
    const info = durMap.get(a.itemSeq);
    if (!info) continue;
    const kinds: MedFlag['kinds'] = [];
    if (info.pregnancy.length) kinds.push({ type: '임부금기', content: info.pregnancy[0].content });
    if (info.elderly.length) kinds.push({ type: '노인주의', content: info.elderly[0].content });
    if (info.age.length) kinds.push({ type: '연령금기', content: info.age[0].content });
    if (info.dup.length) kinds.push({ type: '효능군중복', content: info.dup[0].content });
    if (kinds.length) flags.push({ medId: a.id, name: a.name, kinds });
  }

  return { combos, flags };
}
