import type { DrugApi } from './types';
import { createBundledClient } from './bundledClient';
import { createMockClient } from './mockClient';

export * from './types';

// API 클라이언트 팩토리.
// VITE_API_BASE 가 설정돼 있으면: 검색은 번들 데이터셋(기기), 상세(e약은요)는 Worker.
// 비어 있으면: 목 클라이언트(인증키 없이 데모).
// 컴포넌트는 이 단일 인스턴스만 import 하므로 데이터 소스 교체가 한 곳에서 끝난다.

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();

export const drugApi: DrugApi = apiBase ? createBundledClient(apiBase) : createMockClient();

/** 현재 목 모드인지 (UI 안내 배너용) */
export const isMockMode = !apiBase;
/** 검색에 번들 데이터셋을 쓰는지 (데이터 업데이트·마크 갤러리 노출용) */
export const usesDataset = !!apiBase;

export { getMarkOptions, proxiedImg, type MarkOption } from './dataset';
