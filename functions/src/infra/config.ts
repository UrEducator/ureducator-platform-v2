/** Deploy-time configuration. Values come from functions/.env.<projectId> (non-secret) and are validated fail-closed. */
const bool = (v: string | undefined, d = false) => (v === undefined ? d : v === 'true');
export const CONFIG = {
  env: process.env.APP_ENV ?? 'unset',
  expectedProject: process.env.EXPECTED_PROJECT_ID ?? '',
  region: process.env.APP_REGION ?? 'asia-south1',
  paymentsEnabled: bool(process.env.PAYMENTS_ENABLED),
  paymentMode: (process.env.PAYMENT_MODE ?? 'test') as 'test' | 'live',
  aiLiveEnabled: bool(process.env.AI_LIVE_ENABLED),
  enforceAppCheck: bool(process.env.ENFORCE_APP_CHECK),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  maxInstances: Number(process.env.MAX_INSTANCES ?? 10),
};

/**
 * Refuse to start in any project other than the expected one, and refuse live payment mode outside production.
 * This is what makes it hard to run staging code against production by accident.
 */
export function assertEnvironment(env: NodeJS.ProcessEnv = process.env, cfg = CONFIG): void {
  const project = env.GCLOUD_PROJECT ?? env.GOOGLE_CLOUD_PROJECT ?? '';
  const emulator = env.FUNCTIONS_EMULATOR === 'true';
  if (!cfg.expectedProject) throw new Error('EXPECTED_PROJECT_ID is not set; refusing to start.');
  if (emulator) { if (!project.startsWith('demo-') && project !== cfg.expectedProject) throw new Error('Emulator is attached to an unexpected project; refusing to start.'); }
  else if (project !== cfg.expectedProject) throw new Error(`Running in project "${project}" but configured for "${cfg.expectedProject}"; refusing to start.`);
  if (cfg.env !== 'production' && cfg.paymentMode === 'live') throw new Error('Live payment mode is not allowed outside production.');
  if (cfg.env === 'staging' && cfg.paymentsEnabled && cfg.paymentMode !== 'test') throw new Error('Staging payments must use test mode.');
}
