import type { MedItem } from '../domain/models';
import { drugApi } from '../api';
import { getMeta, proxiedImg } from '../api/dataset';
import { buildPrintModel, printFileName, type PrintLookups } from './model';
import { PAGE, layoutDocument } from './layout';
import { PX_PER_MM, canvasMeasure, drawPage, type PhotoMap } from './render';
import { buildJpegPdf, type JpegPage } from './pdf';

// A4 지참약 식별표 만들기(쪽마다 JPEG 1장 + 같은 쪽들을 묶은 PDF 1개) + 폰 공유 창으로 보내기.
// Teams 는 이미지로 받으면 크게 압축해(670KB → 60~100KB) 글자가 뭉개진다. PDF 는 파일로 취급돼
// 원본 그대로 가므로 출력용은 PDF, 이미지는 대화창 미리보기용.
// 흐름: 성분·영문·분류 조회 → 배치 → 식약처 사진 받기 → 쪽마다 캔버스 → JPEG.
// 쪽 순서는 꼬리말 쪽 번호(1/3쪽)와 파일명(_1of3)으로 알 수 있다.
// 환자 이름·병상번호는 넣지 않는다(종이에 환자 바코드를 직접 붙임).

export type PrintProgress =
  | { stage: 'prepare' }
  | { stage: 'photos'; done: number; total: number }
  | { stage: 'pages'; done: number; total: number };

export interface PrintImages {
  files: File[]; // 쪽 순서대로 JPEG(2940×4158)
  pdf: File; // 같은 쪽들을 A4 로 묶은 PDF(출력용 — Teams 가 압축하지 않음)
  pages: number;
  photosMissing: number; // 사진 URL 은 있었지만 받지 못한 장수
}

const PHOTO_TIMEOUT_MS = 20000; // 처음 보는 사진은 식약처→워커 경유가 20초 가까이 걸리기도 함(이후 캐시로 즉시)

const emptyMap = () => new Map<string, string>();
const safeMap = (p?: Promise<Map<string, string>>) => (p ? p.catch(emptyMap) : Promise.resolve(emptyMap()));

/** 식약처 사진 1장 — 워커 프록시(CORS) 경유라 캔버스가 오염되지 않는다. 실패·시간초과면 null. */
function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  const src = proxiedImg(url);
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      img.onload = img.onerror = null;
      resolve(null);
    }, PHOTO_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.naturalWidth ? img : null);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/** 앱 글꼴(Pretendard)이 아직 안 받아졌으면 잠깐 기다린다 — 오프라인이면 기기 글꼴로 진행. */
async function settleFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const wait = Promise.all(
    ['400', '700', '900'].map((w) => document.fonts.load(`${w} 20px "Pretendard Variable"`).catch(() => [])),
  );
  await Promise.race([wait, new Promise((r) => setTimeout(r, 2000))]);
}

function dbDateOf(builtAt?: string): string | undefined {
  if (!builtAt) return undefined;
  const d = new Date(builtAt);
  if (Number.isNaN(d.getTime())) return builtAt.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('이미지 변환 실패'));
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function createPrintImages(
  meds: MedItem[],
  onProgress?: (p: PrintProgress) => void,
): Promise<PrintImages> {
  if (!meds.length) throw new Error('약이 없어요');
  onProgress?.({ stage: 'prepare' });
  const createdAt = new Date();
  const seqs = [...new Set(meds.map((m) => m.itemSeq).filter(Boolean))];
  const [ingrKo, eng, cls] = await Promise.all([
    safeMap(drugApi.getIngredientsKo?.(seqs)),
    safeMap(drugApi.getEngNames?.(seqs)),
    safeMap(drugApi.getClassNames?.(seqs)),
  ]);
  const lookups: PrintLookups = { ingrKo, eng, cls };
  const model = buildPrintModel(meds, lookups, { createdAt, dbDate: dbDateOf(getMeta()?.builtAt) });

  await settleFonts();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE.w * PX_PER_MM);
  canvas.height = Math.round(PAGE.h * PX_PER_MM);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 쓸 수 없어요');
  const measure = canvasMeasure(ctx);
  const doc = layoutDocument(model, measure);

  // 사진: 동시에 받되 각자 시간 제한. 이미 본 사진은 서비스워커 캐시에서 즉시.
  const urls = [...new Set(meds.map((m) => m.imageUrl).filter((u): u is string => !!u))];
  const photos: PhotoMap = new Map();
  let done = 0;
  onProgress?.({ stage: 'photos', done, total: urls.length });
  await Promise.all(
    urls.map(async (u) => {
      photos.set(u, await loadPhoto(u));
      done += 1;
      onProgress?.({ stage: 'photos', done, total: urls.length });
    }),
  );

  const total = doc.pages.length;
  const files: File[] = [];
  const pdfPages: JpegPage[] = [];
  for (const page of doc.pages) {
    onProgress?.({ stage: 'pages', done: page.index, total });
    drawPage(ctx, measure, doc, page, model, photos);
    const jpeg = await canvasToJpeg(canvas, 0.92);
    files.push(new File([jpeg.buffer as ArrayBuffer], printFileName(createdAt, page.index + 1, total), { type: 'image/jpeg' }));
    pdfPages.push({ jpeg, widthPx: canvas.width, heightPx: canvas.height });
  }
  canvas.width = canvas.height = 0; // iOS 캔버스 메모리 즉시 반환

  const pdfBytes = buildJpegPdf(pdfPages, { title: '지참약 식별표', createdAt });
  const pdf = new File([pdfBytes.buffer as ArrayBuffer], printFileName(createdAt, 1, total, 'pdf'), { type: 'application/pdf' });
  return { files, pdf, pages: total, photosMissing: [...photos.values()].filter((v) => !v).length };
}

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded' | 'retry';

/**
 * 폰 공유 창으로 쪽 이미지들 보내기(Teams 앱 선택). 파일 공유를 못 하는 브라우저면 파일로 저장한다.
 * ⚠ 반드시 버튼 탭 직후(사용자 동작 안)에 호출 — 이미지 생성 같은 긴 작업 뒤엔 브라우저가 공유를 막는다.
 */
export async function shareFiles(files: File[]): Promise<ShareOutcome> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const data: ShareData = { files, title: '지참약 식별표' };
  if (typeof nav.share === 'function' && nav.canShare?.(data)) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'retry'; // 사용자 동작 만료 — 한 번 더 탭
      // 그 외 실패는 저장으로 폴백
    }
  }
  // 여러 장을 한꺼번에 받으면 브라우저가 두 번째부터 막기도 해서 조금씩 띄워 저장
  files.forEach((f, i) => setTimeout(() => downloadFile(f), i * 400));
  return 'downloaded';
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
