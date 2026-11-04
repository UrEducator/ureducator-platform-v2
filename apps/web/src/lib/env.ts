/**
 * Build-time configuration. NEXT_PUBLIC_* values are inlined into the static export, so they must contain nothing secret.
 * Everything here fails closed: a staging build refuses to run against any project other than the staging project.
 */
const pub = {
  backend: process.env.NEXT_PUBLIC_BACKEND ?? 'firebase',
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? 'staging',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  functionsRegion: process.env.NEXT_PUBLIC_FUNCTIONS_REGION ?? 'asia-south1',
  appCheckSiteKey: process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY ?? '',
  harnessUrl: process.env.NEXT_PUBLIC_HARNESS_URL ?? 'http://127.0.0.1:4010',
};

export const EXPECTED_STAGING_PROJECT = 'ugc-mock-test-staging';
export const ENV = {
  ...pub,
  backend: pub.backend === 'mock' ? ('mock' as const) : ('firebase' as const),
  isStaging: pub.appEnv !== 'production',
  /** Staging and local test builds are never indexable. */
  noindex: pub.appEnv !== 'production',
  paymentsUiEnabled: false as const, // checkout UI stays off until the owner authorises the payment phase
};

export function assertClientEnv(): string | null {
  if (ENV.backend === 'mock') return pub.appEnv === 'local-test' ? null : 'The mock backend is only allowed in local test builds.';
  if (pub.appEnv === 'staging' && pub.projectId !== EXPECTED_STAGING_PROJECT) return `This staging build is configured for "${pub.projectId || 'no project'}" instead of ${EXPECTED_STAGING_PROJECT}.`;
  if (!pub.apiKey || !pub.appId) return 'Firebase web configuration is missing.';
  return null;
}
