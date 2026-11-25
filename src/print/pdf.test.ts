import { describe, it, expect } from 'vitest';
import { buildJpegPdf } from './pdf';

// 가짜 JPEG(내용은 검증하지 않음 — 길이·오프셋만 확인)
const fakeJpeg = (n: number) => {
  const b = new Uint8Array(n);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[n - 2] = 0xff;
  b[n - 1] = 0xd9;
  return b;
};
const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');

describe('buildJpegPdf', () => {
  it('페이지 수만큼 Page 객체와 이미지가 들어간다', () => {
    const pdf = buildJpegPdf(
      [
        { jpeg: fakeJpeg(100), widthPx: 2100, heightPx: 2970 },
        { jpeg: fakeJpeg(80), widthPx: 2100, heightPx: 2970 },
      ],
      { title: '지참약 확인표', createdAt: new Date(2026, 10, 11, 14, 32) },
    );
    const s = latin1(pdf);
    expect(s.startsWith('%PDF-1.4\n')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(s).toContain('/Count 2');
    expect(s.match(/\/Filter \/DCTDecode/g)).toHaveLength(2);
    expect(s).toContain('/Length 100');
    expect(s).toContain('/CreationDate (D:20261111143200)');
  });

  it('xref 오프셋이 각 객체 시작을 정확히 가리킨다', () => {
    const pdf = buildJpegPdf([
      { jpeg: fakeJpeg(333), widthPx: 10, heightPx: 10 },
      { jpeg: fakeJpeg(77), widthPx: 10, heightPx: 10 },
      { jpeg: fakeJpeg(5), widthPx: 10, heightPx: 10 },
    ]);
    const s = latin1(pdf);
    const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe('xref');
    const [, countStr] = /xref\n0 (\d+)\n/.exec(s.slice(startxref))!;
    const count = Number(countStr);
    expect(count).toBe(1 + 3 + 3 * 3); // free + catalog/pages/info + 페이지당 3
    const entries = s.slice(startxref).split('\n').slice(2, 2 + count);
    entries.forEach((e, n) => {
      expect(e.length + 1).toBe(20); // 항목은 개행 포함 20바이트
      if (n === 0) return;
      const off = Number(e.slice(0, 10));
      expect(s.slice(off, off + `${n} 0 obj`.length)).toBe(`${n} 0 obj`);
    });
  });

  it('한글 제목은 UTF-16BE 16진 문자열로 넣는다', () => {
    const s = latin1(buildJpegPdf([{ jpeg: fakeJpeg(10), widthPx: 1, heightPx: 1 }], { title: '지참' }));
    expect(s).toContain('/Title <FEFFC9C0CC38>');
  });

  it('빈 페이지 목록은 거부', () => {
    expect(() => buildJpegPdf([])).toThrow();
  });
});
