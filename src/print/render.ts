import {
  CELL_PAD,
  CW,
  FONTS,
  FOOTER_TOP,
  GROUP_H,
  HEAD1,
  HEAD2,
  LH,
  MARGIN,
  PAGE,
  TH_H,
  colW,
  colX,
  ellipsize,
  type Col,
  type DocLayout,
  type FontSpec,
  type GroupRowLayout,
  type Measure,
  type MedRowLayout,
  type PageLayout,
} from './layout';
import { formatPrintDate, type PrintMed, type PrintModel } from './model';
import { cleanMark, glyphColors, glyphLabelSize, shapeGeom, shapePathD } from '../design/pillShape';

// 캔버스에 A4 한 쪽씩 그린다(브라우저 전용). 좌표는 전부 mm 로 받고 S(px/mm)를 곱한다.
// 글꼴은 앱과 같은 Pretendard → 기기 기본 한글 글꼴 순. 흑백 레이저 출력 기준(색에 의존하지 않음).

// 14px/mm → 2940×4158px ≈ 356dpi(약 12.2MP). 식약처 사진(가로 780~1300px)을 원본에 가깝게 싣고,
// iOS 캔버스 면적 한도(16.7MP) 안에 든다.
export const PX_PER_MM = 14;
const S = PX_PER_MM;
const FAMILY =
  "'Pretendard Variable', Pretendard, -apple-system, system-ui, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', 'Malgun Gothic', sans-serif";

const INK = '#111';
const INK2 = '#444';
const RULE = '#bdbdbd';

export type PhotoMap = Map<string, HTMLImageElement | null>; // imageUrl → 이미지(null = 받기 실패)

const font = (f: FontSpec) => `${f.weight} ${(f.size * S).toFixed(2)}px ${FAMILY}`;

/** 캔버스 글자 폭 측정기(mm). 같은 문자열·글꼴은 캐시. */
export function canvasMeasure(ctx: CanvasRenderingContext2D): Measure {
  const cache = new Map<string, number>();
  return (text, f) => {
    const key = `${f.weight}|${f.size}|${text}`;
    let w = cache.get(key);
    if (w === undefined) {
      ctx.font = font(f);
      w = ctx.measureText(text).width / S;
      cache.set(key, w);
    }
    return w;
  };
}

interface Ctx {
  c: CanvasRenderingContext2D;
  m: Measure;
}

/** 한 줄 글자: (x, 줄 윗변 top) 기준, 줄 높이 lh 의 가운데에 앉힌다. */
function text(
  { c }: Ctx,
  s: string,
  x: number,
  top: number,
  f: FontSpec,
  opts: { color?: string; align?: CanvasTextAlign; lh?: number } = {},
) {
  if (!s) return;
  const lh = opts.lh ?? f.size * LH;
  c.font = font(f);
  c.fillStyle = opts.color ?? INK;
  c.textAlign = opts.align ?? 'left';
  c.textBaseline = 'alphabetic';
  c.fillText(s, x * S, (top + lh / 2 + f.size * 0.36) * S);
}

function lines(ctx: Ctx, ls: string[], x: number, top: number, f: FontSpec, opts: { color?: string; align?: CanvasTextAlign } = {}) {
  const lh = f.size * LH;
  ls.forEach((l, i) => text(ctx, l, x, top + i * lh, f, { ...opts, lh }));
  return ls.length * lh;
}

function rect(
  { c }: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { fill?: string; stroke?: string; lw?: number; r?: number; dash?: number[] },
) {
  c.beginPath();
  const r = (o.r ?? 0) * S;
  if (r && 'roundRect' in c) c.roundRect(x * S, y * S, w * S, h * S, r);
  else c.rect(x * S, y * S, w * S, h * S);
  if (o.fill) {
    c.fillStyle = o.fill;
    c.fill();
  }
  if (o.stroke) {
    c.setLineDash((o.dash ?? []).map((d) => d * S));
    c.strokeStyle = o.stroke;
    c.lineWidth = (o.lw ?? 0.25) * S;
    c.stroke();
    c.setLineDash([]);
  }
}

function hline({ c }: Ctx, x1: number, x2: number, y: number, lw: number, color = INK) {
  c.beginPath();
  c.moveTo(x1 * S, y * S);
  c.lineTo(x2 * S, y * S);
  c.strokeStyle = color;
  c.lineWidth = lw * S;
  c.stroke();
}

// ── 머리 ──────────────────────────────────────────

function barcodeBox(ctx: Ctx, x: number, y: number, w: number, h: number, big: boolean) {
  rect(ctx, x, y, w, h, { stroke: '#777', lw: 0.3, r: 1.6, dash: [1.4, 1] });
  const t = big ? { size: FONTS.metaVal.size * 1.05, weight: 700 as const } : FONTS.sign;
  const lh = t.size * LH;
  if (big) {
    text(ctx, '환자 바코드 부착', x + w / 2, y + h / 2 - lh, t, { color: '#9a9a9a', align: 'center' });
    text(ctx, '이름·병상번호는 파일에 넣지 않아요', x + w / 2, y + h / 2 + 0.4, FONTS.hint, { color: '#b0b0b0', align: 'center' });
  } else {
    text(ctx, '환자 바코드 부착', x + w / 2, y + (h - lh) / 2, t, { color: '#9a9a9a', align: 'center' });
  }
}

function drawFirstHeader(ctx: Ctx, model: PrintModel) {
  const x = MARGIN.l;
  const y = MARGIN.t;
  text(ctx, '지참약 식별표', x, y, FONTS.title, { lh: FONTS.title.size * 1.15 });
  const top = y + 11;
  text(ctx, '작성', x, top, FONTS.metaKey, { color: '#666' });
  text(ctx, formatPrintDate(model.createdAt), x + 11, top, FONTS.metaVal);
  text(ctx, '약', x + 64, top, FONTS.metaKey, { color: '#666' });
  text(ctx, `${model.medCount}종`, x + 71, top, FONTS.metaVal);
  barcodeBox(ctx, MARGIN.l + CW - HEAD1.barcode.w, y, HEAD1.barcode.w, HEAD1.barcode.h, true);
}

function drawContHeader(ctx: Ctx, model: PrintModel, page: PageLayout, total: number) {
  const x = MARGIN.l;
  const y = MARGIN.t;
  text(ctx, '지참약 식별표 (계속)', x, y + 1, FONTS.contTitle, { lh: FONTS.contTitle.size * 1.2 });
  text(
    ctx,
    `작성 ${formatPrintDate(model.createdAt)} · ${page.noFrom}–${page.noTo}번 / 총 ${model.medCount}종 · ${page.index + 1}/${total}쪽`,
    x,
    y + 8.4,
    FONTS.sub,
    { color: INK2 },
  );
  barcodeBox(ctx, MARGIN.l + CW - HEAD2.barcode.w, y, HEAD2.barcode.w, HEAD2.barcode.h, false);
}

// ── 표 ────────────────────────────────────────────

function drawTableHead(ctx: Ctx, y: number, cols: Col[]) {
  rect(ctx, MARGIN.l, y, CW, TH_H, { fill: '#efefef' });
  hline(ctx, MARGIN.l, MARGIN.l + CW, y, 0.42);
  hline(ctx, MARGIN.l, MARGIN.l + CW, y + TH_H, 0.28);
  for (const col of cols) {
    const x = colX(cols, col.key);
    const lh = FONTS.th.size * 1.18;
    const top = y + (TH_H - col.label.length * lh) / 2;
    col.label.forEach((l, i) =>
      text(ctx, l, col.align === 'center' ? x + col.w / 2 : x + CELL_PAD, top + i * lh, FONTS.th, {
        color: '#333',
        align: col.align ?? 'left',
        lh,
      }),
    );
  }
}

function drawGroupRow(ctx: Ctx, r: GroupRowLayout) {
  const x = MARGIN.l;
  if (r.group.special) {
    rect(ctx, x, r.y, CW, r.h, { fill: '#fff' });
    rect(ctx, x + 0.21, r.y + 0.21, CW - 0.42, r.h - 0.42, { stroke: INK, lw: 0.42 });
  } else {
    rect(ctx, x, r.y, CW, r.h, { fill: '#e3e3e3' });
    hline(ctx, x, x + CW, r.y, 0.28);
    hline(ctx, x, x + CW, r.y + r.h, 0.28);
  }
  const title = r.cont ? `${r.group.title} (계속)` : r.group.title;
  text(ctx, title, x + CELL_PAD, r.y, FONTS.group, { lh: GROUP_H });
  const tw = ctx.m(title, FONTS.group);
  const noteX = x + CELL_PAD + tw + 2.6;
  const note = ellipsize(r.group.note, MARGIN.l + CW - CELL_PAD - noteX, FONTS.groupNote, ctx.m);
  text(ctx, note, noteX, r.y, FONTS.groupNote, { lh: GROUP_H, color: '#333' });
}

function drawPhoto(ctx: Ctx, page: PageLayout, r: MedRowLayout, photos: PhotoMap) {
  const PHOTO_H = page.photo.h;
  const x = colX(page.cols, 'photo') + 1.2;
  const w = page.photo.w;
  const y = r.y + (r.h - PHOTO_H) / 2;
  rect(ctx, x, y, w, PHOTO_H, { fill: '#f4f4f4', stroke: '#cfcfcf', lw: 0.18, r: 1 });
  const url = r.med.imageUrl;
  const img = url ? photos.get(url) : undefined;
  if (img) {
    const inset = 0.4;
    const bw = w - inset * 2;
    const bh = PHOTO_H - inset * 2;
    const k = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
    const dw = img.naturalWidth * k;
    const dh = img.naturalHeight * k;
    const { c } = ctx;
    c.save();
    c.beginPath();
    c.rect((x + inset) * S, (y + inset) * S, bw * S, bh * S);
    c.clip();
    c.drawImage(img, (x + (w - dw) / 2) * S, (y + (PHOTO_H - dh) / 2) * S, dw * S, dh * S);
    c.restore();
  } else if (r.med.glyph) {
    // 사진 대신 앱과 같은 모양·색 그림 + 짧은 표시(실물 사진이 아님을 알림). 못 받은 사유는 앱 안내로 충분.
    // 흑백 출력에서도 윤곽이 보이게 테두리는 진하게(drawGlyph).
    const size = PHOTO_H - 1;
    drawGlyph(ctx, r.med.glyph, x + 0.8, y + 0.5, size);
    const cx = x + 0.8 + size + (w - 0.8 - size) / 2;
    const lh = FONTS.hint.size * 1.25;
    const top = y + (PHOTO_H - lh * 2) / 2;
    text(ctx, '사진 없음', cx, top, FONTS.hint, { color: '#8a8a8a', align: 'center', lh });
    text(ctx, '(그림)', cx, top + lh, FONTS.hint, { color: '#8a8a8a', align: 'center', lh });
  } else {
    const label = url ? '사진 못 받음' : '사진 미등록';
    text(ctx, label, x + w / 2, y, FONTS.hint, { color: '#a0a0a0', align: 'center', lh: PHOTO_H });
  }
}

/** 앱 글리프(Icon.PillGlyph)와 같은 도형·색·각인을 캔버스에 그린다. (x, y) 왼쪽 위, size 정사각(mm). */
function drawGlyph({ c }: Ctx, g: NonNullable<PrintMed['glyph']>, x: number, y: number, size: number) {
  const geom = shapeGeom(g.shape);
  const col = glyphColors(g.color);
  const k = (size * S) / 100; // viewBox 100 → px
  c.save();
  c.translate(x * S, y * S);
  c.scale(k, k);
  const path = new Path2D(shapePathD(g.shape));
  const grad = c.createLinearGradient(0, 0, 0, 100);
  grad.addColorStop(0, col.top);
  grad.addColorStop(0.55, col.fill);
  grad.addColorStop(1, col.bot);
  c.fillStyle = grad;
  c.fill(path);
  c.strokeStyle = '#6b6b6b';
  c.lineWidth = (0.22 * S) / k;
  c.lineJoin = 'round';
  c.stroke(path);
  c.restore();
  const label = cleanMark(g.marking);
  if (label) {
    c.font = `700 ${(glyphLabelSize(geom, label) * k).toFixed(2)}px ${FAMILY}`;
    c.fillStyle = col.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x * S + 50 * k, y * S + geom.ty * k);
  }
}

function drawMedRow(ctx: Ctx, page: PageLayout, r: MedRowLayout, photos: PhotoMap) {
  const { cols, fonts: f } = page;
  const x0 = MARGIN.l;
  hline(ctx, x0, x0 + CW, r.y + r.h, 0.18, RULE);
  const mid = (h: number) => r.y + (r.h - h) / 2;

  text(ctx, String(r.med.no), colX(cols, 'no') + colW(cols, 'no') / 2, mid(f.no.size * LH), f.no, { color: '#555', align: 'center' });
  drawPhoto(ctx, page, r, photos);

  // 이름 칸: 이름 / 성분·영문 / 분류(무슨 약인지) / 메모
  const nx = colX(cols, 'name') + CELL_PAD;
  const stackH =
    r.name.length * f.name.size * LH + r.sub.length * f.sub.size * LH + r.cls.length * f.cls.size * LH + r.memo.length * f.memo.size * LH;
  let y = mid(stackH);
  y += lines(ctx, r.name, nx, y, f.name);
  y += lines(ctx, r.sub, nx, y, f.sub, { color: INK2 });
  y += lines(ctx, r.cls, nx, y, f.cls);
  lines(ctx, r.memo, nx, y, f.memo);

  const cellLH = f.cell.size * LH;
  lines(ctx, r.look, colX(cols, 'look') + CELL_PAD, mid(r.look.length * cellLH), f.cell);
  text(ctx, r.med.dose, colX(cols, 'dose') + colW(cols, 'dose') / 2, mid(f.dose.size * LH), f.dose, { align: 'center' });
  lines(ctx, r.freq, colX(cols, 'freq') + CELL_PAD, mid(r.freq.length * cellLH), f.cell);
}

function drawFooter(ctx: Ctx, model: PrintModel, pageIndex: number, total: number) {
  hline(ctx, MARGIN.l, MARGIN.l + CW, FOOTER_TOP, 0.28);
  const right = `ward-pillcheck · ${pageIndex + 1}/${total}쪽`;
  const rw = ctx.m(right, FONTS.foot);
  const db = model.dbDate ? ` (${model.dbDate} 기준)` : '';
  const left = ellipsize(
    `출처: 식약처 의약품 낱알식별·제품 허가정보${db} · 식별 보조용 — 최종 확인은 의료진 · 흑백 출력 시 색은 글자로 확인`,
    CW - rw - 4,
    FONTS.foot,
    ctx.m,
  );
  text(ctx, left, MARGIN.l, FOOTER_TOP + 1, FONTS.foot, { color: '#555' });
  text(ctx, right, MARGIN.l + CW, FOOTER_TOP + 1, FONTS.foot, { color: '#555', align: 'right' });
}

/** 한 쪽을 캔버스에 그린다(캔버스 크기는 A4 × PX_PER_MM 이어야 함). */
export function drawPage(
  c: CanvasRenderingContext2D,
  m: Measure,
  doc: DocLayout,
  page: PageLayout,
  model: PrintModel,
  photos: PhotoMap,
) {
  const ctx: Ctx = { c, m };
  c.save();
  c.fillStyle = '#fff';
  c.fillRect(0, 0, PAGE.w * S, PAGE.h * S);
  if (page.first) drawFirstHeader(ctx, model);
  else drawContHeader(ctx, model, page, doc.pages.length);
  drawTableHead(ctx, page.tableTop, page.cols);
  for (const r of page.rows) {
    if (r.kind === 'group') drawGroupRow(ctx, r);
    else drawMedRow(ctx, page, r, photos);
  }
  drawFooter(ctx, model, page.index, doc.pages.length);
  c.restore();
}
