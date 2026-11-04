import { test, expect, type Page } from '@playwright/test';
import { advanceClock, call, makeUser, reset, serverErrors, signInAs } from './helpers';

test.beforeEach(async () => { await reset(); });
test.afterEach(async () => { expect(await serverErrors(), 'unexpected server-side errors').toEqual([]); });

const startMini = async (page: Page, id = 'mt-mini') => {
  await page.goto(`/app/tests/detail?id=${id}`);
  await page.getByLabel(/I have read the instructions/).check();
  await page.getByTestId('start-test').click();
  await expect(page.getByRole('heading', { name: /Question 1 of 10/ })).toBeVisible();
};

test('answers survive a reload and the timer keeps running on the server clock', async ({ page }) => {
  const u = await makeUser(); await signInAs(page, u); await startMini(page);
  await page.getByTestId('option-c').check({ force: true });
  await expect(page.getByText(/All answers saved/)).toBeVisible();
  await page.getByTestId('save-next').click(); await page.getByTestId('option-b').check({ force: true });
  await expect(page.getByText(/All answers saved/)).toBeVisible();
  const before = await page.getByTestId('timer').textContent();
  await advanceClock(5 * 60_000);                                 // five minutes pass on the server
  await page.reload();
  await expect(page.getByRole('heading', { name: /Question \d of 10/ })).toBeVisible();
  const after = await page.getByTestId('timer').textContent();
  const secs = (t: string | null) => { const [h, m, s] = (t ?? '0:0:0').split(':').map(Number); return h! * 3600 + m! * 60 + s!; };
  expect(secs(before) - secs(after)).toBeGreaterThanOrEqual(5 * 60 - 3);   // the clock advanced, no restart
  await page.getByRole('button', { name: /Question 1: Answered/ }).first().click();
  await expect(page.getByTestId('option-c')).toBeChecked();
  await page.getByRole('button', { name: /Question 2: Answered/ }).first().click();
  await expect(page.getByTestId('option-b')).toBeChecked();
});

test('going offline keeps answers on the device and syncs them when the connection returns', async ({ page, context }) => {
  const u = await makeUser(); await signInAs(page, u); await startMini(page);
  await page.getByTestId('option-c').check({ force: true });
  await expect(page.getByText(/All answers saved/)).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('save-next').click(); await page.getByTestId('option-b').check({ force: true });
  await expect(page.getByText(/offline|Not saved|Saving/i).first()).toBeVisible({ timeout: 20_000 });
  await context.setOffline(false);
  await expect(page.getByText(/All answers saved/)).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await page.getByRole('button', { name: /Question 2: Answered/ }).first().click();
  await expect(page.getByTestId('option-b')).toBeChecked();
});

test('the test submits itself when time runs out and the result says so', async ({ page }) => {
  await page.clock.install({ time: new Date() });
  const u = await makeUser(); await signInAs(page, u); await startMini(page);
  await page.getByTestId('option-c').check({ force: true });
  await expect(page.getByText(/All answers saved/)).toBeVisible();
  await advanceClock(16 * 60_000);                                // server clock passes the 15 minute deadline
  await page.clock.fastForward(16 * 60_000);
  await expect(page).toHaveURL(/\/app\/results\?s=/, { timeout: 30_000 });
  await expect(page.getByText(/automatically when time ran out/)).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('2');     // the answer saved before the deadline counts
});

test('a late submit cannot add answers after the deadline, and a second submit is idempotent', async () => {
  const u = await makeUser();
  const s = await call(u, 'startExam', { mockTestId: 'mt-mini', language: 'en', clientRequestId: 'req-a1' });
  const sid = s.body.data.sessionId as string;
  const again = await call(u, 'startExam', { mockTestId: 'mt-mini', language: 'en', clientRequestId: 'req-a1' });
  expect(again.body.data.sessionId).toBe(sid);                    // same request id: same session, no second attempt
  await call(u, 'saveResponses', { sessionId: sid, seq: 1, responses: [{ qid: 'dq-research-sampling', selected: ['c'], visited: true, marked: false, timeSpentMs: 3000 }] });
  await advanceClock(20 * 60_000);
  const late = await call(u, 'submitExam', { sessionId: sid, clientRequestId: 'req-s1', finalSeq: 2, reason: 'manual', responses: [{ qid: 'dq-ethics-plagiarism', selected: ['d'], visited: true, marked: false, timeSpentMs: 1000 }] });
  expect(late.status).toBe(200);
  const r = await call(u, 'getExamResult', { sessionId: sid });
  expect(r.body.data.summary.correct).toBe(1);                    // only the answer saved before the deadline
  const dup = await call(u, 'submitExam', { sessionId: sid, clientRequestId: 'req-s2', finalSeq: 2, reason: 'manual' });
  expect(dup.body.data.alreadySubmitted).toBe(true);
});

test('with "answers open later" the score is shown but the answer key stays locked until the window closes', async ({ page }) => {
  const u = await makeUser(); await signInAs(page, u); await startMini(page, 'mt-mini-late');
  await page.getByTestId('option-c').check({ force: true });                                   // correct
  await page.getByTestId('save-next').click(); await page.getByTestId('option-a').check({ force: true });   // wrong: lands in the notebook, but only once review opens
  await expect(page.getByText(/All answers saved/)).toBeVisible();
  await page.getByTestId('open-submit').click(); await page.getByTestId('confirm-submit').click();
  await expect(page).toHaveURL(/\/app\/results\?s=/);
  await expect(page.getByTestId('score')).toContainText('2');
  await expect(page.getByText('Answers and explanations are not open yet')).toBeVisible();
  await expect(page.getByText('Explanation', { exact: true })).toHaveCount(0);
  // the API refuses too, not just the UI
  const sid = new URL(page.url()).searchParams.get('s')!;
  const nb = await call(u, 'listNotebook', {}); expect(nb.body.data.entries).toEqual([]); expect(nb.body.data.hidden).toBeGreaterThan(0);
  const ask = await call(u, 'askMentor', { question: 'Explain this question', mode: 'question_explanation', ref: { sessionId: sid, qid: 'dq-research-sampling' } });
  expect(ask.body.error?.reason).toBe('ANSWERS_LOCKED');
  await advanceClock(2 * 86_400_000);
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('heading', { name: 'Question review' })).toBeVisible();
  await expect(page.getByText('Explanation').first()).toBeVisible();
});

test("one student cannot read or finish another student's session", async () => {
  const a = await makeUser(); const b = await makeUser();
  const s = await call(a, 'startExam', { mockTestId: 'mt-mini', language: 'en', clientRequestId: 'req-x1' });
  const sid = s.body.data.sessionId as string;
  for (const [name, data] of [['getExamSession', { sessionId: sid }], ['saveResponses', { sessionId: sid, seq: 1, responses: [{ qid: 'dq-research-sampling', selected: ['a'], visited: true, marked: false, timeSpentMs: 1 }] }], ['submitExam', { sessionId: sid, clientRequestId: 'req-x2', finalSeq: 0, reason: 'manual' }], ['getExamResult', { sessionId: sid }], ['generateReport', { sessionId: sid }]] as const) {
    const r = await call(b, name, data); expect(r.body.error?.reason, name).toBe('SESSION_NOT_FOUND');
  }
});

test('the 150-question full-length format loads with the 50 + 100 layout, 300 marks and 180 minutes', async ({ page }) => {
  const u = await makeUser(); await signInAs(page, u);
  await page.goto('/app/tests/detail?id=mt-full');
  await expect(page.getByText('The test has 150 questions for 300 marks and lasts 180 minutes.')).toBeVisible();
  await page.getByLabel(/I have read the instructions/).check(); await page.getByTestId('start-test').click();
  await expect(page.getByRole('heading', { name: /Question 1 of 150/ })).toBeVisible();
  await expect(page.getByTestId('timer')).toHaveText(/^03:00:0\d$|^02:59:5\d$/);
  await expect(page.getByRole('tab', { name: /Paper I.*\(50\)/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Paper II.*\(100\)/ })).toBeVisible();
  await page.screenshot({ path: 'tests/e2e/shots/14-exam-full-150.png' });
});
