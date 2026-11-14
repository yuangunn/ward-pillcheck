import { describe, it, expect, afterEach } from 'vitest';
import { MIN_KEYBOARD, isEditing, trackKeyboardInset, viewportFit } from './keyboardInset';

const H = 844; // 레이아웃 높이(아이폰 세로)

describe('viewportFit (키보드 위로 앱 화면 맞추기)', () => {
  it('입력 중 + 키보드(336px)가 덮으면 아래 336 만큼 줄인다', () => {
    expect(viewportFit(H, { height: H - 336, offsetTop: 0, scale: 1 }, true)).toEqual({ top: 0, bottom: 336 });
  });
  it('iOS 가 보이는 영역을 위로 밀어 올린 경우(offsetTop) 위·아래 모두 맞춘다', () => {
    expect(viewportFit(H, { height: 500, offsetTop: 40, scale: 1 }, true)).toEqual({ top: 40, bottom: 304 });
  });
  it('입력 중이 아니면 0 (도구막대 변화 등에 반응하지 않음)', () => {
    expect(viewportFit(H, { height: 500, offsetTop: 0, scale: 1 }, false)).toEqual({ top: 0, bottom: 0 });
  });
  it('작은 차이(도구막대)는 키보드로 보지 않는다', () => {
    expect(viewportFit(H, { height: H - (MIN_KEYBOARD - 1), offsetTop: 0, scale: 1 }, true)).toEqual({ top: 0, bottom: 0 });
  });
  it('확대 중(scale>1)에는 건드리지 않는다', () => {
    expect(viewportFit(H, { height: 300, offsetTop: 100, scale: 2 }, true)).toEqual({ top: 0, bottom: 0 });
  });
  it('visualViewport 미지원이면 0', () => {
    expect(viewportFit(H, null, true)).toEqual({ top: 0, bottom: 0 });
  });
});

describe('isEditing', () => {
  it('텍스트 입력·textarea 는 키보드, 체크박스·버튼·읽기전용은 아님', () => {
    const text = document.createElement('input');
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox' });
    const ro = Object.assign(document.createElement('input'), { readOnly: true });
    expect(isEditing(text)).toBe(true);
    expect(isEditing(document.createElement('textarea'))).toBe(true);
    expect(isEditing(cb)).toBe(false);
    expect(isEditing(ro)).toBe(false);
    expect(isEditing(document.createElement('button'))).toBe(false);
    expect(isEditing(null)).toBe(false);
  });
});

describe('trackKeyboardInset (이벤트 연결)', () => {
  let off: (() => void) | undefined;
  afterEach(() => {
    off?.();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-keyboard');
    document.documentElement.style.removeProperty('--kb-inset');
    document.documentElement.style.removeProperty('--vv-top');
  });

  it('입력칸 포커스 + 키보드 → --kb-inset·data-keyboard, 포커스 해제·키보드 닫힘 → 0', async () => {
    Object.defineProperty(document.documentElement, 'clientHeight', { value: H, configurable: true });
    const vv = Object.assign(new EventTarget(), { height: H, offsetTop: 0, scale: 1 });
    const win = {
      visualViewport: vv,
      document,
      requestAnimationFrame: (cb: FrameRequestCallback) => (cb(0), 1),
      cancelAnimationFrame: () => {},
    } as unknown as Window;
    off = trackKeyboardInset(win);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    vv.height = H - 336;
    vv.dispatchEvent(new Event('resize'));
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--kb-inset')).toBe('336px');
    expect(root.hasAttribute('data-keyboard')).toBe(true);

    input.blur();
    vv.height = H;
    vv.dispatchEvent(new Event('resize'));
    expect(root.style.getPropertyValue('--kb-inset')).toBe('0px');
    expect(root.hasAttribute('data-keyboard')).toBe(false);
  });
});
