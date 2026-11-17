import {pressIdsUntilSpeaker} from '../support/world_routes';
import {expect,test} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {seedSave,seedJson,continueIfAsked} from '../support/e2e';
import {journeys} from '../../src/worlds/catalogue';
import {finishJourneyTravel} from '../support/journey_navigation';
const pupilPath=():string[]=>pressIdsUntilSpeaker(journeys.w08,'L’ÉLÈVE');
// ROUGE CONNU (arbitrage Cynthia en attente) : en forme courte, les scènes encounter_*/aftermath_*/handoff_* sont injoignables (shortForm.ts du 12 novembre), donc aucune scène de L'ÉLÈVE ne se joue. Ne pas affaiblir ce test.
test('Descendants gives the pupil a dedicated visible robot, including after reload',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await seedSave(page,seedJson({lang:'fr',phase:'street',line:'BBABBBCBDAB'}));await page.goto('/?parcours=ancien');await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);
 for(const id of pupilPath()!){await page.locator(`.journey-options [data-option="${id}"]`).click();await finishJourneyTravel(page);}
 const view=page.locator('.illustrated-view');await expect(view).toHaveAttribute('data-speaker','eleve');await expect(view).toHaveAttribute('data-speaker-body','robot.student');await page.waitForTimeout(600);
 const dir='../production/qa/evidence/character-remediation';mkdirSync(dir,{recursive:true});await page.screenshot({path:`${dir}/robot-${info.project.name}.png`});await page.reload();await page.waitForSelector('html[data-ready="1"]');await continueIfAsked(page);await expect(view).toHaveAttribute('data-speaker-body','robot.student');expect(errors).toEqual([]);
});
