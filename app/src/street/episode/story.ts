import type {StoryConsequence} from '../../worlds/consequences';
/** Short 1984 episode. Fictional situations, separate from the seven-day simulation. */
export interface Option { id: string; label: string; next: string; trust?: number; exposure?: number; memory?: string; memories?: readonly string[]; requires?: string }
export interface Scene { chapter: number; title: string; place: string; speaker: string; text: string; actor?: string; options: Option[] }
export interface EpisodeState { scene: string; trust: number; exposure: number; memories: string[]; history: string[] }
export const freshEpisode = (): EpisodeState => ({ scene: 'arrival', trust: 0, exposure: 0, memories: [], history: [] });
export const story: Record<string, Scene> = {
  arrival: { chapter: 1, title: 'Ton frère part demain', place: 'street.mid', speaker: 'LE QUARTIER · 2030', text: 'Marlène, ta mère, t’attend devant l’immeuble. Le Registre, qui répartit les postes par IA, envoie ton frère travailler ailleurs demain : il a refusé. « Monte. Il reste peut-être un recours. »', actor: 'marlene', options: [
    { id: 'help', label: 'Porter son sac, monter', next: 'plant', trust: 1, memory: 'Tu as porté son sac.' },
    { id: 'ask', label: 'Demander des nouvelles du frère', next: 'plant' },
  ] },
  plant: { chapter: 1, title: 'Le basilic', place: 'unit.9-B', speaker: 'MARLÈNE', actor: 'marlene', text: 'Dans la cuisine, Marlène te tend une bouture de basilic. « Ton frère disait que je le noyais. Prends-en une. » Son téléphone affiche un message verrouillé : seul le Registre peut l’ouvrir.', options: [
    { id: 'accept', label: 'Prendre la bouture', next: 'hub', trust: 1, memory: 'Une bouture de basilic t’attend chez toi.' },
    { id: 'later', label: 'La laisser chez maman', next: 'hub' },
  ] },
  hub: { chapter: 1, title: 'Avant le dîner', place: 'unit.9-B', speaker: 'EXPLORER', text: 'Marlène t’attend pour dîner. Tu peux la rejoindre ou faire un détour.', options: [
    { id: 'clinic', label: 'Passer à la cabine médicale', next: 'clinic' },
    { id: 'stall', label: 'Nadia · des nouvelles du quartier', next: 'stall' },
    { id: 'dinner', label: 'Retrouver Marlène pour dîner', next: 'dinner' },
  ] },
  clinic: { chapter: 1, title: 'Pris en charge', place: 'place.cabine', speaker: 'LA CABINE', text: 'La cabine te soigne sans rendez-vous. Sur le reçu, ton sommeil et tes déplacements sont notés avec le diagnostic. Le même service te soigne et te suit.', options: [
    { id: 'share', label: 'Garder le suivi personnalisé', next: 'hub', exposure: 1, memory: 'Tu as conservé le suivi de santé personnalisé.' },
    { id: 'limit', label: 'Limiter le suivi au médical', next: 'hub', memory: 'Tu as demandé à limiter les données partagées.' },
  ] },
  stall: { chapter: 1, title: 'Les absents', place: 'anchor.stall.front', speaker: 'NADIA', actor: 'nadia', text: 'Nadia garde les graines de ton frère. « Un transfert volontaire, vraiment ? »', options: [
    { id: 'remember', label: 'Prendre les graines pour maman', next: 'hub', memory: 'Tu as pris les graines de ton frère pour Marlène.' },
  ] },
  dinner: { chapter: 1, title: 'Une chaise en plus', place: 'unit.9-B', speaker: 'MARLÈNE', actor: 'marlene', text: 'Tu dînes chez ta mère. La troisième assiette est celle de ton frère. Ton bracelet s’allume : « Interaction inhabituelle détectée. » Marlène se tait, la cuillère en l’air.', options: [
    { id: 'stay', label: 'Rapprocher ma chaise', next: 'confession', trust: 1, exposure: 1, memory: 'Tu es resté quand le bracelet s’est allumé.' },
    { id: 'leave', label: 'Prendre ma veste', next: 'departure', memory: 'Le dîner s’est terminé au signal du bracelet.' },
  ] },
  confession: { chapter: 1, title: 'Ne me laisse pas seule avec ça', place: 'unit.9-B', speaker: 'TA MÈRE', actor: 'marlene', text: 'Ta mère te prend la main. « Il n’a pas choisi de partir. J’ai peur. »', options: [{ id: 'hear', label: 'Écouter ce qu’elle me demande', next: 'request' }] },
  departure: { chapter: 1, title: 'La main sur ta veste', place: 'unit.9-B', speaker: 'TA MÈRE', actor: 'marlene', text: 'Tu prends ta veste. Sa voix casse : « Avant que tu partes, j’ai une demande. »', options: [{ id: 'hear', label: 'Écouter avant de partir', next: 'request' }] },
  request: { chapter: 2, title: 'Une demande à table', place: 'unit.9-B', speaker: 'MARLÈNE', actor: 'marlene', text: 'Elle pose son téléphone devant toi. « Au Registre, tu peux faire suspendre le transfert. Mon accès est bloqué. Tu y vas ? »', options: [
    { id: 'together', label: 'Y aller avec maman', next: 'checkpoint', trust: 1, exposure: 1, memory: 'Tu as accompagné Marlène.' },
    { id: 'alone', label: 'Y aller seul', next: 'checkpoint', memory: 'Tu portes le message de ton frère.' },
    { id: 'refuse', label: 'Refuser et quitter la table', next: 'distance', trust: -1 },
  ] },
  checkpoint: { chapter: 2, title: 'Une raison de te retenir', place: 'anchor.cp.head', speaker: 'LE CONTRÔLE', text: 'Au Registre, le terminal affiche : « Accès familial restreint. » Tu peux attendre une agente, ou déclarer que ta mère a poussé ton frère à refuser : le dossier s’ouvre, mais une enquête vise ta mère.', options: [
    { id: 'appeal', label: 'Demander un examen humain', next: 'appeal', exposure: 1, memory: 'Tu as demandé un recours humain.' },
    { id: 'report', label: 'Dénoncer ma mère', next: 'message', trust: -3, memory: 'Tu as signalé Marlène.' },
    { id: 'back', label: 'Revenir auprès de Marlène', next: 'distance' },
  ] },
  appeal: { chapter: 2, title: 'En attente', place: 'anchor.cp.head', speaker: 'LE CONTRÔLE', text: 'Une agente ouvre le portique. « Vous pouvez consulter le dossier. » Elle ne peut pas rétablir l’accès de ta mère.', options: [
    { id: 'enter', label: 'Entrer et écouter', next: 'message', memory: 'Une agente a ouvert le portique.' },
    { id: 'wait', label: 'Rester défendre son accès', next: 'distance', trust: 1, exposure: 1, memory: 'Tu as attendu pour défendre son accès.' },
  ] },
  message: { chapter: 3, title: 'Ce qu’il reste d’une voix', place: 'room.audition', speaker: 'TON FRÈRE · MESSAGE ENREGISTRÉ', text: 'Un message de ton frère. « Aide-moi à contester. Ils me retiennent jusqu’à demain. » Sa voix tremble. « Maman noie toujours mon basilic ? » Un témoin qui signe suspend le transfert.', options: [
    { id: 'keep', label: 'Conserver sa voix pour Marlène', next: 'return', exposure: 1, memory: 'Tu as conservé la voix de ton frère.' },
    { id: 'inspect', label: 'Ouvrir l’ordre de transfert', next: 'evidence', exposure: 1, memory: 'Tu as consulté l’ordre de transfert de ton frère.' },
    { id: 'delete', label: 'Effacer ma copie du message', next: 'return', memory: 'Le message a été effacé.' },
  ] },
  evidence: { chapter: 3, title: 'Ton nom à la place du sien', place: 'room.audition', speaker: 'L’AGENTE', text: 'L’agente te tend l’ordre. « Votre signature suspend le transfert quarante-huit heures. » Elle ajoute : « Vous ne quitterez pas le secteur avant votre témoignage. »', options: [
    { id: 'witness', label: 'Signer comme témoin', next: 'return', exposure: 3, trust: 1, memory: 'Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.' },
    { id: 'witness_voice', label: 'Signer et emporter sa voix', next: 'return', exposure: 4, trust: 1, memory: 'Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.', memories: ['Tu as conservé la voix de ton frère.'] },
    { id: 'voice_only', label: 'Conserver sa voix sans signer', next: 'return', exposure: 1, memory: 'Tu as conservé la voix de ton frère.' },
    { id: 'close_file', label: 'Refermer le dossier', next: 'return', memory: 'Tu as laissé partir le dossier sans opposition.' },
  ] },
  distance: { chapter: 3, title: 'Le palier', place: 'stairs.9', speaker: 'MARLÈNE', actor: 'marlene', text: 'Sur le palier, ta mère serre sa veste. « Il part demain. Reste un instant. »', options: [
    { id: 'sit', label: 'S’asseoir près d’elle', next: 'return', trust: 1, memory: 'Tu t’es assis près d’elle.' },
    { id: 'home', label: 'Rentrer, fermer ma porte', next: 'end', trust: -1, memory: 'Tu as fermé ta porte.' },
  ] },
  return: { chapter: 3, title: 'Devant sa porte', place: 'door.9-B', speaker: 'À TOI', actor: 'marlene', text: 'Devant sa porte, ta mère demande : « Son départ est suspendu ? » Ton bracelet propose de classer « résolu ».', options: [
    { id: 'honest', label: 'Tout dire à Marlène', next: 'end', trust: 1, memory: 'Tu lui as dit la vérité.' },
    { id: 'safe', label: 'Confirmer « résolu » et rentrer', next: 'end', trust: -1, memory: 'Tu as confirmé que la situation était résolue.' },
  ] },
  end: { chapter: 3, title: 'Ce que cette journée change', place: 'unit.9-D', speaker: 'FIN DU PARCOURS', text: '', options: [] },
};
story.exit_check={chapter:3,title:'Le portique ne s’ouvre pas',place:'anchor.cp.head',speaker:'LE CONTRÔLE',text:'Le portique ne s’ouvre pas. Ton logement et les services restent accessibles. Tu peux demander un reçu du refus, ou rentrer sans nouvelle demande.',options:[
 {id:'receipt',label:'Exiger le reçu du refus',next:'end',exposure:1,memory:'Tu as conservé le reçu du refus de sortie.'},
 {id:'return_home',label:'Rentrer sans ajouter une demande',next:'end',memory:'Tu es rentré après le refus de sortie.'},
]};

/** Legal options exclude already explored detours; no routine can be farmed. */
export function optionsFor(state: EpisodeState): Option[] {
  const base=story[state.scene]!.options.filter(o => state.scene !== 'hub' || !state.history.includes(o.next));
  if(state.scene==='return'){
    const suspended=state.memories.includes('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.');
    const blocked=suspended||state.exposure>=3;
    base.push({id:'check_exit',label:'Vérifier mon autorisation de sortie',next:blocked?'exit_check':'end',memory:blocked?'Tu as présenté ton autorisation au contrôle de sortie.':'Ton autorisation de sortie est valide ; tu n’as pas quitté le secteur.'});
    if(state.trust>=3&&!state.memories.includes('Tu as signalé Marlène.'))base.push({id:'plan_together',label:'Préparer la suite avec maman',next:'end',memory:'Marlène et toi avez préparé ensemble la prochaine démarche.',memories:['Tu lui as dit la vérité.']});
  }
  return base;
}
/** Pure choice reducer. Invalid and duplicate gestures cannot apply effects twice. */
export function choose(state: EpisodeState, id: string): EpisodeState {
  const option = optionsFor(state).find(o => o.id === id);
  if (!option) return state;
  return { scene: option.next, trust: state.trust + (option.trust ?? 0), exposure: state.exposure + (option.exposure ?? 0), memories: [...state.memories, ...(option.memory ? [option.memory] : []), ...(option.memories ?? [])], history: [...state.history, state.scene] };
}
/** Distinct relational and institutional consequences; comfort is not a moral score. */
export function ending(state: EpisodeState): string {
  const betrayed = state.memories.includes('Tu as signalé Marlène.');
  const voice = state.memories.includes('Tu as conservé la voix de ton frère.');
  const told = state.memories.includes('Tu lui as dit la vérité.');
  const planned = state.memories.includes('Marlène et toi avez préparé ensemble la prochaine démarche.');
  const relation = betrayed ? 'Marlène a reçu une copie du signalement. Ce soir, sa porte reste fermée.' : planned ? 'Marlène garde une copie de votre prochaine démarche, à faire ensemble.' : told ? (voice ? 'Ta mère écoute deux fois le rire de ton frère, la main sur la tienne.' : 'Ta mère te serre contre elle. Vous relisez ce qui reste à faire.') : 'Vous vous séparez sans rien préparer. Marlène connaît la date du transfert.';
  const system = state.exposure >= 3 ? 'Ton prochain trajet sera vérifié.' : 'Ton logement et tes repas restent garantis.';
  const opposition = state.memories.includes('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.');
  return `${relation}\n\n${opposition ? 'Le transfert de ton frère est suspendu quarante-huit heures ; ton autorisation de sortie est retenue jusqu’à ton témoignage demain. ' : 'Tu n’as pas suspendu le transfert de ton frère. Son départ reste prévu demain matin. '}${system}`;
}
/** Replays choices, bridging identifiable legacy dinner edges; rejects malformed histories. */
export function restoreEpisode(raw: string | null): { state: EpisodeState; picks: string[] } {
  try {
    const picks: unknown = JSON.parse(raw ?? 'null');
    if (!Array.isArray(picks) || picks.length > 30) throw new Error('invalid episode');
    let state = freshEpisode();
    const migrated: string[] = [];
    for (const id of picks) {
      if (typeof id !== 'string') throw new Error('invalid choice');
      // Old histories jumped directly from either dinner gesture to this request.
      // A following request choice identifies that legacy edge unambiguously.
      if ((state.scene === 'confession' || state.scene === 'departure') && ['together', 'alone', 'refuse'].includes(id)) {
        state = choose(state, 'hear'); migrated.push('hear');
      }
      const next = choose(state, id); if (next === state) throw new Error('obsolete choice'); state = next; migrated.push(id);
    }
    return { state, picks: migrated };
  } catch { return { state: freshEpisode(), picks: [] }; }
}

/** Scene details follow the actual route; the family never teleports or forgets a denunciation. */
export function episodeText(state: EpisodeState): string {
  const has = (memory: string): boolean => state.memories.includes(memory);
  const accompanied = has('Tu as accompagné Marlène.');
  const betrayed = has('Tu as signalé Marlène.');
  if(state.scene==='exit_check')return `${state.memories.includes('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.')?'Ta signature bloque ta sortie jusqu’au témoignage de demain.':'Tes démarches déclenchent une vérification avant de sortir.'} ${story.exit_check!.text}`;
  if (state.scene === 'appeal') return `Une agente ouvre le portique. « Vous pouvez consulter le dossier. Suspendre le départ exige une opposition signée. » ${accompanied ? 'Marlène doit attendre dehors : son accès reste bloqué.' : 'Ta mère est restée chez elle : son accès reste bloqué.'}`;
  if (state.scene === 'distance') return `${state.history.includes('checkpoint') ? 'Tu rentres du Registre sans le dossier.' : 'Tu quittes la table sans accepter.'} Marlène te rejoint sur le palier. « Il part demain. Reste un instant. » Son transfert n’est pas suspendu.`;
  if (state.scene === 'return') {
    const result = has('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.')
      ? '48 heures de suspension : tu peux rentrer chez toi, mais pas quitter le secteur avant ton témoignage demain.'
      : 'Tu n’as rien signé : le transfert reste prévu demain matin.';
    return `${result} ${betrayed ? 'Marlène montre la notification du signalement. « Tu leur as dit que c’était ma faute ? »' : 'Devant sa porte, Marlène demande : « Qu’as-tu fait ? »'} Le bracelet propose « résolu » : suivi clos, transfert inchangé.`;
  }
  return story[state.scene]!.text;
}

/** Visible receipts and relationships come from this episode, not questionnaire metrics. */
export function episodeConsequences(state:EpisodeState):StoryConsequence[]{
 const has=(m:string)=>state.memories.includes(m);const facts:StoryConsequence[]=[];
 if(has('Tu as signalé Marlène.'))facts.push({id:'mother-reported',label:'Marlène signalée',detail:'Ta déclaration a déclenché une enquête. Elle a reçu une copie.',kind:'relationship',companion:'away'});
 if(has('Tu as conservé la voix de ton frère.'))facts.push({id:'brother-voice',label:'Voix conservée',detail:'Une copie du message reste entre tes mains. Elle ne suspend pas le départ.',kind:'object'});
 if(has('Le message a été effacé.'))facts.push({id:'voice-erased',label:'Message effacé',detail:'Tu gardes le souvenir des mots, pas un enregistrement à partager.',kind:'object'});
 if(has('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.'))facts.push({id:'transfer-stopped',label:'Transfert suspendu · 48 h',detail:'Le reçu porte ta signature. Ta sortie est retenue jusqu’au témoignage.',kind:'access'});
 else if(state.exposure>=3)facts.push({id:'exit-review',label:'Sortie soumise à vérification',detail:'Tes démarches déclenchent un contrôle supplémentaire au portique.',kind:'access'});
 if(has('Tu as conservé le reçu du refus de sortie.'))facts.push({id:'exit-receipt',label:'Refus de sortie documenté',detail:'Le reçu permet de contester le refus ; il ne débloque pas le portique.',kind:'object'});
 if(has('Marlène et toi avez préparé ensemble la prochaine démarche.'))facts.push({id:'shared-appointment',label:'Prochaine démarche préparée',detail:'Marlène garde une copie du rendez-vous et viendra avec toi.',kind:'relationship',companion:'near'});
 return facts;
}
export function episodeConsequence(state:EpisodeState):StoryConsequence|null{
 const facts=episodeConsequences(state);let effect=facts.at(-1)??null;
 if(state.scene==='exit_check'||(state.scene==='return'&&facts.some(f=>f.id==='transfer-stopped'||f.id==='exit-review')))effect={id:'exit-portico',label:'Sortie retenue',detail:'Le lecteur refuse de débloquer la sortie du secteur. Le logement reste accessible.',kind:'access',visual:'keys',active:false,action:'Présenter l’autorisation'};
 else if(state.scene==='return'&&facts.some(f=>f.id==='brother-voice'))effect={id:'voice-player',label:'Message du frère conservé',detail:'Tu peux encore remettre l’enregistrement à Marlène.',kind:'object',visual:'capsule',active:true,action:'Examiner l’enregistrement'};
 if(effect&&state.scene==='return'&&state.memories.includes('Tu as signalé Marlène.'))return {...effect,companion:'away'};
 return effect?{...effect,companion:undefined}:null;
}
