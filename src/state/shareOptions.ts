// 인계 공유 상세설정(성분명·겉모습 포함 여부) — 기기에 저장(병동 PC/폰 단위).

export interface ShareOptions {
  /** 품목명의 성분 괄호(…) 포함 여부 */
  ingredient: boolean;
  /** 겉모습(색/모양/각인) 괄호 포함 여부 */
  appearance: boolean;
}

const KEY = 'ward-pillcheck:shareOptions';

// 기본값: 성분명은 빼고(간결), 겉모습은 표시. (환자명 마스킹은 항상 강제 — CopySheet 가 외부 복사·공유 시 mask:true 고정)
export const DEFAULT_SHARE_OPTIONS: ShareOptions = { ingredient: false, appearance: true };

export function getShareOptions(): ShareOptions {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SHARE_OPTIONS };
    const parsed = JSON.parse(raw) as Partial<ShareOptions>;
    return {
      ingredient: parsed.ingredient ?? DEFAULT_SHARE_OPTIONS.ingredient,
      appearance: parsed.appearance ?? DEFAULT_SHARE_OPTIONS.appearance,
    };
  } catch {
    return { ...DEFAULT_SHARE_OPTIONS };
  }
}

export function setShareOptions(opts: ShareOptions): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(opts));
  } catch {
    /* ignore */
  }
}
