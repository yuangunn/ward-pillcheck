// 화면 전체 핀줌·두 번 탭 확대 막기.
//
// index.html 뷰포트(maximum-scale=1, user-scalable=no)는 안드로이드 크롬에선 먹지만,
// iOS 사파리(10+)는 접근성 이유로 무시해 아이폰에선 핀줌이 그대로 됐다. 설치형 PWA 는 주소창이 없어
// 한 번 확대되면 되돌리기 어렵고 하단 고정바·시트가 화면 밖으로 밀린다.
// - iOS: WebKit 전용 gesture* 이벤트 기본 동작을 막아 핀줌을 멈춘다.
// - 공통: global.css 의 touch-action: pan-x pan-y 로 핀치·두 번 탭 확대를 끈다(스크롤은 그대로).
// 각인을 읽어야 하는 실물 사진은 라이트박스가 자체 확대(design/ZoomableImage)를 제공한다.

const EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const;

export function disablePageZoom(target: Pick<Document, 'addEventListener' | 'removeEventListener'> = document): () => void {
  const block = (e: Event) => e.preventDefault();
  for (const t of EVENTS) target.addEventListener(t, block, { passive: false });
  return () => {
    for (const t of EVENTS) target.removeEventListener(t, block);
  };
}
