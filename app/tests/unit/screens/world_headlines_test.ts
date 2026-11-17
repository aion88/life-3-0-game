import {expect,it} from 'vitest';
import {worldHeadline} from '../../../src/screens/fastforward/worldHeadlines';
import {answersOf,type WorldId,type QuestionKey} from '../../../src/shared/types';
import mayorScenes from '../../../src/screens/mayor/scenes.json';
const empty=answersOf({});
it('each future has four distinct mission-specific editions in both languages',()=>{
 for(const lang of ['fr','en'] as const){
  const titles:string[]=[];
  for(let n=1;n<=12;n++){
   const world=`w${String(n).padStart(2,'0')}` as WorldId;
   for(let year=2027;year<=2030;year++){
    const line=worldHeadline(world,year,empty,null,lang);
    expect(line.year).toBe(year);expect(line.world).toBe(world);
    expect(line.source).toBe('editorial-fiction');expect(line.contribution).toBeNull();
    expect(line.boundary.toLowerCase()).toContain(lang==='fr'?'inventé':'made-up');titles.push(line.title);
   }
  }
  expect(new Set(titles).size).toBe(48);
 }
});
it('extinction years through 2032 do not repeat the 2030 ending or invent a 2026 edition',()=>{
 for(const world of ['w07','w12'] as const){
  const titles=Array.from({length:6},(_,i)=>worldHeadline(world,2027+i,empty,null).title);
  expect(new Set(titles).size).toBe(6);
 }
 expect(()=>worldHeadline('w01',2026,empty,null)).toThrow(RangeError);
});
it('editorial contributions quote only the actual mayor choice, separately from fiction',()=>{
 for(const scene of mayorScenes)for(const choice of scene.choix){
  const question=scene.id as QuestionKey,answer=choice.key as 'A'|'B'|'C'|'D';
  const selected={question,answer,deltas:[{axis:'freedom',value:2}]};
  const result=worldHeadline('w10',2029,answersOf({[question]:answer}),selected);
  expect(result.contribution).toEqual({question,answer,label:choice.t});
  expect(result.boundary).toContain('pas seul');
  expect(worldHeadline('w10',2029,empty,selected).contribution).toBeNull();
  expect(worldHeadline('w10',2029,answersOf({[question]:answer}),{...selected,deltas:[]}).contribution).toBeNull();
 }
});
