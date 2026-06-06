// 커밋된 마크 gif + (캐시 복원된) pills.json 으로 marks.json 을 재생성한다.
// 배포 캐시 최적화로 push 배포가 build-dataset 를 건너뛸 때, 새로 커밋한 마크가
// marks.json(목록)에 반영되도록 하기 위함. 네트워크/키 불필요(디스크만 사용).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data');
const marksDir = resolve(OUT, 'marks');
const pillsPath = resolve(OUT, 'pills.json');

if (!existsSync(pillsPath)) {
  console.warn('pills.json 없음 — marks.json 재생성 생략(전체 빌드에서 처리됨).');
  process.exit(0);
}

const pills = JSON.parse(readFileSync(pillsPath, 'utf8'));
const nedrugId = (url) => (String(url).split('/').pop() || '').replace(/[^a-zA-Z0-9]/g, '');

// 고유 마크 이미지 → 대표코드/빈도 (build-dataset 의 buildMarks 와 동일 로직: 이미지 단위)
const map = new Map(); // imageId -> { img, codeCount: Map<code,n>, count }
for (const r of pills) {
  for (const [codes, img] of [
    [r.markFA, r.markFI],
    [r.markBA, r.markBI],
  ]) {
    if (!codes || !img) continue;
    const id = nedrugId(img);
    if (!id) continue;
    const e = map.get(id) || { img, codeCount: new Map(), count: 0 };
    e.count += 1;
    for (const c of String(codes).split(',').map((s) => s.trim()).filter(Boolean)) {
      e.codeCount.set(c, (e.codeCount.get(c) || 0) + 1);
    }
    map.set(id, e);
  }
}
const repCode = (cc) => [...cc.entries()].sort((a, b) => b[1] - a[1])[0][0];

// 실제 커밋·캐시된 gif 가 있는 이미지만 목록에 포함
const out = [];
for (const v of map.values()) {
  const file = `${nedrugId(v.img)}.gif`;
  if (existsSync(resolve(marksDir, file))) out.push({ code: repCode(v.codeCount), file, count: v.count });
}
out.sort((a, b) => b.count - a.count);

writeFileSync(`${OUT}/marks.json`, JSON.stringify(out));
writeFileSync(`${OUT}/marks-meta.json`, JSON.stringify({ builtAt: new Date().toISOString(), version: 1, count: out.length }));
console.log(`marks.json 재생성: ${out.length}종 (커밋된 gif 기준)`);
