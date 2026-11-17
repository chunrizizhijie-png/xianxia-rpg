import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const localModelHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { headers: localModelHeaders },
  preview: { host: '127.0.0.1', port: 4188, strictPort: true, headers: localModelHeaders },
  build: {
    assetsInlineLimit: 200_000,
    modulePreload: false,
  },
});
