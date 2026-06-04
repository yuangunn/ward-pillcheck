import { type DrugApi, type DrugDetail, type PillResult, type PillSearchQuery } from './types';
import { searchDataset } from './dataset';
import { getBundledDetail } from './details';
import { createWorkerClient } from './workerClient';

// 번들 데이터셋 클라이언트:
// - searchPills: 기기에 저장된 낱알 데이터셋에서 직접 검색(전체 커버·오프라인)
// - getDetail: 받아둔 허가사항 번들(전문약 포함) 우선 → 온라인이면 e약은요로 보강(상호작용/부작용/보관)
export function createBundledClient(apiBase: string): DrugApi {
  const worker = createWorkerClient(apiBase);

  async function liveDetail(itemSeq: string, itemName?: string): Promise<DrugDetail | null> {
    // 오프라인이면 네트워크 시도하지 않음(대기 방지)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    try {
      return await worker.getDetail(itemSeq, itemName);
    } catch {
      return null;
    }
  }

  return {
    searchPills(query: PillSearchQuery): Promise<PillResult[]> {
      return searchDataset(query);
    },
    async getDetail(itemSeq: string, itemName?: string): Promise<DrugDetail | null> {
      const bundled = await getBundledDetail(itemSeq); // 받아둔 경우에만(네트워크 없음)
      const hasDoc = !!(bundled && (bundled.efcy || bundled.useMethod || bundled.atpn));

      if (hasDoc) {
        // 허가사항 전수 본문 + (온라인) e약은요 보강(상호작용/부작용/보관/성분)
        const live = await liveDetail(itemSeq, itemName);
        return {
          itemSeq,
          efcy: bundled!.efcy ?? live?.efcy,
          useMethod: bundled!.useMethod ?? live?.useMethod,
          atpn: bundled!.atpn ?? live?.atpn,
          intrc: live?.intrc,
          se: live?.se,
          deposit: live?.deposit,
          ingredient: live?.ingredient,
          source: '허가사항',
        };
      }
      // 번들 미다운로드 → 온라인 워커(없으면 null)
      return liveDetail(itemSeq, itemName);
    },
  };
}
