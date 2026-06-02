import type { DrugApi } from './types';
import { createWorkerClient } from './workerClient';
import { createMockClient } from './mockClient';

export * from './types';

// API 클라이언트 팩토리.
// VITE_API_BASE 가 설정돼 있으면 Worker 프록시를, 비어 있으면 목 클라이언트를 사용.
// 컴포넌트는 이 단일 인스턴스만 import 하므로 데이터 소스 교체가 한 곳에서 끝난다.

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();

export const drugApi: DrugApi = apiBase
  ? createWorkerClient(apiBase)
  : createMockClient();

/** 현재 목 모드인지 (UI 안내 배너용) */
export const isMockMode = !apiBase;
