// Builds dist/functions: the bundle plus a minimal package.json with ONLY the runtime dependencies, so Cloud Build never needs the workspace.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const out = 'dist/functions';
if (!existsSync('functions/lib/index.js')) throw new Error('Run "npm run build -w functions" first.');
rmSync(out, { recursive: true, force: true }); mkdirSync(out + '/lib', { recursive: true });
cpSync('functions/lib/index.js', out + '/lib/index.js');
const src = JSON.parse(readFileSync('functions/package.json', 'utf8'));
writeFileSync(out + '/package.json', JSON.stringify({ name: 'ureducator-functions', version: src.version, private: true, main: 'lib/index.js', engines: { node: '24' }, dependencies: src.dependencies }, null, 2) + '\n');
for (const f of ['.env.ugc-mock-test-staging']) if (existsSync('functions/' + f)) cpSync('functions/' + f, out + '/' + f);
execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: out, stdio: 'inherit' });
console.log('prepared', out);
