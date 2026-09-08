import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const index = JSON.parse(fs.readFileSync('question-index.json', 'utf8'));

test('히어로 홈에서 연습을 시작하고 주제별 질문을 탐색한다', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('알고 있다면,');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: '한 질문, 시작하기' }).click();
  await expect(page).toHaveURL(/\/practice\/$/);
  await expect(page.locator('h1')).toHaveText(index[0].question);
  await page.getByRole('link', { name: '말로 풀어보는 CS 홈' }).click();
  await page.locator('.topic-ribbon').getByRole('link', { name: '네트워크' }).click();
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(2);
});

test('질문을 먼저 보고 답변을 펼친 뒤 다른 질문으로 이동한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('practice/');
  await expect(page.locator('h1')).toHaveText(index[0].question);
  await expect(page.locator('#answer')).not.toHaveAttribute('open', '');
  await page.locator('#answer > summary').click();
  await expect(page.locator('#answer-0')).toBeVisible();
  await expect(page.locator('#answer-1 li')).toHaveCount(4);
  await expect(page.locator('#answer-2 li')).toHaveCount(4);
  await expect(page.locator('#answer-3 li')).toHaveCount(4);
  await page.getByRole('button', { name: '다른 질문 뽑기' }).click();
  await expect(page).toHaveURL(/\/questions\/(?!async-api-and-blocking)[a-z-]+\/$/);
  await expect(page.locator('#answer')).not.toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('종이 넘김이 끝난 뒤 반복 이동과 뒤로 가기가 동작한다', async ({ page }) => {
  await page.goto('practice/');
  await page.getByRole('button', { name: '다른 질문 뽑기' }).click();
  await expect(page.locator('.paper-turn-overlay')).toBeAttached();
  await expect(page.locator('.paper-turn-front .related-section')).toBeAttached();
  await expect(page.locator('.paper-turn-front .question-card')).toBeAttached();
  await expect(page.locator('.paper-turn-overlay')).toHaveCount(0);
  const first = page.url();
  await page.getByRole('button', { name: '다른 질문 뽑기' }).click();
  await expect(page.locator('.paper-turn-overlay')).toBeAttached();
  await expect(page.locator('.paper-turn-front .related-section')).toBeAttached();
  await expect(page.locator('.paper-turn-front .question-card')).toBeAttached();
  await expect(page.locator('.paper-turn-overlay')).toHaveCount(0);
  expect(page.url()).not.toBe(first);
  await page.goBack();
  await expect(page).toHaveURL(first);
  await expect(page.locator('.question-card')).toBeVisible();
});

test('모션 감소 설정에서는 종이 효과 없이 질문을 이동한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('practice/');
  await page.getByRole('button', { name: '다른 질문 뽑기' }).click();
  await expect(page).toHaveURL(/\/questions\//);
  await expect(page.locator('.paper-turn-overlay')).toHaveCount(0);
});

test('검색, 카테고리, 태그, 빈 결과와 초기화가 동작한다', async ({ page }) => {
  await page.goto('library/');
  const cards = page.locator('[data-question-card]:visible');
  await expect(cards).toHaveCount(index.length);
  await page.getByRole('button', { name: '분산 시스템' }).click();
  await expect(cards).toHaveCount(3);
  await page.getByRole('searchbox', { name: '질문 검색' }).fill('타임아웃');
  await expect(cards).toHaveCount(1);
  await page.getByLabel('태그 선택').selectOption('TCP');
  await expect(cards).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.getByRole('button', { name: '전체 질문 보기' }).click();
  await expect(cards).toHaveCount(index.length);
  await page.getByRole('searchbox', { name: '질문 검색' }).fill('IOCP');
  await expect(cards).toHaveCount(1);
  await page.reload();
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole('searchbox', { name: '질문 검색' })).toHaveValue('IOCP');
});

test('모든 문항 주소와 연관 링크가 열리고 모바일에서 넘치지 않는다', async ({ page }) => {
  for (const entry of index) {
    const response = await page.goto(`questions/${entry.id}/`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(entry.question);
    await page.locator('summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const links = await page.locator('.related-card').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
    for (const link of links) expect(index.some((item: { id: string }) => link?.endsWith(`/questions/${item.id}/`))).toBe(true);
  }
});

test('직접 태그 링크, 답변 앵커와 테마 유지가 동작한다', async ({ page }) => {
  await page.goto('library/?tag=TCP');
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(1);
  await page.goto('questions/async-api-and-blocking/#answer-2');
  await expect(page.locator('#answer-2')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: '다크 모드로 전환' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '라이트 모드로 전환' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('저장소 접근이 차단돼도 화면과 테마 전환이 동작한다', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('practice/');
  await expect(page.locator('h1')).toBeVisible();
  await page.locator('.theme-toggle').click();
  await page.locator('summary').click();
  await expect(page.locator('#answer-0')).toBeVisible();
  expect(errors).toEqual([]);
});
