import { test, expect } from '@playwright/test';

test('IOCP 지식 트리에서 기초부터 구현으로 이동한다', async ({ page }) => {
  await page.goto('notes/');
  const tree = page.getByRole('navigation', { name: 'IOCP 지식 트리' });
  await tree.getByRole('link', { name: '소켓의 기다림에서 IOCP까지' }).click();
  await expect(page.locator('h1')).toHaveText('소켓의 기다림에서 IOCP까지');
  await expect(tree.locator('[aria-current="page"]')).toHaveText('소켓의 기다림에서 IOCP까지');
  await tree.getByText('02 구현 — 연결 하나를 처리하기', { exact: true }).click();
  await expect(tree.getByRole('link', { name: 'AcceptEx로 새 연결 받기' })).toBeHidden();
  await tree.getByText('02 구현 — 연결 하나를 처리하기', { exact: true }).click();
  await tree.getByRole('link', { name: 'AcceptEx로 새 연결 받기' }).click();
  await expect(tree.locator('[aria-current="page"]')).toHaveText('AcceptEx로 새 연결 받기');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
