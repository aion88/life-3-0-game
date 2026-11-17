import {expect,test} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {journeys} from '../../src/worlds/catalogue';
import {decide,startJourney} from '../../src/worlds/state';
import {journeyMaterial,journeyConsequences} from '../../src/worlds/consequences';
import type {JourneyWorldId} from '../../src/worlds/types';
import {CANONICAL_LINES} from '../fixtures/canonical-lines';
import {seedSave,seedJson,continueIfAsked} from '../support/e2e';
import {finishJourneyTravel} from '../support/journey_navigation';
import {successPressIds,settled} from '../support/world_routes';
import {openEndSheet} from '../support/menu';
for(const [world,line] of [...CANONICAL_LINES.filter(([id])=>id in journeys),['w09','DCCACBBBCBC'] as const])test(`${world}: manipulate actual material state and retain both final decisions`,async({page},info)=>{
 const j=journeys[world as JourneyWorldId];await seedSave(page,seedJson({lang:'fr',phase:'street',line}));await page.goto('/?parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);let state=settled(j,startJourney(j));
 for(const id of successPressIds(j)){
  if(state.scene.startsWith('aftermath_')){
   const scene=j.scenes.find(s=>s.id===state.scene)!;const material=journeyMaterial(j.id,state,scene.location)!;expect(material).not.toBeNull();
   await expect(page.locator('.scene-consequence')).toHaveAttribute('data-working',String(material.active));
   if(info.project.name==='iphone')await page.getByRole('button',{name:'Voir la scène sans les panneaux de lecture',exact:true}).click();
   await page.locator('.prop-inspect').click();await expect(page.locator('.prop-closeup')).toBeVisible();await expect(page.locator('.prop-closeup [role=status]')).toHaveText(material.detail);
   mkdirSync('../production/qa/evidence/story-remediation',{recursive:true});await page.screenshot({path:`../production/qa/evidence/story-remediation/${world}-${info.project.name}.png`});await page.locator('.prop-close').click();if(info.project.name==='iphone')await page.getByRole('button',{name:'Revenir aux dialogues et aux choix',exact:true}).click();
  }
  await page.locator(`.journey-options [data-option="${id}"]`).click();await finishJourneyTravel(page);state=settled(j,decide(j,state,id));
 }
 /* The short game no longer reaches the aftermath scenes (applyShortForm re-points the endings): the sheet must show exactly the facts the engine established. */
 const expectedFacts=journeyConsequences(j.id,state).map(c=>c.id);expect(expectedFacts.length).toBeGreaterThan(0);
 await expect(page.locator('[data-ui=end-outcome]')).toBeVisible();await openEndSheet(page);
 await expect.poll(async()=>page.locator('.life-lived-grid [data-consequence]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-consequence')).sort())).toEqual([...expectedFacts].sort());await expect(page.locator('.journey-ending')).toContainText('Objectif atteint');
 const failures=await page.locator('.life-lived-grid li strong,.life-lived-grid li p,.life-chart-grid figcaption,.life-impact-action strong,.life-impact-effect p').evaluateAll(nodes=>nodes.flatMap(node=>{
  const rgb=(v:string)=>v.match(/[\d.]+/g)!.map(Number);const luminance=(v:number[])=>v.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i]!,0);
  let parent:Element|null=node,bg=[16,33,38];while(parent){const c=rgb(getComputedStyle(parent).backgroundColor);if((c[3]??1)===1){bg=c;break;}parent=parent.parentElement;}
  const a=luminance(rgb(getComputedStyle(node).color)),b=luminance(bg);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return ratio<4.5?[`${node.textContent?.slice(0,40)}: ${ratio.toFixed(2)}`]:[];
 }));expect(failures).toEqual([]);await page.screenshot({path:`../production/qa/evidence/story-remediation/${world}-ending-${info.project.name}.png`});

});

import {freshEpisode,optionsFor,choose} from '../../src/street/episode/story';
test('1984: a signed opposition blocks the exit in play and appears in the final facts',async({page},info)=>{
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'ACBACBACAAD'}));await page.goto('/?parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);let state=freshEpisode();
 for(const id of ['help','accept','dinner','stay','hear','alone','appeal','enter','inspect','witness','check_exit']){
  const shown=optionsFor(state);const option=shown.find(o=>o.id===id)!;if(shown.length===1){state=choose(state,id);continue;}/* a single displayed gesture is applied by the game itself */await page.getByRole('button',{name:option.label,exact:true}).click();state=choose(state,id);
  const skip=page.getByRole('button',{name:'Arriver directement',exact:true});if(await skip.isVisible())await skip.click();
 }
 await expect(page.locator('.episode-line')).toContainText('bloque ta sortie');await expect(page.locator('.scene-consequence')).toHaveAttribute('data-working','false');if(info.project.name==='iphone')await page.getByRole('button',{name:'Voir la scène sans les panneaux de lecture',exact:true}).click();await page.locator('.prop-inspect').click();await expect(page.locator('.prop-closeup [role=status]')).toContainText('refuse');mkdirSync('../production/qa/evidence/story-remediation',{recursive:true});await page.screenshot({path:`../production/qa/evidence/story-remediation/w10-portico-${info.project.name}.png`});await page.locator('.prop-close').click();if(info.project.name==='iphone')await page.getByRole('button',{name:'Revenir aux dialogues et aux choix',exact:true}).click();await page.getByRole('button',{name:'Exiger le reçu du refus',exact:true}).click();const skip=page.getByRole('button',{name:'Arriver directement',exact:true});if(await skip.isVisible())await skip.click();await expect(page.locator('[data-ui=end-outcome]')).toBeVisible();await page.locator('[data-ui=end-sheet]>summary').click();await expect(page.locator('[data-consequence=exit-receipt]')).toBeVisible();
});
