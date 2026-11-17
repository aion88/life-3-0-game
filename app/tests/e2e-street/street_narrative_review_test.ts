import {expect,test,type Page} from '@playwright/test';
import {L} from '../support/episode_labels';
import {seedSave,seedJson,continueIfAsked,LINES} from '../support/e2e';
import {CANONICAL_LINES} from '../fixtures/canonical-lines';
import {journeys} from '../../src/worlds/catalogue';
import {startJourney,decide,blockedReason} from '../../src/worlds/state';
import {narrativeScene} from '../../src/worlds/narrative';
import type {Journey,JourneyState,JourneyWorldId} from '../../src/worlds/types';
import {finishJourneyTravel} from '../support/journey_navigation';
import {mkdirSync} from 'node:fs';
const evidence='../production/qa/evidence/narrative-review';
/** Composite translucent backgrounds before measuring actual rendered text contrast. */
async function readable(page:Page) {
 const failures=await page.locator('.stage-dialogue p,.stage-dialogue h1,.stage-dialogue h2,.stage-dialogue summary,.moral-card dd,.moral-card dt,.moral-card>strong,.scene-choices button,.scene-choices small,.dinner-reaction button').evaluateAll(nodes=>{
  const rgba=(value:string)=>{const n=value.match(/[\d.]+/g)?.map(Number)??[0,0,0];return [n[0]!,n[1]!,n[2]!,n[3]??1];};
  const over=(front:number[],back:number[])=>front.slice(0,3).map((v,i)=>v*front[3]!+back[i]!*(1-front[3]!)).concat(1);
  const light=(c:number[])=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i]!,0);
  return nodes.flatMap(node=>{
   if(!node.getClientRects().length || !node.textContent?.trim())return [];
   let parent:Element|null=node;const layers:number[][]=[];
   while(parent){const style=getComputedStyle(parent);const bg=rgba(style.backgroundColor);layers.push(bg);if(bg[3]===1)break;parent=parent.parentElement;}
   let bg=[18,35,40,1];for(const layer of layers.reverse())bg=over(layer,bg);
   const ink=over(rgba(getComputedStyle(node).color),bg);const a=light(ink),b=light(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   return ratio<4.5?[`${node.className||node.tagName}: ${ratio.toFixed(2)} ${node.textContent.slice(0,70)}`]:[];
  });
 });expect(failures).toEqual([]);
}
async function enter(page:Page,line:string) {await seedSave(page,seedJson({lang:'fr',phase:'street',line}));await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);}
test.use({locale:'fr-FR'});
for(const betrayed of [false,true])test(`1984: readable dinner, appeal and ${betrayed?'betrayal':'family'} outcome`,async({page},info)=>{
 await enter(page,LINES.w10);
 const labels=[L('arrival','help'),L('plant','accept'),'Retrouver Marlène pour dîner',L('dinner','stay'),L('request','alone'),...(betrayed?[L('checkpoint','report')]:[L('checkpoint','appeal'),L('appeal','enter')]),L('message','inspect'),L('evidence','witness'),L('return','honest')];
 for(const label of labels){
  await readable(page);
  if(info.project.name==='iphone'){const tools=await page.locator('.episode-tools').boundingBox(),goal=await page.locator('.episode-goals').boundingBox();expect(goal!.y).toBeGreaterThanOrEqual(tools!.y+tools!.height);}
  const scene=await page.locator('.episode-hud').getAttribute('data-scene');
  if(scene==='appeal')await expect(page.locator('.episode-line')).toContainText('restée chez elle');
  if(scene==='return'){await expect(page.locator('.episode-line')).toContainText('48 heures');if(betrayed)await expect(page.locator('.episode-line')).toContainText('signalement');}
  if(['dinner','evidence','return'].includes(scene!)){mkdirSync(evidence,{recursive:true});await page.screenshot({path:`${evidence}/w10-${scene}-${betrayed}-${info.project.name}.png`});}
  await page.getByRole('button',{name:label,exact:true}).click();
  const skip=page.getByRole('button',{name:'Arriver directement',exact:true});if(await skip.isVisible()){await readable(page);await skip.click();}
 }
 await expect(page.locator('.episode-report')).toContainText('48 heures');
});
function path(j:Journey,s:JourneyState=startJourney(j)):string[]|null {const scene=j.scenes.find(x=>x.id===s.scene)!;if(scene.ending)return scene.ending==='success'?[]:null;for(const o of scene.options){if(blockedReason(s,o,j))continue;const tail=path(j,decide(j,s,o.id));if(tail)return[o.id,...tail];}return null;}
for(const [world,line] of [...CANONICAL_LINES.filter(([id])=>id in journeys),['w09','DCCACBBBCBC'] as const])test(`${world}: reasons visible before each decision and readable consequences`,async({page},info)=>{
 const j=journeys[world as JourneyWorldId];await enter(page,line);
 let state=startJourney(j);
 const route=path(j)!;let at=0;
 /** A scene whose only displayed gesture is available is applied by the game itself (no press): the model follows it and reports what is told. */
 const settle=():string[]=>{const told:string[]=[];for(let guard=0;guard<12;guard++){
  const raw=j.scenes.find(x=>x.id===state.scene)!;if(raw.ending)break;
  const shown=narrativeScene(world as JourneyWorldId,raw,state).options.filter(o=>!(o.hideWhenBlocked&&blockedReason(state,o,j)!==null));
  const only=shown[0];if(shown.length!==1||!only||blockedReason(state,only,j)!==null)break;
  expect(only.id,`${world}: the automatic gesture is the route's next step`).toBe(route[at]);at++;told.push(only.consequence);state=decide(j,state,only.id);}
  return told;};
 settle();
 while(at<route.length){
  const id=route[at]!;
  const scene=j.scenes.find(s=>s.id===state.scene)!;
  if(!scene.interludeFor)await expect(page.locator('.journey-line')).toHaveText(narrativeScene(world as JourneyWorldId,scene,state).text);/* the text shown depends on what the route established */
  await readable(page);
  await page.locator(`.journey-options [data-option="${id}"]`).click();await finishJourneyTravel(page);
  state=decide(j,state,id);at++;
  // The scenes applied on their own are told in grey beside the next gesture, nothing is lost.
  const told=settle();
  if(!j.scenes.find(s=>s.id===state.scene)!.ending)for(const line of told)await expect(page.locator('.journey-told')).toContainText(line);
 }
 await expect(page.locator('.journey-ending')).toContainText('Objectif atteint');mkdirSync(evidence,{recursive:true});await page.screenshot({path:`${evidence}/${world}-end-${info.project.name}.png`});
});
