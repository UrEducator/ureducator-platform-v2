/**
 * Writes the SYNTHETIC demo catalogue, papers and mock tests into Firestore. Never imported by index.ts, so it is not deployed.
 *
 *   staging:   node scripts/seed-staging.mjs --project ugc-mock-test-staging --confirm-write-synthetic-staging-data
 *   emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-staging.mjs --project demo-ureducator --emulator
 *
 * Guards: the project must be exactly the staging project (or a demo-* project against the emulator), and the confirmation
 * flag is required. Anything else exits without touching Firestore. Everything written is labelled `sample`.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreStore } from '../infra/firestoreStore';
import { seedDemo } from './demoSeed';

const STAGING_PROJECT = 'ugc-mock-test-staging';
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const value = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const fail = (m: string): never => { console.error(`REFUSED: ${m}`); process.exit(2); };

const project = value('--project');
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!project) fail('--project is required (no default project is ever used).');
if (flag('--emulator')) {
  if (!emulatorHost) fail('--emulator needs FIRESTORE_EMULATOR_HOST to be set.');
  if (!project!.startsWith('demo-')) fail('the emulator may only be used with a demo-* project id.');
} else {
  if (emulatorHost) fail('FIRESTORE_EMULATOR_HOST is set; pass --emulator or unset it.');
  if (project !== STAGING_PROJECT) fail(`only ${STAGING_PROJECT} may be seeded; got "${project}".`);
  if (!flag('--confirm-write-synthetic-staging-data')) fail('add --confirm-write-synthetic-staging-data to write synthetic sample data to staging.');
}
for (const k of ['GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT']) {
  const v = process.env[k];
  if (v && v !== project) fail(`${k}="${v}" disagrees with --project "${project}".`);
}

const app = initializeApp({ projectId: project });
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
console.log(`Seeding synthetic sample content into "${project}"${flag('--emulator') ? ' (emulator)' : ''} ...`);
seedDemo(new FirestoreStore(db), Date.now()).then(() => { console.log('Done. Mock tests: mt-mini, mt-mini-late, mt-full (all labelled sample).'); process.exit(0); }, (e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
