import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../mobile/src/api', import.meta.url)) },
  },
  test: {
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    exclude: ['**/node_modules/**', 'admin/**'],
  },
});
