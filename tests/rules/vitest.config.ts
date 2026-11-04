import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// fileURLToPath (not URL.pathname) so the repository root resolves correctly on Windows ("C:\..." rather than "/C:/...").
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    root: fileURLToPath(new URL('../../', import.meta.url)),
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
