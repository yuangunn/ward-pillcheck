import { describe, it, expect } from 'vitest';
import { extractFeature, cosineSim, rankFeatures, type ImgLike } from './marksim';

/** 흰 배경 + paint(x,y)==true 인 곳은 검정으로 칠한 RGBA 이미지 생성 */
function makeImg(w: number, h: number, paint: (x: number, y: number) => boolean): ImgLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ink = paint(x, y);
      const v = ink ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const square = (cx: number, cy: number, r: number) => (x: number, y: number) =>
  Math.abs(x - cx) <= r && Math.abs(y - cy) <= r;
const vbar = (cx: number, half: number) => (x: number, _y: number) => Math.abs(x - cx) <= half;
const hbar = (cy: number, half: number) => (_x: number, y: number) => Math.abs(y - cy) <= half;

describe('extractFeature', () => {
  it('잉크 없는(흰) 이미지는 0 벡터', () => {
    const f = extractFeature(makeImg(32, 32, () => false));
    expect(f.some((v) => v > 0)).toBe(false);
  });

  it('위치·크기 불변: 작은 모서리 사각형 ≈ 큰 중앙 사각형', () => {
    const small = extractFeature(makeImg(64, 64, square(8, 8, 4)));
    const big = extractFeature(makeImg(64, 64, square(32, 32, 18)));
    expect(cosineSim(small, big)).toBeGreaterThan(0.9);
  });
});

describe('cosineSim', () => {
  it('동일 벡터는 1', () => {
    const f = extractFeature(makeImg(48, 48, square(24, 24, 10)));
    expect(cosineSim(f, f)).toBeCloseTo(1, 5);
  });

  it('세로 막대 vs 가로 막대는 사각형끼리보다 덜 닮음', () => {
    const v = extractFeature(makeImg(64, 64, vbar(32, 4)));
    const h = extractFeature(makeImg(64, 64, hbar(32, 4)));
    const sq1 = extractFeature(makeImg(64, 64, square(32, 32, 12)));
    const sq2 = extractFeature(makeImg(64, 64, square(20, 40, 12)));
    expect(cosineSim(v, h)).toBeLessThan(cosineSim(sq1, sq2));
  });
});

describe('rankFeatures', () => {
  const feats = [
    { code: 'SQ', img: 'sq', vec: Array.from(extractFeature(makeImg(64, 64, square(32, 32, 12)))) },
    { code: 'VB', img: 'vb', vec: Array.from(extractFeature(makeImg(64, 64, vbar(32, 4)))) },
    { code: 'HB', img: 'hb', vec: Array.from(extractFeature(makeImg(64, 64, hbar(32, 4)))) },
  ];

  it('질의(사각형)와 가장 닮은 것이 1순위', () => {
    const q = extractFeature(makeImg(64, 64, square(24, 24, 8)));
    const ranked = rankFeatures(q, feats, 3);
    expect(ranked[0].code).toBe('SQ');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('topN 제한 + 내림차순 정렬', () => {
    const q = extractFeature(makeImg(64, 64, vbar(30, 5)));
    const ranked = rankFeatures(q, feats, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].code).toBe('VB');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });
});
