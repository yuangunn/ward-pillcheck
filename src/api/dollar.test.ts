import { describe, it, expect } from 'vitest';
import {
  cloudFromImage,
  cloudFromStrokes,
  cloudSimilarity,
  resampleStrokes,
  normalizeCloud,
  CLOUD_N,
  type Pt,
} from './dollar';
import { extractFeature, extractFeatureVariants, rankFeaturesMulti, type ImgLike, type MarkFeature } from './marksim';

// ── 합성 글리프(획 정의) ─ 손그림 시뮬레이션으로 $P(획) vs HOG(비트맵) 비교 ──
const SIZE = 56;
const PAD = 8;
const SPAN = SIZE - PAD * 2;
type Seg = [number, number, number, number];
const GLYPHS: Record<string, { segs?: Seg[]; ring?: boolean }> = {
  triangle: { segs: [[0.5, 0.15, 0.85, 0.8], [0.85, 0.8, 0.15, 0.8], [0.15, 0.8, 0.5, 0.15]] },
  square: { segs: [[0.2, 0.2, 0.8, 0.2], [0.8, 0.2, 0.8, 0.8], [0.8, 0.8, 0.2, 0.8], [0.2, 0.8, 0.2, 0.2]] },
  tee: { segs: [[0.15, 0.2, 0.85, 0.2], [0.5, 0.2, 0.5, 0.85]] },
  ell: { segs: [[0.3, 0.15, 0.3, 0.8], [0.3, 0.8, 0.8, 0.8]] },
  vee: { segs: [[0.2, 0.18, 0.5, 0.82], [0.5, 0.82, 0.8, 0.18]] },
  ex: { segs: [[0.2, 0.2, 0.8, 0.8], [0.8, 0.2, 0.2, 0.8]] },
  arrow: { segs: [[0.5, 0.18, 0.5, 0.85], [0.25, 0.4, 0.5, 0.18], [0.75, 0.4, 0.5, 0.18]] },
  zee: { segs: [[0.2, 0.2, 0.8, 0.2], [0.8, 0.2, 0.2, 0.8], [0.2, 0.8, 0.8, 0.8]] },
  circle: { ring: true },
};
const NAMES = Object.keys(GLYPHS);

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const toPx = (n: number) => PAD + n * SPAN;
function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function renderGlyph(name: string, stroke = 2.2): ImgLike {
  const g = GLYPHS[name];
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  data.fill(255);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let ink = false;
      if (g.ring) ink = Math.abs(Math.hypot(x - SIZE / 2, y - SIZE / 2) - SPAN * 0.42) <= stroke;
      else for (const [x1, y1, x2, y2] of g.segs!) if (distToSeg(x, y, toPx(x1), toPx(y1), toPx(x2), toPx(y2)) <= stroke) { ink = true; break; }
      if (ink) { const i = (y * SIZE + x) * 4; data[i] = data[i + 1] = data[i + 2] = 20; }
    }
  return { data, width: SIZE, height: SIZE };
}

/** 글리프의 획을 따라 "손으로 그린" 폴리라인 생성(회전 + 점 떨림). $P 질의용. */
function strokesFromGlyph(name: string, rot: number, jitter: number, rand: () => number): Pt[][] {
  const g = GLYPHS[name];
  const cx = SIZE / 2, cy = SIZE / 2;
  const rad = (rot * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const J = () => (rand() - 0.5) * 2 * jitter;
  const place = (x: number, y: number): Pt => {
    const px = toPx(x) + J(), py = toPx(y) + J();
    const dx = px - cx, dy = py - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };
  if (g.ring) {
    const s: Pt[] = [];
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      s.push(place(0.5 + 0.42 * Math.cos(a), 0.5 + 0.42 * Math.sin(a)));
    }
    return [s];
  }
  return g.segs!.map(([x1, y1, x2, y2]) => {
    const s: Pt[] = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) s.push(place(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps));
    return s;
  });
}

describe('$P cloud — 기본 동작', () => {
  it('정규화: 무게중심 원점·최대변 1', () => {
    const c = normalizeCloud([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 10, y: 30 }]);
    const cx = c.reduce((s, p) => s + p.x, 0) / c.length;
    expect(Math.abs(cx)).toBeLessThan(1e-9);
    const xs = c.map((p) => p.x), ys = c.map((p) => p.y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(span).toBeCloseTo(1, 5);
  });
  it('리샘플은 정확히 N점', () => {
    const pts = resampleStrokes([[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]], CLOUD_N);
    expect(pts).toHaveLength(CLOUD_N);
  });
  it('같은 모양은 다른 모양보다 더 닮음(삼각형 vs 사각형)', () => {
    const triImg = cloudFromImage(renderGlyph('triangle'));
    const triDraw = cloudFromStrokes(strokesFromGlyph('triangle', 0, 0, rng(1)));
    const sqImg = cloudFromImage(renderGlyph('square'));
    expect(cloudSimilarity(triDraw, triImg)).toBeGreaterThan(cloudSimilarity(triDraw, sqImg));
  });
});

// ── A/B: HOG(비트맵) vs $P(획) — 손그림 시뮬레이션 Recall ──
describe('A/B 정확도: HOG(비트맵) vs $P(획)', () => {
  const hogTemplates: MarkFeature[] = NAMES.map((n) => ({ code: n, img: n, imgId: n, vec: Array.from(extractFeature(renderGlyph(n))) }));
  const pTemplates = NAMES.map((n) => ({ name: n, cloud: cloudFromImage(renderGlyph(n)) }));

  /** 한 조건(regime)에서 손그림 시뮬레이션 Recall 측정 */
  function measure(label: string, maxRot: number, maxJit: number, dropStroke: boolean) {
    const TRIALS = 16;
    let hog1 = 0, hog3 = 0, p1 = 0, p3 = 0, total = 0;
    const rand = rng(20260609);
    for (const name of NAMES) {
      for (let t = 0; t < TRIALS; t++) {
        const rot = (rand() - 0.5) * 2 * maxRot;
        const jitter = 0.8 + rand() * maxJit;
        total++;
        let qStrokes = strokesFromGlyph(name, rot, jitter, rand);
        // 획 누락(미완성 그림) 시뮬레이션: 획이 2개 이상이면 하나 뺌
        if (dropStroke && qStrokes.length > 1 && rand() > 0.5) qStrokes = qStrokes.slice(0, -1);

        const qImg = rasterStrokes(qStrokes);
        const hogRank = rankFeaturesMulti(extractFeatureVariants(qImg), hogTemplates, NAMES.length).map((r) => r.code);
        const hi = hogRank.indexOf(name);
        if (hi === 0) hog1++;
        if (hi >= 0 && hi < 3) hog3++;

        const qCloud = cloudFromStrokes(qStrokes);
        const pRank = pTemplates
          .map((tp) => ({ name: tp.name, s: cloudSimilarity(qCloud, tp.cloud) }))
          .sort((a, b) => b.s - a.s)
          .map((r) => r.name);
        const pi = pRank.indexOf(name);
        if (pi === 0) p1++;
        if (pi >= 0 && pi < 3) p3++;
      }
    }
    const pct = (x: number) => `${((x / total) * 100).toFixed(0)}%`;
    // eslint-disable-next-line no-console
    console.log(
      `  [${label}]  HOG @1 ${pct(hog1)} @3 ${pct(hog3)}  |  $P @1 ${pct(p1)} @3 ${pct(p3)}`,
    );
    return { hog1: hog1 / total, p1: p1 / total };
  }

  it('여러 조건에서 Recall 비교(표 출력)', () => {
    // eslint-disable-next-line no-console
    console.log(`\n[그려서 찾기 A/B] 글리프 ${NAMES.length}종 × 16회/조건 — 손그림 시뮬레이션`);
    const mild = measure('약함  ±12°,떨림소', 12, 1.5, false);
    measure('보통  ±25°,떨림중', 25, 3.0, false);
    measure('심함  ±40°,떨림대,획누락', 40, 4.5, true);
    // 약한 조건에선 둘 다 잘 돼야 함(무작위 1/9≈11% 대비)
    expect(mild.hog1).toBeGreaterThan(0.5);
    expect(mild.p1).toBeGreaterThan(0.5);
  });
});

/** 손그림 폴리라인을 흰배경 ImgLike 로 래스터화(HOG 질의용) */
function rasterStrokes(strokes: Pt[][], stroke = 2.2): ImgLike {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  data.fill(255);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let ink = false;
      for (const s of strokes) {
        for (let i = 1; i < s.length && !ink; i++)
          if (distToSeg(x, y, s[i - 1].x, s[i - 1].y, s[i].x, s[i].y) <= stroke) ink = true;
        if (ink) break;
      }
      if (ink) { const i = (y * SIZE + x) * 4; data[i] = data[i + 1] = data[i + 2] = 20; }
    }
  return { data, width: SIZE, height: SIZE };
}
