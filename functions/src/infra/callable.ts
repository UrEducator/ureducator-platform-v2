import { randomUUID } from 'node:crypto';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import type { SecretParam } from 'firebase-functions/params';
import { CONFIG, assertEnvironment } from './config';
import { authPort, deps } from './runtime';
import { dispatch, type EndpointDef } from './dispatch';

let checked = false;
/** Cloud Functions adapter: environment guard, App Check visibility, structured logs, and mapping of safe errors to HttpsError. */
export function callable(name: string, def: EndpointDef, secrets: SecretParam[] = []) {
  return onCall(
    {
      region: CONFIG.region, maxInstances: CONFIG.maxInstances, minInstances: 0, cpu: 1, concurrency: 40,
      memory: def.memory ?? '512MiB', timeoutSeconds: def.timeoutSeconds ?? 30,
      cors: CONFIG.allowedOrigins.length ? CONFIG.allowedOrigins : false,
      enforceAppCheck: CONFIG.enforceAppCheck, ...(secrets.length ? { secrets } : {}),
    },
    async (req: CallableRequest) => {
      const t0 = Date.now();
      const cid = String(req.rawRequest.headers['x-request-id'] ?? '').slice(0, 64) || randomUUID();
      if (!checked) { assertEnvironment(); checked = true; }
      const tok = req.auth?.token;
      const who = req.auth ? { uid: req.auth.uid, emailVerified: tok?.email_verified === true, role: typeof tok?.role === 'string' ? tok.role : undefined, email: tok?.email } : null;
      const out = await dispatch(name, def, req.data, who, {
        d: deps(), auth: authPort, ip: req.rawRequest.ip ?? 'unknown', cid, secret: (n) => secrets.find((s) => s.name === n)?.value() ?? null,
        onError: (id, e) => logger.error('callable.failed', { name, cid: id, error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : 'unknown' }),
      });
      if (out.ok) { logger.info('callable.ok', { name, cid, uid: who?.uid ?? 'anonymous', ms: Date.now() - t0, appCheck: req.app ? 'present' : 'missing' }); return out.data; }
      logger.warn('callable.rejected', { name, cid, reason: out.error.reason, ms: Date.now() - t0 });
      throw new HttpsError(out.error.code, out.error.message, { reason: out.error.reason, correlationId: out.error.correlationId });
    },
  );
}
