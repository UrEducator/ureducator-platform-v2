import { test, expect, type Page } from '@playwright/test';
import { call, HARNESS, makeUser, reset, serverErrors, signInAs } from './helpers';

test.beforeEach(async () => { await reset(); });
test.afterEach(async () => { expect(await serverErrors(), 'unexpected server-side errors').toEqual([]); });
const shot = (page: Page, name: string) => page.screenshot({ path: `tests/e2e/shots/${name}.png` });

async function asUser(page: Page, u: Awaited<ReturnType<typeof makeUser>>) { await call(u, 'ensureProfile', {}); await signInAs(page, u); }

test('owner bootstrap works once, only for the configured verified email, and a student sees no staff area', async ({ page, browser }) => {
  const stranger = await makeUser();
  expect((await call(stranger, 'claimOwner', {})).body.error?.reason).toBe('FORBIDDEN');
  await asUser(page, stranger); await page.goto('/admin');
  await expect(page.getByText('Staff access only')).toBeVisible(); await shot(page, '20-staff-only');

  // the configured owner address (harness OWNER_BOOTSTRAP_EMAIL) but not yet verified: refused
  const res = await fetch(`${HARNESS}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.test', password: 'correct-horse-9', name: 'Subhash' }) });
  const t = (await res.json()) as { token: string };
  const unverified = await fetch(`${HARNESS}/call/claimOwner`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-token': t.token }, body: '{}' });
  expect((await unverified.json()).error.reason).toBe('EMAIL_NOT_VERIFIED');
  await fetch(`${HARNESS}/__setRole`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.test', role: null, verified: true }) });
  const fresh = (await (await fetch(`${HARNESS}/auth/refresh`, { method: 'POST', headers: { 'x-mock-token': t.token } })).json()) as { token: string; user: unknown };
  const ownerPage = await (await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })).newPage();
  await ownerPage.addInitScript((s) => { if (!localStorage.getItem('ur_mock_session')) localStorage.setItem('ur_mock_session', JSON.stringify(s)); }, fresh);
  await ownerPage.goto('/app/claim-owner'); await ownerPage.getByTestId('claim-owner').click();
  await expect(ownerPage.getByText('You are now the owner.')).toBeVisible();
  await ownerPage.getByRole('link', { name: 'Open the content studio' }).click();
  await expect(ownerPage.getByRole('heading', { name: 'Overview' })).toBeVisible(); await shot(ownerPage, '21-admin-overview');
  // a second claim is refused even for the same address
  const again = await fetch(`${HARNESS}/call/claimOwner`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-token': ((await (await fetch(`${HARNESS}/auth/refresh`, { method: 'POST', headers: { 'x-mock-token': fresh.token } })).json()) as { token: string }).token }, body: '{}' });
  expect((await again.json()).error.reason).toBe('OWNER_ALREADY_CLAIMED');

  // the owner gives the first student a content-editor role from the people page
  await ownerPage.goto('/admin/people');
  const row = ownerPage.getByRole('row').filter({ hasText: stranger.email });
  await row.getByLabel('Role').selectOption('content_editor'); await row.getByRole('button', { name: 'Apply' }).click();
  await expect(ownerPage.getByText(/Role set to Content editor/)).toBeVisible(); await shot(ownerPage, '22-admin-people');
  expect((await call(stranger, 'adminOverview', {})).body.error?.reason).toBe('FORBIDDEN');   // the old token carries no role yet
  const refreshed = (await (await fetch(`${HARNESS}/auth/refresh`, { method: 'POST', headers: { 'x-mock-token': stranger.session.token } })).json()) as { token: string };
  expect((await fetch(`${HARNESS}/call/adminOverview`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-token': refreshed.token }, body: '{}' })).status).toBe(200);
  // the owner cannot be demoted, and nobody can mint another owner
  expect((await call(stranger, 'assignRole', { uid: 'x', role: 'owner' })).body.error).toBeTruthy();
});

test('content pipeline: editor writes, reviewer approves, admin publishes, student sits the test', async ({ browser }) => {
  const ctx = async (u: Awaited<ReturnType<typeof makeUser>>) => { const c = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' }); const p = await c.newPage(); await asUser(p, u); return p; };
  const editor = await makeUser({ role: 'content_editor', name: 'Edith Editor' }); const reviewer = await makeUser({ role: 'subject_reviewer', name: 'Rhea Reviewer' }); const adm = await makeUser({ role: 'admin', name: 'Anil Admin' }); const student = await makeUser({ name: 'Sita Student' });

  // --- editor: blueprint, question
  const ed = await ctx(editor);
  await ed.goto('/admin/blueprints');
  await ed.getByLabel('Identifier').fill('e2e-one'); await ed.getByLabel('Name', { exact: true }).fill('E2E one question'); await ed.getByLabel('Duration (minutes)').fill('5');
  await ed.getByRole('button', { name: 'Remove section' }).last().click(); await ed.getByLabel('Questions').first().fill('1'); await ed.getByLabel('Title').first().fill('Paper I');
  await ed.getByRole('button', { name: 'Save blueprint' }).click(); await expect(ed.getByText(/Saved version 1/)).toBeVisible(); await shot(ed, '23-admin-blueprints');

  await ed.goto('/admin/questions/edit');
  await ed.getByLabel('Subject').selectOption('paper1'); await ed.getByLabel('Unit').selectOption('p1-teaching'); await ed.getByLabel('Topic').selectOption('p1-teaching-methods');
  await ed.getByLabel('Question (English)').fill('Which activity is a formative assessment?');
  for (const [k, t] of [['A', 'Final board exam'], ['B', 'In-class quiz with feedback'], ['C', 'Annual result'], ['D', 'Entrance test']]) await ed.getByLabel(`Option ${k} (English)`).fill(t);
  await ed.getByRole('radio', { name: 'B is correct' }).check(); await ed.getByLabel('Explanation (English)').fill('Formative assessment gives feedback while learning is under way.');
  await ed.getByTestId('save-question').click(); await expect(ed).toHaveURL(/questions\/edit\?id=/);
  await shot(ed, '24-question-editor');
  await expect(ed.getByTestId('move-approved')).toHaveCount(0);                       // an editor cannot approve
  await ed.getByTestId('move-review').click(); await expect(ed.getByText('Status is now “In review”.')).toBeVisible();
  const qid = new URL(ed.url()).searchParams.get('id')!;

  // --- reviewer approves; the author could not
  const rv = await ctx(reviewer); await rv.goto(`/admin/questions/edit?id=${qid}`);
  await expect(rv.getByTestId('save-question')).toBeVisible();
  await rv.getByTestId('move-approved').click(); await expect(rv.getByText('Status is now “Approved”.')).toBeVisible();
  await expect(rv.getByTestId('move-published')).toHaveCount(0);                      // a reviewer cannot publish

  // --- admin publishes the question, then builds and publishes the test
  const ad = await ctx(adm); await ad.goto(`/admin/questions/edit?id=${qid}`);
  await ad.getByTestId('move-published').click(); await expect(ad.getByText('Status is now “Published”.')).toBeVisible();
  await ad.goto('/admin/tests/edit'); await expect(ad.getByLabel('Blueprint')).toBeVisible();
  await ad.getByLabel('Title', { exact: true }).fill('E2E published test'); await ad.getByLabel('Blueprint').selectOption('e2e-one');
  await expect(ad.getByTestId('save-test')).toBeDisabled();                           // no question chosen yet
  await ad.getByText(/Add questions to this section/).click(); await ad.getByRole('button', { name: /Add: Which activity/ }).click();
  await ad.getByTestId('save-test').click(); await expect(ad.getByText(/Saved as a draft/)).toBeVisible(); await shot(ad, '25-test-editor');
  await ad.goto('/admin/tests'); await ad.getByRole('button', { name: 'Publish', exact: true }).click(); await expect(ad.getByText(/Published\. Students can now start/)).toBeVisible();

  // --- the student sees it, sits it and gets the server's score
  const st = await ctx(student); await st.goto('/app/tests'); await st.getByText('E2E published test').click();
  await st.getByLabel(/I have read the instructions/).check(); await st.getByTestId('start-test').click();
  await expect(st.getByText('Which activity is a formative assessment?')).toBeVisible();
  await st.getByTestId('option-b').check({ force: true }); await st.getByTestId('open-submit').click(); await st.getByTestId('confirm-submit').click();
  await expect(st.getByTestId('score')).toContainText('2'); await expect(st.getByText('Formative assessment gives feedback')).toBeVisible();
  // the audit log recorded the steps without the answer
  const owner = await makeUser({ role: 'owner' }); const log = await call(owner, 'adminList', { collection: 'auditLogs', limit: 50 });
  const actions = (log.body.data.items as { action: string }[]).map((x) => x.action); for (const a of ['question.save', 'question.review', 'question.approved', 'question.published', 'mocktest.publish', 'blueprint.upsert']) expect(actions).toContain(a);
  expect(JSON.stringify(log.body.data)).not.toContain('Final board exam');
});

test('each staff role sees only its own areas, and the server refuses the rest', async ({ page }) => {
  const support = await makeUser({ role: 'support_agent' }); await asUser(page, support);
  await page.goto('/admin'); const nav = page.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link', { name: 'Support' })).toBeVisible(); await expect(nav.getByRole('link', { name: 'Questions' })).toHaveCount(0); await expect(nav.getByRole('link', { name: 'Pricing' })).toHaveCount(0);
  for (const [n, d] of [['adminList', { collection: 'orders', limit: 5 }], ['adminList', { collection: 'auditLogs', limit: 5 }], ['adminGetQuestion', { questionId: 'x' }], ['adminUpsertPlan', { planId: 'p', name: 'Plan', pricePaise: 100, durationDays: 30, entitlements: ['all'], published: false }]] as const) expect((await call(support, n, d)).body.error?.reason, n).toBe('FORBIDDEN');
  await page.goto('/admin/support'); await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible();
  const adm = await makeUser({ role: 'admin' });
  const plan = { planId: 'p1', name: 'Plan', pricePaise: 100, durationDays: 30, entitlements: ['all'] };
  expect((await call(adm, 'adminUpsertPlan', { ...plan, published: true })).body.error?.reason).toBe('FORBIDDEN');    // pricing is not an admin duty at all
  expect((await call(adm, 'adminUpsertPlan', { ...plan, published: false })).body.error?.reason).toBe('FORBIDDEN');
  const sup = await makeUser({ role: 'super_admin' });
  expect((await call(sup, 'adminUpsertPlan', { ...plan, published: false })).status).toBe(200);                       // a super administrator can draft a price
  const author = await call(adm, 'adminSaveQuestion', { meta: { subjectId: 'paper1', unitId: 'p1-teaching', topicId: 'p1-teaching-methods', difficulty: 'easy', languages: ['en'] }, version: { content: { type: 'mcq_single', stem: { en: 'Q' }, options: [{ id: 'a', text: { en: 'x' } }, { id: 'b', text: { en: 'y' } }] }, correct: ['a'], provenance: { kind: 'original', copyrightStatus: 'own_work', officialPyqVerified: false } } });
  const q = author.body.data as { questionId: string; version: number };
  await call(adm, 'adminTransitionQuestion', { questionId: q.questionId, version: q.version, to: 'review' });
  expect((await call(adm, 'adminTransitionQuestion', { questionId: q.questionId, version: q.version, to: 'approved' })).body.error?.reason).toBe('SEPARATION_OF_DUTIES');
});
