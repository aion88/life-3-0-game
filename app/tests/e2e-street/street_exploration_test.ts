import { successPressIds } from '../support/world_routes';
import { finishJourneyTravel } from '../support/journey_navigation';
import { test, expect } from '@playwright/test';
import { seedSave, seedJson, continueIfAsked, SAVE_KEY } from '../support/e2e';
import { journeys } from '../../src/worlds/catalogue';
const path = (): string[] => successPressIds(journeys.w03);
for (const mobile of [false, true]) test(`explore actual alternative and restore original ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width:390,height:844 } : { width:1440,height:900 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seedSave(page, seedJson({ lang:'fr', phase:'street', line:'BAABBACBBAD' }));
  await page.goto('/?episode=court&parcours=ancien'); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
  
  const original = await page.evaluate(k => localStorage.getItem(k), SAVE_KEY);
  for (const choice of path()!) {
    await page.locator(`.journey-options [data-option="${choice}"]`).click();
    await finishJourneyTravel(page);
  }
  await page.getByRole('button',{name:'Explorer un autre monde',exact:true}).click();
  await expect(page.locator('[data-ui="explorer-world"]')).toHaveCount(12);
  await page.locator('[data-ui="explorer-world"][data-world="w01"]').click();
  await expect(page.locator('[data-ui="explorer-detail"]')).toContainText('Les réponses qui changent');
  await page.locator('[data-ui="explorer-go"]').click();
  await expect(page.locator('[data-ui="retrospective"]')).toBeVisible();
  for (const axis of ['freedom','abundance','unrest','order','surveillance','aiPower']) await expect(page.locator(`.retro-trend [data-axis="${axis}"]`)).toHaveCount(4);
  // The present-day facts moved into the "Sources et méthode" dialog of the retrospective.
  await page.getByRole('button',{name:'Sources et méthode',exact:true}).click();
  await page.locator('[data-ui="present-signals"] summary').click();
  await expect(page.locator('.retro-present-cards article')).toHaveCount(5);
  await expect(page.locator('.retro-present-cards')).toContainText('pas un décompte de condamnations');
  await page.screenshot({path:`../production/qa/evidence/street/2026-11-10-worlds/exploration-timeline-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.reload(); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
  await expect(page.locator('[data-ui="retrospective"]')).toBeVisible();
  await page.locator('[data-ui="retro-enter"]').click();
  await expect(page.locator('main.journey')).toHaveAttribute('data-world','w01');
  
  // This checks save/resume after arrival. Reloading before the GLB finishes makes WebKit
  // report its cancelled fetch as an access-control page error during document teardown.
  await expect(page.locator('.illustrated-view')).toHaveAttribute('data-ready','true');
  await expect(page.locator('.illustrated-view canvas')).toHaveCSS('opacity','1');
  await page.reload(); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
  await expect(page.locator('main.journey')).toHaveAttribute('data-world','w01');
  
  await page.locator('[data-ui="exploration-return"]').click();
  await expect(page.locator('main.journey')).toHaveAttribute('data-world','w03');
  await expect(page.locator('.journey-ending')).toBeVisible();
  expect(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).toBe(original);
  // Deliberately revisiting the original completed world must not restore its ending.
  await page.getByRole('button',{name:'Explorer un autre monde',exact:true}).click();
  await page.locator('[data-ui="explorer-world"][data-world="w03"]').click();
  await page.locator('[data-ui="explorer-go"]').click();
  await page.locator('[data-ui="retro-enter"]').click();
  await expect(page.locator('.journey-ending')).toHaveCount(0);
  
  const first = path()![0]!;
  await page.locator(`.journey-options [data-option="${first}"]`).click();
  await finishJourneyTravel(page);
  const scene = await page.locator('main.journey').getAttribute('data-scene');
  await page.reload(); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
  await expect(page.locator('main.journey')).toHaveAttribute('data-scene',scene!);
  await page.locator('[data-ui="exploration-return"]').click();
  await expect(page.locator('.journey-ending')).toBeVisible();
  expect(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).toBe(original);
  if (!mobile) {
    for (const world of ['w10', 'w07']) {
      await page.getByRole('button',{name:'Explorer un autre monde',exact:true}).click();
      await page.locator(`[data-ui="explorer-world"][data-world="${world}"]`).click();
      await page.locator('[data-ui="explorer-go"]').click();
      if (world === 'w07') await page.clock.install();
      await page.locator('[data-ui="retro-enter"]').click();
      if (world === 'w10') {
        await expect(page.locator('.episode')).toBeVisible();
      } else {
        await expect(page.getByTestId('causes-edition')).toBeVisible();
        await page.getByTestId('causes-next').click(); await page.getByTestId('causes-next').click();
        await page.getByTestId('causes-replay').click();
        await expect(page.getByTestId('bilan-explore')).toBeVisible();
      }
      await page.locator('[data-ui="exploration-return"]').click();
      await expect(page.locator('.journey-ending')).toBeVisible();
      expect(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).toBe(original);
    }
  }
  expect(errors).toEqual([]);
});
