// SPDX-License-Identifier: GPL-3.0-or-later


import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Local development talks directly to the Oracle API. The retired
  // Cloudflare Worker remains available only under backend/legacy-cloudflare-worker.
  const apiTarget = env.VITE_DEV_API_TARGET || env.VITE_API_URL || 'http://127.0.0.1:8081';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(process.cwd(), 'src')
      }
    },
    publicDir: 'public',
    server: {
      host: '127.0.0.1',
      port: 5176,
      strictPort: true,
      fs: {
        // The shared stylesheet and authenticated client live beside this
        // build while the backend remains a separately deployable service.
        allow: [resolve(process.cwd(), '..')]
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          ws: true
        }
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Target browser modern yang dipakai kader agar transpile tidak
      // menambah ukuran dan waktu parsing JavaScript.
      target: 'es2020',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // React jarang berubah dibanding kode halaman; cache terpisah
          // membuat navigasi berikutnya tidak mengunduh ulang vendor utama.
          // Vite 8 memakai Rolldown yang mengharuskan manualChunks berupa
          // fungsi (format object hanya berlaku pada Rollup versi lama).
          manualChunks(id) {
            if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
              return 'react-vendor';
            }
            return undefined;
          }
        }
      }
    }
  };
});
