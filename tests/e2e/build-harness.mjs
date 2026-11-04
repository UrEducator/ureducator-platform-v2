// Bundles the local harness into one CJS file. firebase-* stay external (they are only touched by code paths the harness never runs).
import { build } from 'esbuild';
await build({
  entryPoints: ['tests/e2e/mock-server.ts'], outfile: 'tests/e2e/.build/mock-server.cjs', bundle: true, platform: 'node', target: 'node24', format: 'cjs',
  external: ['firebase-admin', 'firebase-admin/*', 'firebase-functions', 'firebase-functions/*'], sourcemap: false, logLevel: 'info',
});
