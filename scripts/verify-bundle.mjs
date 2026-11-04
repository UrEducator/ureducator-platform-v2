// Scans built artefacts for things that must never ship to staging. Exits non-zero on any finding.
//   node scripts/verify-bundle.mjs functions/lib apps/web/out
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PROD_ID = /ugc-mock-test(?!-staging)/;            // production project id (the staging id merely starts with it)
const RULES = [
  { name: 'production project id', re: PROD_ID },
  { name: 'old project id ur-educator', re: /ur-educator/i },
  { name: 'live Razorpay key', re: /rzp_live_[A-Za-z0-9]+/ },
  { name: 'Razorpay secret-looking value', re: /razorpay[_-]?(key[_-]?secret|webhook[_-]?secret)["']?\s*[:=]\s*["'][A-Za-z0-9]{16,}/i },
  { name: 'private key material', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'service account JSON', re: /"type"\s*:\s*"service_account"/ },
  { name: 'Google OAuth refresh/access token', re: /\bya29\.[0-9A-Za-z_-]{20,}|1\/\/0[0-9A-Za-z_-]{30,}/ },
  { name: 'source map reference', re: /\/\/# sourceMappingURL=/ },
];
// Web bundle only: server-side concepts must not appear in browser code.
const WEB_ONLY = [
  { name: 'answer-key collection name', re: /answerKeys/ },
  { name: 'report signing key doc', re: /_reportKey/ },
  { name: 'Firebase Admin SDK', re: /firebase-admin/ },
];
const TEXT = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css', '.txt', '.map', '.xml', '.webmanifest', '.svg']);
function* walk(p) { const s = statSync(p); if (s.isFile()) { yield p; return; } for (const f of readdirSync(p)) yield* walk(join(p, f)); }

let findings = 0, files = 0;
for (const root of process.argv.slice(2)) {
  const isWeb = !/functions/.test(root);
  for (const f of walk(root)) {
    if (!TEXT.has(extname(f))) continue; files++;
    if (f.endsWith('.map')) { console.error(`FAIL  ${f}: source map shipped`); findings++; continue; }
    const text = readFileSync(f, 'utf8');
    for (const r of [...RULES, ...(isWeb ? WEB_ONLY : [])]) { const m = text.match(r.re); if (m) { findings++; console.error(`FAIL  ${f}: ${r.name} -> "${m[0].slice(0, 60)}"`); } }
  }
}
console.log(`scanned ${files} text files, ${findings} finding(s)`);
process.exit(findings ? 1 : 0);
