import {journeys} from './catalogue';
import {moralMoments} from './moralMoments';
import {startJourney,decide,blockedReason} from './state';
import type {JourneyState,JourneyWorldId} from './types';
/** Preview a reachable situation, using real costs/requirements; never invent inventory. */
export function moralSetup(world:JourneyWorldId):JourneyState {
 const j=journeys[world],target=moralMoments[world].scene,queue=[startJourney(j)],seen=new Set<string>();let best:JourneyState|undefined,bestScore=-1;
 for(let i=0;i<queue.length&&i<15000;i++){
  const state=queue[i]!,key=JSON.stringify([state.scene,state.resource,[...state.inventory].sort()]);if(seen.has(key))continue;seen.add(key);
  const scene=j.scenes.find(s=>s.id===state.scene)!;
  if(state.scene===target){const score=scene.options.filter(o=>!blockedReason(state,o,j)).length*100+state.resource;if(score>bestScore){best=state;bestScore=score;}continue;}
  for(const option of scene.options)if(!blockedReason(state,option,j))queue.push(decide(j,state,option.id));
 }
 if(!best)throw new Error(`Scène morale inaccessible : ${world}/${target}`);return best;
}
