import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Role } from '@ureducator/shared';
import { FirestoreStore } from './firestoreStore';
import type { AuthPort } from '../services/admin';
import type { Deps } from '../services/exam';

let db: Firestore | undefined;
export function firestore(): Firestore {
  if (!db) {
    if (getApps().length === 0) initializeApp();
    db = getFirestore();
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}
export const deps = (): Deps => ({ store: new FirestoreStore(firestore()), clock: Date.now });

export const authPort: AuthPort = {
  async setRole(uid: string, role: Role | null) {
    if (getApps().length === 0) initializeApp();
    const auth = getAuth();
    await auth.setCustomUserClaims(uid, role ? { role } : null);
    if (!role) await auth.revokeRefreshTokens(uid); // a demoted user loses access at the next token refresh
  },
};
export async function accessToken(): Promise<string> {
  const cred = getApp().options.credential;
  const t = await cred?.getAccessToken();
  if (!t) throw new Error('no credential');
  return t.access_token;
}
