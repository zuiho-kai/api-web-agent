import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Public base path. Set via VITE_BASE_PATH for sub-path deployments
// (e.g. /api_web_agent/). Defaults to '/' for root deployments / dev.
const BASE = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base: BASE,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60000,
    setupFiles: ['./test/setup.ts'],
  },
});
