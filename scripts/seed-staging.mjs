// Bundles functions/src/devtools/seedCli.ts to a temp file and runs it with the arguments given. See that file for the guards.
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const out = join(mkdtempSync(join(tmpdir(), 'ur-seed-')), 'seed.cjs');
await build({ entryPoints: ['functions/src/devtools/seedCli.ts'], outfile: out, bundle: true, platform: 'node', target: 'node24', format: 'cjs', sourcemap: false, logLevel: 'error' });
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
