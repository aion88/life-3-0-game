import {test,expect} from '@playwright/test';
import {L} from '../support/episode_labels';
import {seedSave,seedJson,continueIfAsked,LINES} from '../support/e2e';
async function enter(page:import('@playwright/test').Page,line=LINES.w10){await seedSave(page,seedJson({lang:'fr',phase:'street',line}));await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);await page.locator('.illustrated-view[data-ready=true]').waitFor();}
test('1984 loads one renderer without the old district requests',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));await enter(page);
 await expect(page.locator('canvas')).toHaveCount(1);expect(requests.filter(u=>/w10\/scene|w10\/nav|environment\.glb/.test(u))).toEqual([]);
 await expect(page.locator('.episode-options button').first()).toBeEnabled();
 await page.locator('.episode-options button').first().click();const skip=page.getByRole('button',{name:'Arriver directement',exact:true});if(await skip.isVisible())await skip.click();await expect(page.locator('canvas')).toHaveCount(1);
});
test('missing decor leaves the story playable and retry restores it',async({page})=>{
 let fail=true;await page.route('**/illustrated/**',route=>fail?route.abort('failed'):route.continue());await enter(page);
 await expect(page.locator('.illustrated-view')).toHaveAttribute('data-image-state','fallback');await expect(page.locator('.episode-options button').first()).toBeEnabled();
 fail=false;await page.locator('[data-ui=retry-plate]').click();await expect(page.locator('.illustrated-view')).toHaveAttribute('data-image-state','ready');
});

test('portrait framing preserves plate proportions and expands for observation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await enter(page);
 const frame=page.locator('.iv-frame');const before=await frame.boundingBox();expect(before!.height).toBeGreaterThan(260);expect(before!.width/before!.height).toBeCloseTo(16/9,1);
 await page.getByRole('button',{name:'Voir la scène sans les panneaux de lecture'}).click();await expect.poll(async()=> (await frame.boundingBox())!.height).toBeGreaterThan(before!.height+100);
});

test('renderer completing during a welcome press does not lose the click',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/characters/*.glb',async route=>{await gate;await route.continue();});
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'BAABBACBBAD'}));
 await page.goto('/?episode=court&parcours=ancien');
 const resume=page.locator('[data-ui=resume-continue]');await expect(resume.or(page.locator('[data-option]').first()).first()).toBeVisible();if(await resume.count())await resume.click();
 // No welcome window any more: the first press of the story is the first option, pressed while the renderer completes.
 const start=page.locator('[data-option]').first();await expect(start).toBeVisible();await start.scrollIntoViewIfNeeded();
 const title=page.locator('.journey h2').first();const before=await title.textContent();const optionId=await start.getAttribute('data-option');
 const rect=await start.boundingBox();
 await page.mouse.move(rect!.x+rect!.width/2,rect!.y+rect!.height/2);await page.mouse.down();release();
 await page.locator('.illustrated-view[data-ready=true]').waitFor();
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await page.mouse.up();
 // The click was not lost: the pressed option is spent, the scene moved on.
 await expect.poll(async()=>(await title.textContent())!==before||(await page.locator(`[data-option="${optionId}"]`).count())===0).toBe(true);
});

test('automatic dinner camera cuts keep the gesture buttons mounted',async({page})=>{
 await enter(page);
 for(const label of [L('arrival','help'),L('plant','accept'),'Retrouver Marlène pour dîner']){
  await page.getByRole('button',{name:label,exact:true}).click();const skip=page.getByRole('button',{name:'Arriver directement',exact:true});if(await skip.isVisible())await skip.click();
 }
 const chair=await page.getByRole('button',{name:L('dinner','stay'),exact:true}).elementHandle();
 await page.clock.install();await page.clock.runFor(2400);expect(await chair!.evaluate(node=>node.isConnected)).toBe(true);
 await page.getByRole('button',{name:L('dinner','stay'),exact:true}).click();/* the confession shows one gesture: it is applied without a press, so the request follows */await expect(page.locator('.episode-hud')).toHaveAttribute('data-scene','request');
});

test('arrival and dinner inspection controls are not covered by prior impacts',async({page})=>{
 await page.setViewportSize({width:390,height:664});await enter(page);
 for(const label of [L('arrival','help'),L('plant','accept'),'Retrouver Marlène pour dîner']){
  await page.getByRole('button',{name:label,exact:true}).click();const skip=page.getByRole('button',{name:'Arriver directement',exact:true});if(await skip.isVisible()){await expect(page.locator('.choice-impact')).toHaveCount(0);await skip.click();}
 }
 await page.getByRole('button',{name:'Observer la pièce',exact:true}).click();await page.locator('[data-inspect=bracelet]').click();await expect(page.locator('.choice-impact')).toHaveCount(0);await page.getByRole('button',{name:'Revenir à la table',exact:true}).click();await expect(page.getByRole('button',{name:L('dinner','stay'),exact:true})).toBeVisible();
});
