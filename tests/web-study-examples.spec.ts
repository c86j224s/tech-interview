import { test, expect } from '@playwright/test';

test('CSS 학습 예제의 layer·명시도·상속 결과를 확인한다', async ({ page }) => {
  await page.setContent(`<style>
    @layer base, components;
    @layer base { #normal { color: red; } #important { color:red !important; } }
    @layer components { .normal { color:blue; } .important { color:blue !important; } }
    .parent { margin-left:20px; color:red; }
    .inherit { margin-left:inherit; } .initial { margin-left:initial; } .unset { margin-left:unset; }
    :where(#low) { color:red; } .low { color:blue; }
    :is(.high,#not-matching) { color:red; } .high { color:blue; }
  </style><div id="normal" class="normal">N</div><div id="important" class="important">I</div>
  <div class="parent"><p class="inherit">A</p><p class="initial">B</p><p class="unset">C</p></div>
  <p id="low" class="low">L</p><p class="high">H</p>`);
  await expect(page.locator('#normal')).toHaveCSS('color', 'rgb(0, 0, 255)');
  await expect(page.locator('#important')).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(page.locator('.inherit')).toHaveCSS('margin-left', '20px');
  await expect(page.locator('.initial')).toHaveCSS('margin-left', '0px');
  await expect(page.locator('.unset')).toHaveCSS('margin-left', '0px');
  await expect(page.locator('#low')).toHaveCSS('color', 'rgb(0, 0, 255)');
  await expect(page.locator('.high')).toHaveCSS('color', 'rgb(255, 0, 0)');
});

test('이벤트 위임 예제는 내부 span을 찾고 중첩 목록을 제외한다', async ({ page }) => {
  await page.setContent(`<div id="items" data-list-root><button data-action="open" data-id="outer"><span>바깥</span></button><div data-list-root><button data-action="open" data-id="inner"><span>안쪽</span></button></div></div><output></output>`);
  await page.evaluate(() => {
    const list = document.querySelector('#items')!;
    list.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>('button[data-action]');
      if (!button || !list.contains(button)) return;
      if (button.closest('[data-list-root]') !== list || button.disabled) return;
      document.querySelector('output')!.textContent += button.dataset.id + ',';
    });
  });
  await page.getByText('안쪽', { exact: true }).click();
  await expect(page.locator('output')).toHaveText('');
  await page.getByText('바깥', { exact: true }).click();
  await expect(page.locator('output')).toHaveText('outer,');
});
