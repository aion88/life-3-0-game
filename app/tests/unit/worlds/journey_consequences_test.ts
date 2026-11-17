import { expect, it } from 'vitest';
import { journeys } from '../../../src/worlds/catalogue';
import { decide, restoreJourney, serializeJourney, startJourney } from '../../../src/worlds/state';
import type { JourneyWorldId } from '../../../src/worlds/types';
import { shortCosts } from '../../../src/worlds/shortForm';
const play=(id:JourneyWorldId,choices:string[],finish=true)=>{
 const journey=journeys[id]; let state=startJourney(journey);
 for(const choice of choices){
  while(journey.scenes.find(s=>s.id===state.scene)?.interludeFor){const scene=journey.scenes.find(s=>s.id===state.scene)!;state=decide(journey,state,scene.options[0]!.id);}
  const next=decide(journey,state,choice);expect(next,`${id}/${state.scene}/${choice}`).not.toBe(state);state=next;}
 // Institutional outcome is followed by a new, separate decision about its trace.
 while(finish&&(state.scene.startsWith('aftermath_')||state.scene.startsWith('handoff_')))state=decide(journey,state,journey.scenes.find(s=>s.id===state.scene)!.options[0]!.id);
 return {state,scene:journey.scenes.find(s=>s.id===state.scene)!};
};
it('selling data cannot count as preserving privacy even when both people get keys',()=>{
 // The short form tells what a gesture cost at the end, so the meaning is checked there.
 const run=(ids:string[])=>{const j=journeys.w01;let state=startJourney(j);for(const id of ids){const next=decide(j,state,id);expect(next,`w01/${state.scene}/${id}`).not.toBe(state);state=next;}return {state,scene:j.scenes.find(s=>s.id===state.scene)!};};
 const told=(r:ReturnType<typeof run>)=>shortCosts('w01',r.state,r.scene.id).map(line=>line.join(' ')).join(' ');
 const clean=run(['respond_1','papers','take','respond_1','appeal','respond_2','claim','hold','both']);
 expect(clean.scene.ending).toBe('success');expect(told(clean)).not.toContain('données');
 const paid=run(['respond_1','rush','respond_1','privacy','respond_1','pair','shrug','both_data']);
 expect(paid.scene.ending).toBe('compromise');expect(told(paid)).toContain('revente');
 const publicHelp=run(['respond_1','papers','take','respond_1','leak','respond_1','pair','excuse','both_public']);
 expect(publicHelp.scene.ending).toBe('compromise');expect(told(publicHelp)).toContain('Tomasz');expect(told(publicHelp)).toContain('reçu public');
});
it('a private water contract cannot claim to have saved the dispensary',()=>{
 for(const route of [['queue','general','exclusive','contract_private'],['inspect','diagnose','all','favour','exclusive','contract_private']]){
  const result=play('w06',route);expect(result.scene.ending).toBe('failure');expect(result.scene.text).toContain('dispensaire n’était pas couvert');
 }
 expect(play('w06',['inspect','diagnose','all','target','commons','share']).scene.ending).toBe('success');
 const monopoly=play('w06',['inspect','diagnose','all','general','exclusive','contract']);
 expect(monopoly.scene.ending).toBe('compromise');expect(monopoly.scene.text).toContain('L’évacuation est annulée');
});
it('a ready-made demonstration remains only a provisional answer to a real need',()=>{
 const demo=play('w03',['optimise','sort','rest','show']);
 expect(demo.scene.ending).toBe('compromise');expect(demo.scene.text).toContain('aucune demande régulière');
 const ranked=play('w03',['ask','listen','repair','rank','ranked']);expect(ranked.scene.ending).toBe('compromise');expect(ranked.scene.text).toContain('compétition');
});
it('escorting one person does not claim to have secured a shared crossing',()=>{
 const {state}=play('w05',['help','escort']);expect(state.inventory).toContain('Père accompagné');expect(state.inventory).not.toContain('Passage balisé');
});
it('archives-only ending respects the selected evidence rather than inventing a flattering biography',()=>{
 const result=play('w08',['memory','record','experiment','discuss','archive']);
 expect(result.scene.ending).toBe('compromise');expect(result.scene.text).toContain('documents que tu as retenus');
 expect(result.scene.text).not.toContain('image rassurante');
});
it('migrates only identifiable old presentation gestures and serializes normalized choices',()=>{
 for(const [world,route,oldId] of [
  ['w01',['rush','privacy','pair','both_data'],'both'],
  ['w01',['papers','take','leak','pair','both_public'],'both'],
  ['w06',['queue','general','exclusive','contract_private'],'contract'],
 ] as const){
  const current=play(world,[...route],false).state;
  const old=JSON.parse(serializeJourney(journeys[world],current));old.choices.at(-1).option=oldId;
  const restored=restoreJourney(journeys[world],JSON.stringify(old));expect(restored).toEqual(current);
  expect(JSON.parse(serializeJourney(journeys[world],restored)).choices.at(-1).option).toBe(route.at(-1));
  old.choices.at(-1).option='not-an-old-gesture';expect(restoreJourney(journeys[world],JSON.stringify(old))).toEqual(startJourney(journeys[world]));
 }
});
