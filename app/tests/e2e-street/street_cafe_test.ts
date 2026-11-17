import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {seedSave,seedJson,continueIfAsked} from '../support/e2e';
const dir='../production/qa/evidence/street/cafe-reference';mkdirSync(dir,{recursive:true});
for(const mobile of [false,true])test(`Café reference ${mobile?'mobile':'desktop'}: detailed shots preserve choices`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
 await seedSave(page,seedJson({lang:'fr',phase:'street',line:'BBAAABBBDAA'}));
 await page.goto('/?episode=court&parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 
 // The arrival film no longer starts by itself: it is offered under "Regarder le café" and can be skipped once started.
 // ROUGE CONNU (défaut du jeu) : le film n'est plus lancé à l'arrivée ; le bouton « Voir l’arrivée depuis le quai » est sans effet quand le joueur est déjà au café (illustratedView.ts:156 renvoie aussitôt si location===current, runtime.ts:168-171 ne passe donc jamais cafeFilm à vrai pendant un plan).
 await expect(page.getByRole('button',{name:'Passer le plan du café',exact:true})).toHaveCount(0);
 await page.getByText('Regarder le café',{exact:true}).click();
 await page.getByRole('button',{name:'Voir l’arrivée depuis le quai',exact:true}).click();
 await expect(page.getByRole('button',{name:'Passer le plan du café',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Passer le plan du café',exact:true}).click();
 await expect(page.getByRole('button',{name:'Passer le plan du café',exact:true})).toHaveCount(0);
 const before=await page.evaluate(()=>JSON.stringify(localStorage));
 await page.screenshot({path:`${dir}/${mobile?'mobile':'desktop'}-jeu.png`});
 await page.getByText('Regarder le café',{exact:true}).click();
 for(const shot of ['counter','blankets','portrait','wide']) {
  await page.locator(`[data-cafe-shot=${shot}]`).click();
  await expect(page.locator('.journey-view[data-world]')).toHaveAttribute('data-shot',shot);
  await page.screenshot({path:`${dir}/${mobile?'mobile':'desktop'}-${shot}.png`});
 }
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const timings=await page.evaluate(()=>new Promise<number[]>(resolve=>{const frames:number[]=[];let last=0;const tick=(t:number)=>{if(last)frames.push(t-last);last=t;if(frames.length<120)requestAnimationFrame(tick);else resolve(frames.sort((a,b)=>a-b));};requestAnimationFrame(tick);}));
 writeFileSync(`${dir}/${mobile?'mobile':'desktop'}-timings.json`,JSON.stringify({device:'Development Mac; mobile viewport is not a physical phone',medianMs:timings[60],p95Ms:timings[114]}));
 expect(errors).toEqual([]);
});
