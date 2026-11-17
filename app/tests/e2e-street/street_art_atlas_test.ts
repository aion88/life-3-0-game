import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { journeys } from '../../src/worlds/catalogue';

// Exercise every cached location, including rooms not reached by the success path.
for (const journey of Object.values(journeys)) test(`art atlas ${journey.id}: every location renders and preserves the save`, async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('aiaftermath.v2.save','atlas-preservation-sentinel'));
  await page.goto(`/?atelier=mondes&monde=${journey.id}`);
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.getByLabel('Monde à regarder')).toHaveValue(journey.id);
  mkdirSync('public/apercus/lieux',{recursive:true});
  for(const place of journey.locations){
    await page.getByLabel('Lieu à regarder').selectOption(place.id);
    await expect(page.getByRole('heading')).toHaveText(place.name);
    await expect(page.locator('.journey-view')).toHaveAttribute('data-location',place.id);
    await expect(page.locator('.journey-view')).toHaveAttribute('data-photographic','true');
    await page.waitForTimeout(150);
    const clean=await page.addStyleTag({content:'.soraya-studio header,.soraya-studio nav,.soraya-note{visibility:hidden!important}'});
    await page.screenshot({path:`public/apercus/lieux/${journey.id}-${place.id}.png`});
    await clean.evaluate(n=>n.parentNode?.removeChild(n));
  }
  await page.getByLabel('Lieu à regarder').selectOption(journey.locations[0]!.id);
  await page.getByRole('button',{name:'Plan rapproché',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByLabel('Lieu à regarder')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  mkdirSync('../production/qa/evidence/street/2026-11-09-art-direction',{recursive:true});
  await page.screenshot({path:`../production/qa/evidence/street/2026-11-09-art-direction/${journey.id}-mobile.png`});
  expect(await page.evaluate(()=>localStorage.getItem('aiaftermath.v2.save'))).toBe('atlas-preservation-sentinel');
  expect(errors).toEqual([]);
});
