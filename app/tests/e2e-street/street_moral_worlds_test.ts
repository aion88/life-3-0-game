import {test,expect} from '@playwright/test';
import {moralMoments,type MoralWorld} from '../../src/worlds/moralMoments';
const evidence='../production/qa/evidence/local-feedback';
test('ten worlds: both moral outcomes, world-specific rules and no lighting leaks',async({page},info)=>{
 test.setTimeout(180_000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?atelier=dilemmes&monde=w05');
 const host=page.locator('.moral-studio'),select=page.getByRole('combobox',{name:'Choisir un monde'});
 const ready=async(id:string)=>{await expect(host).toHaveAttribute('data-world',id);await expect(host).toHaveAttribute('data-ready','true');};
 await ready('w05');await expect(host).toHaveAttribute('data-scene-light','infrared');await expect(page.locator('.ms-event')).toContainText('COUPURE DE COURANT');await expect(page.locator('.iv-background')).not.toHaveCSS('filter','none');
 await page.locator('.ms-options button:not(:disabled)').first().click();await page.getByRole('button',{name:'Voir le lieu suivant',exact:true}).click();await expect(host).toHaveAttribute('data-scene-light','natural');await expect(page.locator('.iv-background')).toHaveCSS('filter','none');
 for(const world of Object.keys(moralMoments) as MoralWorld[]){
  await select.selectOption(world);await ready(world);await expect(page.locator('.ms-rule')).toHaveText(moralMoments[world].rule);
  await expect(host).toHaveAttribute('data-scene-light',world==='w05'?'infrared':'natural');if(world!=='w05')await expect(page.locator('.iv-background')).toHaveCSS('filter','none');
  const available=await page.locator('.ms-options button:not(:disabled)').evaluateAll(bs=>bs.map(b=>(b as HTMLElement).dataset['option']!));expect(available.length).toBeGreaterThanOrEqual(2);
  await page.screenshot({path:`${evidence}/moral-${world}-${info.project.name}.png`});
  for(const option of available){
   await page.locator(`.ms-options [data-option="${option}"]`).click();for(const [who,what] of moralMoments[world].results[option]!){await expect(page.locator('.ms-result')).toContainText(who);await expect(page.locator('.ms-result')).toContainText(what);}
   await page.getByRole('button',{name:'Essayer l’autre choix',exact:true}).click();await ready(world);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect(errors).toEqual([]);
});
