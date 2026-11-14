// 키보드가 올라오면 앱 화면(#root)을 "실제로 보이는 영역" 위로 줄인다(안드로이드 adjustResize 와 같은 효과).
//
// 왜: #root 는 position:fixed 로 레이아웃 뷰포트에 붙어 있는데, iOS 사파리와 안드로이드 크롬(108+, 기본
// resizes-visual)은 키보드가 떠도 레이아웃 뷰포트를 줄이지 않고 위에 덮기만 한다. 그래서 하단 시트(환자 추가 등)와
// 가운데 팝업의 입력칸·버튼이 키보드 밑에 깔렸다. 시트 포커스는 튀는 글리치 때문에 preventScroll 이라
// 브라우저가 입력칸을 끌어올려 주지도 않는다.
// 어떻게: visualViewport(키보드를 뺀 보이는 영역)를 따라 --vv-top / --kb-inset CSS 변수를 갱신하고,
// global.css 의 #root 가 top/bottom 으로 그 영역에 맞춘다. 줄어든 시트 안에서 입력칸이 가려지면 그 스크롤 칸만 굴린다.

export interface ViewportLike {
  height: number;
  offsetTop: number;
  scale: number;
}

/** 이보다 작은 차이는 키보드가 아니라 브라우저 도구막대 등으로 보고 무시(px) */
export const MIN_KEYBOARD = 80;

/**
 * 레이아웃 높이와 보이는 영역 → #root 를 맞출 위·아래 여백(px).
 * 입력 중이 아니거나(키보드 없음) 확대 중이면 0 — 핀줌은 막혀 있지만 접근성 강제 확대 대비.
 */
export function viewportFit(layoutH: number, vv: ViewportLike | null, editing: boolean): { top: number; bottom: number } {
  if (!vv || !editing || vv.scale > 1.01) return { top: 0, bottom: 0 };
  const top = Math.max(0, Math.round(vv.offsetTop));
  const bottom = Math.max(0, Math.round(layoutH - vv.offsetTop - vv.height));
  if (bottom < MIN_KEYBOARD) return { top: 0, bottom: 0 };
  return { top, bottom };
}

const NON_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/** 키보드를 띄우는 입력 요소에 포커스가 있나 */
export function isEditing(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) return !el.readOnly && !NON_TEXT.has(el.type);
  return (el as HTMLElement).isContentEditable === true;
}

/** 줄어든 화면에서 입력칸이 가려졌으면 가장 가까운 스크롤 칸만 굴려 보이게(body·#root 는 건드리지 않음 — 화면 튐 방지) */
export function revealInScroller(el: HTMLElement, margin = 16): void {
  let p = el.parentElement;
  while (p && p.id !== 'root' && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) {
      const pr = p.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      if (er.bottom > pr.bottom - margin) p.scrollTop += er.bottom - pr.bottom + margin;
      else if (er.top < pr.top + margin) p.scrollTop -= pr.top + margin - er.top;
      return;
    }
    p = p.parentElement;
  }
}

/** 앱 시작 시 1회. 해제 함수 반환. */
export function trackKeyboardInset(win: Window = window): () => void {
  const vv = win.visualViewport;
  if (!vv) return () => {};
  const doc = win.document;
  const root = doc.documentElement;
  let raf = 0;
  let pending = false; // 프레임당 한 번만 계산(rAF 콜백이 동기로 불려도 꼬이지 않게 핸들과 분리)
  let last = '';
  const apply = () => {
    pending = false;
    const active = doc.activeElement;
    const { top, bottom } = viewportFit(root.clientHeight, vv, isEditing(active));
    const key = `${top}|${bottom}`;
    if (key === last) return;
    last = key;
    root.style.setProperty('--vv-top', `${top}px`);
    root.style.setProperty('--kb-inset', `${bottom}px`);
    if (bottom > 0) root.setAttribute('data-keyboard', '');
    else root.removeAttribute('data-keyboard');
    // 화면이 줄어든 다음 프레임에 입력칸 위치 보정
    if (bottom > 0 && active instanceof HTMLElement) win.requestAnimationFrame(() => revealInScroller(active));
  };
  const update = () => {
    if (pending) return;
    pending = true;
    raf = win.requestAnimationFrame(apply);
  };
  // 입력칸 사이 이동(focusout→focusin) 때 잠깐 0 으로 튀지 않게 포커스 해제는 조금 늦게 반영
  let blurT: ReturnType<typeof setTimeout> | undefined;
  const onFocusOut = () => {
    clearTimeout(blurT);
    blurT = setTimeout(update, 120);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  doc.addEventListener('focusin', update);
  doc.addEventListener('focusout', onFocusOut);
  update();
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    doc.removeEventListener('focusin', update);
    doc.removeEventListener('focusout', onFocusOut);
    clearTimeout(blurT);
    if (pending) win.cancelAnimationFrame(raf);
  };
}
