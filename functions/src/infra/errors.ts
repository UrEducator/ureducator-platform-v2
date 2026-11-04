export type ErrorCode =
  | 'invalid-argument' | 'unauthenticated' | 'permission-denied' | 'not-found' | 'already-exists'
  | 'failed-precondition' | 'resource-exhausted' | 'unavailable' | 'internal' | 'aborted';
/** Safe, client-visible error. `reason` is a stable machine code; message never contains internals. */
export class AppError extends Error {
  constructor(public code: ErrorCode, public reason: string, message?: string) { super(message ?? reason); }
}
export const err = (code: ErrorCode, reason: string, message?: string) => new AppError(code, reason, message);
