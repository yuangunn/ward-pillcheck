import { defineConfig, devices } from '@playwright/test';

// 실제 브라우저 E2E. vitest(src/**/*.test) 와 분리된 e2e/ 디렉터리만 대상으로 한다.
// dev 서버를 base '/' 로 띄워 단순한 URL 로 접근.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // 모바일 세로 뷰포트 + 데스크톱 포인터(마우스) — dnd-kit PointerSensor 안정 동작
    {
      name: 'mobile-layout',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'VITE_BASE=/ npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
