import {aftermathFact} from './aftermath';
import type {JourneyState,JourneyWorldId} from './types';
/** Facts reconstructed from decisions, never scores invented from the questionnaire. */
export interface StoryConsequence {id:string;label:string;detail:string;kind:'access'|'object'|'relationship';companion?:'near'|'away'|undefined;visual?:'keys'|'case'|'wheel'|'cup'|'lamp'|'tap'|'capsule'|'photo'|'hearth';active?:boolean;action?:string}
const effect=(id:string,label:string,detail:string,kind:StoryConsequence['kind']='object',companion?:StoryConsequence['companion']):StoryConsequence=>({id,label,detail,kind,...(companion?{companion}:{})});
export function journeyConsequences(world:JourneyWorldId,state:JourneyState):StoryConsequence[] {
 const has=(v:string)=>state.inventory.includes(v);const list:StoryConsequence[]=[];
 const add=(item:string,id:string,label:string,detail:string,kind:StoryConsequence['kind']='object',companion?:StoryConsequence['companion'])=>{if(has(item))list.push(effect(id,label,detail,kind,companion));};
 if(world==='w01'){
  add('Données cédées','data','Données cédées · 1 mois','Le bail est financé par un contrat de revente de tes traces.','access');
  add('Tomasz exposé','source','Tomasz identifié','Son nom est désormais attaché au reçu public.','relationship');
  add('Bail commun','keys','Deux accès valides','Esteban et toi figurez sur le contrat.','access','near');
  add('Bail individuel','one-key','Un seul accès','Ton nom figure sur le contrat ; celui d’Esteban en est absent.','access','away');
  add('Clé donnée à Esteban','given-key','Clé remise à Esteban','Il peut rentrer. Tu restes sans accès.','access','near');
 }
 if(world==='w02'){
  add('Accompagnement assuré','visit','Ton séjour annulé','Ce temps est réservé aux visites de soins près de Soraya.','relationship');
  add('Transfert annulé','stays','Transfert annulé','Soraya garde sa place ici et ses soins.','access','near');
  add('Transfert reporté','week','Report · 7 jours','Le véhicule repart ; la réévaluation reste prévue.','access','near');
  add('Transfert confirmé','leaves','Départ confirmé','La place de Soraya se libère ici. Ses soins continuent ailleurs.','relationship','away');
 }
 if(world==='w03'){
  add('Remorque réparée','wheel','La roue tourne','Noor peut reprendre sa tournée de visites.');
  add('Séance ouverte','workshop','Séance ouverte préparée','Une invitation et des outils sont prêts ; le vote décide du maintien du lieu.','access');
  add('Accès classé','ranking','Accès classé adopté','Les habitants reçoivent de nouveau des places selon le classement.','access');
 }
 if(world==='w04'){
  add('Apprentissage limité','limit','Mode général retiré','Le prototype n’apprend plus au-delà du geste autorisé.');
  add('Pièce traçable','component','Composant traçable','Un autre atelier peut vérifier la pièce.');
  if(state.choices.some(c=>c.scene==='wall'&&c.option==='trial'))list.push(effect('cup','Essai autorisé','Iris peut utiliser la main dans le périmètre documenté.','access','near'));
 }
 if(world==='w05'){
  add('Passage balisé','route','Passage balisé','Les voisins peuvent rejoindre le café.','access');
  add('Eau vérifiée','water','Eau vérifiée','Les tasses peuvent être remplies sans supposer l’eau potable.');
  add('Couchages prêts','beds','Couchages prêts','Les couvertures sont réparties pour la nuit.');
  add('Batterie envoyée au pont','battery','Batterie envoyée','Le secours emporte la batterie ; elle n’est plus disponible au café.');
 }
 if(world==='w06'){
  add('Demande commune','addresses','Dispensaire inclus','La réparation demandée couvre les logements et le dispensaire.','access');
  add('Demande privée','private','Ton adresse seulement','Le dispensaire n’est pas inclus dans cette demande.','access');
  add('Licence commune','license','Plan réutilisable','Mina peut réparer et transmettre la solution.','access');
  add('Intervention privée','monopoly','Réparateur exclusif','La prochaine panne dépend encore du prestataire.','access');
 }
 if(world==='w08'){
  add('Récit d’Aurèle','voice','Voix conservée','La capsule garde la voix d’Aurèle avec ses hésitations.');
  if(has('Droit de discuter')){const limited=state.choices.some(c=>c.scene==='lesson'&&c.option!=='living');list.push(effect('different',limited?'Droit discuté, non transmis':'Droit de contredire',limited?'Tu as ensuite choisi une archive seule ou aucune capsule : le droit discuté n’est pas inclus dans la transmission.':'L’accord permet à l’élève de raconter cette histoire autrement.','access'));}
  add('Essai personnel','experiment','Essai autonome','L’élève a pu proposer sa propre méthode.','relationship','near');
 }
 if(world==='w09'){
  add('Photo confiée','photo','Original hors capteurs','La photographie non corrigée reste conservée ; participer au programme ne l’efface pas.');
  if(state.choices.some(c=>c.scene==='moment'&&c.option==='show'))list.push(effect('photo-shown','Séance de consolation choisie',has('Photo confiée')?'La séance propose un récit apaisant. L’original conservé reste distinct de ce récit.':'La copie transmise alimente le récit apaisant du programme.','object'));
  add('Photo diffusée','copy','Copie au Gardien','Un retrait de la scène ne retire pas la copie déjà transmise.','access');
  add('Rideau déplacé','curtain','Rideau fermé','Un espace provisoire échappe au programme de consolation.','access','near');
  add('Confort personnel suspendu','comfort','Confort personnalisé coupé','Ton environnement ne s’adapte plus à tes préférences.','access');
 }
 if(world==='w11'){
  add('Inès dénoncée','ines','Inès retenue','Augustin empêche son retour ce soir.','relationship','away');
  add('Joint réparé','hearth','Joint réparé','Le joint retient la chaleur ; le bois reste nécessaire.');
  add('Fagot','wood','Un fagot disponible','Le combustible est conservé pour le foyer.');
  add('Savoir partagé','knowledge','Geste autorisé','Le village distingue cette réparation manuelle du retour des réseaux.','access','near');
 }
 for(const after of state.choices.filter(c=>c.scene.startsWith('aftermath_')||c.scene.startsWith('handoff_'))){const fact=aftermathFact(world,after.option);if(fact)list.push(effect(`after-${after.option}`,fact.label,fact.detail,'access'));}
 return list;
}

/** A manipulable close-up demonstrates a real object state, without changing saved choices. */
export function journeyMaterial(world:JourneyWorldId,state:JourneyState,location:string):StoryConsequence|null{
 const has=(x:string)=>state.inventory.includes(x),picked=(scene:string,option?:string)=>state.choices.some(c=>c.scene===scene&&(!option||c.option===option));
 const pending=state.scene.replace(/^(aftermath_|handoff_)/,'');
 let visual:StoryConsequence['visual'],active=false,label='',detail='',action='Observer',companion:StoryConsequence['companion'];
 if(world==='w01'&&['home','line'].includes(location)){visual='keys';active=has('Bail commun')||has('Bail individuel');label=active?'La clé répond':'Aucun accès à ton nom';detail=has('Bail commun')?'Deux noms : Esteban et toi pouvez entrer.':has('Clé donnée à Esteban')?'La clé donnée ouvre pour Esteban, pas pour toi.':has('Bail individuel')?'Le lecteur accepte ta clé. Esteban reste dehors.':'Le lecteur ne trouve pas de contrat valide pour toi.';action='Présenter ma clé';companion=has('Bail individuel')?'away':has('Bail commun')?'near':undefined;if(!picked('desk')&&location==='home'){active=true;label='Clé actuelle · jusqu’à ce soir';detail='L’ancien accès fonctionne encore. Sans nouveau contrat ou recours, il expirera ce soir.';}}
 else if(world==='w02'&&['home','garden'].includes(location)){visual='case';active=has('Transfert confirmé');label=active?'Départ confirmé':has('Transfert annulé')?'Départ annulé':'Départ en attente';detail=active?'Le véhicule peut emporter la valise.':has('Transfert annulé')?'Soraya défait ses affaires : les soins continuent ici.':has('Transfert reporté')?'La valise reste près de la porte pendant le report.':'La réservation existe encore ; aucune annulation n’a été obtenue.';action='Vérifier le véhicule';companion=active?'away':has('Transfert annulé')?'near':undefined;}
 else if(world==='w03'&&['workshop','square'].includes(location)){visual='wheel';active=has('Remorque réparée');label=active?'La roue est libre':'La roue frotte';detail=active?'La remorque peut rouler jusqu’aux voisins éloignés.':'La roue bute encore contre la fourche. La tournée reste empêchée.';action='Faire tourner la roue';}
 else if(world==='w04'&&['annex','wall'].includes(location)){visual='cup';active=picked('wall','trial');label=active?'Prise autorisée':'Prototype non autorisé';detail=active?'La main tient la tasse puis s’arrête à la limite prévue.':picked('wall','secret')?'L’alerte a suspendu l’usage après l’essai clandestin.':'Tu peux examiner la tasse, mais l’usage du prototype reste interdit.';action='Vérifier la prise';}
 else if(world==='w05'&&location==='cafe'){visual='lamp';active=has('Eau vérifiée');label=active?'Contrôle d’eau alimenté':'Contrôle d’eau éteint';detail=has('Batterie envoyée au pont')?'La batterie est partie au pont ; le contrôle du café ne peut pas être alimenté.':active?'La batterie alimente le contrôle. Le réseau reste coupé.':'Aucune vérification de l’eau n’est encore enregistrée.';action='Consulter le contrôle';}
 else if(world==='w06'&&['square','vault'].includes(location)){visual='tap';active=picked('repair','share')||picked('repair','contract');label=active?'L’eau arrive au dispensaire':'Le dispensaire attend';detail=active?'La demande commune a été mise en œuvre.':picked('repair','contract_private')?'La réparation ne couvre que ton adresse. Ici, rien ne coule.':'Un plan ou une licence seuls ne rétablissent pas encore l’eau.';action='Ouvrir le robinet du dispensaire';}
 else if(world==='w08'&&['school','home','garden'].includes(location)){visual='capsule';active=has('Récit d’Aurèle')&&!['silent'].includes(pending);label=active?'La voix est dans la capsule':'Pas de voix transmise';detail=active?'Le relevé montre l’enregistrement avec ses hésitations.':'Une règle ou un document ne contient pas sa voix ; une capsule gardée ne la transmet pas.';action='Examiner la capsule';}
 else if(world==='w09'&&['home','glass'].includes(location)){visual='photo';active=has('Photo confiée')&&has('Rideau déplacé');label=active?'Photo hors regard':'Photo non protégée ici';detail=active?'Le rideau soustrait l’original au programme pour ce moment.':has('Photo diffusée')?'La copie est déjà chez le Gardien. Fermer un rideau ne la retire pas.':'Il manque l’original confié ou un espace soustrait aux capteurs.';action='Vérifier ce que voit le capteur';}
 else if(world==='w11'&&['home','forge'].includes(location)){visual='hearth';active=has('Fagot')&&has('Joint réparé')&&has('Geste appris');label=active?'Le foyer peut tenir':'Le foyer reste incomplet';detail=active?'Bois, joint et tirage sont réunis. La chaleur reste dans la pièce.':'Le bois, le joint et le réglage ont chacun leur rôle ; il en manque encore.';action='Vérifier le tirage';}
 else return null;
 return {id:`material-${world}-${active}-${label}-${detail}`,label,detail,kind:'object',visual,active,action,...(companion?{companion}:{})};
}
