import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';

const setCustomUserClaimsMock = vi.fn();
const revokeRefreshTokensMock = vi.fn();
let capturedApp: App | undefined;

vi.mock('firebase-admin/auth', () => ({
  getAuth: (app?: App) => {
    capturedApp = app;
    return {
      setCustomUserClaims: setCustomUserClaimsMock,
      revokeRefreshTokens: revokeRefreshTokensMock,
    } as unknown as Auth;
  },
}));

describe('runtime authPort with named SDK app', () => {
  afterEach(async () => {
    for (const app of getApps()) {
      await deleteApp(app);
    }
    vi.clearAllMocks();
    capturedApp = undefined;
  });

  it('authPort.setRole() resolves default app and sets custom claims even with named app present', async () => {
    initializeApp({ projectId: 'ugc-mock-test-staging' }, '__FIREBASE_FUNCTIONS_SDK__');
    expect(getApps().length).toBe(1);

    const { authPort } = await import('../infra/runtime');
    await authPort.setRole('user-123', 'owner');

    expect(capturedApp).toBeDefined();
    expect(capturedApp?.name).toBe('[DEFAULT]');
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith('user-123', { role: 'owner' });
    expect(revokeRefreshTokensMock).not.toHaveBeenCalled();
  });

  it('authPort.setRole(uid, null) clears custom claims and revokes refresh tokens', async () => {
    const { authPort } = await import('../infra/runtime');
    await authPort.setRole('user-123', null);

    expect(setCustomUserClaimsMock).toHaveBeenCalledWith('user-123', null);
    expect(revokeRefreshTokensMock).toHaveBeenCalledWith('user-123');
  });
});
