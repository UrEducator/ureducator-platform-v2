// Bundles the functions and the shared workspace package into one CommonJS file.
// firebase-admin and firebase-functions stay external so Cloud Build installs them from package.json.
import { build } from 'esbuild';
await build({
  entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, platform: 'node', target: 'node24', format: 'cjs',
  external: ['firebase-admin', 'firebase-admin/*', 'firebase-functions', 'firebase-functions/*'],
  sourcemap: false, minify: false, legalComments: 'none', logLevel: 'info',
});
