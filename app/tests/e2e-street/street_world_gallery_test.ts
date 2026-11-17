import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
test('gallery presents twelve actual world images and missions without changing a save', async ({page}) => {
 await page.setViewportSize({width:1800,height:1200});
 await page.addInitScript(() => localStorage.setItem('aiaftermath.v2.save', 'gallery-preservation-sentinel'));
 await page.goto('/mondes.html');
 await expect(page.locator('article')).toHaveCount(12);
 for(const article of await page.locator('article').all()) {
  await article.scrollIntoViewIfNeeded();
  const image=article.locator('img').first();
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate((n:HTMLImageElement)=>n.complete&&n.naturalWidth>0)).toBe(true);
  await expect(article.locator('.mission')).not.toBeEmpty();
 }
 expect(await page.evaluate(() => localStorage.getItem('aiaftermath.v2.save'))).toBe('gallery-preservation-sentinel');
 await page.addStyleTag({content:'header{display:none}.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:16px;max-width:none}article>div{padding:16px}article>div>p:not(.mission){display:none}article>div>span{font-size:11px;color:#efbc7b}h2{font-size:25px}.mission{font-size:16px;line-height:1.4}details{display:none}'});
 const evidence='../production/qa/evidence/street/2026-11-10-worlds';mkdirSync(evidence,{recursive:true});
 await page.addStyleTag({content:'article:nth-child(n+7){display:none}'});
 await page.locator('main').screenshot({path:`${evidence}/mondes-01-06.png`});
 await page.addStyleTag({content:'article:nth-child(n+7){display:block}article:nth-child(-n+6){display:none}'});
 await page.locator('main').screenshot({path:`${evidence}/mondes-07-12.png`});
});

test('gallery stays readable on mobile and expands real arrival images', async ({page}) => {
 await page.setViewportSize({width:390,height:844});
 await page.goto('/mondes.html');
 await expect(page.locator('article')).toHaveCount(12);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 const first = page.locator('article').first();
 await first.locator('summary').click();
 const arrival = first.locator('details img').first();
 await expect(arrival).toBeVisible();
 await expect.poll(() => arrival.evaluate((n:HTMLImageElement) => n.complete && n.naturalWidth > 0)).toBe(true);
 const extinction = page.locator('#w07');
 await expect(extinction.locator('details')).toHaveCount(0);
 await expect(extinction.locator('figcaption')).toContainText('Écran de fin réel');
});
