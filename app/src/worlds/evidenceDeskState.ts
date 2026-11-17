/** Isolated design experiment. No game-save access. */
export type EvidenceSide = 'original' | 'transcript';
export type EvidenceField = 'words' | 'time' | 'reference';
export type EvidenceRoute = 'appeal' | 'broadcast';
export type Attendee = 'S-141' | 'S-207';
export interface EvidenceResult { route: EvidenceRoute; exposed: Attendee[]; protected: Attendee[]; status: 'review' | 'incomplete' | 'public' }
export interface EvidenceDeskState {
  selected: { original: EvidenceField | null; transcript: EvidenceField | null };
  proof: { words: boolean; time: boolean };
  assembled: boolean; redacted: Attendee[]; armed: boolean; feedback: string; result: EvidenceResult | null;
}
export type EvidenceAction = { type: 'select'; side: EvidenceSide; field: EvidenceField } | { type: 'assemble' } | { type: 'redact'; attendee: Attendee } | { type: 'arm' } | { type: 'deliver'; route: EvidenceRoute } | { type: 'reset' };
export const ATTENDEES: readonly Attendee[] = ['S-141', 'S-207'];
export const ORIGINAL_WORDS = 'Je ne demande pas que les caméras soient coupées.';
export const TRANSCRIBED_WORDS = 'Je demande que les caméras soient coupées.';
export function freshEvidenceDesk(): EvidenceDeskState {
 return { selected: { original: null, transcript: null }, proof: { words: false, time: false }, assembled: false, redacted: [], armed: false, feedback: 'Relie un passage de ta copie à celui du rapport automatique.', result: null };
}
export function reduceEvidenceDesk(state: EvidenceDeskState, action: EvidenceAction): EvidenceDeskState {
 if (action.type === 'reset') return freshEvidenceDesk();
 if (state.result) return state;
 switch(action.type) {
 case 'select': {
  if (state.assembled) return state;
  const selected = {...state.selected,[action.side]:action.field};
  if (!selected.original || !selected.transcript) return {...state,selected,feedback:'Maintenant, sélectionne le passage correspondant sur l’autre document.'};
  const clear = {original:null,transcript:null};
  if (selected.original !== selected.transcript) return {...state,selected:clear,feedback:'Ces éléments ne se répondent pas. Compare une phrase avec une phrase, ou les deux repères de lecture. Tu peux recommencer.'};
  if (selected.original === 'reference') return {...state,selected:clear,feedback:'Deux numéros de document, une même séance : cela ne prouve pas une altération. Cherche ce que le rapport te fait dire.'};
  const field=selected.original;
  if (state.proof[field]) return {...state,selected:clear,feedback:'Ce rapprochement est déjà établi.'};
  const proof={...state.proof,[field]:true};
  return {...state,selected:clear,proof,feedback:proof.words&&proof.time?'Même instant, sens inversé. Tu peux assembler ton rectificatif.':field==='words'?'« ne … pas » a disparu. Il faut aussi prouver qu’il s’agit du même instant.':'Même instant : 00:14. Compare maintenant les mots attribués à ta voix.'};
 }
 case 'assemble':
  if(state.assembled)return state;
  if(!state.proof.words||!state.proof.time)return {...state,feedback:'Il manque un rapprochement : les mots et le même instant doivent être établis.'};
  return {...state,assembled:true,feedback:'Phrase rétablie. La copie porte aussi deux identifiants : tu peux les masquer avant de transmettre.'};
 case 'redact':
  if(!state.assembled||!ATTENDEES.includes(action.attendee))return state;
  return {...state,armed:false,redacted:state.redacted.includes(action.attendee)?state.redacted.filter(id=>id!==action.attendee):[...state.redacted,action.attendee],feedback:'Le cache reste modifiable. Le recours exige les identités ; le canal public les montrera si tu les laisses lisibles.'};
 case 'arm':
  if(!state.assembled)return {...state,feedback:'Assemble d’abord la correction avec ses deux preuves.'};
  return {...state,armed:!state.armed,feedback:state.armed?'Dossier reposé. Tu peux encore le modifier.':'Dossier en main. Dépose-le dans une destination. Cette transmission termine la séquence.'};
 case 'deliver':{
  if(!state.assembled||!state.armed)return {...state,feedback:'Prends le dossier corrigé avant de le transmettre.'};
  const result:EvidenceResult={route:action.route,exposed:ATTENDEES.filter(id=>!state.redacted.includes(id)),protected:[...state.redacted],status:action.route==='broadcast'?'public':state.redacted.length?'incomplete':'review'};
  return {...state,result,armed:false,feedback:'Transmission effectuée. Cette copie ne peut plus être rappelée.'};
 }
 }
}
