import {it} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {journeys} from '../../../src/worlds/catalogue';
import {startJourney,decide,blockedReason} from '../../../src/worlds/state';
import {narrativeScene} from '../../../src/worlds/narrative';
import {spokenLine} from '../../../src/worlds/spokenLines';
import {moralMoments} from '../../../src/worlds/moralMoments';
import {freshEpisode,choose,optionsFor,episodeText} from '../../../src/street/episode/story';
import type {JourneyState} from '../../../src/worlds/types';
const words=(s:string)=>s.trim().split(/\s+/).filter(Boolean).length;
it('records actual visible route lengths for the audit, without asserting engagement',()=>{
 const rows=[];
 for(const j of Object.values(journeys)){
  const leaves:{ending:string;choices:number;words:number}[]=[];
  const visit=(state:JourneyState,count:number,n:number)=>{
   const original=j.scenes.find(s=>s.id===state.scene)!,scene=narrativeScene(j.id,original,state);
   if(scene.ending){leaves.push({ending:scene.ending,choices:count,words:n});return;}
   const spoken=scene.text!==original.text?null:scene.id===moralMoments[j.id].scene?moralMoments[j.id].voice:spokenLine(j.id,scene.id,scene.text);
   const visible=scene.interludeFor&&scene.text===original.text?`${scene.id===j.start?moralMoments[j.id].context:''} ${spoken??scene.text.split(/(?<=[.!?])\s/).slice(0,3).join(' ')}`:scene.text;
   const reading=words(visible+' '+scene.options.map(o=>o.label).join(' '));
   for(const o of scene.options)if(!blockedReason(state,o,j))visit(decide(j,state,o.id),count+1,n+reading+words(o.consequence));
  };visit(startJourney(j),0,0);
  const successes=leaves.filter(s=>s.ending==='success'),times=leaves.map(s=>s.words/200+s.choices*8/60);
  rows.push({world:j.id,routes:leaves.length,minChoices:Math.min(...leaves.map(s=>s.choices)),maxChoices:Math.max(...leaves.map(s=>s.choices)),minMinutes:Math.min(...times),maxMinutes:Math.max(...times),successMinMinutes:Math.min(...successes.map(s=>s.words/200+s.choices*8/60)),endings:Object.fromEntries(['success','compromise','failure'].map(k=>[k,leaves.filter(s=>s.ending===k).length]))});
 }
 const endings:{words:number;choices:number;success:boolean}[]=[];
 const visit1984=(state=freshEpisode(),n=0,count=0):void=>{if(state.scene==='end'){endings.push({words:n,choices:count,success:state.memories.includes('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.')&&!state.memories.includes('Tu as signalé Marlène.')});return;}const choices=optionsFor(state);for(const o of choices)visit1984(choose(state,o.id),n+words(episodeText(state)+' '+choices.map(c=>c.label).join(' ')),count+1);};visit1984();
 const dir='../production/qa/full-audit';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/pacing-current.json`,JSON.stringify({method:'Estimate: actual visible prose + all option labels + chosen consequences, 200 words/min and 8 seconds/choice. Excludes questionnaire, intro, final report, optional disclosures and pauses. Not a player study. 1984 dinner approximation uses authored scene prose.',worlds:rows,w10:{routes:endings.length,minChoices:Math.min(...endings.map(s=>s.choices)),maxChoices:Math.max(...endings.map(s=>s.choices)),minMinutes:Math.min(...endings.map(s=>s.words/200+s.choices*8/60)),maxMinutes:Math.max(...endings.map(s=>s.words/200+s.choices*8/60)),successMinMinutes:Math.min(...endings.filter(s=>s.success).map(s=>s.words/200+s.choices*8/60))}},null,2));
});
