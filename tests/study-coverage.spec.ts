import { test, expect } from '@playwright/test';

test('학습 범위는 링크 유무와 본문 검토를 분리하고 검색한다', async ({ page }) => {
  await page.goto('notes/');
  await page.getByText('선택 연습 자료', { exact: true }).click();
  await page.getByRole('link', { name: '기존 질문과 학습 노트의 연결 검토 →' }).click();
  await expect(page).toHaveURL(/\/notes\/coverage\/$/);
  await expect(page.locator('[data-coverage-entry]')).toHaveCount(1500);
  await page.getByRole('searchbox').fill('condition-variable-predicate');
  await expect(page.locator('[data-coverage-family]:not([hidden])')).toHaveCount(1);
  const family = page.locator('[data-coverage-family]:not([hidden])');
  await family.locator('summary').click();
  await expect(family).toContainText('본문 검토 완료');
  await family.getByRole('link', { name: '본문 1', exact: true }).first().click();
  await expect(page).toHaveURL(/\/notes\/condition-variables\/#section-2$/);
});

test('학습 범위 전체 목록은 JavaScript 없이도 읽을 수 있다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}notes/coverage/`);
    await expect(page.locator('[data-coverage-entry]')).toHaveCount(1500);
    await page.locator('[data-coverage-family]').first().locator('summary').click();
    await expect(page.locator('[data-coverage-family]').first().locator('li').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
