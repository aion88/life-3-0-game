/**
 * Public smoke of the DEFAULT path (no `?parcours=`): French short mode, Atlas inside the home page, worlds opened on the situation player.
 * Story type: Integration (BLOCKING). Run after going live: see production/release/2026-11-14-procedure-mise-en-ligne.md, "Fumée du parcours par défaut".
 * Every scenario starts from a brand-new browser context (no save). No fixed waits: only states.
 */
import {test,expect,type Page} from '@playwright/test';

/** Collects JS errors and failed requests; requests cancelled by a navigation (WebKit reports them) are not failures. */
function watch(page:Page){
 const problems:string[]=[];
 page.on('pageerror',e=>problems.push(`pageerror: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error')problems.push(`console.error: ${m.text()}`);});
 page.on('requestfailed',r=>{const why=r.failure()?.errorText??'';if(/abort|cancel/i.test(why))return;problems.push(`requestfailed: ${r.url()} ${why}`);});
 page.on('response',r=>{if(r.status()>=400)problems.push(`http ${r.status()}: ${r.url()}`);});
 return problems;
}
const home=async(page:Page):Promise<void>=>{await page.goto('/');await page.waitForSelector('html[data-ready="1"]');};
const top=async(page:Page,selector:string):Promise<number>=>page.locator(selector).first().evaluate((e:Element)=>e.getBoundingClientRect().top+window.scrollY);

test('1 home: play, contact, Atlas placed between Play and resources, no horizontal scroll',async({page})=>{
 const problems=watch(page);
 await home(page);
 const play=page.getByRole('button',{name:'Jouer',exact:true});
 await expect(play).toBeVisible();
 const contact=page.getByRole('link',{name:'Contact / Donner mon avis'});
 await expect(contact).toBeVisible();
 await expect(contact).toHaveAttribute('href',/^mailto:[^@\s?]+@[^@\s?]+\.[a-z]+/i);
 await expect(page.locator('[data-ui="open-atlas"]')).toHaveCount(0);
 await expect(page.locator('[data-ui="home-atlas"] .atlas')).toHaveCount(1);
 const playTop=await top(page,'.life-entry-intro button, [data-lang=fr]');
 const atlasTop=await top(page,'[data-ui="home-atlas"] .atlas');
 const resourcesTop=await top(page,'.life-resources');
 expect(atlasTop,'Atlas below Play').toBeGreaterThan(playTop);
 expect(atlasTop,'Atlas above resources').toBeLessThan(resourcesTop);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(problems).toEqual([]);
});

test('2 Atlas in the home page: spread timeline, gauge, sheet opens with an https link and closes',async({page})=>{
 const problems=watch(page);
 await home(page);
 const atlas=page.locator('[data-ui="home-atlas"]');
 await expect.poll(()=>atlas.locator('svg.at-tl .at-mk').count()).toBeGreaterThan(40);
 // Below 760 px the SVG frieze is hidden by design (atlas.css) and the same laws are read as one button per law in a vertical list.
 const wide=await atlas.locator('svg.at-tl').evaluate((e:Element)=>e.getBoundingClientRect().width>0);
 const markers=wide?atlas.locator('svg.at-tl .at-mk'):atlas.locator('.at-tl-v .at-tkb');
 if(wide){
  const spread=await page.evaluate(()=>{
   const all=[...document.querySelectorAll('[data-ui="home-atlas"] svg.at-tl .at-mk')];
   const a=all[0]!.getBoundingClientRect(),b=all[all.length-1]!.getBoundingClientRect();
   return {dx:Math.abs(b.x-a.x),transforms:[all[0]!,all[all.length-1]!].map(e=>getComputedStyle(e).transform)};
  });
  expect(spread.dx,'first and last markers must not be stacked').toBeGreaterThan(50);
  for(const t of spread.transforms)expect(t,'markers keep their transform').not.toBe('none');
 }
 else expect(await markers.count(),'vertical list carries the laws').toBeGreaterThan(40);
 const count=await markers.count();
 // A gauge bar of the "what the sources measure" block (the extinction worlds' measures) has a real width.
 // (No gauge sits inside a world card named Autodestruction: the gauges are the `.at-ctile.has-gauge` tiles of `.at-outblock`.)
 const fill=page.locator('[data-ui="home-atlas"] .at-outblock .at-ctile.has-gauge .at-gfill').first();
 await expect(fill).toHaveCount(1);
 await fill.scrollIntoViewIfNeeded();
 expect((await fill.boundingBox())?.width??0,'gauge fill width').toBeGreaterThan(0);
 // A marker opens a sheet with an https link; the sheet closes.
 const marker=markers.nth(Math.floor(count/2));
 await marker.scrollIntoViewIfNeeded();
 if(wide)await marker.dispatchEvent('click');else await marker.click();
 const sheet=page.locator('.at-sheet');
 await expect(sheet).toBeVisible();
 await expect(sheet.locator('a[href^="https://"]').first()).toBeVisible();
 await sheet.locator('.at-sheet-close').click();
 await expect(sheet).toBeHidden();
 expect(problems).toEqual([]);
});

test('3 default path to an ending: Atlas and contact on the end screen, Atlas lights a world and Back returns',async({page})=>{
 const problems=watch(page);
 await home(page);
 await page.getByRole('button',{name:'Jouer',exact:true}).click();
 await page.getByTestId('warning-continue').click();
 const scene=page.locator('[data-testid="q-scene"]');
 // Always the first choice; the questionnaire has no Continue button, the last answer leaves straight for the world (no chronology screen in between).
 // A world (situation player) or, if the first choices lead to extinction, the bilan.
 const player=page.locator('.sp[data-ready="1"]');
 const bilanAtlas=page.locator('[data-testid="bilan-atlas"]');
 const arrived=player.or(bilanAtlas);
 for(let guard=0;guard<40&&!(await arrived.isVisible());guard++){
  const first=page.locator('[data-option]').first();
  await expect(first.or(arrived)).toBeVisible({timeout:60_000});
  if(await arrived.isVisible())break;
  const before=await scene.textContent().catch(()=>null);
  await first.click();
  await expect(async()=>{if(await arrived.isVisible()||!(await scene.count()))return;expect(await scene.textContent()).not.toBe(before);}).toPass();
 }
 await expect(page.locator('[data-ui="retrospective"]')).toHaveCount(0);
 await expect(player.or(bilanAtlas)).toBeVisible({timeout:60_000});
 if(await player.count()){
  await enterWorld(page);
  for(let i=0;i<4;i++){
   const targets=page.locator('.sp[data-busy="false"] .sp-target:not([disabled])');
   await expect(targets.first()).toBeVisible({timeout:30_000});
   await targets.first().click();
   if(i<3)await expect(page.locator('.sp')).toHaveAttribute('data-situation',String(i+2));
  }
  await expect(page.locator('.sp')).toHaveAttribute('data-phase','end');
 }
 const atlasButton=page.locator('[data-ui="open-atlas"], [data-testid="bilan-atlas"]').first();
 await expect(atlasButton).toBeVisible({timeout:30_000});
 await expect(page.locator('[data-ui="contact"]').first()).toBeVisible();
 await atlasButton.click();
 await expect(page.locator('.atlas[data-lit]')).toHaveCount(1);
 await page.getByTestId('atlas-back').click();
 await expect(page.locator('[data-ui="open-atlas"], [data-testid="bilan-atlas"]').first()).toBeVisible({timeout:30_000});
 expect(problems).toEqual([]);
});

/** Answers the questionnaire with `pick(index)` (0 = first option) and enters the world obtained; returns false when the answers lead to an extinction (the bilan). */
async function answerAndEnter(page:Page,pick:(i:number)=>'first'|'last'):Promise<boolean>{
 await page.getByRole('button',{name:'Jouer',exact:true}).click();
 await page.getByTestId('warning-continue').click();
 const scene=page.locator('[data-testid="q-scene"]');
 // The last answer leaves straight for the world (or the bilan): no chronology screen in between.
 const player=page.locator('.sp[data-ready="1"]');
 const arrived=player.or(page.locator('[data-testid="bilan-atlas"]'));
 for(let i=0;i<40&&!(await arrived.isVisible());i++){
  const options=page.locator('[data-option]');
  await expect(options.first().or(arrived)).toBeVisible({timeout:60_000});
  if(await arrived.isVisible())break;
  const before=await scene.textContent().catch(()=>null);
  await (pick(i)==='first'?options.first():options.last()).click();
  await expect(async()=>{if(await arrived.isVisible()||!(await scene.count()))return;expect(await scene.textContent()).not.toBe(before);}).toPass();
 }
 await expect(arrived).toBeVisible({timeout:60_000});
 return (await player.count())>0;
}
/** Passes the world's arrival card (shown before the first situation) when it is on screen. */
async function enterWorld(page:Page):Promise<void>{
 const enter=page.locator('.sp[data-phase="intro"] .sp-enter');
 if(await enter.count())await enter.click();
}
/** Plays the four situations of the world on screen (first target each time) up to the end ticket. */
async function playToEnd(page:Page):Promise<void>{
 await enterWorld(page);
 for(let i=0;i<4;i++){
  const targets=page.locator('.sp[data-busy="false"] .sp-target:not([disabled])');
  await expect(targets.first()).toBeVisible({timeout:30_000});
  await targets.first().click();
  if(i<3)await expect(page.locator('.sp')).toHaveAttribute('data-situation',String(i+2));
 }
 await expect(page.locator('.sp')).toHaveAttribute('data-phase','end');
 await expect(page.locator('[data-ui="open-atlas"]')).toBeVisible({timeout:30_000});
}

test('4 explored world: the Atlas lights the world PLAYED last, not the questionnaire one, and Back returns to its end screen',async({page})=>{
 const problems=watch(page);
 await home(page);
 // First answers that lead to an inhabited world (an extinction has no situation player): first option, then last, then alternating.
 const strategies:Array<(i:number)=>'first'|'last'>=[()=>'first',()=>'last',i=>i%2?'last':'first'];
 let entered=false;
 for(const [n,strategy] of strategies.entries()){
  if(n>0){await page.evaluate(()=>localStorage.clear());await home(page);}
  entered=await answerAndEnter(page,strategy);
  if(entered)break;
 }
 expect(entered,'no questionnaire strategy led to an inhabited world').toBe(true);
 const first=await page.locator('.sp').getAttribute('data-world');
 await playToEnd(page);
 await page.locator('.sp-action[data-action="worlds"]').click();
 const other=page.locator(`.sp-world-link:not([data-world="${first}"])`).first();
 await expect(other).toBeVisible();
 const explored=await other.getAttribute('data-world');
 expect(explored).not.toBe(first);
 await other.click();
 await expect(page.locator('.sp')).toHaveAttribute('data-world',explored!);
 await expect(page.locator('.sp[data-ready="1"]')).toBeVisible();
 await playToEnd(page);
 await page.locator('[data-ui="open-atlas"]').click();
 const atlas=page.locator('.atlas[data-lit]');
 await expect(atlas).toHaveCount(1);
 await expect(atlas,`lit world must be the explored one (${explored}), not ${first}`).toHaveAttribute('data-lit',explored!);
 const arrival=page.locator('.at-arrival');
 await expect(arrival).toContainText('Ton monde');
 expect(await arrival.textContent()).not.toMatch(/\bw\d{2}\b/);
 // The header's name must be the Atlas's own name for the explored id (the player's list shows situation titles, not Atlas names).
 const headerName=/Ton monde : (.+?)\./.exec((await arrival.textContent())!)?.[1]?.toLowerCase()??'';
 const cardText=(await page.locator(`.atlas [data-world="${explored}"]`).allTextContents()).join(' ').toLowerCase();
 expect(headerName.length,'header carries a world name').toBeGreaterThan(2);
 expect(cardText,`Atlas entries of ${explored} carry the header's name`).toContain(headerName);
 await page.getByTestId('atlas-back').click();
 await expect(page.locator('.sp')).toHaveAttribute('data-world',explored!);
 await expect(page.locator('.sp')).toHaveAttribute('data-phase','end');
 expect(problems).toEqual([]);
});
