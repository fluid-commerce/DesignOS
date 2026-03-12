import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fluidWatcherPlugin } from './src/server/watcher';

export default defineConfig({
  plugins: [
    react(),
    fluidWatcherPlugin('../.fluid/working'),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  optimizeDeps: {
    // better-sqlite3 is a native Node.js addon — exclude from Vite's browser bundle
    exclude: ['better-sqlite3'],
  },
});
