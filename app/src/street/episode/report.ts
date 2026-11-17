/** Goals and outcomes depend on actual family choices, never on an inferred moral score. */
import { choose, optionsFor, story, type EpisodeState, type Option } from './story';
const opposed = (s: EpisodeState): boolean => s.memories.includes('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.');
const betrayed = (s: EpisodeState): boolean => s.memories.includes('Tu as signalé Marlène.');
const voice = (s: EpisodeState): boolean => s.memories.includes('Tu as conservé la voix de ton frère.');
export function activeObjective(s: EpisodeState): string {
  if (s.scene === 'end') return opposed(s) ? betrayed(s) ? 'Départ suspendu · ta mère dénoncée' : 'Départ suspendu · témoigner demain' : 'Départ non suspendu · demain matin';
  if (['arrival','plant','hub','clinic','stall'].includes(s.scene)) return 'Rejoindre ta mère pour comprendre le transfert de ton frère';
  if (['dinner','confession','departure','request'].includes(s.scene)) return 'Écouter ta mère et décider d’aller contester le transfert';
  if (['checkpoint','appeal'].includes(s.scene)) return 'Accéder au dossier sans dénoncer ta mère';
  if (['message','evidence'].includes(s.scene)) return 'Suspendre le transfert de ton frère · signer a un coût';
  return opposed(s) ? 'Dire à ta mère ce que tu as obtenu et payé' : 'Dire à ta mère que le départ reste prévu';
}
export function objectives(s: EpisodeState): { label: string; status: string }[] {
  const dinner = s.history.includes('dinner');
  const message = s.history.includes('message');
  const returned = s.scene === 'end';
  return [
    { label: 'Retrouver ta mère à la table familiale', status: dinner ? 'Fait' : 'En cours' },
    { label: 'Accéder au dossier de ton frère au Registre', status: message ? 'Fait' : returned || s.scene === 'distance' || s.scene === 'return' ? 'Non obtenu' : dinner ? 'En cours · accès contrôlé' : 'À venir' },
    { label: 'Suspendre le transfert de ton frère sans dénoncer ta mère', status: opposed(s) ? betrayed(s) ? 'Non atteint · mère dénoncée' : 'Réussi' : returned ? 'Non atteint' : 'En cours' },
    { label: 'Facultatif · rapporter sa voix à ta mère', status: returned ? voice(s) && s.memories.includes('Tu lui as dit la vérité.') ? 'Réussi' : 'Non obtenu' : 'À venir' },
  ];
}
export function report(s: EpisodeState): { title: string; text: string }[] {
  const told = s.memories.includes('Tu lui as dit la vérité.');
  return [
    { title: 'Ton objectif', text: opposed(s) ? betrayed(s) ? 'Le transfert de ton frère est suspendu 48 heures, mais tu as dénoncé ta mère pour accéder au dossier. Tu as gagné du temps pour lui en exposant un autre membre de ta famille.' : 'Tu as suspendu le transfert de ton frère pendant 48 heures sans dénoncer ta mère. Ce délai permet de contester ; il ne garantit pas sa libération. Tu dois témoigner demain.' : 'Tu n’as pas suspendu le transfert : le départ de ton frère reste prévu demain matin. Écouter son message ou rester avec ta mère ne remplace pas une opposition signée.' },
    { title: 'L’accès au Registre', text: s.history.includes('message') ? betrayed(s) ? 'Ton signalement a ouvert le portique. Ta mère en a reçu copie : cet accès lui a coûté sa confiance et l’a exposée au contrôle.' : 'Ton recours a permis à une agente d’ouvrir le portique. Cette décision humaine a rendu la contestation possible ; elle ne suffisait pas à bloquer le départ.' : 'Tu n’as pas atteint le dossier. Aucun recours contre le transfert n’a été signé par toi.' },
    { title: 'Ce que ta mère reçoit', text: voice(s) ? told ? 'Tu lui as transmis la voix de ton frère et dit la vérité sur tes choix. Elle peut réécouter son rire ; cet enregistrement seul ne suspend pas le transfert.' : 'Tu conserves sa voix, mais tu n’as pas choisi de la partager avec ta mère. Elle attend encore une réponse.' : told ? 'Tu lui as dit la vérité, sans lui rapporter l’enregistrement. Vous savez ce qui a été fait et ce qui reste à affronter.' : 'Tu n’as ni rapporté sa voix ni choisi de raconter tes décisions. Ta mère reste avec ses questions.' },
    { title: 'Le prix du recours', text: opposed(s) ? 'Ta signature suspend le départ pendant 48 heures. Ton autorisation de sortie est retenue jusqu’à ton témoignage : tu as engagé ta liberté de mouvement pour donner une chance à ton frère.' : s.history.includes('evidence') ? 'Tu as refusé de signer après avoir lu le coût. Ton autorisation de sortie n’est pas retenue au titre de ce témoignage ; le transfert reste prévu.' : 'Le dossier offrait une opposition par un témoin identifié, contre la retenue de son autorisation de sortie. Tu n’as pas ouvert cette possibilité.' },
    { title: 'Le regard du système', text: s.exposure >= 3 ? 'Le cumul de tes gestes déclenche une vérification de ton prochain déplacement. Tes services essentiels restent assurés ; le confort matériel et la liberté de contester ne vont pas forcément ensemble.' : 'Tes gestes n’ont pas déclenché de vérification supplémentaire. Ce calme administratif ne signifie pas que ta famille est protégée.' },
    { title: 'Ce que ce futur met en jeu', text: 'Le formulaire transforme l’entraide en risque et propose la dénonciation comme raccourci. Les recours humains restent possibles, mais coûteux. Cette famille appartient à une fiction : ce récit ne décrit pas ta famille réelle et ne prédit pas son avenir.' },
  ];
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
/** What a gesture costs (exposure up, trust down) and what it brings (trust up, exposure down), in words. */
export function priceParts(option: Pick<Option, 'trust' | 'exposure'>): { cost: string[]; gain: string[] } {
  const cost: string[] = []; const gain: string[] = [];
  const exposure = option.exposure ?? 0; const trust = option.trust ?? 0;
  if (exposure) (exposure > 0 ? cost : gain).push(`exposition ${signed(exposure)}`);
  if (trust) (trust < 0 ? cost : gain).push(`confiance ${signed(trust)}`);
  return { cost, gain };
}
/** Line shown BEFORE the gesture: "Prix : ..." for what it costs, "Gain : ..." for what it brings, "Prix : 0" when nothing moves. */
export function priceOf(option: Pick<Option, 'trust' | 'exposure'>): string {
  const { cost, gain } = priceParts(option);
  const parts: string[] = [];
  if (cost.length || !gain.length) parts.push(`Prix : ${cost.length ? cost.join(' · ') : '0'}`);
  if (gain.length) parts.push(`Gain : ${gain.join(' · ')}`);
  return parts.join(' · ');
}
/** A single gesture applied without a press: the scene it narrated, and the option it took. */
export interface AutoStep { scene: string; option: string; before: EpisodeState }
/**
 * Scenes that DISPLAY one option only (stall, confession, departure, and the hub once one errand is left)
 * are told, not asked: the option is applied by the same reducer, so saved picks replay unchanged.
 */
export function autoSteps(from: EpisodeState): { state: EpisodeState; steps: AutoStep[] } {
  let state = from; const steps: AutoStep[] = [];
  for (let guard = 0; guard < 12 && state.scene !== 'end'; guard++) {
    const options = optionsFor(state);
    if (options.length !== 1) break;
    const only = options[0]!; const next = choose(state, only.id);
    if (next === state) break;
    steps.push({ scene: state.scene, option: only.id, before: state }); state = next;
  }
  return { state, steps };
}
/** What the effect line says after a gesture: the resource moves, in words. */
export function changesBetween(before: EpisodeState, after: EpisodeState): string[] {
  const out: string[] = [];
  if (after.trust !== before.trust) out.push(`confiance ${signed(after.trust - before.trust)}`);
  if (after.exposure !== before.exposure) out.push(`exposition ${signed(after.exposure - before.exposure)}`);
  return out;
}
/** The ending balance, readable at once: outcome, what was obtained, what it cost, the resources start to end. */
export function balance(s: EpisodeState): { outcome: string; gained: string; cost: string; resource: string } {
  const has = (m: string): boolean => s.memories.includes(m);
  const told = has('Tu lui as dit la vérité.');
  const gained: string[] = [];
  if (opposed(s)) gained.push('transfert suspendu 48 heures');
  else if (s.history.includes('message')) gained.push('accès au dossier de ton frère');
  if (voice(s)) gained.push(told ? 'sa voix rapportée à Marlène' : 'sa voix conservée');
  if (told && !voice(s)) gained.push('Marlène sait la vérité');
  const cost: string[] = [];
  if (opposed(s)) cost.push('sortie personnelle retenue jusqu’à ton témoignage');
  if (betrayed(s)) cost.push('Marlène dénoncée');
  else if (s.trust < 0) cost.push('lien avec Marlène fragilisé');
  if (!opposed(s) && s.exposure >= 3) cost.push('prochain déplacement contrôlé');
  return {
    outcome: activeObjective(s),
    gained: gained.length ? gained.join(' · ') : 'rien pour ton frère',
    cost: cost.length ? cost.join(' · ') : 'rien',
    resource: `confiance 0 → ${s.trust} · exposition 0 → ${s.exposure}`,
  };
}
/** Short slug of the ending variant, exposed as `data-ending`. */
export function endingKey(s: EpisodeState): string {
  return `${opposed(s) ? 'suspendu' : 'maintenu'}${betrayed(s) ? '-denonce' : ''}${voice(s) ? '-voix' : ''}`;
}
/** Every scene's options, for the pricing invariant (each option has a non-empty price). */
export const allOptions = (): Option[] => Object.values(story).flatMap(scene => scene.options);

/** Measures read from the phone layout (px, all relative to the host). */
export interface FitInput { hostWidth: number; hostHeight: number; top: number; lowerTop: number; visibleBottom: number; observing: boolean }
/**
 * Picture window on a phone: it runs from the objective to the lower block (or, when observing the scene, to the bottom
 * of the screen). The frame is exactly as tall as that window; `shift` slides it up so the figures (54 % to 84 % of the
 * frame height) stay inside the part that remains visible.
 */
export function fitFrame(m: FitInput): { windowHeight: number; shift: number } {
  const windowHeight = Math.max(60, (m.observing ? m.hostHeight : m.lowerTop) - m.top);
  if (m.observing) return { windowHeight, shift: 0 };
  const visible = Math.max(60, m.visibleBottom - m.top);
  const frameHeight = Math.max(m.hostWidth, windowHeight * 16 / 9) * 9 / 16;
  const shift = Math.floor(Math.min(Math.max(0, frameHeight * .84 - visible * .94), Math.max(0, frameHeight - windowHeight)));
  return { windowHeight, shift };
}
