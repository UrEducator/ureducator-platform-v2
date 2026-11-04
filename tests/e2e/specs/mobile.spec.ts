import { test, expect } from '@playwright/test';
import { call, makeUser, reset, serverErrors, signInAs } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
test.beforeEach(async () => { await reset(); });
test.afterEach(async () => { expect(await serverErrors()).toEqual([]); });

test('phone layout: no sideways scrolling on key pages, exam palette opens as a sheet', async ({ page }) => {
  const u = await makeUser(); await call(u, 'ensureProfile', {}); await signInAs(page, u);
  const overflow = async (p: string) => { await page.goto(p); await page.waitForLoadState('networkidle'); return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); };
  for (const p of ['/', '/login', '/syllabus', '/app', '/app/tests', '/app/tests/detail?id=mt-mini', '/app/analytics', '/app/planner', '/app/mentor']) expect(await overflow(p), `${p} overflows horizontally`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'tests/e2e/shots/30-mobile-mentor.png' });
  await page.goto('/app/tests/detail?id=mt-mini'); await page.getByLabel(/I have read the instructions/).check(); await page.getByTestId('start-test').click();
  await expect(page.getByRole('heading', { name: /Question 1 of 10/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByTestId('option-c').check({ force: true });
  await page.screenshot({ path: 'tests/e2e/shots/31-mobile-exam.png' });
  await page.getByRole('button', { name: 'Question palette' }).click();
  await expect(page.getByRole('dialog', { name: 'Question palette' })).toBeVisible();
  await page.screenshot({ path: 'tests/e2e/shots/32-mobile-palette.png' });
  await page.getByRole('dialog').getByRole('button', { name: /Question 4:/ }).click();
  await expect(page.getByRole('heading', { name: /Question 4 of 10/ })).toBeVisible();
  // tap targets on the exam screen are at least 44px tall
  const small = await page.getByRole('button', { name: /Save and next|Mark for review|Previous/ }).evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 40).length);
  expect(small).toBe(0);
});
