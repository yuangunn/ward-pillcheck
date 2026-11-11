// 최소 PDF 작성기 — 페이지마다 JPEG 한 장을 A4 전면에 깐 PDF 를 만든다.
// 외부 라이브러리·폰트 파일 없이(오프라인) 한글 출력물을 만들기 위해, 화면을 캔버스에 그린
// 결과(JPEG)를 그대로 페이지 이미지로 넣는다. PDF 는 JPEG(DCTDecode)를 직접 품을 수 있어
// 재압축이 필요 없다.

export interface JpegPage {
  jpeg: Uint8Array; // JPEG 바이트(canvas.toBlob('image/jpeg'))
  widthPx: number;
  heightPx: number;
}

/** A4 (pt). 1pt = 1/72in */
export const A4_PT = { w: 595.28, h: 841.89 } as const;

const enc = new TextEncoder();

/** PDF 텍스트 문자열(UTF-16BE + BOM, 16진 표기) — 한글 제목용 */
function pdfTextString(s: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i += 1) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * JPEG 페이지 목록 → PDF 바이트.
 * 객체 배치: 1 Catalog, 2 Pages, 3 Info, 이후 페이지마다 [Page, Contents, Image] 3개.
 */
export function buildJpegPdf(pages: JpegPage[], opts: { title?: string; createdAt?: Date } = {}): Uint8Array {
  if (!pages.length) throw new Error('페이지가 없어요');
  const chunks: Uint8Array[] = [];
  const offsets: number[] = []; // 객체 번호(1부터) → 바이트 오프셋
  let pos = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(bytes);
    pos += bytes.length;
  };
  const obj = (num: number, body: string) => {
    offsets[num] = pos;
    push(`${num} 0 obj\n${body}\nendobj\n`);
  };

  // 헤더 + 바이너리 표시(일부 뷰어가 바이너리 파일로 인식하도록 고비트 바이트 주석)
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pageObjNums = pages.map((_, i) => 4 + i * 3);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  const info = [`/Producer ${pdfTextString('ward-pillcheck')}`];
  if (opts.title) info.push(`/Title ${pdfTextString(opts.title)}`);
  if (opts.createdAt) info.push(`/CreationDate (${pdfDate(opts.createdAt)})`);
  obj(3, `<< ${info.join(' ')} >>`);

  const W = A4_PT.w.toFixed(2);
  const H = A4_PT.h.toFixed(2);
  pages.forEach((pg, i) => {
    const pageNum = pageObjNums[i];
    const contentNum = pageNum + 1;
    const imgNum = pageNum + 2;
    const name = `Im${i + 1}`;
    obj(
      pageNum,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /${name} ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>`,
    );
    const content = `q ${W} 0 0 ${H} 0 0 cm /${name} Do Q`;
    obj(contentNum, `<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream`);
    offsets[imgNum] = pos;
    push(
      `${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.widthPx} /Height ${pg.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`,
    );
    push(pg.jpeg);
    push('\nendstream\nendobj\n');
  });

  // 상호참조표: 항목마다 정확히 20바이트
  const xrefPos = pos;
  const count = offsets.length; // 0번(free) 포함
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n += 1) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
