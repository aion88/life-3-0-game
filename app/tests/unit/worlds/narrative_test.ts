import {expect,it} from 'vitest';
import {journeys} from '../../../src/worlds/catalogue';
import {narrativeScene} from '../../../src/worlds/narrative';
import {decide,blockedReason,elapsed,startJourney,restoreJourney,serializeJourney} from '../../../src/worlds/state';
import type {JourneyWorldId} from '../../../src/worlds/types';
for(const [id,scene,item,absent,present] of [
 ['w03','encounter_3','Remorque réparée','la roue frotte encore','roue que vous avez réparée'],
 ['w09','encounter_3','Photo confiée','transmise au Gardien','que tu as gardée'],
 ['w11','encounter_3','Inès dénoncée','Inès vient','Augustin la retient'],
] as const)it(`${id} encounter respects whether ${item} occurred`,()=>{
 const j=journeys[id],s=j.scenes.find(s=>s.id===scene)!;
 expect(narrativeScene(id,s,{scene,resource:0,inventory:[],choices:[]}).text).toContain(absent);
 expect(narrativeScene(id,s,{scene,resource:0,inventory:[item],choices:[]}).text).toContain(present);
});
for(const id of Object.keys(journeys) as JourneyWorldId[])it(`${id}: every reachable decision remains escapable and endings survive reload`,()=>{
 const j=journeys[id],queue=[startJourney(j)],seen=new Set<string>(),ends=new Set<string>();
 for(let i=0;i<queue.length;i++){
  const state=queue[i]!,scene=j.scenes.find(s=>s.id===state.scene)!;
  // Encounter memories are independent of access requirements; collapse these cosmetic variants.
  const functional=state.inventory.filter(item=>!item.startsWith('Tu ')&&!item.startsWith('Esteban ')&&!item.startsWith('Soraya ')&&!item.startsWith('Iris ')&&!item.startsWith('Gisèle ')&&!item.startsWith('Noor '));
  // In a world with a clock, the same place reached later is a different situation.
  const key=JSON.stringify([state.scene,state.resource,elapsed(j,state),[...functional].sort()]);if(seen.has(key))continue;seen.add(key);
  expect(state.resource).toBeGreaterThanOrEqual(0);
  if(scene.ending){ends.add(scene.id);expect(restoreJourney(j,serializeJourney(j,state))).toEqual(state);continue;}
  const choices=scene.options.filter(o=>!blockedReason(state,o,j));expect(choices.length,`${id}/${scene.id} stranded`).toBeGreaterThan(0);
  for(const o of choices)queue.push(decide(j,state,o.id));
 }
 expect(ends.size).toBe(j.scenes.filter(s=>s.ending).length);
});

it('the zoo ending preserves an original or private alcove actually obtained',()=>{
 const j=journeys.w09;
 const read=(id:string,inventory:string[])=>narrativeScene('w09',j.scenes.find(s=>s.id===id)!,{scene:id,inventory,resource:1,choices:[]}).text;
 expect(read('show',['Photo confiée'])).toContain('ne l’a pas effacé');
 expect(read('show',['Photo diffusée'])).toContain('copie transmise');
 expect(read('empty',['Rideau déplacé'])).toContain('Ce retrait existe');
 expect(read('empty',[])).toContain('n’avez pas créé');
});
it('failed water repair distinguishes spent vouchers and temporary aid',()=>{
 const j=journeys.w06,s=j.scenes.find(s=>s.id==='dry')!;
 const text=narrativeScene('w06',s,{scene:'dry',inventory:['Plan de réparation','Eau provisoire'],resource:0,choices:[]}).text;
 expect(text).toContain('0 bons');expect(text).toContain('Les seaux');expect(text).toContain('produit un plan');
 expect(text).not.toContain('gardé les bons');
});

it('a repaired private hearth is not described as physically incomplete',()=>{
 const scene=journeys.w11.scenes.find(s=>s.id==='temporary')!;
 const text=narrativeScene('w11',scene,{scene:'temporary',resource:0,choices:[],inventory:['Fagot','Joint réparé','Geste appris']}).text;
 expect(text).toContain('Le foyer est réparé');expect(text).toContain('pas obtenu de transmission');
 const shared=narrativeScene('w11',scene,{scene:'temporary',resource:0,choices:[],inventory:['Fagot','Joint réparé','Geste appris','Savoir partagé']}).text;
 expect(shared).toContain('le village connaît le geste');expect(shared).not.toContain('pas obtenu de transmission');
});
