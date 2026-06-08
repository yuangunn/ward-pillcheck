import { describe, it, expect } from 'vitest';
import {
  extractFeature,
  extractFeatureVariants,
  rankFeatures,
  rankFeaturesMulti,
  rotateImg,
  type ImgLike,
  type MarkFeature,
} from './marksim';

// ── 그려서 찾기 정확도 평가 하니스 ───────────────────────────────
// 실제 마크 gif 는 샌드박스/CI 에 없으므로, 변별 가능한 합성 글리프를 만들고
// 회전·굵기·노이즈로 교란한 "손그림 질의"로 Recall@k 를 측정한다.
// 회전 탐색(rankFeaturesMulti)이 단발 매칭(rankFeatures)보다 robust 함을 검증.

/** 결정적 PRNG (mulberry32) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 56;
type Seg = [number, number, number, number]; // 정규화 0..1 좌표

// 변별 가능한 글리프(선분 집합 또는 원). 서로 회전 동족(예: + 와 ×)이 되지 않게 구성.
const GLYPHS: Record<string, { segs?: Seg[]; ring?: boolean }> = {
  tee: { segs: [[0.15, 0.2, 0.85, 0.2], [0.5, 0.2, 0.5, 0.85]] },
  ell: { segs: [[0.3, 0.15, 0.3, 0.8], [0.3, 0.8, 0.8, 0.8]] },
  vee: { segs: [[0.2, 0.18, 0.5, 0.82], [0.5, 0.82, 0.8, 0.18]] },
  ex: { segs: [[0.2, 0.2, 0.8, 0.8], [0.8, 0.2, 0.2, 0.8]] },
  arrow: { segs: [[0.5, 0.18, 0.5, 0.85], [0.25, 0.4, 0.5, 0.18], [0.75, 0.4, 0.5, 0.18]] },
  zee: { segs: [[0.2, 0.2, 0.8, 0.2], [0.8, 0.2, 0.2, 0.8], [0.2, 0.8, 0.8, 0.8]] },
  why: { segs: [[0.5, 0.5, 0.5, 0.85], [0.5, 0.5, 0.2, 0.18], [0.5, 0.5, 0.8, 0.18]] },
  dee: { segs: [[0.3, 0.15, 0.3, 0.85], [0.3, 0.15, 0.7, 0.35], [0.7, 0.35, 0.7, 0.65], [0.7, 0.65, 0.3, 0.85]] },
  circle: { ring: true },
};

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1,
    dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** 글리프를 ink(검정/흰배경) ImgLike 로 래스터화. stroke=획 반경(px), noise=잡음 비율. */
function renderGlyph(
  name: string,
  opts: { stroke?: number; noise?: number; rand?: () => number } = {},
): ImgLike {
  const { stroke = 2.2, noise = 0, rand } = opts;
  const g = GLYPHS[name];
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  data.fill(255);
  const pad = 8;
  const span = SIZE - pad * 2;
  const toPx = (n: number) => pad + n * span;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let ink = false;
      if (g.ring) {
        const R = span * 0.42;
        ink = Math.abs(Math.hypot(x - SIZE / 2, y - SIZE / 2) - R) <= stroke;
      } else {
        for (const [x1, y1, x2, y2] of g.segs!) {
          if (distToSeg(x, y, toPx(x1), toPx(y1), toPx(x2), toPx(y2)) <= stroke) {
            ink = true;
            break;
          }
        }
      }
      if (ink) {
        const i = (y * SIZE + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 20;
      }
    }
  }
  if (noise && rand) {
    const k = Math.floor(noise * SIZE * SIZE);
    for (let n = 0; n < k; n++) {
      const i = (Math.floor(rand() * SIZE * SIZE) | 0) * 4;
      const v = rand() > 0.5 ? 70 : 200;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
  return { data, width: SIZE, height: SIZE };
}

describe('그려서 찾기 정확도 — 회전 탐색 vs 단발', () => {
  const names = Object.keys(GLYPHS);
  // 템플릿 DB: 각 글리프 표준형
  const templates: MarkFeature[] = names.map((name) => ({
    code: name,
    img: name,
    imgId: name,
    vec: Array.from(extractFeature(renderGlyph(name))),
  }));

  it('교란된 손그림 질의에서 회전 탐색이 Recall 을 끌어올린다', () => {
    const rand = rng(12345);
    const TRIALS = 12;
    let base1 = 0,
      base3 = 0,
      mult1 = 0,
      mult3 = 0,
      total = 0;

    for (const truth of names) {
      for (let t = 0; t < TRIALS; t++) {
        const stroke = 1.6 + rand() * 2.4; // 굵기 변동
        const angle = (rand() * 2 - 1) * 28; // ±28° 손그림 기울기(자유 스케치)
        const drawn = rotateImg(renderGlyph(truth, { stroke }), angle);

        // 단발(0°): 회전 보정 없음
        const b = rankFeatures(extractFeature(drawn), templates, 3);
        if (b[0]?.code === truth) base1++;
        if (b.some((r) => r.code === truth)) base3++;

        // 회전·미러 탐색
        const m = rankFeaturesMulti(extractFeatureVariants(drawn), templates, 3);
        if (m[0]?.code === truth) mult1++;
        if (m.some((r) => r.code === truth)) mult3++;

        total++;
      }
    }

    const pct = (n: number) => +(n / total).toFixed(3);
    // eslint-disable-next-line no-console
    console.log('[marksim recall]', {
      baseline: { '@1': pct(base1), '@3': pct(base3) },
      rotationSearch: { '@1': pct(mult1), '@3': pct(mult3) },
      trials: total,
    });

    // 회전 탐색이 단발보다 확실히 낫고, 절대 성능 바를 넘는다.
    expect(mult3).toBeGreaterThan(base3);
    expect(mult1).toBeGreaterThan(base1);
    expect(pct(mult3)).toBeGreaterThanOrEqual(0.97);
    expect(pct(mult1)).toBeGreaterThanOrEqual(0.9);
  });
});
