import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { createUserWithEmailAndPassword, getAuth, getIdTokenResult, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ENV } from './env';
import { ApiError, type AuthService, type AuthUser, type Backend, type Reads } from './types';

function app() {
  if (getApps().length) return getApp();
  const a = initializeApp({ apiKey: ENV.apiKey, appId: ENV.appId, authDomain: ENV.authDomain, projectId: ENV.projectId, messagingSenderId: ENV.messagingSenderId });
  // App Check is requested in monitor mode: tokens are attached when a site key is configured; the server does not enforce yet.
  if (ENV.appCheckSiteKey) initializeAppCheck(a, { provider: new ReCaptchaEnterpriseProvider(ENV.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  return a;
}

async function toUser(u: User | null): Promise<AuthUser | null> {
  if (!u) return null;
  const t = await getIdTokenResult(u);
  return { uid: u.uid, email: u.email, displayName: u.displayName, emailVerified: u.emailVerified, role: typeof t.claims.role === 'string' ? t.claims.role : null };
}
const authErr = (e: unknown): ApiError => {
  if (e instanceof ApiError) return e;
  const c = (e as { code?: string })?.code ?? '';
  const message = (e as { message?: string })?.message;
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is not correct.',
    'auth/wrong-password': 'Email or password is not correct.',
    'auth/user-not-found': 'No account found with this email address.',
    'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
    'auth/weak-password': 'Choose a password with at least 8 characters.',
    'auth/too-many-requests': 'Too many failed login attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Network connection problem. Check your internet connection and try again.',
    'auth/operation-not-allowed': 'Email sign-in is not switched on for this environment yet.',
    'auth/invalid-email': 'Please enter a valid email address.',
  };
  return new ApiError('auth', c || 'AUTH', map[c] ?? message ?? 'Could not complete that. Please try again.');
};

export function getClientFirestore() {
  return getFirestore(app());
}

export function createFirebaseBackend(): Backend {
  const a = app(); const auth = getAuth(a); const db = getFirestore(a); const fns = getFunctions(a, ENV.functionsRegion);

  const authService: AuthService = {
    onChange: (cb) => onAuthStateChanged(auth, (u) => { void toUser(u).then(cb).catch(() => cb(null)); }),
    async signUp(email, password, name) {
      try { const c = await createUserWithEmailAndPassword(auth, email, password); await updateProfile(c.user, { displayName: name }); await sendEmailVerification(c.user); } catch (e) { throw authErr(e); }
    },
    async signIn(email, password) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new ApiError(
                  'auth',
                  'TIMEOUT',
                  'Sign-in request timed out. Please check your network connection and try again.'
                )
              ),
            15000
          )
        );
        await Promise.race([
          signInWithEmailAndPassword(auth, email, password),
          timeoutPromise,
        ]);
      } catch (e) {
        throw authErr(e);
      }
    },
    async signOut() { await signOut(auth); },
    async sendReset(email) { try { await sendPasswordResetEmail(auth, email); } catch (e) { const x = authErr(e); if (x.reason === 'auth/user-not-found') return; throw x; } },
    async resendVerification() { if (auth.currentUser) try { await sendEmailVerification(auth.currentUser); } catch (e) { throw authErr(e); } },
    async refresh() { if (!auth.currentUser) return null; await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return toUser(auth.currentUser); },
  };

  const withId = <T,>(s: { id: string; data(): unknown }) => ({ id: s.id, ...(s.data() as object) }) as T;
  const get1 = async <T,>(path: string, id: string) => { const s = await getDoc(doc(db, path, id)); return s.exists() ? (s.data() as T) : null; };
  const reads: Reads = {
    async catalogue() {
      const [s, u, t] = await Promise.all(['subjects', 'units', 'topics'].map((c) => getDocs(collection(db, c))));
      return { subjects: s!.docs.map((d) => withId<never>(d)), units: u!.docs.map((d) => withId<never>(d)), topics: t!.docs.map((d) => withId<never>(d)) };
    },
    async publishedTests() { return (await getDocs(query(collection(db, 'mockTests'), where('status', '==', 'published')))).docs.map((d) => withId<never>(d)); },
    async blueprints() { return Object.fromEntries((await getDocs(collection(db, 'examBlueprints'))).docs.map((d) => [d.id, d.data() as never])); },
    async publishedPlans() { return (await getDocs(query(collection(db, 'plans'), where('published', '==', true)))).docs.map((d) => withId<never>(d)); },
    profile: (uid) => get1('users', uid),
    async attempts(uid) { return (await getDocs(query(collection(db, 'examSessions'), where('uid', '==', uid), orderBy('startedAtMs', 'desc'), limit(50)))).docs.map((d) => withId<never>(d)); },
    async results(uid) { return (await getDocs(query(collection(db, 'results'), where('uid', '==', uid), orderBy('submittedAtMs', 'desc'), limit(50)))).docs.map((d) => withId<never>(d)); },
    snapshot: (uid) => get1('performanceSnapshots', uid),
    studyPlan: (uid) => get1('studyPlans', uid),
    subscription: (uid) => get1('subscriptions', uid),
  };

  return {
    kind: 'firebase', auth: authService, reads,
    async call(name, data) {
      try {
        const res = await httpsCallable(fns, name, { timeout: 30_000 })(data);
        return res.data as never;
      } catch (e) {
        const x = e as { code?: string; message?: string; details?: { reason?: string; correlationId?: string } };
        const code = (x.code ?? 'unknown').replace(/^functions\//, '');
        throw new ApiError(code, x.details?.reason ?? (code === 'unavailable' || code === 'deadline-exceeded' ? 'NETWORK' : 'UNKNOWN'), x.message && x.details?.reason ? x.message : 'Something went wrong. Please try again.', x.details?.correlationId);
      }
    },
  };
}
