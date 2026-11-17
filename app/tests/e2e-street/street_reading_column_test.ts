import {finishJourneyTravel} from '../support/journey_navigation';
import {test,expect} from '@playwright/test';
import {seedSave,seedJson,continueIfAsked} from '../support/e2e';
import {CANONICAL_LINES} from '../fixtures/canonical-lines';
for(const mobile of [false,true])test(`speaker dialogue stage ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:CANONICAL_LINES.find(([world])=>world==='w02')![1]}));
 await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 
 const column=page.locator('.stage-dialogue');await expect(column.locator('.journey-panel')).toBeVisible();
 await expect(page.locator('.lived-orientation')).toHaveCount(1);/* the goal now sits above the picture, out of the dialogue column */
 await expect(page.locator('.short-bar')).toHaveCount(1);/* the resource bar replaced the status line */
 await expect(page.locator('.scene-choices .journey-options')).toHaveCount(1);
 await expect(column.locator('.journey-line')).toHaveCSS('font-family',/-apple-system/)/* lived scenes read in the system font (--lived-font) */;
 const box=await column.locator('.journey-panel').boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(mobile?390:1440);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.illustrated-view')).toHaveAttribute('data-ready','true');
 await expect(page.locator('.illustrated-view canvas')).toHaveCSS('opacity','1');
 await page.screenshot({path:`../production/qa/evidence/street/dialogue-stage-${mobile?'mobile':'desktop'}.png`});
 await page.locator('.journey-options button').first().click();await finishJourneyTravel(page);
 await expect(page.locator('.journey-feedback')).toBeVisible();
});
