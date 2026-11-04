// Static guard on the rules files (runs without an emulator). It is NOT a substitute for the emulator rules tests.
import { readFileSync } from 'node:fs';
const fs = readFileSync('firestore.rules', 'utf8'); const st = readFileSync('storage.rules', 'utf8');
const fail = (m) => { console.error('FAIL ' + m); process.exitCode = 1; };
const never = ['answerKeys', 'publishedPapers', 'questions', 'examResponses', 'errorNotebook', 'learningNotes', 'reports', 'leads', 'consentRecords', 'auditLogs', 'paymentEvents', 'coupons', 'roles', 'rateLimits', 'systemSettings'];
for (const c of never) {
  const m = fs.match(new RegExp(`match /${c}/[^\\n]*`)); if (!m) { fail(`${c}: no explicit deny block`); continue; }
  if (!/allow read, write: if false;/.test(m[0])) fail(`${c}: not denied -> ${m[0]}`);
}
if (!/match \/\{document=\*\*\} \{ allow read, write: if false; \}/.test(fs)) fail('missing catch-all deny');
// No block may allow writes from clients, and "if true" is only allowed on the public catalogue.
for (const line of fs.split('\n')) {
  if (/allow (write|create|update|delete)[^;]*: if (?!false)/.test(line)) fail('client write allowed: ' + line.trim());
  if (/if true/.test(line) && !/match \/(subjects|units|topics|examBlueprints)\//.test(line)) fail('unexpected "if true": ' + line.trim());
}
if (!/allow read, write: if false;/.test(st) || /if true|request\.auth/.test(st)) fail('storage.rules must be deny-all');
if (!process.exitCode) console.log('rules lint ok');
