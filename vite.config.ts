import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const API = process.env.VITE_API_PROXY || 'http://localhost:4000';
// When previewing behind an HTTPS reverse proxy (e.g. *.e2b.app), the HMR websocket must use the public port.
const hmrClientPort = process.env.HMR_CLIENT_PORT ? Number(process.env.HMR_CLIENT_PORT) : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    hmr: hmrClientPort ? { clientPort: hmrClientPort, protocol: 'wss' } : undefined,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
    },
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
