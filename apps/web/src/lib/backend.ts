import type { Backend } from './types';

let instance: Promise<Backend> | null = null;
/**
 * Lazily loads exactly one backend. The condition reads process.env directly so it is replaced by a literal at build time
 * and the mock branch (and its chunk) is removed unless NEXT_PUBLIC_BACKEND=mock. scripts/verify-bundle.mjs enforces this.
 */
export function getBackend(): Promise<Backend> {
  instance ??= process.env.NEXT_PUBLIC_BACKEND === 'mock' ? import('./backend.mock').then((m) => m.createMockBackend()) : import('./backend.firebase').then((m) => m.createFirebaseBackend());
  return instance;
}
