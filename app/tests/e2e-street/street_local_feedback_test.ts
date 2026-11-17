import {answerMayor,checkMayorSource} from '../support/menu';
import {successPressIds,settled} from '../support/world_routes';
import {test,expect} from '@playwright/test';
import {seedSave,seedJson,continueIfAsked,displayLetters,SAVE_KEY} from '../support/e2e';
import {finishJourneyTravel} from '../support/journey_navigation';
import {journeys} from '../../src/worlds/catalogue';
import {startJourney,decide} from '../../src/worlds/state';
const j=journeys.w03;
const path=():string[]=>successPressIds(j);
const evidence='../production/qa/evidence/local-feedback';
test('neutral answers, source stickers, explicit entry before timeline',async({page},info)=>{
 await page.goto('/?parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await page.getByRole('button',{name:'Jouer',exact:true}).click();
 await expect(page.locator('.play-flow')).toContainText('personnages 3D');await page.getByTestId('warning-continue').click();
 const before=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
 // The mayor scenes carry their real-world reference in a fold: opening it never touches the save.
 await checkMayorSource(page);
 expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(before);
 const colors=await page.locator('.c-option--q').evaluateAll(buttons=>buttons.map(b=>({border:getComputedStyle(b).borderColor,background:getComputedStyle(b).backgroundColor})));
 expect(new Set(colors.map(c=>JSON.stringify(c))).size).toBe(1);
 const letters=displayLetters('BAABBACBBAD');
 for(const [i,letter] of letters.entries()){
  if(await checkMayorSource(page)&&i===5)await page.screenshot({path:`${evidence}/question-help-${info.project.name}.png`});
  await answerMayor(page,letter,i===letters.length-1);
 }
 const entry=page.locator('[data-ui="world-entry"]');await expect(entry).toContainText('Le monde où tu arrives');
 const a=await entry.boundingBox(),b=await page.locator('[data-ui="retro-timeline"]').boundingBox();expect(a!.y+a!.height).toBeLessThan(b!.y);
 await expect(page.locator('[data-ui="retro-enter"]')).toBeInViewport();
 await page.screenshot({path:`${evidence}/world-entry-${info.project.name}.png`});
});
test('speaker bubble, actual immediate consequences, infographic ending and exploration',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'BAABBACBBAD'}));await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 await expect(page.locator('.illustrated-view')).toHaveAttribute('data-ready','true');await expect(page.locator('.reading-column')).toHaveCount(0);
 await expect(page.locator('.stage-dialogue .journey-panel')).toBeVisible();await expect(page.getByRole('navigation',{name:'Tes gestes'})).toBeVisible();
 await page.screenshot({path:`${evidence}/dialogue-${info.project.name}.png`});
 let s=settled(j,startJourney(j)),count=0;
 for(const id of path()!){const scene=j.scenes.find(x=>x.id===s.scene)!;const o=scene.options.find(x=>x.id===id)!;const next=settled(j,decide(j,s,id));await page.locator(`.journey-options [data-option="${id}"]`).click();await finishJourneyTravel(page);
  // The effect of a gesture is told in the flow beside the next gesture (no floating impact card, no moral card in the short game).
  if(!j.scenes.find(x=>x.id===next.scene)!.ending){await expect(page.locator('.journey-feedback')).toContainText(o.consequence);if(next.resource!==s.resource)await expect(page.locator('.lived-changes')).toContainText(`${Math.abs(next.resource-s.resource)}`);}
  s=next;if(++count===1){await expect(page.locator('.journey-feedback')).toBeVisible();await page.screenshot({path:`${evidence}/consequence-${info.project.name}.png`});}}
 await expect(page.locator('.life-impact-flow>li')).toHaveCount(3);await expect(page.locator('.life-sheet figure')).toHaveCount(6);
 await expect(page.locator('.life-decision-archive')).not.toHaveAttribute('open','');
 await expect(page.getByRole('button',{name:'Explorer un autre monde',exact:true})).toBeInViewport();
 await page.screenshot({path:`${evidence}/ending-${info.project.name}.png`,fullPage:true});
 await page.locator('.life-impact-map').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/infographics-${info.project.name}.png`});
 await page.getByRole('button',{name:'Explorer un autre monde',exact:true}).click();await expect(page.locator('[data-ui="explorer-world"]')).toHaveCount(12);
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('cafe action objects and power allocation visibly change both endings without touching the save',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'BAABBACBBAD'}));
 await page.goto('/?atelier=cafe-action');await expect(page.locator('.cafe-action')).toHaveAttribute('data-ready','true');
 const before=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
 await page.getByRole('button',{name:'Écouter',exact:true}).click();await expect(page.locator('.ca-dialogue')).toContainText('TON PÈRE');
 await expect(page.locator('.ca-outage')).toBeHidden();await expect(page.locator('.iv-background')).toHaveCSS('filter','none');
 await page.getByRole('button',{name:'Papa, tu m’entends ?',exact:true}).click();await expect(page.locator('.cafe-action')).toHaveAttribute('data-phase','choose');await expect(page.locator('.ca-outage')).toBeVisible();await expect(page.locator('.ca-outage')).toContainText('COUPURE DE COURANT');await expect(page.locator('.ca-outage')).toContainText('Vision infrarouge activée');await expect(page.locator('.iv-background')).not.toHaveCSS('filter','none');await expect(page.locator('.iv-motion>canvas')).not.toHaveCSS('filter','none');
 await page.screenshot({path:`${evidence}/cafe-action-choice-${info.project.name}.png`});
 await page.getByRole('button',{name:'Allumer le balisage',exact:true}).click();await expect(page.locator('.ca-visitor')).toHaveCount(6);await expect(page.locator('.ca-results')).toContainText('Au pont');await expect(page.locator('.ca-route-light')).toHaveCSS('opacity','1');
 await page.getByRole('button',{name:'Essayer l’autre décision',exact:true}).click();await expect(page.locator('.ca-visitor')).toHaveCount(0);
 await page.getByRole('button',{name:'Guider les secours',exact:true}).click();await expect(page.locator('.ca-visitor')).toHaveCount(3);await expect(page.locator('.ca-results')).toContainText('Avec toi');
 await expect(page.locator('.ca-visitor').last()).toHaveCSS('opacity','1');await page.screenshot({path:`${evidence}/cafe-action-rescue-${info.project.name}.png`,fullPage:true});
 expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
