import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {seedSave,seedJson,continueIfAsked,LINES} from '../support/e2e';
const dir='../production/qa/full-audit';mkdirSync(dir,{recursive:true});
for(const [world,line] of [['w10',LINES.w10],['w03','BAABBACBBAD']] as const)test(`audit probe ${world}: loading and visible scene`,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const requests:{url:string;bytes:number}[]=[],pending:Promise<void>[]=[];
 page.on('requestfinished',r=>pending.push(r.sizes().then(s=>{requests.push({url:r.url(),bytes:s.responseBodySize});},()=>{})));
 const start=Date.now();await seedSave(page,seedJson({lang:'fr',phase:'street',line}));await page.goto('/?parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);await page.locator('.illustrated-view[data-ready=true]').waitFor();
 const readyMs=Date.now()-start;
 
 await page.waitForLoadState('networkidle');await Promise.all(pending);
 const measurements=await page.evaluate(async()=>{
  const frame=document.querySelector('.iv-frame')!.getBoundingClientRect();
  const panel=document.querySelector('.episode-dialogue,.journey-panel')!.getBoundingClientRect();
  const intervals:number[]=[];let last=await new Promise<number>(r=>requestAnimationFrame(r));for(let i=0;i<90;i++){const now=await new Promise<number>(r=>requestAnimationFrame(r));intervals.push(now-last);last=now;}
  intervals.sort((a,b)=>a-b);
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},frame:{width:frame.width,height:frame.height,y:frame.y},dialogue:{height:panel.height,y:panel.y},canvases:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height,visible:!!c.getClientRects().length&&getComputedStyle(c).visibility!=='hidden'})),horizontalOverflow:document.documentElement.scrollWidth>innerWidth,rafMedianMs:intervals[45],raf95Ms:intervals[85],note:'RAF timing on this Mac using browser emulation is not physical-phone GPU performance.'};
 });
 await page.screenshot({path:`${dir}/${world}-${info.project.name}.png`});
 writeFileSync(`${dir}/probe-${world}-${info.project.name}.json`,JSON.stringify({world,project:info.project.name,readyMs,transferredBytes:requests.reduce((a,r)=>a+r.bytes,0),requests:requests.length,largest:requests.sort((a,b)=>b.bytes-a.bytes).slice(0,8),errors,...measurements},null,2));expect(errors).toEqual([]);
});
