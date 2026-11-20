import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Forward /api/* to the Flask backend so the browser doesn't need CORS
    proxy: { '/api': 'http://127.0.0.1:5000' },
  },
});
