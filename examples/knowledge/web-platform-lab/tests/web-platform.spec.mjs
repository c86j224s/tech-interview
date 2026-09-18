import { test, expect } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

test.beforeEach(async ({ page }) => {
  await page.goto(baseURL);
});

test('accordion exposes a coherent accessible state and measures CSSOM', async ({ page }) => {
  const trigger = page.locator('#accordion-trigger');
  const panel = page.locator('#accordion-panel');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect(page.locator('#metric-display')).not.toHaveText('-');
  await expect(page.locator('#metric-rect')).toContainText('×');
});

test('component variants alter computed padding without replacing semantics', async ({ page }) => {
  const trigger = page.locator('#accordion-trigger');
  await page.locator('[data-variant="dense"]').click();
  const densePadding = await trigger.evaluate((node) => getComputedStyle(node).paddingBlockStart);
  await page.locator('[data-variant="warning"]').click();
  const warningPadding = await trigger.evaluate((node) => getComputedStyle(node).paddingBlockStart);
  expect(densePadding).not.toBe(warningPadding);
  await expect(trigger).toHaveAttribute('type', 'button');
  await expect(trigger).toHaveAttribute('aria-controls', 'accordion-panel');
});

test('failure injection is diagnosed and repair restores the contract', async ({ page }) => {
  await page.locator('#inject-failure').click();
  await expect(page.locator('#diagnostic')).toContainText('FAIL');
  await page.locator('#repair-contract').click();
  await expect(page.locator('#diagnostic')).toContainText('PASS');
});

test('mobile viewport keeps the page within the viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.reload();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
