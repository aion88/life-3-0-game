import type {StoryConsequence} from './consequences';
import './consequences.css';
export type {StoryConsequence} from './consequences';
/** Close-up drawings use saved facts. Testing a prop never grants unearned progress. */
const objects:Record<NonNullable<StoryConsequence['visual']>,string>={
 keys:'<path class="prop-frame" d="M51 135V16h98v119z"/><g class="prop-door"><path d="M57 22h86v113H57z"/><path d="M69 33h62v38H69z M69 83h62v38H69z"/><circle cx="130" cy="80" r="4"/></g><g class="prop-key"><circle cx="33" cy="94" r="10"/><path d="M43 94h30v7 M62 94v7"/></g><circle class="prop-signal" cx="164" cy="75" r="6"/>',
 case:'<path d="M47 113V43h85v70z M73 43V31h32v12 M58 43v70 M120 43v70"/><circle cx="63" cy="120" r="6"/><circle cx="117" cy="120" r="6"/><g class="prop-car"><path d="M120 20h55l10 16v20h-65z"/><path d="M131 26h35v12h-35z"/><circle cx="133" cy="57" r="5"/><circle cx="174" cy="57" r="5"/></g>',
 wheel:'<path d="M42 23h78l14 25 M129 35l-20 60"/><g class="prop-wheel"><circle cx="100" cy="87" r="43"/><circle cx="100" cy="87" r="35"/><path d="M100 44v86 M57 87h86 M70 57l60 60 M70 117l60-60"/><circle cx="100" cy="87" r="7"/></g>',
 cup:'<path d="M37 123h126"/><g class="prop-cup"><path d="M67 38h65v56q0 22-33 22T67 94z M132 49h12q20 0 14 23t-26 18"/><path class="prop-liquid" d="M73 53h53"/></g><path d="M45 111V84l10-8 12 16 M45 96h22 M156 115h16"/>',
 lamp:'<path d="M36 30h127v83H36z M48 42h103v51H48z M73 113v13h55v-13"/><path class="prop-readout" d="M56 70h13l7-15 10 29 11-24 9 10h35"/><path d="M16 52h15v36H16z M18 47h10"/><circle class="prop-signal" cx="145" cy="103" r="3"/>',
 tap:'<path d="M54 88V35h67v18H76v35 M94 35V22 M80 22h28 M35 112q65 32 130 0"/><g class="prop-water"><path d="M62 89v31 M68 91v34 M74 89v31"/></g>',
 capsule:'<path d="M41 37q0-17 18-17h82q18 0 18 17v83H41z M41 44h118 M55 56h90v44H55z M67 111h65"/><g class="prop-wave"><path d="M62 78h8l4-13 6 26 7-32 7 38 7-26 6 15 5-10h26"/></g><circle class="prop-signal" cx="148" cy="32" r="3"/>',
 photo:'<path d="M58 27h89v103H58z M66 37h73v67H66z M70 89l19-20 16 14 12-12 19 20"/><circle cx="117" cy="53" r="8"/><g class="prop-scan"><path d="M16 21h22v17H16z M38 30l103 73 M38 30l103 10"/></g><path class="prop-curtain" d="M45 14v116h112V14z M62 14v116 M80 14v116 M98 14v116 M116 14v116 M134 14v116"/>',
 hearth:'<path d="M40 126V40h120v86 M33 40h134V26H33z M60 126V67h80v59 M73 18V5h54v13"/><path d="M64 117l69 7 M67 128l65-16"/><path class="prop-fire" d="M80 115q-16-20 7-42 0 18 11 21 1-29 16-36-5 24 7 39 7 17-9 24z"/><g class="prop-smoke"><path d="M99 49q-12-18 0-35 M112 49q-12-18 0-35"/></g>',
};
export function createConsequenceVisual(host:HTMLElement):{set(effect:StoryConsequence|null):void;dispose():void} {
 const doc=host.ownerDocument,root=doc.createElement('aside');root.className='scene-consequence';root.hidden=true;root.setAttribute('aria-label','État concret de la scène');host.append(root);let current='';
 const icons:Record<StoryConsequence['kind'],string>={access:'M8 4h10v24H8 M18 16h5 M12 16h1',object:'M5 9h22v20H5z M10 9V4h12v5 M5 16h22',relationship:'M10 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M3 28v-6a7 7 0 0 1 14 0v6 M17 28v-6a7 7 0 0 1 12 0v6'};
 return {set(effect){
  if(!effect){root.hidden=true;current='';return;}if(current===effect.id)return;current=effect.id;root.hidden=false;root.dataset['effect']=effect.id;root.dataset['kind']=effect.kind;root.dataset['open']='false';root.dataset['working']=String(Boolean(effect.active));root.replaceChildren();
  const text=doc.createElement('div'),label=doc.createElement('strong'),detail=doc.createElement('small');label.textContent=effect.label;detail.textContent=effect.detail;text.append(label,detail);
  if(effect.visual){
   root.dataset['visual']=effect.visual;const miniature=doc.createElementNS('http://www.w3.org/2000/svg','svg');miniature.setAttribute('viewBox','0 0 200 145');miniature.setAttribute('aria-hidden','true');miniature.classList.add('prop-mini');miniature.innerHTML=objects[effect.visual];const heading=doc.createElement('div');heading.className='prop-heading';heading.append(miniature,text);const inspect=doc.createElement('button');inspect.type='button';inspect.className='prop-inspect';inspect.textContent=effect.action??'Examiner';inspect.setAttribute('aria-expanded','false');
   const closeup=doc.createElement('div');closeup.className='prop-closeup';closeup.hidden=true;const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 200 145');svg.setAttribute('aria-hidden','true');svg.innerHTML=objects[effect.visual];
   const result=doc.createElement('p');result.setAttribute('role','status');result.textContent=effect.detail;const close=doc.createElement('button');close.type='button';close.className='prop-close';close.textContent='Refermer';close.addEventListener('click',()=>{root.dataset['open']='false';closeup.hidden=true;inspect.setAttribute('aria-expanded','false');inspect.focus();});
   closeup.append(svg,result,close);inspect.addEventListener('click',()=>{root.dataset['open']='true';closeup.hidden=false;inspect.setAttribute('aria-expanded','true');close.focus({preventScroll:true});});root.append(heading,inspect,closeup);
  }else{delete root.dataset['visual'];const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('aria-hidden','true');const path=doc.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[effect.kind]);svg.append(path);root.append(svg,text);}
 },dispose(){root.remove();}};
}
