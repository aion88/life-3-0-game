import {expect,it} from 'vitest';
import {journeys} from '../../../src/worlds/catalogue';
import {blockedReason,decide,startJourney} from '../../../src/worlds/state';

for(const journey of Object.values(journeys))it(`${journey.id}: public route has contextual surfaces, bounded events and no post-result errands`,()=>{
 const queue=[startJourney(journey)],seen=new Set<string>();
 for(let i=0;i<queue.length;i++){
  const state=queue[i]!;
  const key=JSON.stringify([state.scene,state.resource,state.inventory.filter(v=>!v.startsWith('Tu '))]);
  if(seen.has(key))continue;seen.add(key);
  const scene=journey.scenes.find(s=>s.id===state.scene)!;
  expect(scene.legacyBefore,scene.id).toBeUndefined();
  if(scene.ending){expect(scene.options).toHaveLength(0);continue;}
  if(!scene.id.startsWith('encounter_'))expect(scene.presentation,scene.id).toBeDefined();
  if(scene.presentation?.kind==='event'){
   expect(scene.options).toHaveLength(1);
   const event=scene.options[0]!;
   expect(event.cost??0).toBe(0);expect(event.remove??[]).toHaveLength(0);
   expect(journey.scenes.find(s=>s.id===event.next)?.presentation?.kind).not.toBe('event');
  }
  for(const option of scene.options)if(!blockedReason(state,option,journey))queue.push(decide(journey,state,option.id));
 }
});
