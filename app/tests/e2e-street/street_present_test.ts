import { test, expect } from '@playwright/test';
import { seedSave, seedJson, continueIfAsked, SAVE_KEY } from '../support/e2e';
for (const mobile of [false, true]) for (const episode of [false, true]) test(`real facts ${episode ? '1984' : 'commons'} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? {width:390,height:844} : {width:1440,height:900});
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seedSave(page, seedJson({lang:'fr',phase:'street',line:episode?'ACBACBACAAD':'BAABBACBBAD'}));
  await page.goto('/?episode=court&parcours=ancien'); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
  
  const before = await page.evaluate(k=>localStorage.getItem(k), SAVE_KEY);
  // On a narrow screen the notebook tools sit behind the menu button (no welcome window opens them any more).
  const realWorld = page.getByRole('button',{name:'Dans le monde réel',exact:true});
  if (!(await realWorld.isVisible())) await page.getByRole('button',{name:'Menu',exact:true}).click();
  await realWorld.click();
  const facts = page.locator('[data-ui="real-world-comparisons"]');
  await expect(facts).toBeVisible();
  await facts.locator('summary').click();
  await expect(facts.locator('article')).toHaveCount(5);
  await expect(facts).toContainText('Le lien avec le jeu');
  await expect(facts).toContainText('arrêt de la CEDH le 4 juillet 2023');
  await expect(facts.locator('a').first()).toHaveAttribute('target','_blank');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:episode?'Retour au quartier':'Fermer',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:episode?'Retour au quartier':'Fermer',exact:true}).click();
  await expect(facts).toHaveCount(0);
  expect(await page.evaluate(k=>localStorage.getItem(k), SAVE_KEY)).toBe(before);
  expect(errors).toEqual([]);
});
