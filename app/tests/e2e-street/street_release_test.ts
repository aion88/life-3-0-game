import {answerMayor,checkMayorSource} from '../support/menu';
import {successPressIds} from '../support/world_routes';
import { finishJourneyTravel } from '../support/journey_navigation';
import {test,expect} from '@playwright/test';
import {displayLetters,SAVE_KEY} from '../support/e2e';
import resources from '../../src/screens/lang/resources.json' with {type:'json'};
import {journeys} from '../../src/worlds/catalogue';
import {moralMoments} from '../../src/worlds/moralMoments';
const journey=journeys.w03;
const path=():string[]=>successPressIds(journey);
for(const mobile of [false,true])test(`release ${mobile?'mobile':'desktop'}: root to ending and truly fresh identical replay`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?parcours=ancien');await page.waitForSelector('html[data-ready="1"]');
 const poster=page.locator('.life-entry-poster img');
 await expect(poster).toBeVisible();
 await expect.poll(()=>poster.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 expect(await poster.evaluate((img:HTMLImageElement)=>img.currentSrc)).toContain('poster-horizontal.jpg');
 await expect(page.locator('.life-entry-intro')).toContainText('Max Tegmark, physicien au MIT');
 await expect(page.getByRole('button',{name:'Jouer',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Contact / Donner mon avis'})).toHaveAttribute('href',/^mailto:contact@kaizntech\.com\?subject=/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:`../production/qa/evidence/street/release-entry-${mobile?'mobile':'desktop'}.png`});
 const answer=async()=>{
  await page.locator('[data-lang=fr]').click();await page.getByTestId('warning-continue').click();
  const letters=displayLetters('BAABBACBBAD');let sources=0;
  for(const [index,letter] of letters.entries()){
   if(await checkMayorSource(page))sources++;
   await answerMayor(page,letter,index===letters.length-1);
  }
  expect(sources).toBeGreaterThan(0);
  await expect(page.locator('[data-ui=retrospective]')).toBeVisible();
  await page.locator('[data-ui=retro-enter]').click();
  await expect(page.locator('main.journey')).toHaveAttribute('data-world','w03');
  
 };
 await expect(page.locator('.life-entry-credit')).toContainText('Cynthia Ortu');
 await expect(page.getByRole('button',{name:'Jouer',exact:true})).toHaveCSS('background-color','rgb(185, 217, 177)');
 await page.getByRole('link',{name:'Explorer les ressources'}).click();
 await page.getByRole('searchbox',{name:'Rechercher dans les ressources'}).fill('tegmark');
 await expect(page.locator('.life-resource-groups a').first()).toBeVisible();
 await expect(page.getByRole('link',{name:'Life 3.0 — Max Tegmark, présentation de l’essai',exact:true})).toHaveAttribute('href','https://www.penguinrandomhouse.com/books/530584/life-30-by-max-tegmark/9781101970317/');
 await page.getByRole('searchbox',{name:'Rechercher dans les ressources'}).fill('zzzz-no-result');
 await expect(page.locator('.life-resource-count')).toHaveText(`0 ressources sur ${resources.length}`);
 await page.getByRole('searchbox',{name:'Rechercher dans les ressources'}).fill('');
 await expect(page.locator('.life-resource-count')).toHaveText(`${resources.length} ressources`);
 await expect(page.locator('.life-resource-groups a')).toHaveCount(resources.length);
 await answer();
 for(const option of path()!){
  const before=await page.locator('main.journey').getAttribute('data-location');
  const moral=await page.locator('main.journey').getAttribute('data-scene')===moralMoments.w03.scene;
  if(moral)await expect(page.locator('[data-ui=moral-event]'),'moral cards are off in the short game').toHaveCount(0);
  await page.locator(`.journey-options [data-option="${option}"]`).click();
  const travel=page.getByRole('dialog',{name:'Changer de lieu'});
  if(await travel.isVisible())expect(await page.locator('main.journey').getAttribute('data-location')).toBe(before);
  await finishJourneyTravel(page);
  if(moral)await expect(page.locator('[data-ui=moral-event]')).toHaveCount(0);
 }
 await expect(page.locator('.journey-ending')).toContainText('Objectif atteint');
 const answers=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).answers,SAVE_KEY);
 await page.reload();await page.waitForSelector('html[data-ready="1"]');
 await page.locator('[data-ui=resume-new]').click();await page.locator('[data-ui=resume-confirm]').click();
 await answer();
 await expect(page.locator('main.journey')).toHaveAttribute('data-scene',journey.start);
 await expect(page.locator('.journey-ending')).toHaveCount(0);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).answers,SAVE_KEY)).toEqual(answers);
 expect(errors).toEqual([]);
});
