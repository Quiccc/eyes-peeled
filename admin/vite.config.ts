import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Express server serves the build at /admin-panel/ (same origin as the API).
// In dev, Vite proxies the admin API to the server. The key is a regex on purpose: a plain "/admin"
// prefix would also match "/admin-panel" and proxy the panel itself.
export default defineConfig({
  base: '/admin-panel/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '^/admin/': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: true },
      '^/files/': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: true },
    },
  },
});
