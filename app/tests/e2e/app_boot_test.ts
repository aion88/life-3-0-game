import { expect, test } from '@playwright/test';

test('test_page_loads_ready_without_console_error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('./');
  await page.waitForSelector('html[data-ready="1"]');
  expect(errors).toEqual([]);
});
