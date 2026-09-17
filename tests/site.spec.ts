import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import matter from 'gray-matter';

const noteFiles = fs.readdirSync('notes', { recursive: true }).filter((file) => String(file).endsWith('.md'));
const noteContent = noteFiles.map((file) => matter(fs.readFileSync(`notes/${file}`, 'utf8')));
const noteCount = noteContent.length;
const index = JSON.parse(fs.readFileSync('question-index.json', 'utf8'));
const content = index.map((entry: { id: string; question: string }) => ({
  ...entry,
  ...matter(fs.readFileSync(`questions/${entry.id}.md`, 'utf8')).data,
}));
const firstQuestion = index.find((entry: { id: string }) => entry.id === 'async-api-and-blocking');
const categoryCount = (category: string) => content.filter((entry: { category: string }) => entry.category === category).length;
const tagCount = (tag: string) => content.filter((entry: { tags: string[] }) => entry.tags.includes(tag)).length;

test('히어로 홈에서 연습을 시작하고 주제별 질문을 탐색한다', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('알고 있다면,');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: '한 질문, 시작하기' }).click();
  await expect(page).toHaveURL(/\/questions\/[a-z0-9-]+\/$/);
  const selectedId = await page.locator('body').getAttribute('data-current-id');
  await expect(page.locator('h1')).toHaveText(index.find((entry: { id: string }) => entry.id === selectedId).question);
  await page.getByRole('link', { name: '말로 풀어보는 CS 홈' }).click();
  await page.locator('.topic-ribbon').getByRole('link', { name: '네트워크' }).click();
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(categoryCount('네트워크'));
});

test('질문을 먼저 보고 답변을 펼친 뒤 다른 질문으로 이동한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('practice/');
  await expect(page.locator('h1')).toHaveText(firstQuestion.question);
  await expect(page.locator('#answer')).not.toHaveAttribute('open', '');
  await page.locator('#answer > summary').click();
  await expect(page.locator('#answer-0')).toBeVisible();
  await expect(page.locator('#answer-1 li')).toHaveCount(4);
  await expect(page.locator('#answer-2 li')).toHaveCount(4);
  await expect(page.locator('#answer-3 li')).toHaveCount(4);
  await page.getByRole('button', { name: '다른 질문 뽑기' }).click();
  await expect(page).toHaveURL(/\/questions\/(?!async-api-and-blocking)[a-z0-9-]+\/$/);
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

test('랜덤 덱은 새로고침과 일반 이동 뒤에도 최근 질문을 반복하지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('practice/');
  const seen = new Set([firstQuestion.id]);
  for (let i = 0; i < 15; i++) {
    const previous = page.url();
    await page.getByRole('button', { name: '다른 질문 뽑기' }).click();
    await page.waitForURL((url) => url.href !== previous && /\/questions\/[a-z0-9-]+\/$/.test(url.pathname));
    const id = await page.locator('body').getAttribute('data-current-id');
    expect(seen.has(id)).toBe(false);
    seen.add(id);
    if (i === 5) await page.reload();
  }
  const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('cs-question-deck-v1') || '{}'));
  expect(state.remaining.length).toBe(index.length - seen.size);
});

test('저장소가 막혀도 랜덤 이동은 현재 질문을 제외한다', async ({ page }) => {
  await page.addInitScript(() => {
    for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(window, key, { get() { throw new Error('blocked'); } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('practice/');
  await page.getByRole('button', { name: '다른 질문 뽑기' }).click();
  await expect(page).toHaveURL(/\/questions\/(?!async-api-and-blocking)[a-z0-9-]+\/$/);
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
  await expect(cards).toHaveCount(categoryCount('분산 시스템'));
  await page.getByRole('searchbox', { name: '질문 검색' }).fill('요청이 타임아웃됐을 때');
  await expect(cards).toHaveCount(1);
  await page.getByLabel('태그 선택').selectOption('TCP');
  await expect(cards).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.getByRole('button', { name: '전체 질문 보기' }).click();
  await expect(cards).toHaveCount(index.length);
  await page.getByRole('searchbox', { name: '질문 검색' }).fill('IOCP');
  const iocpCount = content.filter((entry) => `${entry.title} ${entry.category} ${entry.tags.join(' ')}`.toLowerCase().includes('iocp')).length;
  await expect(cards).toHaveCount(iocpCount);
  await page.reload();
  await expect(cards).toHaveCount(iocpCount);
  await expect(page.getByRole('searchbox', { name: '질문 검색' })).toHaveValue('IOCP');
});

test('모든 문항 주소와 연관 링크가 열리고 모바일에서 넘치지 않는다', async ({ page }) => {
  test.setTimeout(Math.max(30_000, index.length * 1_000));
  for (const entry of index) {
    const response = await page.goto(`questions/${entry.id}/`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(entry.question);
    await page.locator('summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const proseText = await page.locator('.prose').evaluateAll((sections) => sections.map((section) => {
      const copy = section.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('pre, code').forEach((node) => node.remove());
      return copy.textContent || '';
    }).join('\n'));
    expect(proseText, `${entry.id}: 볼드 구분자 노출`).not.toContain('**');
    const source = content.find((item: { id: string }) => item.id === entry.id);
    if (source.answerMinutes === 5) {
      await expect(page.locator('.question-meta')).toContainText('5분 답변 목표 · 보강본');
      await expect(page.locator('.followup-prompt')).toHaveText(source.followups.map((item: { prompt: string }) => item.prompt));
    }
    const links = await page.locator('.related-card').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
    for (const link of links) expect(index.some((item: { id: string }) => link?.endsWith(`/questions/${item.id}/`))).toBe(true);
    if (source.followups?.length === 3) {
      expect(links.map((link) => link?.split('/').filter(Boolean).at(-1))).toEqual(source.followups.map((item: { id: string }) => item.id));
    }
  }
});

test('난이도와 기술 필터를 조합하고 주소로 복원한다', async ({ page }) => {
  await page.goto('library/');
  await page.getByLabel('난이도', { exact: true }).selectOption('중하');
  await page.getByLabel('태그 선택').selectOption('IOCP');
  const expected = content.filter((entry) => entry.difficulty === '중하' && entry.tags.includes('IOCP')).length;
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(expected);
  await page.reload();
  await expect(page.getByLabel('난이도', { exact: true })).toHaveValue('중하');
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(expected);
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(index.length);
  await page.goto('questions/jps-plus-preprocessing/');
  await expect(page.getByRole('link', { name: '난이도 중하' })).toBeVisible();
  await page.getByRole('link', { name: '난이도 중하' }).click();
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(content.filter((entry) => entry.difficulty === '중하').length);
});

test('직접 태그 링크, 답변 앵커와 테마 유지가 동작한다', async ({ page }) => {
  await page.goto('library/?tag=TCP');
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(tagCount('TCP'));
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

test('꼬리 질문의 조건을 읽고 다음 문항으로 이어간다', async ({ page }) => {
  await page.goto('questions/async-api-and-blocking/');
  await expect(page.locator('.question-meta')).toContainText('5분 답변 목표 · 보강본');
  const followup = page.locator('.related-card').first();
  await expect(followup.locator('.related-category')).toContainText('꼬리 질문');
  await expect(followup.locator('.followup-prompt')).toContainText('DB 대기 요청이 쌓입니다');
  await followup.click();
  await expect(page).toHaveURL(/\/questions\/bounded-queue-backpressure\/$/);
  await expect(page.locator('#answer')).not.toHaveAttribute('open', '');
  await page.locator('.related-card').first().click();
  await expect(page).toHaveURL(/\/questions\/deadline-cancellation-propagation\/$/);
  await page.goBack();
  await expect(page.locator('h1')).toHaveText(index.find((entry: { id: string }) => entry.id === 'bounded-queue-backpressure').question);
  await page.goto('questions/binary-search-boundary/');
  const binary = content.find((entry: { id: string }) => entry.id === 'binary-search-boundary');
  await expect(page.locator('.question-meta')).toContainText(binary.answerMinutes === 5 ? '5분 답변 목표 · 보강본' : '핵심 답변');
  await expect(page.locator('.related-card .followup-prompt')).toHaveCount(binary.followups?.length || 0);
});

test('JavaScript 없이도 보강 답변과 꼬리 질문 링크를 읽는다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}questions/transactional-outbox/`);
    await expect(page.getByRole('complementary', { name: '콘텐츠 이용 안내' })).toContainText('AI 모델의 학습·훈련 데이터로 사용하지 마세요.');
    await page.locator('summary').click();
    await expect(page.locator('.spoken-answer')).toContainText('이중 쓰기(dual write)');
    await page.locator('.related-card').first().click();
    await expect(page).toHaveURL(/\/questions\/message-consumer-idempotency\/$/);
    await expect(page.locator('#answer')).not.toHaveAttribute('open', '');
  } finally {
    await context.close();
  }
});

test('꼬리 질문에서 독립 문항으로 이동하고 원문 맥락으로 돌아온다', async ({ page }) => {
  await page.goto('questions/atomics-memory-order/');
  await page.locator('summary').click();
  await page.locator('#answer-3 a[href$="/cpp-release-sequence-visibility/"]').click();
  await expect(page.locator('.question-meta')).toContainText('꼬리 질문에서 확장 · 핵심 답변');
  await page.locator('summary').click();
  await expect(page.locator('.spoken-answer')).toContainText('release sequence');
  await page.locator('.promotion-origin a').click();
  await expect(page).toHaveURL(/\/questions\/atomics-memory-order\/$/);
  await page.goto('library/?tag=' + encodeURIComponent('심화 질문'));
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(500);
});

test('질문에서 학습 노트의 원리·슈도코드를 읽고 연습으로 돌아온다', async ({ page }) => {
  await page.goto('questions/quicksort-worst-case/');
  await page.getByRole('region', { name: '관련 학습 노트' }).getByRole('link', { name: '퀵소트의 분할과 최악 시간' }).click();
  await expect(page).toHaveURL(/\/notes\/quicksort\/$/);
  await expect(page.locator('.note-body pre')).toContainText('partition(a, lo, hi)');
  await page.getByRole('navigation', { name: '학습 노트 목차' }).getByRole('link', { name: '슈도코드', exact: true }).click();
  await expect(page).toHaveURL(/#section-3$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#practice-questions a[href$="/quicksort-worst-case/"]').click();
  await expect(page).toHaveURL(/\/questions\/quicksort-worst-case\/$/);
  await page.goto('questions/introsort-depth-fallback/');
  await expect(page.locator('.question-notes')).toContainText('퀵소트의 분할과 최악 시간');
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '학습 노트' }).click();
  await expect(page.locator('.note-card')).toHaveCount(noteCount);
});

test('모든 학습 노트가 JavaScript 없이도 목차·본문·연습 링크를 제공한다', async ({ browser, baseURL }) => {
  test.setTimeout(Math.max(30_000, noteCount * 1_000));
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}notes/`);
    const links = await page.locator('.note-card h2 a').evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).href));
    expect(links.length).toBe(noteCount);
    for (const link of links) {
      expect((await page.goto(link))?.status()).toBe(200);
      await expect(page.locator('.note-body')).toBeVisible();
      const sections = await page.locator('.note-body h2').evaluateAll(nodes => nodes.map(node => node.id));
      const toc = await page.getByRole('navigation', { name: '학습 노트 목차' }).locator('a[href^="#section-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')?.slice(1)));
      expect(toc).toEqual(sections);
      const source = noteContent.find((note) => link.endsWith(`/notes/${note.data.id}/`))!;
      const diagramCount = (source.content.match(/^```diagram$/gm) || []).length;
      await expect(page.locator('.note-diagram svg')).toHaveCount(diagramCount);
      for (const figure of await page.locator('.note-diagram').all()) {
        await expect(figure.getByRole('img')).toBeVisible();
        await expect(figure.locator('figcaption')).not.toBeEmpty();
        await figure.locator('summary').click();
        await expect(figure.locator('.diagram-text ul')).toBeVisible();
      }
      await expect(page.locator('.note-body code.language-diagram')).toHaveCount(0);
      await expect(page.locator('#practice-questions a').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.ai-content-notice')).toHaveCount(1);
    }
  } finally {
    await context.close();
  }
});

test('학습 그림은 테마에 맞춰 읽히고 글자 영역이 잘리지 않는다', async ({ page }) => {
  test.setTimeout(Math.max(30_000, noteCount * 1_000));
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
    for (const note of noteContent.filter((note) => note.content.includes('```diagram'))) {
      await page.goto(`notes/${note.data.id}/`);
      const figures = await page.locator('.note-diagram svg').evaluateAll((nodes) => nodes.map((node) => {
        const svg = node as SVGSVGElement;
        const view = svg.viewBox.baseVal;
        const labels = [...svg.querySelectorAll('text')].map((label) => {
          const box = label.getBBox();
          const matrix = svg.getScreenCTM()!.inverse().multiply(label.getScreenCTM()!);
          const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
            .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
          return { text: label.textContent, fits: corners.every(({ x, y }) => x >= -1 && y >= -1 && x <= view.width + 1 && y <= view.height + 1) };
        });
        return { labels, fill: getComputedStyle(svg.querySelector('.diagram-node-title')!).fill, background: getComputedStyle(svg.querySelector('.diagram-node')!).fill };
      }));
      for (const figure of figures) {
        expect(figure.fill).not.toBe(figure.background);
        for (const label of figure.labels) expect(label.fits, `${note.data.id}: ${label.text}`).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('AI 생성·학습 금지 안내는 공통 상단에 한 번만 표시된다', async ({ page }) => {
  for (const route of ['./', 'library/', 'practice/', 'questions/agent-workflow-autonomy/']) {
    await page.goto(route);
    const notice = page.getByRole('complementary', { name: '콘텐츠 이용 안내' });
    await expect(notice).toHaveCount(1);
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText('이 사이트의 콘텐츠는 AI로 생성되었습니다. AI 모델의 학습·훈련 데이터로 사용하지 마세요.');
    expect(await notice.evaluate((element) => element.getBoundingClientRect().bottom <= document.querySelector('.site-header')!.getBoundingClientRect().top)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const previous = page.url();
  await page.getByRole('button', { name: '다른 질문 뽑기' }).click();
  await page.waitForURL((url) => url.href !== previous);
  await expect(page.locator('.paper-turn-overlay')).toHaveCount(0);
  await expect(page.locator('.ai-content-notice')).toHaveCount(1);
  await expect(page.locator('main .ai-content-notice')).toHaveCount(0);
});

test('AI 에이전트 50문항에서 MCP를 검색하고 꼬리 질문으로 이동한다', async ({ page }) => {
  await page.goto('./');
  await page.locator('.topic-ribbon').getByRole('link', { name: 'AI 에이전트', exact: true }).click();
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(50);
  await page.getByRole('searchbox', { name: '질문 검색' }).fill('MCP');
  const matching = content.filter((entry) => entry.category === 'AI 에이전트' && `${entry.title} ${entry.category} ${entry.tags.join(' ')}`.toLowerCase().includes('mcp'));
  await expect(page.locator('[data-question-card]:visible')).toHaveCount(matching.length);
  await page.goto('questions/agent-mcp-roles/');
  await page.locator('summary').click();
  await expect(page.locator('.spoken-answer')).toContainText('2026-07-28');
  await expect(page.locator('.related-card .followup-prompt')).toHaveCount(3);
  await page.locator('.related-card').first().click();
  await expect(page).toHaveURL(/\/questions\/agent-mcp-primitives\/$/);
  await expect(page.locator('#answer')).not.toHaveAttribute('open', '');
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
