import {test,expect} from '@playwright/test';
import {seedSave,seedJson,continueIfAsked} from '../support/e2e';
import {finishJourneyTravel} from '../support/journey_navigation';
test('Oracle arrival reveals the precinct and leaves the actors clear of the dialogue',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'DBCAAACBDAD'}));
 await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 
 for(const choice of ['ours','listen']){await page.locator(`[data-option=${choice}]`).click();await finishJourneyTravel(page);}
 await page.locator('[data-option=make]').click();/* the chosen gesture already authorizes the movement: no confirmation card */
 await expect(page.locator('.journey-view[data-world]')).toHaveAttribute('data-performing','true');
 await expect(page.locator('[data-ui=current-location]')).toHaveText('Vers · Les Marches de l’Oracle');
 await page.waitForTimeout(600);
 await page.screenshot({path:'../production/qa/evidence/street/oracle-revision/arrivee.png'});
 await expect(page.locator('.journey-view[data-world]')).toHaveAttribute('data-performing','false',{timeout:8000});
 await expect(page.locator('main.journey')).toHaveAttribute('data-location','oracle');
 const mood=await page.locator('.journey-head-anchor').boundingBox();const panel=await page.locator('.journey-panel').boundingBox();
 expect(mood!.x).toBeGreaterThan(panel!.x+panel!.width);
 await page.screenshot({path:'../production/qa/evidence/street/oracle-revision/apres-en-jeu.png'});
 expect(errors).toEqual([]);
});
