import { ENV } from './env';
/**
 * Test-only helper: stands in for clicking the link in a verification email.
 * The check reads process.env directly (not ENV) on purpose: Next inlines it at build time, so the whole body is
 * removed from every non-mock bundle. scripts/verify-bundle.mjs fails the build if the session key below ever ships.
 */
export async function mockVerifyEmail(): Promise<void> {
  if (process.env.NEXT_PUBLIC_BACKEND !== 'mock') return;
  const raw = localStorage.getItem('ur_mock_session'); const token = raw ? (JSON.parse(raw) as { token: string }).token : '';
  await fetch(`${ENV.harnessUrl}/auth/verify`, { method: 'POST', headers: { 'x-mock-token': token } });
}
