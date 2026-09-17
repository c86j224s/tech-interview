import { test, expect } from '@playwright/test';

test('질문 없이 지식 경로에서 원리와 후속 개념으로 이동한다', async ({ page }) => {
  await page.goto('notes/');
  await page.locator('#path-event-platforms > summary').click();
  await page.locator('#path-event-platforms').getByRole('link', { name: 'Pulsar 아키텍처와 구독', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Pulsar 아키텍처와 구독');
  await expect(page.locator('#practice-questions')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '선행 개념' })).toContainText('데이터 시스템 기초');
  await page.getByRole('region', { name: '후속·관련 개념' }).getByRole('link', { name: 'Pulsar 전달·재처리 구현', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Pulsar 전달·재처리 구현');
  await expect(page.locator('time')).toHaveText('2026-09-17');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('지식 경로와 독립 문서는 JavaScript 없이 사용 가능하다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}notes/`);
    await page.locator('#path-server-io > summary').click();
    await page.locator('#path-server-io').getByRole('link', { name: 'Linux epoll 이벤트 루프', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Linux epoll 이벤트 루프');
    const link = page.getByRole('navigation', { name: '학습 노트 목차' }).locator('a[href="#section-2"]');
    await link.click();
    await expect(page).toHaveURL(/#section-2$/);
    await expect(page.locator('#practice-questions')).toHaveCount(0);
    await expect(page.getByRole('region', { name: '후속·관련 개념' })).toBeVisible();
  } finally { await context.close(); }
});
