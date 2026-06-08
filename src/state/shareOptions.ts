// 인계 공유 상세설정(성분명·겉모습 포함 여부) — 기기에 저장(병동 PC/폰 단위).

export interface ShareOptions {
  /** 품목명의 성분 괄호(…) 포함 여부 */
  ingredient: boolean;
  /** 겉모습(색/모양/각인) 괄호 포함 여부 */
  appearance: boolean;
  /** 환자 라벨 가리기(개인정보 보호). 기본 켜짐 */
  mask: boolean;
}

const KEY = 'ward-pillcheck:shareOptions';

// 기본값: 성분명은 빼고(간결), 겉모습은 표시, 환자명은 가림(개인정보 보호).
export const DEFAULT_SHARE_OPTIONS: ShareOptions = { ingredient: false, appearance: true, mask: true };

export function getShareOptions(): ShareOptions {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SHARE_OPTIONS };
    const parsed = JSON.parse(raw) as Partial<ShareOptions>;
    return {
      ingredient: parsed.ingredient ?? DEFAULT_SHARE_OPTIONS.ingredient,
      appearance: parsed.appearance ?? DEFAULT_SHARE_OPTIONS.appearance,
      mask: parsed.mask ?? DEFAULT_SHARE_OPTIONS.mask,
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
