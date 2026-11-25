import type { PrintGroup, PrintMed, PrintModel } from './model';

// A4 식별표 배치(순수 함수, 단위 mm). 글자 폭 측정은 주입(measure)받아 캔버스 없이도 테스트한다.
// - 1쪽: 제목·작성정보 + 환자 바코드 부착칸 + 표
// - 2쪽~: 얇은 머리(계속 · 쪽수) + 작은 바코드칸 + 표(머리줄 반복)
// - 식별이 목적이라 식약처 사진을 크게(가로 약 57mm, 원본 비율 ≈1.83:1) 싣는다.
// - 시점 묶음이 쪽을 넘으면 다음 쪽에 "(계속)" 묶음 머리를 다시 그린다. 묶음 머리만 쪽 끝에 남지 않게 한다.

export interface FontSpec {
  size: number; // mm
  weight: 400 | 500 | 700 | 900;
}
export type Measure = (text: string, font: FontSpec) => number; // → mm

const pt = (n: number) => n * 0.3528;
export const LH = 1.32; // 줄간격 배수

export const FONTS = {
  title: { size: pt(19), weight: 900 },
  contTitle: { size: pt(13), weight: 900 },
  sub: { size: pt(9), weight: 400 },
  metaKey: { size: pt(9.4), weight: 500 },
  metaVal: { size: pt(9.8), weight: 700 },
  sign: { size: pt(8.4), weight: 700 },
  hint: { size: pt(8), weight: 400 },
  th: { size: pt(8.6), weight: 700 },
  group: { size: pt(10.5), weight: 900 },
  groupNote: { size: pt(9), weight: 500 },
  no: { size: pt(9), weight: 700 },
  name: { size: pt(11.5), weight: 700 },
  subline: { size: pt(8.6), weight: 400 },
  memo: { size: pt(8.8), weight: 700 },
  cell: { size: pt(9.6), weight: 400 },
  dose: { size: pt(12), weight: 900 },
  foot: { size: pt(7.6), weight: 400 },
} satisfies Record<string, FontSpec>;

export const PAGE = { w: 210, h: 297 } as const;
export const MARGIN = { l: 11, r: 11, t: 11, b: 12 } as const;
export const CW = PAGE.w - MARGIN.l - MARGIN.r; // 188
export const FOOTER_TOP = PAGE.h - MARGIN.b - 6; // 바닥글 구분선 y
export const BODY_BOTTOM = FOOTER_TOP - 1; // 표가 내려올 수 있는 한계

/** 1쪽 머리 */
export const HEAD1 = {
  barcode: { w: 64, h: 24 }, // 환자 바코드 부착칸(오른쪽 위)
  bottom: MARGIN.t + 24,
} as const;
/** 2쪽~ 머리 */
export const HEAD2 = {
  barcode: { w: 56, h: 18 },
  bottom: MARGIN.t + 18,
} as const;

export interface Col {
  key: 'no' | 'photo' | 'name' | 'look' | 'dose' | 'freq';
  w: number;
  label: string[];
  align?: 'center';
}
export const COLS: Col[] = [
  { key: 'no', w: 6, label: ['#'], align: 'center' },
  { key: 'photo', w: 60, label: ['식약처 사진'] },
  { key: 'name', w: 60, label: ['약 이름 · 성분'] },
  { key: 'look', w: 34, label: ['겉모습', '(색/모양/각인)'] },
  { key: 'dose', w: 12, label: ['1회'], align: 'center' },
  { key: 'freq', w: 16, label: ['용법'] },
];
/** 열 시작 x(mm, 페이지 기준) */
export function colX(key: Col['key']): number {
  let x = MARGIN.l;
  for (const c of COLS) {
    if (c.key === key) return x;
    x += c.w;
  }
  throw new Error(`unknown col ${key}`);
}
export const colW = (key: Col['key']): number => COLS.find((c) => c.key === key)!.w;

export const CELL_PAD = 1.6;
export const ROW_PAD = 1.3;
export const PHOTO_H = 31; // 사진 칸 폭(60 - 여백 2.4) ÷ 식약처 사진 비율(≈1.83)
export const TH_H = 8.4;
export const GROUP_H = 7.2;

// ── 줄바꿈 ──────────────────────────────────────────

const HANGING = /^[/·+—–-]$/;

/**
 * 폭에 맞춰 줄을 나눈다. 공백 단위로 끊되, 한 토큰이 폭보다 길면 글자 단위로 끊는다(한글 긴 성분명 등).
 * widths 가 배열이면 줄마다 폭이 다르다(마지막 값이 이후 줄에 반복). maxLines 를 넘으면 마지막 줄을 …로 줄인다.
 */
export function wrapText(
  text: string,
  widths: number | number[],
  font: FontSpec,
  measure: Measure,
  maxLines = Infinity,
): string[] {
  const W = (i: number) => (Array.isArray(widths) ? widths[Math.min(i, widths.length - 1)] : widths);
  const src = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!src) return [];
  const lines: string[] = [];
  let cur = '';
  const flush = () => {
    lines.push(cur.trimEnd());
    cur = '';
  };
  for (const tok of src.split(/( )/)) {
    if (!tok) continue;
    const cand = cur + tok;
    if (measure(cand.trimEnd(), font) <= W(lines.length)) {
      cur = cand;
      continue;
    }
    if (tok === ' ') {
      flush();
      continue;
    }
    // 구분 기호(/ · + —)는 줄 끝에 매단다(셀 안쪽 여백으로 살짝 넘침 허용) — 줄이 '/'로 시작하지 않게.
    if (HANGING.test(tok) && cur.trim()) {
      cur = cand;
      continue;
    }
    if (cur.trim()) flush();
    else cur = '';
    if (measure(tok, font) <= W(lines.length)) {
      cur = tok;
      continue;
    }
    for (const ch of [...tok]) {
      if (!cur || measure(cur + ch, font) <= W(lines.length)) cur += ch;
      else {
        flush();
        cur = ch;
      }
    }
  }
  if (cur.trim()) flush();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(lines.slice(maxLines - 1).join(' '), W(maxLines - 1), font, measure);
  return kept;
}

/** 폭에 맞게 끝을 …로 줄인다 */
export function ellipsize(text: string, width: number, font: FontSpec, measure: Measure): string {
  if (measure(text, font) <= width) return text;
  const chars = [...text];
  while (chars.length && measure(chars.join('').trimEnd() + '…', font) > width) chars.pop();
  return chars.join('').trimEnd() + '…';
}

// ── 표 행 ──────────────────────────────────────────

export interface MedRowLayout {
  kind: 'med';
  y: number;
  h: number;
  med: PrintMed;
  name: string[];
  sub: string[];
  memo: string[];
  look: string[];
  freq: string[];
}
export interface GroupRowLayout {
  kind: 'group';
  y: number;
  h: number;
  group: PrintGroup;
  cont: boolean; // 앞 쪽에서 이어지는 묶음
}
export type RowLayout = MedRowLayout | GroupRowLayout;

export interface PageLayout {
  index: number; // 0부터
  first: boolean;
  tableTop: number; // 표 머리줄 y
  rows: RowLayout[];
  noFrom: number; // 이 쪽 약 번호 범위
  noTo: number;
}
export interface DocLayout {
  pages: PageLayout[];
}

/** 약 1행의 줄 나눔과 높이 */
export function layoutMedRow(med: PrintMed, measure: Measure): Omit<MedRowLayout, 'y'> {
  const nameW = colW('name') - CELL_PAD * 2;
  const name = wrapText(med.name, nameW, FONTS.name, measure, 3);
  const sub = wrapText(med.sub, nameW, FONTS.subline, measure, 3);
  const memo = med.memo ? wrapText(`※ ${med.memo}`, nameW, FONTS.memo, measure, 2) : [];
  const look = wrapText(med.appearance || '—', colW('look') - CELL_PAD * 2, FONTS.cell, measure, 4);
  const freq = wrapText(med.freq, colW('freq') - CELL_PAD * 2, FONTS.cell, measure, 3);
  const stack =
    name.length * FONTS.name.size * LH + sub.length * FONTS.subline.size * LH + memo.length * FONTS.memo.size * LH;
  const textH = Math.max(stack, look.length * FONTS.cell.size * LH, freq.length * FONTS.cell.size * LH);
  const h = Math.max(PHOTO_H, textH) + ROW_PAD * 2;
  return { kind: 'med', h, med, name, sub, memo, look, freq };
}

/** 전체 문서 배치 */
export function layoutDocument(model: PrintModel, measure: Measure): DocLayout {
  const pages: PageLayout[] = [];
  const newPage = (): PageLayout => {
    const first = pages.length === 0;
    const tableTop = (first ? HEAD1.bottom : HEAD2.bottom) + 4;
    const pg: PageLayout = { index: pages.length, first, tableTop, rows: [], noFrom: 0, noTo: 0 };
    pages.push(pg);
    return pg;
  };
  let page = newPage();
  let y = page.tableTop + TH_H;

  for (const group of model.groups) {
    let headerOnThisPage = false;
    group.meds.forEach((med, i) => {
      const row = layoutMedRow(med, measure);
      const needHeader = !headerOnThisPage;
      const need = row.h + (needHeader ? GROUP_H : 0);
      if (y + need > BODY_BOTTOM && page.rows.length > 0) {
        page = newPage();
        y = page.tableTop + TH_H;
        headerOnThisPage = false;
      }
      if (!headerOnThisPage) {
        page.rows.push({ kind: 'group', y, h: GROUP_H, group, cont: i > 0 });
        y += GROUP_H;
        headerOnThisPage = true;
      }
      page.rows.push({ ...row, y });
      y += row.h;
      if (!page.noFrom) page.noFrom = med.no;
      page.noTo = med.no;
    });
  }
  return { pages };
}
