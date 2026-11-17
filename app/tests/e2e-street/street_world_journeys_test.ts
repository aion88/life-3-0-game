import { finishJourneyTravel } from '../support/journey_navigation';
import { openMenuAndClick, openEndSheet } from '../support/menu';
import { successPressIds } from '../support/world_routes';
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { seedJson, seedSave, continueIfAsked, SAVE_KEY } from '../support/e2e';
import { CANONICAL_LINES } from '../fixtures/canonical-lines';
const strings: Record<string,string> = JSON.parse(readFileSync('src/data/strings/fr.json','utf8'));
import { journeys } from '../../src/worlds/catalogue';
import type { Journey, JourneyWorldId } from '../../src/worlds/types';
const evidence='../production/qa/evidence/street/2026-11-10-worlds';
const updatePublicGallery=process.env['UPDATE_PUBLIC_GALLERY']==='1';
if(updatePublicGallery)mkdirSync('public/apercus',{recursive:true});
if(updatePublicGallery)writeFileSync('public/apercus/manifest.json', JSON.stringify(Array.from({length:12},(_,i)=>{
 const id=`w${String(i+1).padStart(2,'0')}`; const j=journeys[id as JourneyWorldId];
 return {id,name:strings[`world.${id}.name` as keyof typeof strings],clear:strings[`world.${id}.clear` as keyof typeof strings],extinction:id==='w07'||id==='w12',mission:j?.mission ?? (id==='w10'?'Suspendre le transfert forcé de ton frère sans dénoncer ta mère, en engageant ta propre liberté de mouvement.':'Comprendre la rupture : retrouver les choix et les mécanismes du modèle qui ont conduit à cette fin.')};
}),null,2));
const fixtures=[...CANONICAL_LINES.filter(([id])=>id!=='w07'&&id!=='w10'&&id!=='w12'), ['w09','DCCACBBBCBC'] as const];
/** Find a success path using declared requirements, rather than clicking the first button blindly. */
function successPath(j: Journey): string[]|null { return successPressIds(j); }
test.use({locale:'fr-FR'});
for (const [world,line] of fixtures) test(`${world}: questionnaire routes to a distinct environment, complete mission and resume`,async({page,isMobile})=>{
 test.setTimeout(120_000); mkdirSync(evidence,{recursive:true});
 if(isMobile)expect(page.viewportSize()!.width).toBeLessThanOrEqual(500);
 const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
 await seedSave(page,seedJson({lang:'fr',phase:'street',line}));
 await page.goto('/?episode=court&parcours=ancien'); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
 const host=page.locator('main.journey'); await expect(host).toHaveAttribute('data-world',world);
 await expect(page.locator('.journey-view canvas')).toBeVisible();
 // No welcome window: the story is playable at once, the rules stay one menu away.
 await expect(page.locator('.journey-head-anchor')).toBeVisible();
 await openMenuAndClick(page,'Règles du monde');
 await expect(page.getByRole('dialog',{name:'Bienvenue dans ce monde'})).toBeVisible();
 await expect(page.locator('.journey-head-anchor')).toBeHidden();
 await page.getByRole('button',{name:'Retour au jeu',exact:true}).click();
 await expect(page.locator('.journey-head-anchor')).toBeVisible();
 await expect(page.locator('[data-ui="current-location"]')).toContainText(journeys[world as JourneyWorldId].locations.find(l=>l.id===journeys[world as JourneyWorldId].scenes.find(s=>s.id===journeys[world as JourneyWorldId].start)!.location)!.name);
 const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).acts,SAVE_KEY);
 const j=journeys[world as JourneyWorldId];
 await expect(page.getByLabel('Ton but et ton prochain pas',{exact:true})).toContainText(j.mission);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(isMobile){
  const mission=await page.getByLabel('Ton but et ton prochain pas',{exact:true}).boundingBox();
  const resources=await page.getByLabel('Où tu en es',{exact:true}).boundingBox();
  expect(resources!.y).toBeGreaterThanOrEqual(mission!.y+mission!.height);
 }
 await expect(page.locator('.illustrated-view')).toHaveAttribute('data-ready','true');
 await expect(page.locator('.illustrated-view canvas')).toHaveCSS('opacity','1');
 await page.screenshot({path:`${evidence}/${world}-arrival.png`});
 if(updatePublicGallery)await page.screenshot({path:`public/apercus/${world}-arrival.png`});
 const cleanView = await page.addStyleTag({content:'.journey-hud,.journey-head-anchor{visibility:hidden!important}'});
 if(updatePublicGallery)await page.screenshot({path:`public/apercus/${world}-scene.png`});
 if(updatePublicGallery&&world==='w02')await page.screenshot({path:'public/apercus/lieux/w02-home.png'});
 await cleanView.evaluate(node => node.parentNode?.removeChild(node));
 let outside=false;
 const path=successPath(j); expect(path).not.toBeNull();
 for(const choice of path!){
  await page.locator(`.journey-options [data-option="${choice}"]`).click();
  await finishJourneyTravel(page);
  await expect(host).not.toHaveAttribute('data-acting','true');
  const location=await host.getAttribute('data-location');
  const place=j.locations.find(l=>l.id===location)!;
  if(!outside&&(place.kind==='public'||place.kind==='landmark')){outside=true;await page.screenshot({path:`${evidence}/${world}-district.png`});if(updatePublicGallery)await page.screenshot({path:`public/apercus/${world}-district.png`});}
 }
 await expect(page.locator('.journey-ending')).toContainText('Objectif atteint');
 await expect(page.locator('[data-ui=end-outcome]')).toBeVisible();await openEndSheet(page);
 await expect(page.locator('.journey-ending')).toContainText('Pourquoi ce monde');
 await expect(page.locator('.journey-ending')).toContainText('pas des probabilités réelles');
 await expect(page.locator('[data-ui=life-sheet]')).toBeVisible();
 await expect(page.locator('.life-chart-grid figure')).toHaveCount(6);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`${evidence}/${world}-ending.png`});
 await openMenuAndClick(page,'Les douze futurs');
 await expect(page.locator('.journey-modal h3')).toHaveCount(12);
 await expect(page.locator('.journey-modal a')).toHaveCount(0);
 await page.getByRole('button',{name:'Fermer',exact:true}).click();
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).acts,SAVE_KEY);expect(after).toEqual(before);
 await page.reload();await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 await expect(page.locator('.journey-ending')).toContainText('Objectif atteint');
 expect(errors).toEqual([]);
});
test('mobile commons: usable choices, modal and fresh questionnaire',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'BAABBACBBAD'}));
 await page.goto('/?episode=court&parcours=ancien'); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
 await expect(page.locator('main.journey')).toHaveAttribute('data-world','w03');
 
 const navBox=await page.locator('.journey-header nav').boundingBox();
 const missionBox=await page.locator('.lived-orientation').boundingBox();
 expect(navBox!.y+navBox!.height).toBeLessThanOrEqual(missionBox!.y);
 await page.screenshot({path:`${evidence}/w03-mobile.png`});
 await openMenuAndClick(page,'Carnet & mes réponses');
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
 for(const choice of successPath(journeys.w03)!) { await page.locator(`.journey-options [data-option="${choice}"]`).click(); await finishJourneyTravel(page); await expect(page.locator('main.journey')).not.toHaveAttribute('data-acting','true'); }
 await expect(page.locator('.journey-ending')).toContainText('Objectif atteint');
 await openEndSheet(page);
 await expect(page.locator('.life-chart-grid figure')).toHaveCount(6);
 await page.getByRole('button',{name:'02 · Comment ce monde est arrivé',exact:true}).click();
 await page.screenshot({path:`${evidence}/fiche-mobile-courbes.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Changer mes réponses de 2026',exact:true}).click();
 await expect(page.locator('[data-testid="q-scene"]')).toBeVisible();
 // The mayor questionnaire has no Continue button: one click answers and the next scene replaces the current one.
 const firstScene=await page.locator('[data-testid="q-scene"]').textContent();
 await page.locator('.c-option--q').first().click();
 await expect(page.locator('[data-testid="q-scene"]')).not.toHaveText(firstScene!);
 await page.screenshot({path:`${evidence}/questionnaire-palette.png`});
});
for (const [world,line] of CANONICAL_LINES.filter(([id])=>id==='w07'||id==='w12')) test(`${world}: extinction keeps its own explanation without a street`,async({page})=>{
 await seedSave(page,seedJson({lang:'fr',phase:'street',line}));
 await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 await expect(page.locator('main.journey')).toHaveCount(0);
 await expect(page.locator('.episode')).toHaveCount(0);
 await expect(page.getByTestId('causes-edition')).toBeVisible();
 if(updatePublicGallery)await page.screenshot({path:`public/apercus/${world}-district.png`});
});

test('retrospective waits for the player, revisits years, then explains the world', async ({ page }) => {
 await seedSave(page,seedJson({lang:'fr',phase:'fastforward',line:'BAABBACBBAD'}));
 await page.goto('/?episode=court&parcours=ancien'); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
 const year=page.locator('[data-ui="retro-year"]').first(); await expect(year).toBeVisible();
 await expect(page.locator('[data-ui="retro-paper"]')).toHaveCount(5);
 await expect(page.locator('.retro-contribution')).toHaveCount(4);
 await page.screenshot({path:`${evidence}/w03-fresque.png`,fullPage:true});
 const first=await year.textContent();
 await page.clock.install(); await page.clock.fastForward(60_000);
 await expect(year).toHaveText(first!);

 await page.clock.resume();
 await page.locator('[data-ui="retro-enter"]').click();
 // No welcome window: the world is told above the first scene, nothing to close before playing.
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('[data-ui=journey-intro]')).toBeVisible();
 const welcome=page.getByRole('dialog',{name:'Bienvenue dans ce monde'});
 
 await expect(page.getByLabel('État émotionnel',{exact:true})).toContainText('Curiosité');
 await page.locator('.journey-options button:not(:disabled)').first().click();
 await finishJourneyTravel(page);
 await expect(page.getByLabel('État émotionnel',{exact:true})).toContainText('Détermination');
 const continuedScene=await page.locator('main.journey').getAttribute('data-scene');
 await page.reload(); await page.waitForSelector('html[data-ready="1"]'); await continueIfAsked(page);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('main.journey')).toHaveAttribute('data-scene',continuedScene!);
 await openMenuAndClick(page,'Règles du monde'); await expect(welcome).toBeVisible();
});
