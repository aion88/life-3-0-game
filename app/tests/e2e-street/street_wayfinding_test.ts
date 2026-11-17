import {expect,test} from '@playwright/test';
import {seedSave,seedJson,continueIfAsked} from '../support/e2e';
import {finishJourneyTravel} from '../support/journey_navigation';
for(const mobile of [false,true]) test(`travel stays legible and survives reload ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'DBCAAACBDAD'}));
 await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 
 const title=page.locator('.journey-scene-title');
 expect(await title.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(20);
 await expect(page.locator('[data-option=ours]')).toContainText('Vers Le jardin des itinéraires');
 await page.locator('[data-option=ours]').click();
 const card=page.getByRole('dialog',{name:'Changer de lieu'});
 await expect(card).toContainText('Le logement sans serrure → Le jardin des itinéraires');
 await expect(card).toContainText('Soraya défait la première boucle de sa valise.');
 await expect(card).toContainText('Conserver sa volonté dans le dossier.');
 await page.clock.install();await page.clock.fastForward(60_000);
 await expect(page.locator('main.journey')).toHaveAttribute('data-location','home');
 await expect(card).toBeVisible();await page.clock.resume();
 await page.reload();await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 await expect(card).toBeVisible();await expect(page.locator('main.journey')).toHaveAttribute('data-location','home');
 await page.keyboard.press('Tab');await expect(page.locator('[data-ui=journey-travel-go]')).toBeFocused();
 await page.screenshot({path:`../production/qa/evidence/street/2026-11-10-worlds/travel-${mobile?'mobile':'desktop'}.png`});
 await finishJourneyTravel(page);
 await expect(card).toHaveCount(0);await expect(page.locator('main.journey')).toHaveAttribute('data-location','garden');
 await page.screenshot({path:`../production/qa/evidence/street/2026-11-10-worlds/garden-${mobile?'mobile':'desktop'}.png`});
});
