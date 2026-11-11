import {
  BADGE_H,
  CELL_PAD,
  COLS,
  CW,
  FONTS,
  FOOTER_TOP,
  GROUP_H,
  HEAD1,
  HEAD2,
  LH,
  MARGIN,
  PAGE,
  PHOTO_H,
  SAFETY,
  TH_H,
  colW,
  colX,
  ellipsize,
  type DocLayout,
  type FontSpec,
  type GroupRowLayout,
  type Measure,
  type MedRowLayout,
  type PageLayout,
  type SafetyLayout,
} from './layout';
import { formatPrintDate, type PrintModel } from './model';

// 캔버스에 A4 한 쪽씩 그린다(브라우저 전용). 좌표는 전부 mm 로 받고 S(px/mm)를 곱한다.
// 글꼴은 앱과 같은 Pretendard → 기기 기본 한글 글꼴 순. 흑백 레이저 출력 기준(색에 의존하지 않음).

export const PX_PER_MM = 10; // 2100×2970px ≈ 254dpi — 출력 선명도와 iOS 캔버스 한도 사이 절충
const S = PX_PER_MM;
const FAMILY =
  "'Pretendard Variable', Pretendard, -apple-system, system-ui, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', 'Malgun Gothic', sans-serif";

const INK = '#111';
const INK2 = '#444';
const MUTED = '#8a8a8a';
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

function vline({ c }: Ctx, x: number, y1: number, y2: number, lw: number, color = INK) {
  c.beginPath();
  c.moveTo(x * S, y1 * S);
  c.lineTo(x * S, y2 * S);
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
  text(ctx, '지참약 확인표', x, y, FONTS.title, { lh: FONTS.title.size * 1.15 });
  text(ctx, '환자 지참약 봉투에 함께 넣어 주세요 · 식별 보조 결과이며 최종 확인은 의료진 책임', x, y + 8.4, FONTS.sub, { color: INK2 });
  const row = (top: number, k1: string, v1: string, k2?: string, v2?: string) => {
    text(ctx, k1, x, top, FONTS.metaKey, { color: '#666' });
    text(ctx, v1, x + 15, top, FONTS.metaVal);
    if (k2) {
      text(ctx, k2, x + 64, top, FONTS.metaKey, { color: '#666' });
      text(ctx, v2 ?? '', x + 79, top, FONTS.metaVal);
    }
  };
  row(y + 13.4, '작성', formatPrintDate(model.createdAt), '약 개수', `${model.medCount}종`);
  row(y + 18, 'DB 기준', model.dbDate ? `식약처 ${model.dbDate}` : '—');

  // 서명란: 1차 / 2차 / 약제부 감별
  const sw = HEAD1.leftW / 3;
  rect(ctx, x, HEAD1.signTop, HEAD1.leftW, HEAD1.signH, { stroke: '#333', lw: 0.28, r: 1.2 });
  const cells: [string, string][] = [
    ['1차 확인', '서명'],
    ['2차 확인', '서명'],
    ['약제부 감별', '□ 의뢰'],
  ];
  cells.forEach(([k, hint], i) => {
    const cx = x + sw * i;
    if (i) vline(ctx, cx, HEAD1.signTop, HEAD1.signTop + HEAD1.signH, 0.18, RULE);
    text(ctx, k, cx + 2, HEAD1.signTop + 0.9, FONTS.sign);
    text(ctx, hint, cx + sw - 2, HEAD1.signTop + HEAD1.signH - 4.4, FONTS.hint, { color: MUTED, align: 'right' });
  });

  barcodeBox(ctx, MARGIN.l + CW - HEAD1.barcode.w, y, HEAD1.barcode.w, HEAD1.barcode.h, true);
}

function drawContHeader(ctx: Ctx, model: PrintModel, page: PageLayout, total: number) {
  const x = MARGIN.l;
  const y = MARGIN.t;
  text(ctx, '지참약 확인표 (계속)', x, y + 1, FONTS.contTitle, { lh: FONTS.contTitle.size * 1.2 });
  text(
    ctx,
    `작성 ${formatPrintDate(model.createdAt)} · ${page.noFrom}–${page.noTo}번 / 총 ${model.medCount}종 · ${page.index + 1}/${total}쪽`,
    x,
    y + 8,
    FONTS.sub,
    { color: INK2 },
  );
  text(ctx, '앞쪽과 함께 보관해 주세요', x, y + 12.4, FONTS.hint, { color: MUTED });
  barcodeBox(ctx, MARGIN.l + CW - HEAD2.barcode.w, y, HEAD2.barcode.w, HEAD2.barcode.h, false);
}

// ── 안전점검 요약 ─────────────────────────────────

function drawSafety(ctx: Ctx, s: SafetyLayout) {
  const x = MARGIN.l;
  const issues = s.level === 'issues';
  rect(ctx, x, s.y, CW, s.h, { stroke: issues ? INK : '#555', lw: issues ? 0.42 : 0.28, r: 1.6 });
  // 왼쪽 칸: 아이콘 + 제목 + 범위
  const lx = x + SAFETY.pad;
  const ty = s.y + SAFETY.pad;
  const head = FONTS.safetyHead;
  const iconR = head.size * 0.5;
  const icx = lx + iconR;
  const icy = ty + (head.size * LH) / 2;
  const { c } = ctx;
  c.beginPath();
  c.arc(icx * S, icy * S, iconR * S, 0, Math.PI * 2);
  c.fillStyle = INK;
  c.fill();
  if (s.level === 'clear') {
    c.beginPath();
    c.moveTo((icx - iconR * 0.45) * S, icy * S);
    c.lineTo((icx - iconR * 0.1) * S, (icy + iconR * 0.38) * S);
    c.lineTo((icx + iconR * 0.5) * S, (icy - iconR * 0.36) * S);
    c.strokeStyle = '#fff';
    c.lineWidth = iconR * 0.28 * S;
    c.stroke();
  } else {
    text(ctx, '!', icx, ty, { size: head.size * 0.8, weight: 900 }, { color: '#fff', align: 'center', lh: head.size * LH });
  }
  text(ctx, s.headline, lx + iconR * 2 + 1.2, ty, head);
  lines(ctx, s.subLines, lx, ty + head.size * LH, FONTS.safetySub, { color: '#555' });

  // 오른쪽: 항목들
  const ix = lx + SAFETY.labelW + SAFETY.gap;
  let iy = ty;
  const lh = FONTS.safetyBody.size * LH;
  for (const it of s.items) {
    const tagH = FONTS.safetyTag.size * 1.45;
    const tagTop = iy + (lh - tagH) / 2;
    rect(ctx, ix, tagTop, it.tagW, tagH, it.item.strong ? { fill: INK, r: 0.6 } : { stroke: INK, lw: 0.25, r: 0.6 });
    text(ctx, it.item.tag, ix + it.tagW / 2, tagTop, FONTS.safetyTag, { color: it.item.strong ? '#fff' : INK, align: 'center', lh: tagH });
    const tx = ix + it.tagW + 1.6;
    text(ctx, it.title, tx, iy, FONTS.safetyTitle, { lh });
    if (it.body.length) {
      text(ctx, it.title ? ` — ${it.body[0]}` : it.body[0], tx + it.titleW, iy, FONTS.safetyBody, { lh, color: INK2 });
      lines(ctx, it.body.slice(1), tx, iy + lh, FONTS.safetyBody, { color: INK2 });
    }
    iy += it.h;
  }
  if (s.more > 0) {
    text(ctx, `외 ${s.more}건 — 앱의 안전점검에서 전체 확인`, ix, iy, FONTS.safetyTitle, { lh });
    iy += lh;
  }
  if (s.message.length) lines(ctx, s.message, ix, iy, FONTS.safetyBody, { color: INK2 });
}

// ── 표 ────────────────────────────────────────────

function drawTableHead(ctx: Ctx, y: number) {
  rect(ctx, MARGIN.l, y, CW, TH_H, { fill: '#efefef' });
  hline(ctx, MARGIN.l, MARGIN.l + CW, y, 0.42);
  hline(ctx, MARGIN.l, MARGIN.l + CW, y + TH_H, 0.28);
  for (const col of COLS) {
    const x = colX(col.key);
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

function drawPhoto(ctx: Ctx, r: MedRowLayout, photos: PhotoMap) {
  const x = colX('photo') + 1.2;
  const w = colW('photo') - 2.4;
  const y = r.y + (r.h - PHOTO_H) / 2;
  rect(ctx, x, y, w, PHOTO_H, { fill: '#f4f4f4', stroke: '#cfcfcf', lw: 0.18, r: 1 });
  const url = r.med.imageUrl;
  const img = url ? photos.get(url) : undefined;
  if (img) {
    const inset = 0.5;
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
  } else {
    const label = url ? '사진 못 받음' : '사진 미등록';
    text(ctx, label, x + w / 2, y, FONTS.hint, { color: '#a0a0a0', align: 'center', lh: PHOTO_H });
  }
}

function drawMedRow(ctx: Ctx, r: MedRowLayout, photos: PhotoMap) {
  const x0 = MARGIN.l;
  hline(ctx, x0, x0 + CW, r.y + r.h, 0.18, RULE);
  const mid = (h: number) => r.y + (r.h - h) / 2;

  text(ctx, String(r.med.no), colX('no') + colW('no') / 2, mid(FONTS.no.size * LH), FONTS.no, { color: '#555', align: 'center' });
  drawPhoto(ctx, r, photos);

  // 이름 칸: 이름 / 성분·영문 / 메모 / 분할·분쇄 배지
  const nx = colX('name') + CELL_PAD;
  const stackH =
    r.name.length * FONTS.name.size * LH +
    r.sub.length * FONTS.subline.size * LH +
    r.memo.length * FONTS.memo.size * LH +
    (r.med.warn ? BADGE_H + 0.8 : 0);
  let y = mid(stackH);
  y += lines(ctx, r.name, nx, y, FONTS.name);
  y += lines(ctx, r.sub, nx, y, FONTS.subline, { color: INK2 });
  y += lines(ctx, r.memo, nx, y, FONTS.memo);
  if (r.med.warn) {
    const label = r.med.warn; // 이모지(⚠)는 기기마다 컬러로 그려져 흑백 출력이 탁해져 쓰지 않는다
    const bw = ctx.m(label, FONTS.badge) + 2.4;
    rect(ctx, nx, y + 0.8, bw, BADGE_H, { fill: INK, r: 0.7 });
    text(ctx, label, nx + bw / 2, y + 0.8, FONTS.badge, { color: '#fff', align: 'center', lh: BADGE_H });
  }

  const cellLH = FONTS.cell.size * LH;
  lines(ctx, r.look, colX('look') + CELL_PAD, mid(r.look.length * cellLH), FONTS.cell);
  text(ctx, r.med.dose, colX('dose') + colW('dose') / 2, mid(FONTS.dose.size * LH), FONTS.dose, { align: 'center' });
  lines(ctx, r.freq, colX('freq') + CELL_PAD, mid(r.freq.length * cellLH), FONTS.cell);

  // 수기칸(지참량) 구분선 + 확인 체크칸
  vline(ctx, colX('qty'), r.y + 1, r.y + r.h - 1, 0.18, '#dcdcdc');
  vline(ctx, colX('chk'), r.y + 1, r.y + r.h - 1, 0.18, '#dcdcdc');
  const box = 4.2;
  rect(ctx, colX('chk') + (colW('chk') - box) / 2, r.y + (r.h - box) / 2, box, box, { stroke: INK, lw: 0.32, r: 0.7 });
}

function drawFooter(ctx: Ctx, pageIndex: number, total: number) {
  hline(ctx, MARGIN.l, MARGIN.l + CW, FOOTER_TOP, 0.28);
  const right = `ward-pillcheck · ${pageIndex + 1}/${total}`;
  const rw = ctx.m(right, FONTS.foot);
  const left = ellipsize(
    '출처: 식약처 의약품 낱알식별·제품 허가정보·DUR(공공데이터포털) · 사진은 식약처 제공 이미지 · 흑백 출력 시 색은 글자로 확인',
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
  if (page.safety) drawSafety(ctx, page.safety);
  drawTableHead(ctx, page.tableTop);
  for (const r of page.rows) {
    if (r.kind === 'group') drawGroupRow(ctx, r);
    else drawMedRow(ctx, r, photos);
  }
  drawFooter(ctx, page.index, doc.pages.length);
  c.restore();
}
