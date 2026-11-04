import { test, expect } from '@playwright/test';
import { call, HARNESS, makeUser, reset, serverErrors, signInAs } from './helpers';

test.beforeEach(async () => { await reset(); });
test.afterEach(async () => { expect(await serverErrors(), 'unexpected server-side errors').toEqual([]); });

test('public pages: honest labelling, no prices, not indexable, disclaimer visible', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByText(/not affiliated with or endorsed by the National Testing Agency/i).first()).toBeVisible();
  await page.screenshot({ path: 'tests/e2e/shots/15-landing.png' });
  await page.goto('/syllabus');
  await expect(page.getByText('Under development').first()).toBeVisible();
  await expect(page.locator('main').getByText('Fully verified', { exact: true })).toHaveCount(0);   // nothing is claimed as verified yet
  await page.screenshot({ path: 'tests/e2e/shots/16-syllabus.png' });
  await page.goto('/pricing');
  await expect(page.getByText('No prices have been published')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('₹');
  const robots = await (await request.get('/robots.txt')).text(); expect(robots).toMatch(/Disallow: \//);
  await page.goto('/this-page-does-not-exist'); await expect(page.getByRole('heading', { name: /does not exist/i })).toBeVisible();
});

test('lead form records consent, and the endpoint is rate limited per address', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your name').first().fill('Ravi Kumar'); await page.getByLabel('Email address').first().fill('ravi@example.test');
  await page.getByRole('button', { name: 'Notify me' }).click();
  await expect(page.getByText('Tick the box to agree to be contacted.')).toBeVisible();            // no consent, no record
  await page.getByLabel(/I agree that UrEducator may email me/).check(); await page.getByRole('button', { name: 'Notify me' }).click();
  await expect(page.getByText('You are on the list')).toBeVisible();
  const noConsent = await fetch(`${HARNESS}/call/captureLead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x', email: 'x@example.test', consent: false }) });
  expect(noConsent.status).toBe(400);
  let limited = 0; for (let i = 0; i < 8; i++) { const r = await fetch(`${HARNESS}/call/captureLead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'bot', email: `b${i}@example.test`, consent: true }) }); if ((await r.json()).error?.code === 'resource-exhausted') limited++; }
  expect(limited).toBeGreaterThan(0);
});

test('signed-out visitors are sent to sign in and then back; open redirects are refused', async ({ page }) => {
  await page.goto('/app/tests'); await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ftests/);
  const u = await makeUser();
  await page.goto('/login?next=https://evil.example/steal');
  await page.getByLabel('Email address').fill(u.email); await page.getByLabel('Password').fill(u.password); await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/app$/);
  await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/);
  await page.goto('/login?next=/app/history');
  await page.getByLabel('Email address').fill(u.email); await page.getByLabel('Password').fill(u.password); await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/app\/history$/);
});

test('an unconfirmed email can browse but cannot start a test or use the mentor', async ({ page }) => {
  const u = await makeUser({ verified: false }); await signInAs(page, u);
  await page.goto('/app/tests'); await expect(page).toHaveURL(/verify-email/);
  const start = await call(u, 'startExam', { mockTestId: 'mt-mini', language: 'en', clientRequestId: 'r1' }); expect(start.body.error?.code === undefined ? 'ok' : start.body.error.reason).not.toBe('ok');
  const ask = await call(u, 'askMentor', { question: 'what is sampling', mode: 'concept' }); expect(ask.body.error?.reason).toBe('EMAIL_NOT_VERIFIED');
});

test('students cannot call staff endpoints or assign themselves a role', async () => {
  const u = await makeUser();
  for (const [n, d] of [['adminList', { collection: 'leads' }], ['adminUpsertCatalogue', { kind: 'topic', id: 'x', unitId: 'p1-teaching', subjectId: 'paper1', name: { en: 'x' } }], ['adminPublishMockTest', { mockTestId: 'mt-mini' }], ['assignRole', { uid: 'someone', role: 'owner' }], ['claimOwner', {}]] as const) {
    const r = await call(u, n, d); expect(r.body.error, n).toBeTruthy(); expect(['permission-denied', 'invalid-argument', 'failed-precondition']).toContain((r.body.error as unknown as { code: string }).code);
  }
  const unauth = await fetch(`${HARNESS}/call/startExam`, { method: 'POST', body: JSON.stringify({ mockTestId: 'mt-mini', language: 'en', clientRequestId: 'z' }) });
  expect(unauth.status).toBe(400); expect((await unauth.json()).error.code).toBe('unauthenticated');
  const reads = await fetch(`${HARNESS}/read/results?uid=someone-else`, { headers: { 'x-mock-token': 'bogus' } }); expect(reads.status).toBe(403);
});
