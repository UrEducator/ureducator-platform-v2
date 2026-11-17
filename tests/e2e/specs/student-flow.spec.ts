import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectNoConsoleErrors, reset, serverErrors } from './helpers';

test.beforeEach(async () => { await reset(); });
test.afterEach(async () => { expect(await serverErrors(), 'unexpected server-side errors').toEqual([]); });

const shot = (page: Page, name: string) => page.screenshot({ path: `tests/e2e/shots/${name}.png`, fullPage: false });

test('new student: sign up, confirm email, take the demo test, read the result, use notebook, planner and mentor', async ({ page }) => {
  await expectNoConsoleErrors(page, async () => {
    // --- sign up
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Asha Verma');
    await page.getByLabel('Email address').fill('asha@example.test');
    await page.getByLabel('Password').fill('correct-horse-9');
    await page.getByLabel(/I have read the/).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/verify-email/);
    await shot(page, '01-verify-email');
    await page.getByRole('button', { name: /simulate clicking the email link/ }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: /Welcome back, Asha/i })).toBeVisible();
    await shot(page, '02-dashboard-empty');

    // --- pick a test
    await page.getByRole('link', { name: 'Mock tests' }).first().click();
    await expect(page.getByRole('heading', { name: 'Mock tests' })).toBeVisible();
    await expect(page.getByText('Fully verified').first()).toBeVisible();
    await shot(page, '03-test-list');
    await page.locator('a[href$="id=mt-pilot-1"]').click();
    await expect(page.getByText(/The test has 10 questions for 20 marks and lasts 15 minutes/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start test' })).toBeDisabled();
    await page.getByLabel(/I have read the instructions/).check();
    await shot(page, '04-instructions');
    await page.getByTestId('start-test').click();

    // --- sit the test. No answer key may reach the browser while the test is running.
    const leaked: string[] = [];
    page.on('response', async (r) => { if (r.url().includes(':4010/call/') || r.url().includes(':4010/read/')) { const t = await r.text().catch(() => ''); if (/"correct"\s*:\s*\[|"explanation"/.test(t) && !r.url().includes('getExamResult')) leaked.push(r.url()); } });
    await expect(page.getByRole('heading', { name: /Question 1 of 10/ })).toBeVisible();
    await shot(page, '05-exam-q1');
    const answer = async (opt: string | null, o: { mark?: boolean } = {}) => {
      if (opt) await page.getByTestId(`option-${opt}`).check({ force: true });
      if (o.mark) await page.getByTestId('mark').click();
      await page.getByTestId('save-next').click({ trial: false }).catch(() => undefined);
    };
    await answer('c'); await answer('b'); await answer('a');
    await expect(page.getByRole('heading', { name: /Question 4 of 10/ })).toBeVisible();
    await answer('a', { mark: true });                 // wrong and marked
    await answer('d');
    await expect(page.getByRole('heading', { name: /Question 6 of 10/ })).toBeVisible();
    await answer(null);                                 // skipped
    await answer('a'); await answer('b');
    await expect(page.getByRole('heading', { name: /Question 9 of 10/ })).toBeVisible();
    await answer('c');                                  // wrong
    await shot(page, '06-exam-q9');
    await page.getByRole('button', { name: /Question 10/ }).first().click().catch(async () => { await page.getByTestId('save-next').click(); });
    expect(leaked, 'answers leaked during the exam').toEqual([]);

    // --- submit
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('submit-summary')).toContainText('Answered');
    await shot(page, '07-submit-dialog');
    await page.getByTestId('confirm-submit').click();
    await expect(page).toHaveURL(/\/app\/results\?s=/, { timeout: 20_000 });
    await expect(page.getByTestId('score')).toContainText('12');
    await expect(page.getByTestId('score-card')).toContainText('/ 20');
    await shot(page, '08-result');

    // --- review is open (immediate policy) and shows the answer key and explanations
    await expect(page.getByRole('heading', { name: 'Question review' })).toBeVisible();
    await expect(page.getByText('Explanation').first()).toBeVisible();
    await expect(page.getByText('Your answer, correct').first()).toBeVisible();
    // Review language toggle temporarily hidden for English-only pilot (T-1)
    // await page.getByRole('button', { name: 'हिन्दी' }).click();
    // await expect(page.getByText('URL का पूर्ण रूप क्या है?')).toBeVisible();
    // await page.locator('#rq-3').scrollIntoViewIfNeeded();
    // await shot(page, '09-result-review-hindi');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download report/ }).click();
    const file = await dl; const path = await file.path();
    const bytes = (await import('node:fs')).readFileSync(path!); expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); expect(bytes.length).toBeGreaterThan(2000);

    // --- history lists it
    await page.getByRole('link', { name: 'History' }).click();
    await expect(page.getByRole('cell', { name: 'Demo mini test' })).toBeVisible();
    await expect(page.getByText('12 / 20 (60%)')).toBeVisible();

    // --- error notebook has the wrong and the flagged question; revising one reschedules it
    await page.getByRole('link', { name: 'Error notebook' }).click();
    await expect(page.getByTestId('notebook-entry')).toHaveCount(2);
    await shot(page, '10-notebook');
    await page.getByTestId('notebook-entry').first().getByRole('button', { name: 'Revise' }).click();
    await page.getByRole('button', { name: 'Show the answer' }).click();
    await shot(page, '11-notebook-revise');
    await page.getByTestId('rate-4').click();
    await expect(page.getByText(/Next:/).first()).toBeVisible();

    // --- planner
    await page.getByRole('link', { name: 'Planner' }).click();
    await page.getByRole('button', { name: 'Create my plan' }).click();
    await expect(page.getByText(/tasks done/)).toBeVisible();
    await expect(page.getByText('Weekly timed mock test and error review')).toBeVisible();
    await shot(page, '12-planner');

    // --- mentor answers from a verified note and cites it
    await page.getByRole('link', { name: 'Study mentor' }).click();
    await page.getByLabel('Your question').fill('What is stratified sampling and why is it probability sampling?');
    await page.getByRole('button', { name: 'Ask the mentor' }).click();
    await expect(page.getByTestId('mentor-turn')).toContainText('[1]');
    await expect(page.getByTestId('mentor-turn')).toContainText('Probability and non-probability sampling');
    await shot(page, '13-mentor');
  });
});

test('key pages have no automatically detectable accessibility violations', async ({ page }) => {
  for (const path of ['/', '/login', '/signup', '/syllabus', '/pricing']) {
    await page.goto(path); await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(r.violations.map((v) => `${path}: ${v.id} (${v.nodes.length})`), path).toEqual([]);
  }
});
