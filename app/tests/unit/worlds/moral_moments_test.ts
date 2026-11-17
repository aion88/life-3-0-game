import {expect,it} from 'vitest';
import {journeys} from '../../../src/worlds/catalogue';
import {moralMoments,journeyLighting} from '../../../src/worlds/moralMoments';
import {moralSetup} from '../../../src/worlds/moralSetup';
import {decide,blockedReason,restoreJourney,serializeJourney} from '../../../src/worlds/state';
import {story} from '../../../src/street/episode/story';
import type {JourneyWorldId} from '../../../src/worlds/types';
it('each inhabited world has a reachable moral decision, real consequences and an explicit AI rule',()=>{
 expect(Object.keys(moralMoments)).toHaveLength(10);
 for(const [id,j] of Object.entries(journeys)){
  const world=id as JourneyWorldId,moment=moralMoments[world],state=moralSetup(world),scene=j.scenes.find(s=>s.id===moment.scene)!;
  expect(scene).toBeDefined();expect(state.scene).toBe(moment.scene);expect(moment.rule).toMatch(/IA|Oracle|Gardien/);
  expect(restoreJourney(j,serializeJourney(j,state))).toEqual(state);
  expect(scene.options.filter(o=>!blockedReason(state,o,j)).length).toBeGreaterThanOrEqual(2);
  for(const option of scene.options){expect(moment.results[option.id],`${id}/${option.id}`).toHaveLength(2);if(blockedReason(state,option,j))continue;const after=decide(j,state,option.id);expect(after).not.toBe(state);expect(after.choices.at(-1)).toEqual({scene:moment.scene,option:option.id});expect(restoreJourney(j,serializeJourney(j,after))).toEqual(after);}
 }
 for(const option of story.evidence!.options)expect(moralMoments.w10.results[option.id]).toHaveLength(2);
});
it('the cafe outage follows its location and never leaks to another world, exterior or new run',()=>{
 const past=[{scene:'water',option:'clean'}];
 expect(journeyLighting('w05','cafe','water',[])).toBe('infrared');expect(journeyLighting('w05','cafe','open',past)).toBe('infrared');
 expect(journeyLighting('w05','fountain','fountain',past)).toBe('natural');expect(journeyLighting('w05','cafe','cafe',[])).toBe('natural');
 for(const id of Object.keys(moralMoments).filter(id=>id!=='w05'))expect(journeyLighting(id as JourneyWorldId,'cafe','water',past)).toBe('natural');
});
it('sending the battery is recorded as an actual tradeoff and does not invent verified water',()=>{
 const state=moralSetup('w05'),next=decide(journeys.w05,state,'battery');expect(next.inventory).toContain('Batterie envoyée au pont');expect(next.inventory).not.toContain('Eau vérifiée');expect(next.resource).toBe(state.resource);
});

it('old waiting decisions are not silently reinterpreted as sending the battery',()=>{const state=moralSetup('w05'),old=decide(journeys.w05,state,'wait');expect(old.inventory).not.toContain('Batterie envoyée au pont');expect(restoreJourney(journeys.w05,serializeJourney(journeys.w05,old))).toEqual(old);});
