import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PillGlyph, ShapeOutline } from './Icon';
import { SHAPE_OPTIONS } from '../constants/appearance';

// 리디자인 핸드오프: 11개 도형이 CSS 둥근박스가 아니라 실제 SVG 형태로 그려져야 한다.
describe('PillGlyph (SVG 폴리곤)', () => {
  it('항상 viewBox 100 SVG를 렌더', () => {
    const { container } = render(<PillGlyph color="하양" shape="원형" marking="AB" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
  });

  it('각인 텍스트는 6자로 잘림', () => {
    const { container } = render(<PillGlyph color="파랑" shape="타원형" marking="ABCDEFGH" />);
    expect(container.querySelector('text')?.textContent).toBe('ABCDEF');
  });

  it('다각형 도형(삼각형/오각형/육각형/팔각형/마름모형/반원형)은 path로 렌더', () => {
    for (const s of ['삼각형', '마름모형', '오각형', '육각형', '팔각형', '반원형']) {
      const { container } = render(<PillGlyph color="노랑" shape={s} marking="X" />);
      expect(container.querySelector('path'), s).toBeTruthy();
    }
  });

  it('원형은 circle, 타원형은 ellipse, 사각형은 rect', () => {
    expect(render(<PillGlyph shape="원형" />).container.querySelector('circle')).toBeTruthy();
    expect(render(<PillGlyph shape="타원형" />).container.querySelector('ellipse')).toBeTruthy();
    expect(render(<PillGlyph shape="사각형" />).container.querySelector('rect')).toBeTruthy();
  });
});

describe('ShapeOutline', () => {
  it('모든 모양 칩 아이콘이 fill=none 외곽선으로 렌더', () => {
    for (const s of SHAPE_OPTIONS) {
      const { container } = render(<ShapeOutline shape={s} />);
      const node = container.querySelector('svg > *');
      expect(node?.getAttribute('fill'), s).toBe('none');
    }
  });
});
