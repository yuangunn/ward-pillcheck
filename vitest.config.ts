import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 테스트 전용 설정. PWA 플러그인 없이 jsdom 환경에서 실행.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
