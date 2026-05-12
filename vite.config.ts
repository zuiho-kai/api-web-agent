import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Public base path. Set via VITE_BASE_PATH for sub-path deployments
// (e.g. /api_web_agent/). Defaults to '/' for root deployments / dev.
// Special: for the single-HTML portable build, switch to relative './'
// so the index.html can be opened from any file:// path.
const SINGLEFILE = process.env.BUILD_TARGET === 'singlefile';
const BASE = SINGLEFILE ? './' : (process.env.VITE_BASE_PATH ?? '/');

export default defineConfig({
  base: BASE,
  plugins: [react(), ...(SINGLEFILE ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // Split heavy deps into their own chunks so the main entry stays small.
    // pdfjs / mammoth+turndown / xlsx are only used after a user uploads a
    // file — paired with dynamic imports in doc-parsers, the chunks are
    // lazy-loaded on demand instead of bloating first paint.
    //
    // For singlefile portable build, vite-plugin-singlefile inlines all
    // chunks into one index.html (no chunk splitting needed).
    rollupOptions: SINGLEFILE
      ? {}
      : {
          output: {
            manualChunks(id: string) {
              if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs';
              if (id.includes('node_modules/mammoth') || id.includes('node_modules/turndown')) return 'docx';
              if (id.includes('node_modules/xlsx')) return 'xlsx';
              if (
                id.includes('node_modules/react-markdown') ||
                id.includes('node_modules/rehype-highlight') ||
                id.includes('node_modules/remark-gfm') ||
                id.includes('node_modules/highlight.js')
              ) {
                return 'markdown';
              }
              if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
                return 'react-vendor';
              }
            },
          },
        },
    chunkSizeWarningLimit: SINGLEFILE ? 5000 : 1200,
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
