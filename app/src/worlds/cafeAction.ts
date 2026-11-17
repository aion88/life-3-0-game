import { createIllustratedJourneyView } from './illustratedView';
import { journeys } from './catalogue';
import { cafeAction,newCafeAction,type CafeAction } from './cafeActionState';
import './cafeAction.css';
/** Short local experiment: objects, interruption, visible branching. No save access. */
export async function mountCafeAction(root:HTMLElement):Promise<()=>void>{
 const host=document.createElement('main');host.className='cafe-action';
 host.innerHTML=`<header class="ca-header"><div><small>LIFE 3.0 · ESSAI LOCAL</small><h1>Le Café du Pont</h1></div><a href="/">Retour au jeu</a></header><p class="ca-objective">Le Protecteur a stoppé la crue. À vous d’ouvrir le refuge.</p><aside class="ca-outage" role="status" hidden><strong>COUPURE DE COURANT</strong><span>Réseau hors service · Vision infrarouge activée</span></aside><section class="ca-stage" aria-label="Le café, objets interactifs"><p class="ca-loading">Ouverture du café…</p></section><section class="ca-dialogue" aria-label="Conversation"><small></small><p role="status" aria-live="polite"></p><span class="ca-hint"></span></section><section class="ca-outcome" hidden aria-label="Ce qui a changé"></section>`;
 root.append(host);const stage=host.querySelector<HTMLElement>('.ca-stage')!;
 const view=await createIllustratedJourneyView(stage,journeys.w05);view.show('cafe',[]);stage.querySelector('.ca-loading')?.remove();
 const layer=stage.querySelector<HTMLElement>('.iv-motion')!;
 const props=document.createElement('div');props.className='ca-props';
 props.innerHTML=`<div class="ca-route-light"></div><div class="ca-radio-prop" aria-hidden="true"><i></i><span>▥</span><b>···</b></div><div class="ca-lantern" aria-hidden="true">◈</div><div class="ca-arrivals" aria-label="Arrivée des voisins"></div><nav class="ca-hotspots" aria-label="Agir dans le café"></nav>`;
 layer.append(props);
 const dialogue=host.querySelector<HTMLElement>('.ca-dialogue')!,speaker=dialogue.querySelector('small')!,line=dialogue.querySelector('p')!,hint=dialogue.querySelector('.ca-hint')!,hotspots=props.querySelector('nav')!,outcome=host.querySelector<HTMLElement>('.ca-outcome')!;
 let state=newCafeAction();

 const act=(action:CafeAction):void=>{const next=cafeAction(state,action);if(next===state)return;state=next;const target=action==='light'?[.65,.76]:[.44,.69];view.moveTo?.(target[0]!,target[1]!);draw();};
 const button=(action:CafeAction,label:string,position:string):void=>{const b=document.createElement('button');b.type='button';b.dataset['action']=action;b.className=`ca-hotspot ca-${position}`;b.textContent=label;b.setAttribute('aria-label',label);b.addEventListener('click',()=>act(action));hotspots.append(b);};
 function draw():void{
  host.dataset['phase']=state.phase;host.dataset['power']=state.power;hotspots.replaceChildren();outcome.hidden=state.phase!=='ending';
  host.querySelector<HTMLElement>('.ca-outage')!.hidden=!['choose','ending'].includes(state.phase);
  view.setEmotion(state.phase==='discover'?'Aux aguets':state.phase==='ending'?'Partagé':'Inquiet',state.phase==='ending'?'hope':'tension','');
  if(state.phase==='discover'){
   speaker.textContent='BRIGITTE';line.textContent='« La radio grésille depuis une heure. C’est la voix de ton père, non ? »';hint.textContent='Touche la radio sur le comptoir.';button('radio','Écouter','radio');
  }else if(state.phase==='prepare'){
   speaker.textContent='TON PÈRE · RADIO';line.textContent='« Je suis près du pont, avec deux voisins. On tient au sec. Le Protecteur ne répond plus. Vous ouvrez ? »';hint.textContent='Réponds à ton père.';button('reply','Papa, tu m’entends ?','radio');
  }else if(state.phase==='choose'){
   speaker.textContent='BRIGITTE';line.textContent='« Le courant vient de sauter. Six voisins attendent le balisage. Les secours attendent notre radio pour retrouver ton père. Une batterie. On alimente quoi ? »';hint.textContent='Une seule batterie · Choisis un appareil.';button('light','Allumer le balisage','lamp');button('rescue','Guider les secours','radio');
  }else{
   speaker.textContent=state.power==='radio'?'TON PÈRE · À LA PORTE':'TON PÈRE · DERNIER MESSAGE';
   line.textContent=state.power==='radio'?'« J’ai vu ta lumière s’éteindre… puis leur bateau. C’était toi ? »':'« J’ai compris. Occupe-toi de ceux qui arrivent. Nous, on attend l’équipe ici. »';
   hint.textContent='';outcome.replaceChildren();
   const tiles=document.createElement('div');tiles.className='ca-results';
   for(const [value,label] of [[String(state.sheltered),'personnes au café'],[state.father==='shelter'?'Avec toi':'Au pont','ton père'],[state.power==='radio'?'6':'3','personnes encore en attente']]){const tile=document.createElement('div'),n=document.createElement('strong'),l=document.createElement('span');n.textContent=value!;l.textContent=label!;tile.append(n,l);tiles.append(tile);}
   const replay=document.createElement('button');replay.type='button';replay.textContent='Essayer l’autre décision';replay.addEventListener('click',()=>{state={...newCafeAction(),phase:'choose'};draw();});outcome.append(tiles,replay);
  }
  const arrivals=props.querySelector<HTMLElement>('.ca-arrivals')!;arrivals.replaceChildren();
  view.setVisitors?.(state.phase==='ending'?state.sheltered:0);
  if(state.phase==='ending'){for(let i=0;i<state.sheltered;i++){const visitor=document.createElement('span');visitor.className='ca-visitor';visitor.style.setProperty('--i',String(i));visitor.style.setProperty('--coat',['#9c4737','#425c63','#c3a66f'][i%3]!);visitor.setAttribute('aria-label',i===0&&state.father==='shelter'?'Ton père':'Un voisin');arrivals.append(visitor);}}
 }
 draw();host.dataset['ready']='true';return()=>{view.dispose();host.remove();};
}
