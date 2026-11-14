import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { StoreProvider } from './state/store';
import { ErrorBoundary } from './design/ErrorBoundary';
import { purgeLegacyPhotoCache } from './api/photoCache';
import { disablePageZoom } from './state/noPageZoom';
import { trackKeyboardInset } from './state/keyboardInset';
import './styles/global.css';

// 새 배포 자동 반영: 새 SW 감지 시 즉시 적용+리로드, 1시간마다 업데이트 점검.
// (설치형 PWA에서 수동 강제새로고침 없이도 최신본이 적용되도록)
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swUrl, reg) {
    if (reg) setInterval(() => reg.update(), 60 * 60 * 1000);
  },
});

void purgeLegacyPhotoCache();
// 화면 전체 핀줌 차단(iOS 는 뷰포트 설정을 무시) — 사진 확대는 라이트박스 안에서만.
disablePageZoom();
// 키보드가 시트·팝업 입력칸을 가리지 않게 앱 화면을 보이는 영역에 맞춤(iOS·안드로이드 크롬은 키보드가 덮기만 함).
trackKeyboardInset();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
