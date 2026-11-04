// Runs the Firestore security-rules suite against the LOCAL emulator, using a demo-* project id. Works in Windows PowerShell and bash:
// no shell syntax is used here. Nothing in this script can reach a real Firebase project:
//   - the project id is demo-ureducator (the emulator needs no credentials and does not contact Google for demo projects)
//   - firebase.json binds the Firestore emulator to 127.0.0.1
//   - credential variables are removed from the child environment
// Exit codes: 0 = all rules tests passed, 1 = a test failed, 3 = a prerequisite is missing (BLOCKER, nothing was tested).
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const PROJECT = 'demo-ureducator';
const blocker = (msg) => { console.error(`\nBLOCKER: ${msg}\nNo rules were tested. Do not deploy rules until this passes.`); process.exit(3); };

const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
if (java.error || java.status !== 0) blocker('Java was not found. The Firestore emulator needs a JDK, version 21 or newer (for example Eclipse Temurin 21). Install it, open a new terminal, and run "java -version".');
const major = Number(/version "(\d+)/.exec(`${java.stderr}${java.stdout}`)?.[1] ?? 0);
if (major < 21) blocker(`Java ${major || 'unknown'} found; the Firestore emulator needs 21 or newer.`);

let firebaseBin;
try { firebaseBin = join(dirname(createRequire(import.meta.url).resolve('firebase-tools/package.json')), 'lib', 'bin', 'firebase.js'); }
catch { blocker('firebase-tools is not installed. Run "npm ci" in the repository root first.'); }

const env = { ...process.env };
for (const k of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT', 'FIRESTORE_EMULATOR_HOST']) delete env[k];

console.log(`Starting the local Firestore emulator for demo project "${PROJECT}" and running tests/rules ...`);
const r = spawnSync(process.execPath, [firebaseBin, 'emulators:exec', '--only', 'firestore', '--project', PROJECT, 'npm run test:rules:run'], { stdio: 'inherit', env });
if (r.error) blocker(`Could not start the Firebase CLI: ${r.error.message}`);
if (r.status !== 0) {
  console.error(`\nRules test run failed with exit code ${r.status}. If the log above shows the emulator could not be downloaded or started, that is an environment blocker (network access to Google download hosts, or Java); if tests are listed as failed, the rules or the tests need fixing. Either way: do not deploy rules.`);
  process.exit(1);
}
console.log('\nRules tests passed against the local emulator.');
