/**
 * Lecteur de situations : machine d'état pure (aucun DOM, aucune horloge).
 * Un monde = quatre situations ; une situation = un choix binaire a|b avec sa contrepartie ; la fin dépend de deux situations nommées (`fin_cles`).
 */
import raw from './situations.json';
import introRaw from './worldIntro.json';

/** The two options of every situation. */
export type Choice = 'a' | 'b';

/** One option: what the player does, what it costs (shown before choosing), what is seen after. */
export interface SituationOption { choix: string; contrepartie: string; suite: string; /** Ce que ce choix interdit désormais au joueur (absent tant que l'auteur ne l'a pas écrit). */ interdit?: string }

/** The piece that carries the fact of a situation. */
export type PieceData =
  | { type: 'telephone'; expediteur: string; message: string }
  | { type: 'papier'; emetteur: string; texte: string }
  | { type: 'ticket'; lignes: string[] }
  | { type: 'carte'; titre: string; champs: [string, string][] };

/** One situation of a world. */
export interface Situation { id: string; lieu: string; piece: PieceData; situation: string; regle: string; a: SituationOption; b: SituationOption }

/** The ending for one combination of the two key situations. */
export interface EndingEntry { si: [Choice, Choice]; lignes: string[] }

/** One world's content. */
export interface SituationWorld { titre: string; regle: string; personnages: string[]; situations: Situation[]; fin_cles: [string, string]; fin: EndingEntry[] }

/** All the worlds, by id (`_lecture` is a note for readers, not a world). */
export const situationsData: Readonly<Record<string, SituationWorld>> = Object.fromEntries(Object.entries(raw as unknown as Record<string, unknown>).filter(([key]) => key !== '_lecture')) as Record<string, SituationWorld>;

const translations = import.meta.glob<{ default: Record<string, unknown> }>('./situations.en.json');
const french: Record<string, SituationWorld> = { ...situationsData };
/** Puts the worlds' text in the player's language. French stays when no translation file exists. */
export async function setSituationLang(lang: string): Promise<void> {
  const load = lang === 'en' ? translations['./situations.en.json'] : undefined;
  const table = load ? Object.fromEntries(Object.entries((await load()).default).filter(([key]) => key !== '_lecture')) as Record<string, SituationWorld> : french;
  Object.assign(situationsData as Record<string, SituationWorld>, table);
}

/** A world's arrival card, shown before the first situation: how this future works, who decides, what it gives, what it takes, and the question it leaves open. */
export interface WorldIntro { monde: string; decide: string; gagne: string; cout: string; question: string }

/** The arrival card of `world` in `lang` (French when the language has no card); `null` for a world without one. */
export function worldIntro(world: string, lang: string): WorldIntro | null {
  const tables = introRaw as unknown as Record<string, Record<string, WorldIntro> | string>;
  const table = tables[lang === 'en' ? 'en' : 'fr'];
  return typeof table === 'object' ? table[world] ?? null : null;
}

/** The world ids, in catalogue order. */
export const worldIds = (): string[] => Object.keys(situationsData);

/** Where the player is: which situation (0 to 3), what is on screen, and every pick so far. A pick leads straight to the next situation (or the end); there is no intermediate screen. */
export interface PlayState { readonly world: string; readonly step: 0 | 1 | 2 | 3; readonly phase: 'choose' | 'end'; readonly picks: readonly Choice[] }

/** A new game in `world`. */
export const start = (world: string): PlayState => ({ world, step: 0, phase: 'choose', picks: [] });

/** Records the pick and moves on at once: next situation, or the end after the fourth. At the end nothing changes (the same state object comes back). */
export function choose(state: PlayState, pick: Choice): PlayState {
  if (state.phase !== 'choose') return state;
  const picks = [...state.picks, pick];
  return state.step === 3 ? { ...state, phase: 'end', picks } : { ...state, step: (state.step + 1) as 1 | 2 | 3, picks };
}

/** What the picks made so far forbid, in the order of the picks. An option without `interdit` adds nothing. */
export function forbidden(world: SituationWorld, picks: readonly Choice[]): string[] {
  const out: string[] = [];
  picks.forEach((pick, index) => { const text = world.situations[index]?.[pick]?.interdit; if (typeof text === 'string' && text !== '') out.push(text); });
  return out;
}

/** The interdits of the game in progress. */
export function interdits(state: PlayState): string[] { const world = situationsData[state.world]; return world ? forbidden(world, state.picks) : []; }

/** The consequence (`suite`) of the latest pick; `null` before the first pick. */
export function previousSuite(state: PlayState): string | null {
  const world = situationsData[state.world]; const last = state.picks.length - 1; if (!world || last < 0) return null;
  return world.situations[last]?.[state.picks[last]!]?.suite ?? null;
}

/** True when the world's data carries at least one `interdit` (the interface shows the banner only then). */
export const hasInterdits = (world: SituationWorld): boolean => world.situations.some(item => (['a', 'b'] as const).some(key => typeof item[key].interdit === 'string' && item[key].interdit !== ''));

/** The three ending lines once the game has ended, from the picks of the two key situations; `null` before the end. */
export function ending(state: PlayState): readonly string[] | null {
  if (state.phase !== 'end') return null;
  const world = situationsData[state.world]; if (!world) return null;
  const [first, second] = world.fin_cles.map(key => world.situations.findIndex(s => s.id === key)) as [number, number];
  const entry = world.fin.find(item => item.si[0] === state.picks[first] && item.si[1] === state.picks[second]);
  return entry?.lignes ?? null;
}
