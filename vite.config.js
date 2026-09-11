import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The gate app talks to one API and nothing else. In development Vite proxies
   /staff to the local back-end; in production VITE_API_BASE points at
   api.pravesha.in and the app is served as static files. */
const API = process.env.VITE_PROXY_TARGET || 'http://localhost:5005';

export default defineConfig({
  plugins: [react()],
  server: { port: 5190, proxy: { '/staff': { target: API, changeOrigin: true } } },
  preview: { port: 5191, proxy: { '/staff': { target: API, changeOrigin: true } } },
  build: { outDir: 'dist', sourcemap: false },
});
