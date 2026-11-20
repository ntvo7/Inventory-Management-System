import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Forward /api/* to the Flask backend so the browser doesn't need CORS
    proxy: { '/api': 'http://127.0.0.1:5000' },
  },
  build: {
    // `npm run build` puts the finished site where Flask serves it on the live server
    outDir: fileURLToPath(new URL('../Inventory Back-End/web', import.meta.url)),
    emptyOutDir: true,
  },
});
