// 외부 워커(공용 인터넷) 연결성 프로브.
// DUR 금기점검·상세 보충정보·실물사진은 모두 같은 워커(VITE_API_BASE)를 거치므로,
// 워커 /health 한 번으로 "인트라넷(외부망 차단)" 여부를 판별한다.
// 백그라운드에서 던지고(앱 렌더를 막지 않음), 결과가 오면 구독자에게 알린다.
import { useEffect, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();

// null = 확인 중(낙관적으로 '보임' 취급) · true = 연결됨 · false = 인트라넷/오프라인
export type Reachable = boolean | null;

// 워커 미설정(데모/목 모드)에선 게이팅하지 않음(항상 true).
let state: Reachable = API_BASE ? null : true;
const listeners = new Set<(r: Reachable) => void>();
let inflight: Promise<void> | null = null;

function emit(): void {
  for (const fn of listeners) fn(state);
}

/** 워커 /health 로 연결성 점검(중복 호출은 공유). 4초 타임아웃. */
export function probeWorker(): Promise<void> {
  if (!API_BASE) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(`${API_BASE.replace(/\/$/, '')}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl.signal,
      });
      state = res.ok;
    } catch {
      state = false; // 연결 실패 → 인트라넷/오프라인으로 판단
    } finally {
      clearTimeout(t);
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

// 네트워크가 돌아오면 재점검(인트라넷 → 인터넷 이동 시 기능 복구)
if (typeof window !== 'undefined' && API_BASE) {
  window.addEventListener('online', () => {
    state = null;
    emit();
    probeWorker();
  });
}

/**
 * 워커 연결 가능 여부 구독. 반환값:
 *  - null  : 확인 중(낙관적 — 기능을 가리지 않음)
 *  - true  : 연결됨
 *  - false : 인트라넷/오프라인 — 워커 전용 기능을 숨긴다
 * 첫 마운트에서 백그라운드 프로브를 시작(렌더를 막지 않음).
 */
export function useWorkerReachable(): Reachable {
  const [r, setR] = useState<Reachable>(state);
  useEffect(() => {
    listeners.add(setR);
    if (state === null) probeWorker();
    return () => {
      listeners.delete(setR);
    };
  }, []);
  return r;
}
