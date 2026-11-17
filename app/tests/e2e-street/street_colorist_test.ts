import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const evidence='../production/qa/evidence/street/colorist-integrated';
mkdirSync(evidence,{recursive:true});
for (const mobile of [false,true]) test(`approved colorist plates load at full frame, ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 for(const [world,place,file] of [['w02','oracle','oracle'],['w05','cafe','cafe'],['w11','pylons','pylons']]){
  await page.goto(`/?atelier=mondes&monde=${world}&lieu=${place}`);
  await expect(page.locator('.illustrated-view')).toHaveAttribute('data-ready','true');
  const background=page.locator('.iv-background');
  await expect(background).toHaveCSS('background-size','100% 100%');
  await expect(background).toHaveCSS('background-image',new RegExp(`illustrated/colorist/${file}\\.jpg`));
  await page.getByRole('button',{name:'Plan rapproché',exact:true}).click();
  await expect(background).toHaveCSS('background-size','100% 100%');
  await page.getByRole('button',{name:'Plan d’ensemble',exact:true}).click();
  await page.screenshot({path:`${evidence}/${world}-${mobile?'mobile':'desktop'}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect(errors).toEqual([]);
});
test('gallery decodes all new and previous backgrounds and supports comparison and enlargement',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/galerie-life.html');
 await expect(page.locator('figure')).toHaveCount(48);
 const decoded=await page.evaluate(async()=>{
  const urls=new Set<string>();
  for(const figure of document.querySelectorAll<HTMLElement>('figure'))for(const css of [figure.dataset['current'],figure.dataset['previous']]){const url=css?.match(/url\(([^)]+)\)/)?.[1];if(url)urls.add(url);}
  return Promise.all([...urls].map(async url=>{const image=new Image();image.src=url;await image.decode();return {url,width:image.naturalWidth,height:image.naturalHeight};}));
 });
 expect(decoded.length).toBeGreaterThanOrEqual(28);
 expect(decoded.every(i=>i.width>0&&i.height>0)).toBe(true);
 const cafe=page.locator('figure[data-name="Le Café du Pont"]');
 await cafe.getByRole('button',{name:'Avant',exact:true}).click();
 await expect(cafe.locator('.plate')).toHaveCSS('background-image',/illustrated\/cafe\.jpg/);
 await cafe.getByRole('button',{name:'Dans le jeu',exact:true}).click();
 await expect(cafe.locator('.plate')).toHaveCSS('background-image',/illustrated\/colorist\/cafe\.jpg/);
 await cafe.getByRole('button',{name:'Agrandir',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 expect(errors).toEqual([]);
});
