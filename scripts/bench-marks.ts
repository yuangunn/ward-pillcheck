/**
 * 그려서 찾기 — 실제 마크 벤치(개발용, CI 아님).
 * 합성 글리프 벤치(marksim.bench.test.ts)는 포화돼 실제 실패를 못 잡는다.
 * 레포에 커밋된 진짜 마크 gif 를 디코드 → 약한 "손그림" 증강(회전·노이즈·굵기) 질의로
 * 현 매처(rankFeaturesMulti)의 Recall@1/@3 측정 + 혼동되는 마크 쌍을 출력해 진짜 실패를 찾는다.
 *
 * 실행:  npx tsx scripts/bench-marks.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import omggif from 'omggif';
import {
  extractFeature,
  extractFeatureVariants,
  rotateImg,
  rankFeaturesMulti,
  type ImgLike,
  type MarkFeature,
} from '../src/api/marksim.ts';

const { GifReader } = omggif as unknown as { GifReader: new (b: Uint8Array) => any };
const MARKS_DIR = path.resolve(import.meta.dirname, '../public/data/marks');

function decodeGif(file: string): ImgLike {
  const r = new GifReader(fs.readFileSync(file));
  const data = new Uint8ClampedArray(r.width * r.height * 4);
  r.decodeAndBlitFrameRGBA(0, data);
  return { data, width: r.width, height: r.height };
}

/** 결정적 노이즈: 일부 픽셀을 검정/흰으로 뒤집어 손그림 잡음 모사 */
function addNoise(img: ImgLike, frac: number, seed: number): ImgLike {
  const d = (img.data as Uint8ClampedArray).slice();
  let a = seed >>> 0;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  const n = img.width * img.height;
  for (let k = 0; k < n * frac; k++) {
    const p = (Math.floor(rnd() * n)) * 4;
    const v = rnd() < 0.5 ? 0 : 255;
    d[p] = d[p + 1] = d[p + 2] = v;
    d[p + 3] = 255;
  }
  return { data: d, width: img.width, height: img.height };
}

// 손그림 모사 증강. 매처가 회전탐색을 하므로 회전은 흡수돼야 정상 — 형상 변별력을 본다.
// (NOISE 환경변수=1 이면 솔트 노이즈도 섞어 더 가혹하게)
const NOISE = process.env.NOISE === '1';
const AUGS: ((img: ImgLike, i: number) => ImgLike)[] = NOISE
  ? [
      (img) => img,
      (img, i) => addNoise(rotateImg(img, 8), 0.02, 100 + i),
      (img, i) => addNoise(rotateImg(img, -12), 0.02, 200 + i),
      (img, i) => addNoise(img, 0.05, 300 + i),
    ]
  : [
      (img) => img,
      (img) => rotateImg(img, 10),
      (img) => rotateImg(img, -15),
      (img) => rotateImg(img, 25),
    ];

function main() {
  const files = fs.readdirSync(MARKS_DIR).filter((f) => f.endsWith('.gif'));
  console.log(`마크 ${files.length}개 디코드·특징추출…`);
  const feats: MarkFeature[] = [];
  const imgById: Record<string, ImgLike> = {};
  const codeById: Record<string, string> = {};
  // marks.json 으로 imgId→code 매핑(있으면)
  try {
    const mj = JSON.parse(fs.readFileSync(path.join(MARKS_DIR, '../marks.json'), 'utf8')) as { code: string; file: string }[];
    for (const m of mj) codeById[m.file.replace(/\.gif$/i, '')] = m.code;
  } catch {
    /* 없으면 코드 비움 */
  }
  for (const f of files) {
    const imgId = f.replace(/\.gif$/i, '');
    const img = decodeGif(path.join(MARKS_DIR, f));
    imgById[imgId] = img;
    feats.push({ code: codeById[imgId] ?? imgId, img: f, imgId, vec: Array.from(extractFeature(img)) });
  }

  let trials = 0, r1 = 0, r3 = 0;
  const fails: { imgId: string; code: string; gotImgId: string; gotCode: string }[] = [];
  for (const t of feats) {
    const base = imgById[t.imgId];
    AUGS.forEach((aug, ai) => {
      const q = extractFeatureVariants(aug(base, ai));
      const ranked = rankFeaturesMulti(q, feats, 5);
      trials++;
      const top = ranked[0];
      if (top?.imgId === t.imgId) r1++;
      else fails.push({ imgId: t.imgId, code: t.code, gotImgId: top?.imgId ?? '-', gotCode: top?.code ?? '-' });
      if (ranked.slice(0, 3).some((x) => x.imgId === t.imgId)) r3++;
    });
  }

  console.log(`\n=== 실제 마크 Recall (trials ${trials}) ===`);
  console.log(`  @1: ${(r1 / trials).toFixed(3)}   @3: ${(r3 / trials).toFixed(3)}`);
  // 마크별 top-1 실패율(증강 4개 중 몇 번 틀렸나) 집계 → 진짜 약한 마크
  const failByMark = new Map<string, { code: string; n: number; confused: Set<string> }>();
  for (const f of fails) {
    const e = failByMark.get(f.imgId) ?? { code: f.code, n: 0, confused: new Set() };
    e.n++; e.confused.add(f.gotCode);
    failByMark.set(f.imgId, e);
  }
  const worst = [...failByMark.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25);
  console.log(`\n=== top-1 실패 마크 ${failByMark.size}종 (증강 4개 중 실패횟수, 혼동된 코드) ===`);
  for (const [imgId, e] of worst) {
    console.log(`  ${e.n}/4  code='${e.code}' (${imgId})  → 혼동: ${[...e.confused].join(', ')}`);
  }
}

main();
