import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The gate app talks to one API and nothing else. In development Vite proxies
   /staff to the local back-end; in production VITE_API_BASE points at
   api.pravesha.in and the app is served as static files. */
const API = process.env.VITE_PROXY_TARGET || 'http://localhost:5005';

/* Every build has its own id: baked into the app, and written to /version.json
   so a phone left open on an old build can tell a new one is out (src/lib/pwa.js). */
const BUILD_ID = new Date().toISOString();
const versionFile = () => ({
  name: 'pravesha-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
  },
});

export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { port: 5190, proxy: { '/staff': { target: API, changeOrigin: true } } },
  preview: { port: 5191, proxy: { '/staff': { target: API, changeOrigin: true } } },
  build: { outDir: 'dist', sourcemap: false },
});
