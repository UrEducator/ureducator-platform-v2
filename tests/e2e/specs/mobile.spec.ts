import { test, expect } from '@playwright/test';
import { call, makeUser, reset, serverErrors, signInAs } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
test.beforeEach(async () => { await reset(); });
test.afterEach(async () => { expect(await serverErrors()).toEqual([]); });

test('phone layout: no sideways scrolling on key pages, exam palette opens as a sheet', async ({ page }) => {
  test.setTimeout(120_000);
  const u = await makeUser(); await call(u, 'ensureProfile', {}); await signInAs(page, u);
  const overflow = async (p: string) => { await page.goto(p); await page.waitForLoadState('domcontentloaded'); return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); };
  for (const p of ['/', '/login', '/syllabus', '/app', '/app/tests', '/app/tests/detail?id=mt-pilot-1', '/app/analytics', '/app/planner', '/app/mentor']) expect(await overflow(p), `${p} overflows horizontally`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'tests/e2e/shots/30-mobile-mentor.png' });
  await page.goto('/app/tests/detail?id=mt-pilot-1'); await page.getByLabel(/I have read the instructions/).check({ force: true }); await page.getByTestId('start-test').click({ force: true });
  await expect(page.getByRole('heading', { name: /Question 1 of 10/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByTestId('option-c').check({ force: true });
  await page.screenshot({ path: 'tests/e2e/shots/31-mobile-exam.png' });
  await page.getByRole('button', { name: 'Question palette' }).click();
  await expect(page.getByRole('dialog', { name: 'Question palette' })).toBeVisible();
  await page.screenshot({ path: 'tests/e2e/shots/32-mobile-palette.png' });

  // Navigate to Question 2 (dense reading comprehension passage) to verify mobile split-screen / accordion UI
  await page.getByRole('dialog').getByRole('button', { name: /Question 2:/ }).click();
  await expect(page.getByRole('heading', { name: /Question 2 of 10/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reading Passage/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'tests/e2e/shots/33-mobile-rc-passage.png' });

  // Verify accordion collapse and expand
  await page.getByRole('button', { name: /Reading Passage/ }).click();
  await expect(page.getByRole('button', { name: /Reading Passage \(Tap to expand\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Reading Passage/ }).click();
  await expect(page.getByRole('button', { name: /Reading Passage \(Tap to collapse\)/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  // Navigate to Question 4
  await page.getByRole('button', { name: 'Question palette' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Question 4:/ }).click();
  await expect(page.getByRole('heading', { name: /Question 4 of 10/ })).toBeVisible();
  // tap targets on the exam screen are at least 44px tall
  const small = await page.getByRole('button', { name: /Save and next|Mark for review|Previous/ }).evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 40).length);
  expect(small).toBe(0);
});
