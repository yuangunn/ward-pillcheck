// 그림 데이터 수집기(옵트인) — ONNX cross-domain 모델 학습용 "진짜 손그림" 수집.
// 그려서찾기에서 사용자가 그림을 그리고 약을 고르면 (획 + 비트맵, 고른 마크 id)를 로컬 저장.
// 그림은 마크 모양일 뿐 PHI 아님. 기본 꺼짐 — 설정에서 켜야 수집한다.
// 저장은 IndexedDB(dataset 스토어의 단일 키 배열). 내보내면 JSON 으로 학습 파이프라인에 투입.

import { idbGet, idbSet } from '../api/dataset';

const KEY = 'drawSamples';
const FLAG = 'ward-pillcheck:collectDraw';
const CAP = 3000; // 과성장 방지(초과 시 오래된 것부터 버림)

/** 한 점 [x,y] (캔버스 좌표). JSON 용량 위해 배열로. */
export type StrokePt = [number, number];

export interface DrawSample {
  id: string;
  ts: number;
  strokes: StrokePt[][]; // 획별 점 배열(온라인 신호)
  png: string; // 캔버스 비트맵 dataURL(오프라인 신호)
  markImgId: string; // 사용자가 고른 마크 이미지 id(약한 라벨)
  markCode: string; // 고른 마크 글자값(참고)
  w: number;
  h: number;
}

export function getCollectMode(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}
export function setCollectMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(FLAG, '1');
    else localStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
}

async function readAll(): Promise<DrawSample[]> {
  try {
    return (await idbGet<DrawSample[]>(KEY)) ?? [];
  } catch {
    return [];
  }
}

/** 표본 1건 추가(라벨=고른 마크). 용량 상한 초과 시 오래된 것부터 제거. */
export async function addSample(s: Omit<DrawSample, 'id' | 'ts'>): Promise<void> {
  const all = await readAll();
  all.push({ ...s, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now() });
  const trimmed = all.length > CAP ? all.slice(all.length - CAP) : all;
  try {
    await idbSet(KEY, trimmed);
  } catch {
    /* 저장 실패 무시(수집은 보조 기능) */
  }
}

export async function sampleCount(): Promise<number> {
  return (await readAll()).length;
}

export async function exportSamples(): Promise<DrawSample[]> {
  return readAll();
}

export async function clearSamples(): Promise<void> {
  try {
    await idbSet(KEY, []);
  } catch {
    /* ignore */
  }
}
