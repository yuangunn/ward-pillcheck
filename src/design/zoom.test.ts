import { describe, it, expect } from 'vitest';
import { DOUBLE_TAP_SCALE, MAX_SCALE, ZOOM_RESET, clampPan, pan, pinch, toggleDoubleTap, zoomAt } from './zoom';

const W = 300;
const H = 200;

describe('zoom (라이트박스 사진 확대 계산)', () => {
  it('원래 크기에선 움직일 수 없다(빈 곳이 보이지 않게)', () => {
    expect(clampPan({ s: 1, x: 50, y: -40 }, W, H)).toEqual(ZOOM_RESET);
  });

  it('확대 배율만큼만 이동 가능', () => {
    // 2배면 가로 ±150, 세로 ±100 까지
    expect(clampPan({ s: 2, x: 999, y: -999 }, W, H)).toEqual({ s: 2, x: 150, y: -100 });
  });

  it('배율은 1~4배로 제한', () => {
    expect(clampPan({ s: 10, x: 0, y: 0 }, W, H).s).toBe(MAX_SCALE);
    expect(clampPan({ s: 0.3, x: 0, y: 0 }, W, H).s).toBe(1);
  });

  it('zoomAt: 손가락 아래 점이 제자리에 남는다', () => {
    const z = zoomAt(ZOOM_RESET, 2, 60, 20, W, H);
    // 내용점 c=(60,20) 이 확대 후에도 화면 (60,20) 에: t + s·c = p
    expect(z.x + z.s * 60).toBeCloseTo(60);
    expect(z.y + z.s * 20).toBeCloseTo(20);
  });

  it('두 번 탭: 확대 ↔ 원래대로', () => {
    const z1 = toggleDoubleTap(ZOOM_RESET, 0, 0, W, H);
    expect(z1).toEqual({ s: DOUBLE_TAP_SCALE, x: 0, y: 0 });
    expect(toggleDoubleTap(z1, 10, 10, W, H)).toEqual(ZOOM_RESET);
  });

  it('핀치: 손가락 거리가 2배가 되면 2배 확대, 가운데점 유지', () => {
    const z = pinch(ZOOM_RESET, { x: -20, y: 0 }, { x: 20, y: 0 }, { x: -40, y: 0 }, { x: 40, y: 0 }, W, H);
    expect(z.s).toBeCloseTo(2);
    expect(z.x).toBeCloseTo(0);
  });

  it('핀치: 오므리면 1배 아래로 내려가지 않는다', () => {
    const z = pinch({ s: 2, x: 30, y: 0 }, { x: -40, y: 0 }, { x: 40, y: 0 }, { x: -5, y: 0 }, { x: 5, y: 0 }, W, H);
    expect(z).toEqual(ZOOM_RESET);
  });

  it('끌기: 확대 상태에서 손가락만큼 이동(범위 안)', () => {
    expect(pan({ s: 2, x: 0, y: 0 }, { x: 0, y: 0 }, { x: 30, y: -10 }, W, H)).toEqual({ s: 2, x: 30, y: -10 });
  });
});
