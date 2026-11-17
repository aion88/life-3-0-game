import {test,expect} from '@playwright/test';
import {seedSave,seedJson,continueIfAsked,LINES} from '../support/e2e';
import {mkdirSync} from 'node:fs';
for(const [world,line] of [['w10',LINES.w10],['w03','BAABBACBBAD']] as const) test(`portrait reading and observation ${world}`,async({page},info)=>{
 test.skip(info.project.name==='desktop','Portrait controls only');
 await page.setViewportSize({width:390,height:844});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await seedSave(page,seedJson({lang:'fr',phase:'street',line}));await page.goto('/?parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 
 const host=page.locator(world==='w10'?'.episode':'.journey');const toggle=page.locator('.scene-reading-toggle');
 await expect(toggle).toBeVisible();
 await expect(page.locator('.illustrated-view')).toHaveAttribute('data-ready','true');
 await expect.poll(async()=>(await page.locator('.iv-frame').boundingBox())?.height??0).toBeGreaterThan(250);
 const frame=await page.locator('.iv-frame').boundingBox();
 const sceneBefore=await host.getAttribute('data-scene');
 await toggle.click();await expect(host).toHaveAttribute('data-observing','true');await expect(page.locator('.scene-choices')).toBeHidden();
 await expect.poll(async()=>(await page.locator('.iv-frame').boundingBox())?.height??0).toBeGreaterThan(frame!.height);
 await expect(toggle).toHaveText('Revenir aux choix');await toggle.click();await expect(page.locator('.scene-choices')).toBeVisible();await expect(host).toHaveAttribute('data-observing','false');
 expect(await host.getAttribute('data-scene')).toBe(sceneBefore);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);expect(overflow).toBe(false);
 const dir='../production/qa/evidence/remediation';mkdirSync(dir,{recursive:true});await page.screenshot({path:`${dir}/${world}-reading-${info.project.name}.png`});expect(errors).toEqual([]);
});
