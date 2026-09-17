import { test, expect } from '@playwright/test';

test('전체 기술 트리에서 운영체제와 IOCP로 내려간다', async ({ page }) => {
  await page.goto('notes/');
  const tree = page.getByRole('navigation', { name: '기술 지식 트리' });
  for (const id of ['computer-science', 'operating-systems', 'io', 'iocp']) {
    await tree.locator(`#knowledge-${id} > summary`).click();
  }
  await tree.getByRole('link', { name: '소켓 I/O 기초', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('소켓 I/O 기초');
  await page.locator('.knowledge-navigation > summary').click();
  await expect(tree.locator('[aria-current="page"]')).toHaveText('소켓 I/O 기초');
  await expect(tree.getByLabel('현재 문서 경로')).toContainText('컴퓨터 과학');
  await expect(tree.getByLabel('현재 문서 경로')).toContainText('운영체제');
  await tree.getByRole('link', { name: 'AcceptEx 접속 수락', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('AcceptEx 접속 수락');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('전체 기술 트리는 JavaScript 없이 펼치고 문서에 접근할 수 있다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}notes/`);
    const tree = page.getByRole('navigation', { name: '기술 지식 트리' });
    for (const id of ['languages', 'python', 'python-values']) await tree.locator(`#knowledge-${id} > summary`).click();
    await expect(tree.getByRole('link', { name: /Python 기본값/ })).toBeVisible();
    await tree.locator('#knowledge-python > summary').click();
    await expect(tree.getByRole('link', { name: /Python 기본값/ })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await context.close();
  }
});
