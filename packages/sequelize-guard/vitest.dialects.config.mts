import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['src/__tests__/*.integration.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
