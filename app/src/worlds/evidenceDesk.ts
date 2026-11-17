import { ATTENDEES, ORIGINAL_WORDS, TRANSCRIBED_WORDS, freshEvidenceDesk, reduceEvidenceDesk, type EvidenceAction, type EvidenceField, type EvidenceRoute, type EvidenceSide } from './evidenceDeskState';
import './evidenceDesk.css';
/** Local proposal: no game save is read, replaced or updated. */
export function mountEvidenceDesk(root: HTMLElement): () => void {
 const doc=root.ownerDocument,host=doc.createElement('main');host.className='evidence-desk';host.dataset['atelier']='preuves';host.setAttribute('aria-label','1984 · Ce que tu as vraiment dit');
 host.style.setProperty('--ed-scene',`url("${import.meta.env.BASE_URL}illustrated/full-frame/w10-room.audition.jpg")`);root.append(host);
 const scene=doc.createElement('figure');scene.className='ed-scene';
 const sceneImage=doc.createElement('img');sceneImage.src=`${import.meta.env.BASE_URL}illustrated/full-frame/w10-anchor.cp.head.jpg`;sceneImage.alt='Le poste de contrôle du Registre : la barrière ferme l’accès à l’assemblée.';scene.append(sceneImage);
 let arrived=false;
 const stage={el:scene,update:(next:ReturnType<typeof freshEvidenceDesk>)=>{scene.dataset['outcome']=next.result?.status??'waiting';},dispose:()=>scene.remove()};
 let state=freshEvidenceDesk(),disposed=false;
 let activeDocument:EvidenceSide='original';
 const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls=''):HTMLElementTagNameMap[K]=>{const el=doc.createElement(tag);el.textContent=text;el.className=cls;return el;};
 const action=(label:string,run:()=>void,cls=''):HTMLButtonElement=>{const b=node('button',label,cls);b.type='button';b.addEventListener('click',run);return b;};
 const dispatch=(event:EvidenceAction,focus?:string):void=>{if(disposed)return;state=reduceEvidenceDesk(state,event);draw();if(focus){const target=host.querySelector<HTMLElement>(focus);target?.focus({preventScroll:true});}};
 const field=(side:EvidenceSide,key:EvidenceField,text:string,label:string):HTMLButtonElement=>{
  const b=action(text,()=>dispatch({type:'select',side,field:key},`[data-evidence-field="${side}-${key}"]`),`ed-field ed-field-${key}`);b.dataset['evidenceField']=`${side}-${key}`;b.setAttribute('aria-label',`${side==='original'?'Copie personnelle':'Rapport IA'} : ${label}`);b.setAttribute('aria-pressed',String(state.selected[side]===key));
  if(key!=='reference'&&state.proof[key]){b.dataset['matched']='true';b.append(node('span',key==='words'?'INVERSION RELEVÉE':'MÊME INSTANT','ed-field-mark'));}b.disabled=state.assembled;return b;
 };
 const draw=():void=>{
  
  host.replaceChildren();host.dataset['phase']=!arrived?'arrival':state.result?'result':state.assembled?'compose':'inspect';
  host.style.setProperty('--ed-scene',`url("${import.meta.env.BASE_URL}illustrated/full-frame/${state.result?.route==='broadcast'?'w10-street.mid':'w10-room.audition'}.jpg")`);
  const header=node('header','','ed-header'),title=node('h1','1984 · Le Registre');title.tabIndex=-1;
  header.append(node('p','LIFE 3.0 · SÉQUENCE LOCALE','ed-kicker'),title,node('p','Une IA a inversé tes propos. Prouve l’altération pour contester ton exclusion.','ed-intro'));
  const leave=node('a','Revenir au jeu','ed-exit');leave.href=import.meta.env.BASE_URL;header.append(leave);host.append(header);
  const access=node('aside','','ed-access');access.setAttribute('aria-label','État de ton accès');
  access.append(node('span',state.result?.status==='review'?'RÉEXAMEN OUVERT':'ACCÈS SUSPENDU','ed-access-status'),node('p',state.result?.status==='public'?'La correction circule. Le Registre maintient ta suspension.':state.result?.status==='review'?'Le dossier attend une décision humaine.':'Motif : incitation à neutraliser la surveillance.'));host.append(access);
  const deskGuide=node('p',state.feedback,'ed-desk-guide');deskGuide.setAttribute('role','status');host.append(deskGuide);
  const documentNav=node('nav','','ed-document-nav');documentNav.setAttribute('aria-label','Documents à comparer');
  for(const [side,label] of [['original','Ma copie'],['transcript','Rapport IA']] as const){const tab=action(label,()=>{activeDocument=side;draw();host.querySelector<HTMLElement>(`[data-document-tab="${side}"]`)?.focus({preventScroll:true});});tab.dataset['documentTab']=side;tab.setAttribute('aria-pressed',String(activeDocument===side));documentNav.append(tab);}host.append(documentNav);
  const workspace=node('div','','ed-workspace');workspace.dataset['document']=activeDocument;
  const original=node('article','','ed-original');original.setAttribute('aria-label','Ta copie locale');
  original.append(node('p','COPIE LOCALE / NON TRANSMISE','ed-paper-kicker'),node('h2','Ta voix.'),node('p','Séance publique · 12 novembre 2030','ed-session'));
  const waveform=node('div','','ed-waveform');waveform.setAttribute('aria-hidden','true');for(const height of [18,35,22,49,70,34,58,80,45,25,53,73,29,49,66,35,22,47,75,30,51,24,14,39,60,25,13]){const bar=node('i');bar.style.height=`${height}%`;waveform.append(bar);}
  original.append(waveform,node('p','Relevé textuel de ton enregistrement','ed-recording-caption'),field('original','time','00:14','repère 00:14'),field('original','words',ORIGINAL_WORDS,'phrase prononcée'),node('p','« Je demande qu’un contrôle indépendant vérifie leur usage. »','ed-secondary-quote'),field('original','reference','Fichier personnel 04 / séance 118','référence du fichier'));
  const report=node('article','','ed-transcript');report.setAttribute('aria-label','Rapport automatique du Registre');
  report.append(node('p','REGISTRE CENTRAL / EXTRACTION IA','ed-paper-kicker'),node('h2','Tes mots, selon eux.'),node('p','Séance publique · 12 novembre 2030','ed-session'));
  const verdict=node('div','','ed-verdict');verdict.append(node('span','MESURE EXÉCUTÉE'),node('strong','Interdiction d’assemblée'),node('small','Décision automatique · droit de contestation'));report.append(verdict,field('transcript','time','00:14','repère 00:14'),field('transcript','words',TRANSCRIBED_WORDS,'phrase attribuée'),node('p','Classification : appel à désactiver les caméras.','ed-classification'),field('transcript','reference','Rapport R-884 / séance 118','référence du rapport'));
  workspace.append(original,report);host.append(workspace);
  const tools=node('section','','ed-tools');tools.setAttribute('aria-label','Rapprochement des pièces');const live=node('p',state.assembled?'Prépare la copie que tu veux transmettre.':'Compare les mots, puis leur repère de lecture.','ed-feedback');
  const findings=node('div','','ed-findings');findings.append(node('span',state.proof.words?'✓ Négation supprimée':'○ Ce qui a été changé'),node('span',state.proof.time?'✓ Même instant établi':'○ Quel instant ?'));
  tools.append(node('p',state.assembled?'02 / Préparer l’envoi':'01 / Trouver l’altération','ed-step'),live,findings);
  if(!state.assembled){const assemble=action('Joindre les pièces au rectificatif',()=>dispatch({type:'assemble'},'.ed-correction h2'),'ed-paperclip');assemble.dataset['evidenceAction']='assemble';assemble.disabled=!state.proof.words||!state.proof.time;tools.append(assemble,node('p','Sélectionne un élément sur chaque document. Tu peux te tromper et recommencer ; aucun chronomètre ne tourne.','ed-hint'));}host.append(tools);
  if(state.assembled){
   const correction=node('section','','ed-correction');correction.setAttribute('aria-label','Rectificatif et identités jointes');const correctionTitle=node('h2','Le rectificatif.');correctionTitle.tabIndex=-1;
   correction.append(node('p','PIÈCES RAPPROCHÉES / SÉANCE 118 / 00:14','ed-paper-kicker'),correctionTitle,node('blockquote',ORIGINAL_WORDS),node('p','Négation rétablie. Le rapport disait l’inverse.','ed-correction-note'),node('h3','Deux présences figurent aussi sur ta copie.'),node('p','Le recours exige leurs identifiants pour authentifier la séance. Le canal public les diffusera tels quels. Tu peux les masquer.','ed-privacy'));
   const people=node('div','','ed-attendees');
   for(const [index,id] of ATTENDEES.entries()){
    const hidden=state.redacted.includes(id),label=node('label','','ed-redaction');label.dataset['redacted']=String(hidden);const input=node('input');input.type='checkbox';input.checked=hidden;input.disabled=Boolean(state.result);input.dataset['attendee']=id;input.setAttribute('aria-label',`Masquer l’identifiant de la personne ${index+1}`);input.addEventListener('change',()=>dispatch({type:'redact',attendee:id},`[data-attendee="${id}"]`));
    label.append(input,node('span',hidden?'██████':id,'ed-identifier'),node('span',hidden?'Identité masquée':'Identité lisible','ed-redaction-label'));people.append(label);
   }
   correction.append(people);host.append(correction);
   if(!state.result){
    const delivery=node('section','','ed-delivery');delivery.setAttribute('aria-label','Transmettre le rectificatif');delivery.append(node('p','03 / Où envoies-tu cette copie ?','ed-step'));
    const envelope=action(state.armed?'Dossier en main · le reposer':'Prendre le dossier corrigé',()=>dispatch({type:'arm'},'[data-evidence-action="take"]'),'ed-envelope');envelope.dataset['evidenceAction']='take';envelope.draggable=true;envelope.setAttribute('aria-pressed',String(state.armed));envelope.append(node('small',`${state.redacted.length} / 2 identités masquées · copie et rapport joints`));
    envelope.addEventListener('dragstart',event=>{if(!event.dataTransfer)return;event.dataTransfer.setData('application/x-life-evidence','rectification');event.dataTransfer.effectAllowed='move';if(!state.armed)state=reduceEvidenceDesk(state,{type:'arm'});envelope.setAttribute('aria-pressed','true');host.querySelectorAll<HTMLButtonElement>('.ed-slot').forEach(slot=>{slot.disabled=false;});});envelope.addEventListener('dragend',()=>{if(!disposed&&!state.result)draw();});delivery.append(envelope);
    const slots=node('div','','ed-slots');
    for(const [route,heading,text] of [['appeal','Fente du recours officiel','Le Registre reçoit la preuve. Identités exigées ; aucune publication.'],['broadcast','Canal public du quartier','Copie publiée immédiatement. Tout ce qui reste lisible sera visible de tous.']] as const){
     const submit=(destination:EvidenceRoute):void=>dispatch({type:'deliver',route:destination},'.ed-result h2');
     const slot=action(heading,()=>submit(route),'ed-slot');slot.dataset['route']=route;slot.disabled=!state.armed;slot.append(node('small',text));
     slot.addEventListener('dragover',event=>{if(state.assembled){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}});slot.addEventListener('drop',event=>{if(event.dataTransfer?.getData('application/x-life-evidence')!=='rectification')return;event.preventDefault();submit(route);});slots.append(slot);
    }
    delivery.append(slots,node('p','Clique ou touche le dossier, puis sa destination. Glisser est facultatif. Transmettre termine cette séquence.','ed-hint'));host.append(delivery);
   }
  }
  if(state.result){
   const result=node('section','','ed-result');result.setAttribute('aria-label','Conséquences de ta transmission');
   const heading=node('h2',state.result.status==='public'?'Ta voix sort du dossier.':state.result.status==='review'?'Un humain devra répondre.':'Pièces jugées incomplètes.');heading.tabIndex=-1;
   result.append(node('p',state.result.route==='broadcast'?'CANAL PUBLIC / COPIE DIFFUSÉE':'REGISTRE / ACCUSÉ DE RÉCEPTION','ed-paper-kicker'),heading,node('p',state.result.status==='public'?'L’écran du quartier affiche ta phrase avec « ne … pas ». L’altération devient visible. Cela ne lève pas l’interdiction d’assemblée : le Registre maintient la suspension.':state.result.status==='review'?'Les deux identifiants rendent ta contestation recevable. Le classement automatique est interrompu ; un examen humain est ouvert. Ton accès reste suspendu jusqu’au verdict.':'Les identifiants masqués empêchent la vérification des présences. Ta correction est archivée ; le recours n’est pas instruit. Ton accès reste suspendu.'));
   const visible=node('div','',state.result.route==='broadcast'?'ed-public-display':'ed-official-receipt');
   visible.setAttribute('aria-label',state.result.route==='broadcast'?'Ce qui apparaît sur l’écran public':'Réponse du terminal');
   visible.append(node('span',state.result.route==='broadcast'?'ÉCRAN DU QUARTIER / RECTIFICATION':'TERMINAL R-884 / RÉPONSE','ed-paper-kicker'));
   visible.append(node('strong',state.result.route==='broadcast'?ORIGINAL_WORDS:state.result.status==='review'?'RECOURS RECEVABLE':'PIÈCES MANQUANTES'));
   visible.append(node('small',state.result.exposed.length?`Présences transmises : ${state.result.exposed.join(' · ')}`:'Présences : ██████ · ██████'));
   result.append(visible);
   const tally=node('dl','','ed-tally');
   for(const [label,value] of [['Ta parole',state.result.route==='broadcast'?'Correction visible dans le quartier':'Correction transmise au Registre'],['Ton accès',state.result.status==='review'?'Suspendu · examen humain ouvert':'Toujours suspendu'],['Les personnes présentes',state.result.exposed.length?`${state.result.exposed.length} identité(s) transmise(s) : ${state.result.exposed.join(', ')}`:'Aucune identité transmise']])tally.append(node('dt',label),node('dd',value));
   result.append(tally,node('p',state.result.route==='broadcast'&&state.result.exposed.length?'Le canal montre aussi les présences. Tu as rendu la falsification vérifiable en exposant des gens qui ne t’avaient rien demandé.':state.result.protected.length?'Les identités masquées ne figurent pas dans la copie transmise. Leur protection réduit les moyens d’authentifier ta preuve.':'Le Registre connaît désormais les deux présences. Tu as obtenu un examen, pas l’effacement de leurs traces.','ed-result-cost'),action('Rejouer cette séquence',()=>{dispatch({type:'reset'},'.ed-header h1');host.scrollTop=0;},'ed-restart'));host.append(result);
  }
  host.append(node('footer','Prototype local · Situation et règles fictives · Aucune sauvegarde du jeu modifiée','ed-footer'));
  const bench=node('section','','ed-bench');bench.setAttribute('aria-label','Borne de contestation — documents et outils');bench.append(...[...host.children].filter(child=>child!==header));host.append(stage.el,bench);stage.update(state);
  // Primary actions live outside the scrollable reading region.
  const dock=node('footer','','ed-action-dock');
  if(!arrived){
   bench.replaceChildren();
   const arrival=node('section','','ed-arrival');
   arrival.append(node('p','ASSEMBLÉE DU QUARTIER · 18 H 30','ed-step'),node('h2','La porte te refuse l’entrée.'),node('p','Tu viens participer à l’assemblée. Le terminal t’accuse d’avoir appelé à couper les caméras. Mais tu as dit le contraire.'),node('p','Ton enregistrement est encore sur ton téléphone. Compare-le au rapport du Registre.'));
   bench.append(arrival);
   const start=action('Consulter le rapport',()=>{arrived=true;draw();host.querySelector<HTMLElement>('.ed-desk-guide')?.focus({preventScroll:true});},'ed-paperclip');start.dataset['evidenceAction']='start';dock.append(start);
  }else if(state.result){
   const restart=bench.querySelector('.ed-restart');if(restart)dock.append(restart);
  }else if(state.assembled){
   const delivery=bench.querySelector('.ed-delivery');if(delivery)dock.append(delivery);
  }else{
   const tools=bench.querySelector('.ed-tools');if(tools)dock.append(tools);
  }
  deskGuide.tabIndex=-1;
  host.append(dock);
 };
 draw();return()=>{disposed=true;stage.dispose();host.remove();};
}
