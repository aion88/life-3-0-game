import {moralMoments,journeyLighting,type MoralWorld} from './moralMoments';
import {moralCard} from './moralView';
import {moralSetup} from './moralSetup';
import {journeys} from './catalogue';
import {decide,blockedReason} from './state';
import {freshEpisode,choose,story,type EpisodeState} from '../street/episode/story';
import type {JourneyState} from './types';
import type {JourneyView} from './view';
import {createIllustratedJourneyView} from './illustratedView';
import fr from '../data/strings/fr.json';
import './moralStudio.css';
/** Local review of actual decision nodes. Does not read/write any player save. */
export async function mountMoralStudio(root:HTMLElement):Promise<()=>void>{
 const doc=root.ownerDocument,host=doc.createElement('main');host.className='moral-studio';
 host.innerHTML='<header><div><small title="Scènes extraites du jeu ; les démarches précédentes sont déjà effectuées dans cet essai.">LIFE 3.0 · SÉQUENCES LOCALES</small><h1></h1></div><label>Monde <select aria-label="Choisir un monde"></select></label><a href="/">Retour au jeu</a></header><p class="ms-rule"></p><p class="ms-context"></p><div class="ms-event" role="status"></div><section class="ms-stage" aria-label="Décor et personnages"></section><section class="ms-story"><small class="ms-speaker"></small><p class="ms-voice"></p><p class="ms-resource"></p><div class="ms-options" aria-label="Tes choix"></div><div class="ms-result"></div><nav class="ms-next"></nav></section>';
 root.append(host);const select=host.querySelector('select')!,stage=host.querySelector<HTMLElement>('.ms-stage')!,event=host.querySelector<HTMLElement>('.ms-event')!,options=host.querySelector<HTMLElement>('.ms-options')!,result=host.querySelector<HTMLElement>('.ms-result')!,next=host.querySelector<HTMLElement>('.ms-next')!;
 const ids=Object.keys(moralMoments) as MoralWorld[];for(const id of ids){const option=doc.createElement('option');option.value=id;option.textContent=fr[`world.${id}.name`];select.append(option);}
 let view:JourneyView|null=null,world:MoralWorld='w01',state:JourneyState|null=null,episode:EpisodeState|null=null,token=0,disposed=false;
 const button=(label:string,fn:()=>void):HTMLButtonElement=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;};
 const setLighting=(location:string,scene:string):void=>{host.dataset['sceneLight']=journeyLighting(world,location,scene,state?.choices??[]);};
 const load=async(id:MoralWorld):Promise<void>=>{
  const request=++token;view?.dispose();view=null;world=id;select.value=id;host.dataset['world']=id;host.dataset['ready']='false';host.dataset['sceneLight']='natural';stage.replaceChildren();options.replaceChildren();result.replaceChildren();next.replaceChildren();event.textContent='Ouverture du lieu…';
  state=null;episode=null;
  if(id==='w10'){episode=freshEpisode();for(const option of ['help','accept','dinner','stay','hear','alone','appeal','enter','inspect'])episode=choose(episode,option);}
  else state=moralSetup(id);
  const moment=moralMoments[id],scene=id==='w10'?story.evidence!:journeys[id].scenes.find(s=>s.id===moment.scene)!;
  const location='place' in scene?scene.place:scene.location;
  const journey=id==='w10'?{id:'w10' as const,title:'1984',locations:[{id:location,name:'Le dossier de ton frère'}]}:journeys[id];
  host.querySelector('h1')!.textContent=id==='w10'?'Le dossier de ton frère':journeys[id].locations.find(l=>l.id===location)!.name;
  host.querySelector('.ms-context')!.textContent=moment.context;host.querySelector('.ms-rule')!.textContent=moment.rule;host.querySelector('.ms-speaker')!.textContent=scene.speaker;host.querySelector('.ms-voice')!.textContent=moment.voice;host.querySelector('.ms-resource')!.textContent=id==='w10'?'Ta signature engage ta propre autorisation de sortie.':`${journeys[id].resource.name} disponibles : ${state!.resource}`;
  const container=doc.createElement('div');container.className='ms-render';stage.append(container);
  try {const created=await createIllustratedJourneyView(container,journey);if(disposed||request!==token){created.dispose();return;}view=created;view.show(location,state?.inventory??[]);view.setEmotion('Face au choix','warning',moment.event);}
  catch{if(request===token)event.textContent='Le décor n’a pas pu être chargé. Change de monde pour réessayer.';return;}
  setLighting(location,moment.scene);event.textContent=moment.event+(host.dataset['sceneLight']==='infrared'?' · VISION INFRAROUGE ACTIVÉE':'');
  for(const option of scene.options){
   const reason=id==='w10'||!('consequence' in option)?null:blockedReason(state!,option,journeys[id]);
   const b=button(option.label,()=>{
    if(result.childElementCount)return;
    if(id==='w10')episode=choose(episode!,option.id);else state=decide(journeys[id],state!,option.id);
    view?.react?.();view?.setEmotion('Partagé','warning','');options.replaceChildren();
    const card=moralCard(doc,id,'result',{scene:moment.scene,option:option.id});if(card)result.append(card);
    const consequence=doc.createElement('p');consequence.className='ms-consequence';consequence.textContent='consequence' in option?option.consequence:story[episode!.scene]!.text;result.append(consequence);
    event.textContent='CHOIX ENREGISTRÉ'+(host.dataset['sceneLight']==='infrared'?' · COURANT COUPÉ, VISION INFRAROUGE':'');
    const target=id==='w10'?story[episode!.scene]!:journeys[id].scenes.find(s=>s.id===state!.scene)!;
    const destination='place' in target?target.place:target.location;
    if(destination!==location&&id!=='w10')next.append(button('Voir le lieu suivant',()=>{
     view?.show(destination,state!.inventory);setLighting(destination,state!.scene);host.querySelector('h1')!.textContent=journeys[id].locations.find(l=>l.id===destination)!.name;event.textContent=host.dataset['sceneLight']==='natural'?'NOUVEAU LIEU · LUMIÈRE DU LIEU':'COUPURE DE COURANT · VISION INFRAROUGE';
    }));
    next.append(button('Essayer l’autre choix',()=>{void load(id);}),button('Monde suivant',()=>{void load(ids[(ids.indexOf(id)+1)%ids.length]!);}));
    result.scrollIntoView({block:'nearest',behavior:'instant'});
   });b.dataset['option']=option.id;if(reason){b.disabled=true;const why=doc.createElement('small');why.textContent=reason;b.append(why);}options.append(b);
  }
  host.dataset['ready']='true';host.scrollIntoView({block:'start',behavior:'instant'});
 };
 select.addEventListener('change',()=>{void load(select.value as MoralWorld);});
 const requested=new URLSearchParams(location.search).get('monde') as MoralWorld;await load(ids.includes(requested)?requested:'w01');
 return()=>{disposed=true;token++;view?.dispose();host.remove();};
}
