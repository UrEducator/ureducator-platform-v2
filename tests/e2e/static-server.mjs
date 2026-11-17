// Local server for the Playwright E2E suite using Next.js production server with mock backend.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const port = process.argv[3] ?? '3100';
const root = process.cwd();
const webDir = join(root, 'apps', 'web');
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

const env = {
  ...process.env,
  NEXT_PUBLIC_BACKEND: 'mock',
  NEXT_PUBLIC_APP_ENV: 'local-test',
  NEXT_PUBLIC_HARNESS_URL: 'http://127.0.0.1:4010',
  NODE_ENV: 'production',
  PORT: String(port),
};

if (!existsSync(join(webDir, '.next-mock', 'BUILD_ID'))) {
  console.log('[static-server] Building Next.js mock app (.next-mock)...');
  execFileSync(process.execPath, [nextBin, 'build'], {
    cwd: webDir,
    stdio: 'inherit',
    env,
  });
}

console.log(`[static-server] Starting Next.js server on port ${port}...`);
const child = spawn(
  process.execPath,
  [nextBin, 'start', '-p', String(port)],
  {
    cwd: webDir,
    stdio: 'inherit',
    env,
  }
);

child.on('error', (err) => {
  console.error('[static-server] Next.js process error:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== null && code !== 0) {
    process.exit(code);
  }
});

const cleanup = () => {
  if (!child.killed) {
    child.kill('SIGTERM');
  }
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
