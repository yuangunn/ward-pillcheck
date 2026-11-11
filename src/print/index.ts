import type { MedItem } from '../domain/models';
import { drugApi } from '../api';
import { getMeta, proxiedImg } from '../api/dataset';
import { runSafetyCheck } from '../api/safety';
import { buildPrintModel, printFileName, type PrintLookups } from './model';
import { PAGE, layoutDocument } from './layout';
import { PX_PER_MM, canvasMeasure, drawPage, type PhotoMap } from './render';
import { buildJpegPdf } from './pdf';

// A4 지참약 확인표 PDF 만들기 + 폰 공유 창으로 보내기.
// 흐름: 성분·영문·제형 조회 + 금기·중복 점검 → 배치 → 식약처 사진 받기 → 쪽마다 캔버스 → JPEG → PDF.
// 환자 이름·병상번호는 넣지 않는다(종이에 환자 바코드를 직접 붙임).

export type PrintProgress =
  | { stage: 'prepare' }
  | { stage: 'photos'; done: number; total: number }
  | { stage: 'pages'; done: number; total: number };

export interface PrintPdf {
  file: File;
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

export async function createPrintPdf(
  meds: MedItem[],
  onProgress?: (p: PrintProgress) => void,
): Promise<PrintPdf> {
  if (!meds.length) throw new Error('약이 없어요');
  onProgress?.({ stage: 'prepare' });
  const createdAt = new Date();
  const seqs = [...new Set(meds.map((m) => m.itemSeq).filter(Boolean))];
  const [ingrKo, eng, forms, safety] = await Promise.all([
    safeMap(drugApi.getIngredientsKo?.(seqs)),
    safeMap(drugApi.getEngNames?.(seqs)),
    safeMap(drugApi.getForms?.(seqs)),
    runSafetyCheck(meds).catch(() => null),
  ]);
  const lookups: PrintLookups = { ingrKo, eng, forms };
  const model = buildPrintModel(meds, lookups, safety, { createdAt, dbDate: dbDateOf(getMeta()?.builtAt) });

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

  const pages = [];
  for (const page of doc.pages) {
    onProgress?.({ stage: 'pages', done: page.index, total: doc.pages.length });
    drawPage(ctx, measure, doc, page, model, photos);
    pages.push({ jpeg: await canvasToJpeg(canvas, 0.9), widthPx: canvas.width, heightPx: canvas.height });
  }
  canvas.width = canvas.height = 0; // iOS 캔버스 메모리 즉시 반환

  const bytes = buildJpegPdf(pages, { title: '지참약 확인표', createdAt });
  const file = new File([bytes.buffer as ArrayBuffer], printFileName(createdAt), { type: 'application/pdf' });
  return { file, pages: pages.length, photosMissing: [...photos.values()].filter((v) => !v).length };
}

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded' | 'retry';

/**
 * 폰 공유 창으로 PDF 보내기(Teams 앱 선택). 파일 공유를 못 하는 브라우저면 파일로 저장한다.
 * ⚠ 반드시 버튼 탭 직후(사용자 동작 안)에 호출 — PDF 생성 같은 긴 작업 뒤엔 브라우저가 공유를 막는다.
 */
export async function sharePdf(file: File): Promise<ShareOutcome> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const data: ShareData = { files: [file], title: '지참약 확인표' };
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
  downloadFile(file);
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
