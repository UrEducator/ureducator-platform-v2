import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/rules/**/*.test.ts'], root: new URL('../../', import.meta.url).pathname, testTimeout: 20000 } });
