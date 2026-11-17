import { expect, it } from 'vitest';
import { journeys } from '../../../src/worlds/catalogue';
import { blockedReason, companionMood, decide, elapsed, restoreJourney, serializeJourney, startJourney } from '../../../src/worlds/state';
import { shortCosts } from '../../../src/worlds/shortForm';
import type { JourneyState } from '../../../src/worlds/types';
const j=journeys.w01;
const run=(ids:string[],from:JourneyState=startJourney(j)):JourneyState=>ids.reduce((state,id)=>{const next=decide(j,state,id);expect(next,`${state.scene}/${id}`).not.toBe(state);return next;},from);
const option=(state:JourneyState,id:string)=>j.scenes.find(s=>s.id===state.scene)!.options.find(o=>o.id===id)!;

it('the clock only advances with gestures and travel, and is replayed from the decisions',()=>{
 expect(elapsed(j,startJourney(j))).toBe(0);
 const atBazaar=run(['respond_1','papers','take']);
 expect(atBazaar.scene).toBe('encounter_2');expect(elapsed(j,atBazaar)).toBe(5+25+15);
 expect(elapsed(j,restoreJourney(j,serializeJourney(j,atBazaar)))).toBe(45);
});
it('the receipt route fits in two hours only by hurrying the two encounters',()=>{
 const fast=run(['respond_1','papers','take','respond_1','appeal','respond_2']);
 expect(blockedReason(fast,option(fast,'claim'),j)).toBeNull();
 expect(elapsed(j,run(['claim'],fast))).toBe(120);
 const slow=run(['respond_1','papers','take','respond_1','appeal','respond_1']);
 expect(blockedReason(slow,option(slow,'claim'),j)).toBe('Plus le temps.');
 // A free gesture is never closed by the clock, so no scene strands the player.
 expect(blockedReason(slow,option(slow,'walk'),j)).toBeNull();
});
it('Tomasz comes back according to what was done with his receipt',()=>{
 expect(run(['respond_1','rush','respond_1','keep','respond_1','single']).scene).toBe('tomasz_none');
 expect(run(['respond_1','papers','take','respond_1','privacy','respond_1','pair']).scene).toBe('tomasz_receipt');
 expect(run(['respond_1','papers','take','respond_1','leak','respond_1','pair']).scene).toBe('tomasz_exposed');
});
it('the companion state follows the latest gesture that changed it',()=>{
 expect(companionMood(j,startJourney(j))).toBe('fait son sac');
 expect(companionMood(j,run(['respond_1']))).toBe('te fait confiance');
 expect(companionMood(j,run(['respond_1','rush','respond_1','privacy']))).toBe('regarde ailleurs');
});
it('a broken promise is told at the end, not before',()=>{
 const alone=run(['respond_1','rush','respond_1','keep','respond_2','single','shrug','one']);
 expect(j.scenes.find(s=>s.id===alone.scene)!.ending).toBe('compromise');
 expect(shortCosts('w01',alone,alone.scene).map(line=>line[1]).join(' ')).toContain('Il l’a appris devant la porte');
});
it('a save made before the clock and before Tomasz still resumes where it was',()=>{
 // Deux voix puis l’ancien bail : possible avant l’horloge, fermé depuis. La rencontre avec Tomasz n’existait pas.
 const old=JSON.stringify({v:1,world:'w01',choices:[['encounter_1','respond_1'],['home','papers'],['papers','take'],['encounter_2','respond_2'],['market','appeal'],['encounter_3','respond_1'],['desk','claim'],['crossing','both']].map(([scene,option])=>({scene,option}))});
 const restored=restoreJourney(j,old);
 expect(restored.scene).toBe('together');expect(restored.inventory).toContain('Bail commun');
});
