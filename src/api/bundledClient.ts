import { type DrugApi, type DrugDetail, type PillResult, type PillSearchQuery } from './types';
import { searchDataset } from './dataset';
import { createWorkerClient } from './workerClient';

// 번들 데이터셋 클라이언트:
// - searchPills: 기기에 저장된 낱알 데이터셋에서 직접 검색(전체 커버·오프라인)
// - getDetail: e약은요 상세는 양이 크고 자주 안 보므로 워커로 그때그때 조회
export function createBundledClient(apiBase: string): DrugApi {
  const worker = createWorkerClient(apiBase);
  return {
    searchPills(query: PillSearchQuery): Promise<PillResult[]> {
      return searchDataset(query);
    },
    getDetail(itemSeq: string, itemName?: string): Promise<DrugDetail | null> {
      return worker.getDetail(itemSeq, itemName);
    },
  };
}
