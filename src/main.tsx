import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { StoreProvider } from './state/store';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);
