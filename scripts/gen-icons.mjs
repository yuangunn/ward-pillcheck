// 의존성 없이 PWA 아이콘 PNG 를 생성한다(zlib + 수동 PNG 인코딩).
// 디자인: teal 배경 + 중앙에 흰색 캡슐(알약) 형태.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const BG = [47, 111, 106]; // #2f6f6a
const FG = [255, 255, 255];

function makePng(size, maskable) {
  const pad = maskable ? Math.round(size * 0.1) : 0; // maskable safe zone
  const cx = size / 2;
  const cy = size / 2;
  // 캡슐 영역(가로로 긴 둥근 사각형)
  const capW = size * 0.5;
  const capH = size * 0.26;
  const r = capH / 2;
  const left = cx - capW / 2;
  const right = cx + capW / 2;
  const top = cy - capH / 2;
  const bottom = cy + capH / 2;

  const raw = Buffer.alloc((size * 3 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let col = BG;
      const inPad = x >= pad && x < size - pad && y >= pad && y < size - pad;
      if (inPad) {
        const inMid = x >= left + r && x <= right - r && y >= top && y <= bottom;
        const inLeftCap = (x - (left + r)) ** 2 + (y - cy) ** 2 <= r * r && x < left + r;
        const inRightCap = (x - (right - r)) ** 2 + (y - cy) ** 2 <= r * r && x > right - r;
        if (inMid || inLeftCap || inRightCap) col = FG;
      }
      raw[p++] = col[0];
      raw[p++] = col[1];
      raw[p++] = col[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

writeFileSync(`${OUT}/icon-192.png`, makePng(192, false));
writeFileSync(`${OUT}/icon-512.png`, makePng(512, false));
writeFileSync(`${OUT}/icon-512-maskable.png`, makePng(512, true));
console.log('icons written to', OUT);
