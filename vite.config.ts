import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 배포 전제: 저장소명을 base 경로로 사용.
// 환경변수 VITE_BASE 로 덮어쓸 수 있음(커스텀 도메인 등).
const base = process.env.VITE_BASE ?? '/ward-pillcheck/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 오프라인 셸만 캐싱. 환자 데이터는 localStorage, API는 항상 fresh.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // API(워커) 응답은 캐싱하지 않음 — 항상 네트워크.
        navigateFallbackDenylist: [/^\/api/],
      },
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '병동 지참약 식별',
        short_name: '지참약식별',
        description: '병동 간호사용 환자 지참약 식별·정리 도구',
        theme_color: '#2f6f6a',
        background_color: '#f5f7f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
