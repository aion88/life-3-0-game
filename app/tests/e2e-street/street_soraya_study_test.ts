import { finishJourneyTravel } from '../support/journey_navigation';
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { seedSave, seedJson, continueIfAsked, SAVE_KEY } from '../support/e2e';
test.use({deviceScaleFactor:2});
const dir='../production/qa/evidence/street/2026-11-09-soraya';mkdirSync(dir,{recursive:true});
async function timings(page:Page) {
 return page.evaluate(()=>new Promise<{medianMs:number;p95Ms:number;frames:number}>(resolve=>{
  const deltas:number[]=[];let before=0;
  const tick=(t:number)=>{if(before)deltas.push(t-before);before=t;if(deltas.length<120)requestAnimationFrame(tick);else{deltas.sort((a,b)=>a-b);resolve({medianMs:deltas[60]!,p95Ms:deltas[114]!,frames:deltas.length});}};
  requestAnimationFrame(tick);
 }));
}
for(const mobile of [false,true])test(`Soraya photographic study ${mobile?'mobile viewport':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>localStorage.setItem('aiaftermath.v2.save','study-does-not-touch-my-save'));
 await page.goto('/?atelier=soraya');await page.waitForSelector('html[data-ready="1"]');
 await expect(page.locator('.journey-view[data-photographic=true]')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Le logement sans serrure'})).toBeVisible();
 await page.waitForTimeout(400);
 await page.screenshot({path:`${dir}/${mobile?'mobile':'desktop'}-photo.png`});
 const photo=await timings(page);
 await page.locator('[data-ui=photo-toggle]').click();
 await expect(page.locator('.journey-view[data-photographic=false]')).toBeVisible();
 await page.waitForTimeout(200); const plain=await timings(page);
 await page.screenshot({path:`${dir}/${mobile?'mobile':'desktop'}-plain.png`});
 await page.locator('[data-ui=photo-toggle]').click();
 await page.getByRole('button',{name:'Plus près de Soraya',exact:true}).click();
 await page.screenshot({path:`${dir}/${mobile?'mobile':'desktop'}-portrait.png`});
 expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe('study-does-not-touch-my-save');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
 writeFileSync(`${dir}/${mobile?'mobile':'desktop'}-timings.json`,JSON.stringify({device:'Chrome on development Mac; DPR 2 emulation capped to 4 million render pixels, not a physical phone',photo,plain},null,2));
});
test('Soraya prototype is integrated into the actual journey and keeps photographic rendering after leaving',async({page})=>{
 await page.setViewportSize({width:1440,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'DBCAAACBDAD'}));
 await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 
 await expect(page.locator('[data-ui=current-location]')).toHaveText('Le logement sans serrure');
 await expect(page.locator('.journey-view[data-photographic=true]')).toBeVisible();
 await page.screenshot({path:`${dir}/gameplay-desktop.png`});
 await page.locator('[data-option=ours]').click();await finishJourneyTravel(page);
 await expect(page.locator('.journey-view[data-photographic=true]')).toBeVisible();
 await expect(page.locator('[data-ui=current-location]')).toHaveText('Le jardin des itinéraires');
 expect(errors).toEqual([]);
});
