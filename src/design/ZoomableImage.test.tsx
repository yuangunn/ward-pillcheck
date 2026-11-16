import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Lightbox } from './ui';

// 화면 전체 핀줌을 막은 대신, 라이트박스 실물 사진은 앱이 직접 확대한다(각인 읽기).
const pill = { itemName: '리피토정10밀리그램', color: '하양', drugShape: '원형', marking: 'ATV', imageUrl: 'https://nedrug.mfds.go.kr/x.jpg' };

function photo() {
  return screen.getByTestId('zoomable-photo');
}
function tap(el: HTMLElement, id: number, x = 150, y = 100) {
  fireEvent.pointerDown(el, { pointerId: id, clientX: x, clientY: y });
  fireEvent.pointerUp(el, { pointerId: id, clientX: x, clientY: y });
}

describe('라이트박스 사진 확대', () => {
  it('두 번 탭하면 확대, 다시 두 번 탭하면 원래대로', () => {
    render(<Lightbox pill={pill} onClose={() => {}} />);
    expect(photo().dataset.scale).toBe('1.00');
    tap(photo(), 1);
    tap(photo(), 2);
    expect(photo().dataset.scale).toBe('2.50');
    tap(photo(), 3);
    tap(photo(), 4);
    expect(photo().dataset.scale).toBe('1.00');
  });

  it('한 번 탭은 확대하지 않고, 간격이 길면 두 번 탭이 아니다', () => {
    vi.useFakeTimers();
    try {
      render(<Lightbox pill={pill} onClose={() => {}} />);
      const now = vi.spyOn(performance, 'now');
      now.mockReturnValue(1000);
      tap(photo(), 1);
      now.mockReturnValue(2000); // 1초 뒤
      tap(photo(), 2);
      expect(photo().dataset.scale).toBe('1.00');
      now.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('두 손가락으로 벌리면 확대된다', () => {
    render(<Lightbox pill={pill} onClose={() => {}} />);
    const el = photo();
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(el, { pointerId: 2, clientX: 140, clientY: 100 });
    fireEvent.pointerMove(el, { pointerId: 2, clientX: 220, clientY: 100 }); // 거리 40 → 120 (3배)
    expect(Number(el.dataset.scale)).toBeCloseTo(3, 1);
    fireEvent.pointerUp(el, { pointerId: 2, clientX: 220, clientY: 100 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(Number(el.dataset.scale)).toBeCloseTo(3, 1); // 손을 떼도 유지
  });

  it('사진을 탭해도 라이트박스가 닫히지 않고, 바깥을 탭하면 닫힌다', () => {
    const onClose = vi.fn();
    render(<Lightbox pill={pill} onClose={onClose} />);
    fireEvent.click(photo());
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      fireEvent.click(screen.getByRole('dialog', { name: '이미지 확대' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('사진이 있을 때 확대 방법을 안내한다', () => {
    render(<Lightbox pill={pill} onClose={() => {}} />);
    expect(screen.getByText(/두 번 탭하거나 두 손가락으로 확대/)).toBeTruthy();
  });
});
