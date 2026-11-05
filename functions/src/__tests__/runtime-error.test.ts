import { describe, expect, it, vi } from 'vitest';
import type * as adminApp from 'firebase-admin/app';

vi.mock('firebase-admin/app', async () => {
  const actual = await vi.importActual<typeof adminApp>('firebase-admin/app');
  return {
    ...actual,
    getApp: () => {
      const err = new Error('Unexpected internal error');
      (err as unknown as { code: string }).code = 'app/internal-error';
      throw err;
    },
  };
});

describe('runtime defaultApp error handling', () => {
  it('rethrows unexpected errors from getApp() when code is not app/no-app', async () => {
    const { defaultApp } = await import('../infra/runtime');
    expect(() => defaultApp()).toThrow('Unexpected internal error');
  });
});
