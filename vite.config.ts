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
      // 오프라인 셸 + 마크 이미지 프리캐시. 환자 데이터는 localStorage, 데이터 번들은 IndexedDB.
      workbox: {
        // 마크 gif(~3MB)까지 프리캐시해 오프라인에서 마크 갤러리/그리기 동작.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,gif}'],
        // pills.json 등 대용량 데이터는 프리캐시 제외(앱이 IndexedDB로 관리).
        globIgnores: ['**/data/*.json', '**/data/*.json.gz'],
        navigateFallbackDenylist: [/^\/api/],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // 실물사진 프록시(/api/img)는 한 번 본 사진을 오프라인 보관(CacheFirst).
        // 설정의 "실물사진 받기"가 이 캐시를 미리 데운다.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/api/img'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pill-photos',
              expiration: { maxEntries: 30000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ['favicon.svg', 'favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: '병동 지참약 식별',
        short_name: '지참약식별',
        description: '병동 간호사용 환자 지참약 식별·정리 도구',
        theme_color: '#2f6bff',
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
