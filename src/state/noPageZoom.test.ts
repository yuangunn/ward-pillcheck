import { describe, it, expect } from 'vitest';
import { disablePageZoom } from './noPageZoom';

describe('disablePageZoom (iOS 화면 핀줌 차단)', () => {
  it('gesturestart/change/end 기본 동작을 막고, 해제하면 다시 허용', () => {
    const doc = document.implementation.createHTMLDocument('t');
    const off = disablePageZoom(doc);
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
      const ev = new Event(t, { cancelable: true });
      doc.dispatchEvent(ev);
      expect(ev.defaultPrevented, t).toBe(true);
    }
    off();
    const ev = new Event('gesturestart', { cancelable: true });
    doc.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
