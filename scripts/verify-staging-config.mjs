// Config gate: proves the deployment configuration targets ONLY the staging project and keeps every risky feature off.
// Read-only and offline. Exits 1 if any check fails.   Usage: node scripts/verify-staging-config.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STAGING = 'ugc-mock-test-staging';
const SITE_URL = `https://${STAGING}.web.app`;
const results = [];
const check = (ok, label, detail = '') => results.push({ ok, label, detail });
const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

/* .firebaserc: only staging, and no default project (so an unqualified command fails instead of guessing) */
const rc = json('.firebaserc');
check(Object.values(rc.projects ?? {}).length > 0 && Object.values(rc.projects).every((v) => v === STAGING), '.firebaserc: every alias is the staging project');
check(!('default' in (rc.projects ?? {})), '.firebaserc: no default project (unqualified commands cannot hit anything)');
check(!rc.targets && !rc.etags, '.firebaserc: no hosting targets or etags pointing elsewhere');

/* firebase.json */
const fj = json('firebase.json');
check(fj.hosting?.site === STAGING, `firebase.json: hosting.site is "${STAGING}"`);
check(fj.hosting?.public === 'apps/web/out', 'firebase.json: hosting serves apps/web/out (never the mock export out-mock)');
check(fj.firestore?.location === 'asia-south1', 'firebase.json: Firestore location asia-south1');
check(fj.firestore?.rules === 'firestore.rules' && fj.storage?.rules === 'storage.rules', 'firebase.json: rules files are the repository rules');
const fn = Array.isArray(fj.functions) ? fj.functions[0] : fj.functions;
check(fn?.source === 'dist/functions' && fn?.runtime === 'nodejs24', 'firebase.json: Functions from dist/functions on nodejs24');
const hdr = (fj.hosting?.headers ?? []).flatMap((h) => h.headers ?? []);
check(hdr.some((h) => h.key === 'X-Robots-Tag' && /noindex/.test(h.value)), 'firebase.json: X-Robots-Tag noindex on every response');
check(hdr.some((h) => h.key === 'Content-Security-Policy'), 'firebase.json: Content-Security-Policy header present');
const emu = fj.emulators ?? {};
const loop = (h) => h === '127.0.0.1' || h === 'localhost';
const bad = Object.entries(emu).filter(([, v]) => v && typeof v === 'object' && 'port' in v && !loop(v.host));
check(bad.length === 0, 'firebase.json: every emulator is bound to localhost', bad.map(([k]) => k).join(', '));
check(!!emu.firestore && !!emu.hub && !!emu.logging, 'firebase.json: firestore, hub and logging emulators declared with explicit hosts');

/* Storage rules: deny-all */
const st = read('storage.rules');
check(/allow read, write: if false;/.test(st) && !/if true|request\.auth/.test(st), 'storage.rules: deny-all');

/* Functions environment file */
const envDir = 'functions';
const envFiles = readdirSync(envDir).filter((f) => f.startsWith('.env'));
check(envFiles.every((f) => f === '.env.ugc-mock-test-staging' || f === '.env.example'), 'functions: only the staging env file (and the example) exist', envFiles.join(', '));
const envPath = join(envDir, '.env.ugc-mock-test-staging');
check(existsSync(envPath), 'functions/.env.ugc-mock-test-staging exists');
if (existsSync(envPath)) {
  const env = Object.fromEntries(read(envPath).split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const ALLOWED = ['APP_ENV', 'EXPECTED_PROJECT_ID', 'APP_REGION', 'PAYMENTS_ENABLED', 'PAYMENT_MODE', 'AI_LIVE_ENABLED', 'ENFORCE_APP_CHECK', 'ALLOWED_ORIGINS', 'PUBLIC_BASE_URL', 'MAX_INSTANCES', 'OWNER_BOOTSTRAP_EMAIL', 'AI_MODEL'];
  check(Object.keys(env).every((k) => ALLOWED.includes(k)), 'env file: only known non-secret keys', Object.keys(env).filter((k) => !ALLOWED.includes(k)).join(', '));
  check(!Object.values(env).some((v) => /rzp_|-----BEGIN|AIza|ya29\./.test(v)), 'env file: no key-looking values');
  check(env.APP_ENV === 'staging', 'env: APP_ENV=staging');
  check(env.EXPECTED_PROJECT_ID === STAGING, `env: EXPECTED_PROJECT_ID=${STAGING}`);
  check(env.APP_REGION === 'asia-south1', 'env: APP_REGION=asia-south1');
  check(env.PAYMENTS_ENABLED === 'false', 'env: PAYMENTS_ENABLED=false');
  check(env.PAYMENT_MODE === 'test', 'env: PAYMENT_MODE=test');
  check(env.AI_LIVE_ENABLED === 'false', 'env: AI_LIVE_ENABLED=false (mock provider only)');
  check(env.ENFORCE_APP_CHECK === 'false', 'env: ENFORCE_APP_CHECK=false (monitor mode)');
  check(Number(env.MAX_INSTANCES) > 0 && Number(env.MAX_INSTANCES) <= 5, `env: MAX_INSTANCES<=5 (is ${env.MAX_INSTANCES})`);
  check(env.PUBLIC_BASE_URL === SITE_URL, `env: PUBLIC_BASE_URL=${SITE_URL}`);
  const origins = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  check(origins.length > 0 && origins.every((o) => o === SITE_URL || o === `https://${STAGING}.firebaseapp.com`), 'env: ALLOWED_ORIGINS are only the two staging origins');
  check('OWNER_BOOTSTRAP_EMAIL' in env, 'env: OWNER_BOOTSTRAP_EMAIL key present', env.OWNER_BOOTSTRAP_EMAIL ? 'SET (a verified owner identity was supplied)' : 'EMPTY (owner claiming is disabled)');
  if (existsSync('dist/functions/.env.ugc-mock-test-staging')) check(read('dist/functions/.env.ugc-mock-test-staging') === read(envPath), 'dist/functions env file equals functions env file');
}
/* The minimum/maximum instance settings live in code: minInstances must be 0 */
const callable = read('functions/src/infra/callable.ts');
check(/minInstances:\s*0/.test(callable), 'callable.ts: minInstances: 0');
check(/maxInstances:\s*CONFIG\.maxInstances/.test(callable), 'callable.ts: maxInstances comes from MAX_INSTANCES');
/* No production identifiers in deployment configuration or build scripts */
const PROD = /ugc-mock-test(?!-staging)|ur-educator/;
const cfgFiles = ['.firebaserc', 'firebase.json', 'firestore.indexes.json', 'storage.rules', 'firestore.rules', 'functions/package.json', 'apps/web/package.json', 'package.json', 'scripts/prepare-deploy.mjs', 'scripts/seed-staging.mjs', 'scripts/test-rules.mjs'];
for (const d of ['apps/web']) for (const f of readdirSync(d)) if (/^\.env/.test(f)) cfgFiles.push(join(d, f));
if (existsSync(envPath)) cfgFiles.push(envPath);
const hits = cfgFiles.filter((f) => existsSync(f) && PROD.test(read(f)));
check(hits.length === 0, 'deployment config: no production or old-project identifier', hits.join(', '));
const webEnv = readdirSync('apps/web').filter((f) => /^\.env/.test(f) && f !== '.env.example');
check(webEnv.length === 0, 'apps/web: no committed .env files (public config is passed at build time)', webEnv.join(', '));
/* Source: nothing but tests may name a production project */
function* walk(p) { if (statSync(p).isFile()) { yield p; return; } for (const f of readdirSync(p)) { if (['node_modules', '.next', 'out', 'out-mock', 'lib', '.build', 'shots'].includes(f)) continue; yield* walk(join(p, f)); } }
const srcHits = [];
for (const root of ['functions/src', 'packages/shared/src', 'apps/web/src']) for (const f of walk(root)) if (/\.(ts|tsx|js|mjs|json)$/.test(f) && !f.includes('__tests__') && PROD.test(read(f))) srcHits.push(f);
check(srcHits.length === 0, 'source (excluding tests): no production or old-project identifier', srcHits.join(', '));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? `  [${r.detail}]` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} config checks passed`);
process.exit(failed ? 1 : 0);
