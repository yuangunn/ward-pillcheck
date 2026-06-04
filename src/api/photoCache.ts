import { getPhotoUrls, proxiedImg } from './dataset';

// 선택적 실물사진 다운로드(대용량). 프록시 경유로 받아 SW 런타임 캐시('pill-photos')에 적재.
// best-effort·중단 가능. 식약처(nedrug)에서 폰 로컬 캐시로 직접 — 우리 레포/Pages 에 호스팅하지 않음.

const PHOTO_CACHE = 'pill-photos';

/** 캐시된 실물사진 장수(설정 표시용) */
export async function cachedPhotoCount(): Promise<number> {
  try {
    if (typeof caches === 'undefined') return 0;
    const c = await caches.open(PHOTO_CACHE);
    return (await c.keys()).length;
  } catch {
    return 0;
  }
}

export interface PhotoProgress {
  done: number;
  total: number;
}

/**
 * 전 낱알 실물사진을 받아 캐시를 데운다(SW CacheFirst 가 가로채 저장).
 * onProgress 로 진행률, shouldStop() 으로 중단.
 */
export async function downloadPhotos(
  onProgress?: (p: PhotoProgress) => void,
  shouldStop?: () => boolean,
): Promise<PhotoProgress> {
  const urls = await getPhotoUrls();
  const total = urls.length;
  let done = 0;
  const BATCH = 12;
  for (let i = 0; i < urls.length; i += BATCH) {
    if (shouldStop?.()) break;
    const batch = urls.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (u) => {
        const p = proxiedImg(u);
        if (!p) return;
        try {
          await fetch(p, { mode: 'cors' });
        } catch {
          /* 개별 실패는 무시 */
        }
      }),
    );
    done = Math.min(i + BATCH, total);
    onProgress?.({ done, total });
  }
  return { done, total };
}

/** 실물사진 캐시 비우기 */
export async function clearPhotos(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete(PHOTO_CACHE);
  } catch {
    /* ignore */
  }
}
