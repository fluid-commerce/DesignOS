import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    environmentMatchGlobs: [
      ['mcp/**/*.test.ts', 'node'],
      ['src/__tests__/routing.test.ts', 'node'],
      ['src/__tests__/brand-seeder.test.ts', 'node'],
      ['src/__tests__/dam-sync.test.ts', 'node'],
      ['src/__tests__/context-map.test.ts', 'node'],
      ['src/__tests__/chat-store-sse.test.ts', 'node'],
    ],
  },
});
