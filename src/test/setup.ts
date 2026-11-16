import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 각 테스트 격리: DOM 정리 + localStorage 초기화
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom 에는 PointerEvent 가 없어 fireEvent.pointerDown 이 pointerId·좌표 없는 Event 를 만든다.
// (사진 확대의 핀치·두 번 탭 테스트용) MouseEvent 기반 최소 폴리필.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'touch';
      this.isPrimary = init.isPrimary ?? false;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
}
