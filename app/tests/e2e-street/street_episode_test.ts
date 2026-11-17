import { expect, test } from '@playwright/test';
import {L} from '../support/episode_labels';
import { seedJson, seedSave, continueIfAsked, LINES, SAVE_KEY } from '../support/e2e';
import { mkdirSync } from 'node:fs';
test.use({ locale: 'fr-FR' });
test('short episode completes, resumes and preserves week actions', async ({ page,isMobile }) => {
  test.setTimeout(240_000);
  if(isMobile)expect(page.viewportSize()!.width).toBeLessThanOrEqual(500);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: LINES.w10 }));
  await page.goto('/?episode=court&parcours=ancien'); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
  const hud = page.locator('.episode-hud'); await expect(hud).toHaveAttribute('data-scene', 'arrival', { timeout: 60_000 });
  // The welcome window is gone: the first decision is playable at once, and each option shows its price before the gesture.
  await expect(page.locator('[data-option="help"] [data-price]')).toHaveText('Gain : confiance +1');
  await expect(page.locator('[data-option="ask"] [data-price]')).toHaveText('Prix : 0');
  await page.getByRole('button', { name: 'Repères du monde', exact: true }).click();
  await expect(page.locator('[data-ui="episode-rules"]')).toContainText('Marlène est ta mère');
  await expect(page.locator('[data-ui="episode-rules"]')).toContainText('ton frère');
  await page.getByRole('button', { name: 'Retour au quartier', exact: true }).click();
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).acts, SAVE_KEY);
  const evidence = '../production/qa/evidence/street/2026-11-09-episode'; mkdirSync(evidence, { recursive: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${evidence}/arrival.png` });
  if(process.env['UPDATE_PUBLIC_GALLERY']==='1'){
  mkdirSync('public/apercus',{recursive:true});
  await page.screenshot({path:'public/apercus/w10-arrival.png',scale:'css'});
  await page.screenshot({path:'public/apercus/w10-district.png',scale:'css'});
  }
  const pick = async (label: string, scene: string): Promise<void> => {
    if(label.startsWith(L('dinner','stay'))) await page.locator('[data-gesture="chair"]').click();
    else await page.getByRole('button', { name: label, exact: true }).click();
    await expect(hud).toHaveAttribute('data-scene', scene);
    const skip = page.getByRole('button', { name: 'Arriver directement', exact: true });
    if (await skip.isVisible()) await skip.click();
  };
  await pick(L('arrival','help'), 'plant');
  await pick(L('plant','accept'), 'hub');
  await pick('Retrouver Marlène pour dîner', 'dinner');
  await expect(hud).toHaveAttribute('data-location', 'unit.9-B');
  await expect(page.locator('[data-ui="episode-orientation"]')).toContainText('frère');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${evidence}/dinner.png` });
  // The confession shows one option only: it is told and applied without a press, so the request follows at once.
  await pick(L('dinner','stay'), 'request');
  await expect(hud).toHaveAttribute('data-location','unit.9-B');
  await expect(page.getByRole('button',{name:'Arriver directement',exact:true})).toHaveCount(0);
  await expect(page.locator('[data-ui="episode-signals"]')).toBeVisible();
  await pick(L('request','together'), 'checkpoint');
  await pick(L('checkpoint','appeal'), 'appeal');
  await pick(L('appeal','enter'), 'message');
  await pick(L('message','inspect'),'evidence');
  await pick(L('evidence','witness'),'return');
  await pick(L('return','honest'), 'end');
  await expect(page.locator('[data-ui="end-outcome"]')).toBeVisible();
  for (const ui of ['end-gained', 'end-cost', 'end-resource', 'end-replay']) await expect(page.locator(`[data-ui="${ui}"]`)).toBeInViewport();
  await page.locator('[data-ui="end-sheet"]>summary').click();
  await expect(page.locator('.episode-panel')).toContainText('48 heures');
  await expect(page.locator('.episode-report')).toContainText('Ton objectif');
  await page.getByRole('button', { name: 'Comprendre le lien avec mes réponses de 2026' }).click();
  await expect(page.locator('.episode-notes')).toContainText('Destination calculée');
  await page.getByRole('button', { name: 'Découvrir les douze scénarios' }).click();
  await expect(page.locator('.episode-notes h3')).toHaveCount(12);
  await expect(page.locator('.episode-notes a')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await page.getByRole('button', { name: 'Retour au quartier', exact: true }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${evidence}/ending.png` });
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).acts, SAVE_KEY); expect(after).toEqual(before);
  await page.reload(); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page); await expect(page.locator('.episode-hud')).toHaveAttribute('data-scene', 'end', { timeout: 60_000 });
  expect(errors).toEqual([]);
});

for (const mobile of [false,true]) test(`dinner exploration ${mobile ? 'mobile' : 'desktop'}: objects, camera, persistence and voluntary exit`, async ({page}) => {
 if(mobile) await page.setViewportSize({width:390,height:844});
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:LINES.w10}));
 await page.goto('/?episode=court&parcours=ancien'); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
 for(const label of [L('arrival','help'),L('plant','accept'),'Retrouver Marlène pour dîner']) {
  await page.getByRole('button',{name:label,exact:true}).click();
  const skip=page.getByRole('button',{name:'Arriver directement',exact:true}); if(await skip.isVisible())await skip.click();
 }
 await expect(page.locator('.dinner-exploration')).toBeVisible();
 await expect(page.locator('.episode-panel')).toHaveCount(0);
 // On a phone the plans and objects sit behind one "Observer la pièce" button: looks, not decisions.
 if(mobile) await page.getByRole('button',{name:'Observer la pièce',exact:true}).click();
 await page.getByRole('button',{name:'Passer le plan d’arrivée',exact:true}).click();
 await expect(page.locator('.episode')).toHaveAttribute('data-shot','marlene');
 for(const shot of ['wide','marlene','player']) {
  await page.locator(`[data-camera="${shot}"]`).click();
  await expect(page.locator('.episode')).toHaveAttribute('data-shot',shot);
  await page.waitForTimeout(400);
  await page.screenshot({path:`../production/qa/evidence/street/2026-11-10-worlds/famille-${shot}-${mobile?'mobile':'desktop'}.png`});
 }

 for(const id of ['bracelet','plate','basil']) {
  await page.locator(`[data-inspect="${id}"]`).click();
  await expect(page.locator(`[data-inspect="${id}"]`)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.dinner-reaction h1')).not.toBeEmpty();
  if(!mobile){await page.waitForTimeout(900);await page.screenshot({path:`../production/qa/evidence/street/2026-11-10-worlds/diner-${id}.png`});}
 }
 await page.getByRole('button',{name:'Revenir à la table',exact:true}).click();
 await page.waitForTimeout(900);
 const evidence='../production/qa/evidence/street/2026-11-10-worlds';mkdirSync(evidence,{recursive:true});
 await page.locator('.dinner-gestures').scrollIntoViewIfNeeded();
 await page.screenshot({path:`${evidence}/diner-${mobile?'mobile':'desktop'}.png`});
 const bounds=await page.locator('.dinner-gestures').boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 await page.reload();await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 await expect(page.locator('.dinner-objects small')).toHaveCount(3);
 await page.locator('[data-gesture="coat"]').click();
 await expect(page.locator('.episode-hud')).toHaveAttribute('data-scene','request');
 await expect(page.locator('.episode-hud')).toHaveAttribute('data-location','unit.9-B');
});

test('dinner cinematic inserts reveal courtyard and absent place without taking choices', async ({page}) => {
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:LINES.w10}));
 await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 for(const label of [L('arrival','help'),L('plant','accept'),'Retrouver Marlène pour dîner']) {
  await page.getByRole('button',{name:label,exact:true}).click();
  const skip=page.getByRole('button',{name:'Arriver directement',exact:true});if(await skip.isVisible())await skip.click();
 }
 const save=await page.evaluate(()=>JSON.stringify(localStorage));
 for(const focus of ['window','plate','marlene']) {
  await expect(page.locator('.episode')).toHaveAttribute('data-shot',focus,{timeout:6000});
  await page.waitForTimeout(350);
  await page.screenshot({path:`../production/qa/evidence/street/2026-11-10-worlds/cinema-${focus}.png`});
 }
 await expect(page.getByRole('button',{name:'Revoir les plans',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(save);
 await page.getByRole('button',{name:'Revoir les plans',exact:true}).click();
 await page.getByRole('button',{name:'Passer le plan d’arrivée',exact:true}).click();
 await expect(page.locator('[data-ui=dinner-cinematic]')).toHaveCount(0);
 await page.locator('[data-gesture=chair]').click();
 await expect(page.locator('.episode-hud')).toHaveAttribute('data-scene','request');
});
