import type { PrintGroup, PrintMed, PrintModel } from './model';

// A4 식별표 배치(순수 함수, 단위 mm). 글자 폭 측정은 주입(measure)받아 캔버스 없이도 테스트한다.
// - 1쪽: 제목·작성정보 + 환자 바코드 부착칸 + 표 / 2쪽~: 얇은 머리(계속 · 쪽수) + 작은 바코드칸 + 표
// - 한 단, 화면·Teams 인계 텍스트와 같은 시점 묶음 머리줄(8am · 아침식후 …).
// - 한 쪽 최대 20종. 줄 높이는 적응형: 그 쪽의 약 수·묶음 수로 표 몸통을 나눠 정한다(최대 ROW_MAX).
//   10종 안팎이면 사진이 크게(약 36×19mm), 20종에 가까울수록 줄·사진·글자가 함께 작아진다.
//   줄이 ROW_MIN 보다 낮아져야 하면 그 쪽에 담는 약을 줄여 다음 쪽으로 넘긴다.

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
  group: { size: pt(10), weight: 900 },
  groupNote: { size: pt(8.6), weight: 500 },
  foot: { size: pt(7.6), weight: 400 },
} satisfies Record<string, FontSpec>;
export type HeadFonts = Record<keyof typeof FONTS, FontSpec>;

const scaleFont = (f: FontSpec, k: number): FontSpec => ({ size: f.size * k, weight: f.weight });
function scaleAll<K extends string>(o: Record<K, FontSpec>, k: number): Record<K, FontSpec> {
  return Object.fromEntries(Object.entries<FontSpec>(o).map(([key, f]) => [key, scaleFont(f, k)])) as Record<K, FontSpec>;
}

/**
 * 출력 프로필.
 * - PAPER: PDF·원본 화질(2940×4158, 14px/mm). 한 쪽 최대 20종.
 * - TEAMS: Teams 는 이미지 긴 변을 1024px 로 줄인다(고화질 설정에서도 — 2026-11 원내 확인).
 *   그래서 처음부터 724×1024 로 그려 다시 줄지 않게 하고, 그 해상도에서 읽히도록 글자를 키우고(×1.55)
 *   한 쪽 약 수를 줄이며(최대 6), 겉모습은 이름 칸·용법은 1회 칸에 합쳐 글자·사진에 폭을 몰아준다.
 */
export interface Profile {
  key: 'paper' | 'teams';
  pxPerMm: number;
  scale: number; // 글자·머리줄 높이 배율
  maxPerPage: number;
  rowMax: number;
  rowMin: number;
  photoColMax: number;
  merged: boolean;
}
export const PAPER: Profile = { key: 'paper', pxPerMm: 14, scale: 1, maxPerPage: 20, rowMax: 23, rowMin: 9.5, photoColMax: 38, merged: false };
export const TEAMS: Profile = { key: 'teams', pxPerMm: 1024 / 297, scale: 1.55, maxPerPage: 6, rowMax: 46, rowMin: 30, photoColMax: 64, merged: true };

/** 머리·바닥글 글꼴(제목은 너무 커지지 않게 1.25배까지) */
export function headFonts(p: Profile): HeadFonts {
  const f = scaleAll(FONTS, p.scale);
  return { ...f, title: scaleFont(FONTS.title, Math.min(p.scale, 1.25)) };
}

/** 약 행 글꼴 — 줄이 낮아지면(약이 많으면) 한 단계 작은 글꼴 */
export interface CellFonts {
  no: FontSpec;
  name: FontSpec;
  sub: FontSpec;
  cls: FontSpec;
  memo: FontSpec;
  cell: FontSpec;
  dose: FontSpec;
}
const NORMAL: CellFonts = {
  no: { size: pt(9), weight: 700 },
  name: { size: pt(11), weight: 700 },
  sub: { size: pt(8.4), weight: 400 },
  cls: { size: pt(8.6), weight: 700 },
  memo: { size: pt(8.6), weight: 700 },
  cell: { size: pt(9.4), weight: 400 },
  dose: { size: pt(12), weight: 900 },
};
const COMPACT: CellFonts = {
  no: { size: pt(8), weight: 700 },
  name: { size: pt(9.6), weight: 700 },
  sub: { size: pt(7.4), weight: 400 },
  cls: { size: pt(8), weight: 700 },
  memo: { size: pt(8), weight: 700 },
  cell: { size: pt(8.4), weight: 400 },
  dose: { size: pt(10.5), weight: 900 },
};
export const COMPACT_BELOW = 15; // 줄 높이(mm)가 이보다 낮으면 작은 글꼴(프로필 배율 적용)
export const cellFonts = (rowH: number, p: Profile = PAPER): CellFonts =>
  scaleAll(rowH < COMPACT_BELOW * p.scale ? COMPACT : NORMAL, p.scale);

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
export const PHOTO_COL_MAX = 38;
/** 열 구성 — 사진 열 폭은 그 쪽 줄 높이에 맞추고, 남는 폭은 이름 열로. Teams 는 4열(겉모습·용법 합침). */
export function columns(photoColW: number, p: Profile = PAPER): Col[] {
  if (p.merged) {
    const no = 8;
    const dose = 26;
    return [
      { key: 'no', w: no, label: ['#'], align: 'center' },
      { key: 'photo', w: photoColW, label: ['식약처 사진'] },
      { key: 'name', w: CW - no - photoColW - dose, label: ['약 이름 · 성분 · 분류', '겉모습(색/모양/각인)'] },
      { key: 'dose', w: dose, label: ['1회', '용법'], align: 'center' },
    ];
  }
  return [
    { key: 'no', w: 6, label: ['#'], align: 'center' },
    { key: 'photo', w: photoColW, label: ['식약처 사진'] },
    { key: 'name', w: 72 + (PHOTO_COL_MAX - photoColW), label: ['약 이름 · 성분 · 분류'] },
    { key: 'look', w: 36, label: ['겉모습', '(색/모양/각인)'] },
    { key: 'dose', w: 14, label: ['1회'], align: 'center' },
    { key: 'freq', w: 20, label: ['용법'] },
  ];
}
/** 열 시작 x(mm, 페이지 기준) */
export function colX(cols: Col[], key: Col['key']): number {
  let x = MARGIN.l;
  for (const c of cols) {
    if (c.key === key) return x;
    x += c.w;
  }
  throw new Error(`unknown col ${key}`);
}
export const colW = (cols: Col[], key: Col['key']): number => cols.find((c) => c.key === key)!.w;

export const CELL_PAD = 1.4;
export const TH_H = 8.4; // 표 머리줄 높이(× 프로필 배율)
export const GROUP_H = 6.4; // 묶음 머리줄 높이(× 프로필 배율)
export const ROW_MAX = PAPER.rowMax; // 약이 적을 때 줄 높이 상한(사진 약 36×19mm)
export const ROW_MIN = PAPER.rowMin; // 이보다 낮게는 줄이지 않는다(사진 약 16×8mm)
export const MAX_PER_PAGE = PAPER.maxPerPage;
export const PHOTO_RATIO = 1.83; // 식약처 낱알 사진 가로:세로
export const rowPad = (rowH: number) => Math.min(1.2, rowH * 0.08);

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
  cls: string[];
  memo: string[];
  /** 줄이 모자랄 때 성분·분류·메모를 한 줄로 이어 쓴 조각들(비어 있으면 sub·cls·memo 를 각 줄로) */
  info: Seg[];
  look: string[];
  freq: string[];
}
/** 한 줄 안 글꼴이 다른 조각 */
export interface Seg {
  text: string;
  font: FontSpec;
  dim?: boolean; // 회색(성분)
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
  rowH: number; // 이 쪽 약 줄 높이(적응형)
  photo: { w: number; h: number }; // 사진 칸
  cols: Col[];
  fonts: CellFonts;
  rows: RowLayout[];
  noFrom: number; // 이 쪽 약 번호 범위
  noTo: number;
}
export interface DocLayout {
  pages: PageLayout[];
  profile: Profile;
  f: HeadFonts; // 머리·바닥글 글꼴
  thH: number; // 표 머리줄 높이
  merged: boolean;
}

type PartKey = 'name' | 'sub' | 'cls' | 'memo' | 'look';
interface Part {
  key: PartKey;
  text: string;
  font: FontSpec;
  max: number;
}

/**
 * 이름 칸 글줄을 줄 높이(avail)에 맞춘다. 먼저 모두 1줄(이름·성분·분류·메모), 넘치면 성분 → 분류 → 메모 순으로 뺀다.
 * 이름이 두 줄이면 성분을 빼서라도 이름을 다 싣고, 남으면 성분 → 메모 순으로 줄을 늘린다(최대 max). 잘린 줄은 …
 */
function fitParts(parts: Part[], width: number, avail: number, measure: Measure): Record<PartKey, string[]> {
  const live = parts.filter((p) => p.text);
  const full = new Map(live.map((p) => [p.key, wrapText(p.text, width, p.font, measure, p.max)]));
  const n = new Map(live.map((p) => [p.key, Math.min(1, full.get(p.key)!.length)]));
  const lh = (p: Part) => p.font.size * LH;
  const total = () => live.reduce((s, p) => s + n.get(p.key)! * lh(p), 0);
  for (const drop of ['sub', 'cls', 'memo'] as PartKey[]) {
    if (total() <= avail) break;
    if (n.has(drop)) n.set(drop, 0);
  }
  const nameP = live.find((q) => q.key === 'name');
  if (nameP && n.get('name') === 1 && full.get('name')!.length > 1 && total() + lh(nameP) > avail && n.get('sub')) {
    n.set('sub', 0);
  }
  for (const grow of ['name', 'sub', 'memo', 'sub'] as PartKey[]) {
    const p = live.find((q) => q.key === grow);
    if (!p || !n.get(grow) || n.get(grow)! >= full.get(grow)!.length) continue;
    if (total() + lh(p) <= avail) n.set(grow, n.get(grow)! + 1);
  }
  const out = { name: [], sub: [], cls: [], memo: [], look: [] } as Record<PartKey, string[]>;
  for (const p of live) {
    const k = n.get(p.key)!;
    if (k) out[p.key] = wrapText(p.text, width, p.font, measure, k);
  }
  return out;
}

export const INFO_SEP = ' · ';

/**
 * 성분·분류·메모를 한 줄(width)로 잇는다. 넘치면 성분부터 …로 줄이고(너무 좁으면 성분은 뺌),
 * 그래도 넘치면 메모 → 분류 순으로 줄인다. 분류·메모는 굵게.
 */
export function inlineInfo(med: PrintMed, size: number, width: number, measure: Measure): Seg[] {
  const reg: FontSpec = { size, weight: 400 };
  const bold: FontSpec = { size, weight: 700 };
  const segs: Seg[] = [
    { text: med.sub, font: reg, dim: true },
    { text: med.cls, font: bold },
    { text: med.memo ? `※ ${med.memo}` : '', font: bold },
  ].filter((x) => x.text);
  const sepW = measure(INFO_SEP, reg);
  const widthOf = (xs: Seg[]) => xs.reduce((w, x) => w + measure(x.text, x.font), 0) + sepW * Math.max(0, xs.length - 1);
  if (widthOf(segs) <= width) return segs;
  const rest = (skip: Seg) => widthOf(segs.filter((x) => x !== skip)) + sepW;
  const sub = segs.find((x) => x.dim);
  if (sub) {
    const room = width - rest(sub);
    if (room >= 10) {
      sub.text = ellipsize(sub.text, room, sub.font, measure);
      return segs;
    }
    segs.splice(segs.indexOf(sub), 1);
    if (widthOf(segs) <= width) return segs;
  }
  for (const x of [...segs].reverse()) {
    const room = width - (widthOf(segs) - measure(x.text, x.font));
    x.text = ellipsize(x.text, Math.max(room, 0), x.font, measure);
    if (widthOf(segs) <= width) break;
  }
  return segs.filter((x) => x.text && x.text !== '…');
}

/** 쪽 기하(줄 높이 → 사진 칸·열·글꼴) */
export function pageGeom(rowH: number, p: Profile = PAPER): Pick<PageLayout, 'rowH' | 'photo' | 'cols' | 'fonts'> {
  const ph = rowH - rowPad(rowH) * 2;
  const pw = Math.min(p.photoColMax - 2.4, ph * PHOTO_RATIO);
  return {
    rowH,
    photo: { w: pw, h: Math.min(ph, pw / PHOTO_RATIO) },
    cols: columns(pw + 2.4, p),
    fonts: cellFonts(rowH, p),
  };
}

/** 약 1행의 줄 나눔(높이는 쪽의 rowH 로 고정). merged(Teams): 겉모습은 이름 칸 아래 줄, 용법은 1회 칸 아래 */
export function layoutMedRow(
  med: PrintMed,
  geom: Pick<PageLayout, 'rowH' | 'cols' | 'fonts'>,
  measure: Measure,
  merged = false,
): Omit<MedRowLayout, 'y'> {
  const { cols, fonts: f, rowH } = geom;
  const avail = rowH - rowPad(rowH) * 2;
  const nameW = colW(cols, 'name') - CELL_PAD * 2;
  const lookText = med.appearance || '—';
  // merged 에서는 겉모습(각인 글자 — 식별의 핵심) 줄을 먼저 확보하고 나머지를 맞춘다.
  const lookLines = merged ? wrapText(lookText, nameW, f.cell, measure, 2) : [];
  const nameAvail = avail - lookLines.length * f.cell.size * LH;
  const fit = fitParts(
    [
      { key: 'name', text: med.name, font: f.name, max: 2 },
      { key: 'sub', text: med.sub, font: f.sub, max: 2 },
      { key: 'cls', text: med.cls, font: f.cls, max: 1 },
      { key: 'memo', text: med.memo ? `※ ${med.memo}` : '', font: f.memo, max: 2 },
    ],
    nameW,
    nameAvail,
    measure,
  );
  const cellLines = Math.max(1, Math.floor(avail / (f.cell.size * LH)));
  const look = merged
    ? lookLines
    : wrapText(lookText, colW(cols, 'look') - CELL_PAD * 2, f.cell, measure, Math.min(3, cellLines));
  const freqCol = merged ? 'dose' : 'freq';
  const freq = wrapText(med.freq, colW(cols, freqCol) - CELL_PAD * 2, f.cell, measure, Math.min(2, cellLines));
  // 각 줄로 다 못 싣고 성분·분류·메모 중 하나라도 빠지면 → 이름 아래 한 줄로 이어 쓴다(이름 칸은 가로로 넓다).
  const dropped = (med.sub && !fit.sub.length) || (med.cls && !fit.cls.length) || (med.memo && !fit.memo.length);
  if (dropped) {
    const infoLH = f.sub.size * LH;
    const nameLH = f.name.size * LH;
    const nameLines = Math.max(1, Math.min(2, Math.floor((nameAvail - infoLH) / nameLH)));
    return {
      kind: 'med',
      h: rowH,
      med,
      name: wrapText(med.name, nameW, f.name, measure, nameLines),
      sub: [],
      cls: [],
      memo: [],
      info: inlineInfo(med, f.sub.size, nameW, measure),
      look,
      freq,
    };
  }
  return { kind: 'med', h: rowH, med, name: fit.name, sub: fit.sub, cls: fit.cls, memo: fit.memo, info: [], look, freq };
}

/** 표 몸통 높이(mm) — 표 머리줄 아래부터 바닥글 위까지 */
const bodyH = (first: boolean, thH: number) => BODY_BOTTOM - ((first ? HEAD1.bottom : HEAD2.bottom) + 4 + thH);

/** 전체 문서 배치 — 한 쪽 최대 maxPerPage 종, 줄 높이 적응형 */
export function layoutDocument(model: PrintModel, measure: Measure, p: Profile = PAPER): DocLayout {
  const meds = model.groups.flatMap((g, gi) => g.meds.map((med) => ({ med, gi })));
  const thH = TH_H * p.scale;
  const groupH = GROUP_H * p.scale;
  const pages: PageLayout[] = [];
  let s = 0;
  while (s < meds.length || pages.length === 0) {
    const first = pages.length === 0;
    const avail = bodyH(first, thH);
    // 담을 약 수 m: 최대 maxPerPage 부터, 줄 높이가 rowMin 이상 나올 때까지 줄인다.
    let m = Math.min(p.maxPerPage, meds.length - s);
    let rowH = p.rowMax;
    for (; m > 0; m -= 1) {
      const groups = new Set(meds.slice(s, s + m).map((x) => x.gi)).size;
      rowH = Math.min(p.rowMax, (avail - groups * groupH) / m);
      if (rowH >= p.rowMin || m === 1) break;
    }
    const geom = pageGeom(rowH, p);
    const tableTop = (first ? HEAD1.bottom : HEAD2.bottom) + 4;
    const page: PageLayout = { index: pages.length, first, tableTop, ...geom, rows: [], noFrom: 0, noTo: 0 };
    let y = tableTop + thH;
    let lastGi = -1;
    for (const { med, gi } of meds.slice(s, s + m)) {
      if (gi !== lastGi) {
        const group = model.groups[gi];
        page.rows.push({ kind: 'group', y, h: groupH, group, cont: med.no !== group.meds[0].no });
        y += groupH;
        lastGi = gi;
      }
      page.rows.push({ ...layoutMedRow(med, geom, measure, p.merged), y });
      y += rowH;
      if (!page.noFrom) page.noFrom = med.no;
      page.noTo = med.no;
    }
    pages.push(page);
    s += Math.max(m, 1);
    if (!meds.length) break;
  }
  return { pages, profile: p, f: headFonts(p), thH, merged: p.merged };
}
