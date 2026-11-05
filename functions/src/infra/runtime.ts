import { getApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Role } from '@ureducator/shared';
import { FirestoreStore } from './firestoreStore';
import type { AuthPort } from '../services/admin';
import type { Deps } from '../services/exam';

export function defaultApp(): App {
  try {
    return getApp();
  } catch (e) {
    if ((e as { code?: unknown }).code !== 'app/no-app') throw e;
    return initializeApp();
  }
}

let db: Firestore | undefined;
export function firestore(): Firestore {
  if (!db) {
    const app = defaultApp();
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}
export function _resetRuntimeForTest(): void {
  db = undefined;
}
export const deps = (): Deps => ({ store: new FirestoreStore(firestore()), clock: Date.now });

export const authPort: AuthPort = {
  async setRole(uid: string, role: Role | null) {
    const app = defaultApp();
    const auth = getAuth(app);
    await auth.setCustomUserClaims(uid, role ? { role } : null);
    if (!role) await auth.revokeRefreshTokens(uid); // a demoted user loses access at the next token refresh
  },
};
export async function accessToken(): Promise<string> {
  const cred = defaultApp().options.credential;
  const t = await cred?.getAccessToken();
  if (!t) throw new Error('no credential');
  return t.access_token;
}
