import { describe, it, expect } from 'vitest';
import { SHAPE_GEOM, glyphColors, shapePathD } from './pillShape';

describe('shapePathD (캔버스 Path2D 용 도형 경로)', () => {
  it('모든 모양이 닫힌 단일 경로', () => {
    for (const shape of Object.keys(SHAPE_GEOM)) {
      const d = shapePathD(shape);
      expect(d.startsWith('M'), shape).toBe(true);
      expect(d.endsWith('Z'), shape).toBe(true);
      expect(d).not.toMatch(/NaN|undefined/);
    }
  });
  it('원형은 지름 양끝(11~89)을 잇는 두 호', () => {
    expect(shapePathD('원형')).toBe('M11 50A39 39 0 1 0 89 50A39 39 0 1 0 11 50Z');
  });
  it('모르는 모양은 원형으로', () => {
    expect(shapePathD('별모양')).toBe(shapePathD('원형'));
    expect(shapePathD(undefined)).toBe(shapePathD('원형'));
  });
  it('장방형은 둥근 모서리 사각형(가로 5~95)', () => {
    const d = shapePathD('장방형');
    expect(d).toMatch(/^M22 31H78A17 17 /);
  });
});

describe('glyphColors', () => {
  it('밝은 색은 어두운 각인, 어두운 색은 밝은 각인', () => {
    expect(glyphColors('하양').light).toBe(true);
    expect(glyphColors('하양').ink).toMatch(/^rgba\(25/);
  });
});
