import {expect,it} from 'vitest';
import {journeys} from '../../../src/worlds/catalogue';
import {blockedReason,decide,startJourney,restoreJourney,serializeJourney} from '../../../src/worlds/state';
import {journeyConsequences} from '../../../src/worlds/consequences';
import {freshEpisode,choose,episodeConsequences,optionsFor} from '../../../src/street/episode/story';
import type {Journey,JourneyState} from '../../../src/worlds/types';
function endPath(j:Journey,s:JourneyState=startJourney(j)):JourneyState{
 const scene=j.scenes.find(x=>x.id===s.scene)!;
 if(scene.ending)return s;
 for(const o of scene.options){if(!blockedReason(s,o,j)){const next=endPath(j,decide(j,s,o.id));if(next)return next;}}
 throw new Error('No final practical decision');
}
for(const j of Object.values(journeys))it(`${j.id}: current decisions reach an ending and the result survives reload`,()=>{
 const completed=endPath(j),scene=j.scenes.find(s=>s.id===completed.scene)!;
 expect(scene.ending).toBeTruthy();
 expect(completed.choices.length).toBeGreaterThan(0);
 expect(restoreJourney(j,serializeJourney(j,completed))).toEqual(completed);
 expect(journeyConsequences(j.id,completed)).toBeDefined();
});
it('response performs its gesture once and a legacy two-step save still replays',()=>{
 const j=journeys.w01,initial=startJourney(j),respond=decide(j,initial,'respond_1');
 expect(respond.scene).toBe('home');expect(respond.inventory).toHaveLength(1);
 const legacy={v:1,world:'w01',choices:[{scene:'encounter_1',option:'respond_1'},{scene:'encounter_1_1',option:'act'}]};
 const restored=restoreJourney(j,JSON.stringify(legacy));expect(restored.scene).toBe('home');expect(restored.inventory).toEqual(respond.inventory);
});
it('1984 visibly denies exit after signing and permits it before a restriction exists',()=>{
 const signed=['help','accept','dinner','stay','hear','alone','appeal','enter','inspect','witness'].reduce(choose,freshEpisode());
 expect(optionsFor(signed).find(o=>o.id==='check_exit')?.next).toBe('exit_check');
 const refused=choose(choose(signed,'check_exit'),'receipt');expect(refused.scene).toBe('end');expect(episodeConsequences(refused).some(f=>f.id==='exit-receipt')).toBe(true);
 const quiet=['ask','decline','dinner','leave','hear','alone','report','delete'].reduce(choose,freshEpisode());
 // Explicitly test rule boundary without relying on a particular optional detour.
 expect(optionsFor({...quiet,scene:'return',exposure:0,memories:[]}).find(o=>o.id==='check_exit')?.next).toBe('end');
});
it('1984 trust opens a shared follow-up, but reporting your mother closes it',()=>{
 const s={...freshEpisode(),scene:'return',trust:3};expect(optionsFor(s).some(o=>o.id==='plan_together')).toBe(true);
 expect(optionsFor({...s,memories:['Tu as signalé Marlène.']}).some(o=>o.id==='plan_together')).toBe(false);
});

import {journeyMaterial} from '../../../src/worlds/consequences';
it('material demonstrations never invent repaired wheels, water, privacy or warmth',()=>{
 const empty=(world:keyof typeof journeys)=>startJourney(journeys[world]);
 expect(journeyMaterial('w03',empty('w03'),'workshop')?.active).toBe(false);
 expect(journeyMaterial('w03',{...empty('w03'),inventory:['Remorque réparée']},'workshop')?.active).toBe(true);
 const privateWater={...empty('w06'),inventory:['Demande privée','Plan de réparation','Intervention privée'],choices:[{scene:'repair',option:'contract_private'}]};
 expect(journeyMaterial('w06',privateWater,'square')?.active).toBe(false);
 expect(journeyMaterial('w06',{...empty('w06'),choices:[{scene:'repair',option:'share'}]},'square')?.active).toBe(true);
 expect(journeyMaterial('w09',{...empty('w09'),inventory:['Photo diffusée','Rideau déplacé']},'home')?.active).toBe(false);
 expect(journeyMaterial('w11',{...empty('w11'),inventory:['Fagot','Joint réparé']},'home')?.active).toBe(false);
});
it('the old housing key still works before the announced evening expiry',()=>{
 const initial=startJourney(journeys.w01);expect(journeyMaterial('w01',initial,'home')?.active).toBe(true);expect(journeyMaterial('w01',initial,'home')?.detail).toContain('expirera ce soir');
 const refused={...initial,choices:[{scene:'desk',option:'walk'}]};expect(journeyMaterial('w01',refused,'line')?.active).toBe(false);
});
it('later choices cannot be erased by old inventory flags in the visual report',()=>{
 const archive={...startJourney(journeys.w08),inventory:['Droit de discuter'],choices:[{scene:'lesson',option:'archive'}]};expect(journeyConsequences('w08',archive).find(f=>f.id==='different')?.label).toContain('non transmis');
 const shown={...startJourney(journeys.w09),inventory:['Photo confiée','Rideau déplacé'],choices:[{scene:'moment',option:'show'}]};expect(journeyConsequences('w09',shown).some(f=>f.id==='photo')).toBe(true);expect(journeyConsequences('w09',shown).find(f=>f.id==='photo-shown')?.detail).toContain('distinct');expect(journeyMaterial('w09',shown,'home')?.active).toBe(true);
});
