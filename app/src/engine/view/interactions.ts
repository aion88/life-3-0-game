/**
 * Interaction dans la rue : un clic, la position de la joueuse et l'état du moteur donnent une résolution [plan 02a T9].
 * Pur : ni DOM, ni Three.js, ni horloge, ni hasard. N'écrit jamais l'état : seul le pilote écrit, par `reduceAct`.
 * Aucun mot de la rue ici : les textes sont des clés de chaînes que l'i18n rend.
 */
import type { Palier } from '../../survival/integrity';
import { DOOR_NOON, pendingChoices } from '../moments/choices';
import { presentAt } from '../moments/npcs';
import type { StreetContext, StreetState, Vec2 } from '../moments/types';
import type { SceneData } from './sceneSchema';

/** Ce que la scène donne à l'interaction : portée, position de chaque objet, zones d'apparition des choix. */
export type InteractData = Pick<SceneData, 'interact' | 'interactions' | 'triggers'>;

/** Ce que le clic a touché. Les personnes (`passerby`) viennent de la vue de foule, les objets du quartier sont des `clickable`. */
export type HitInfo =
  | { readonly kind: 'clickable'; readonly id: string; readonly at: Vec2 }
  | { readonly kind: 'passerby'; readonly id: string; readonly at: Vec2 }
  | { readonly kind: 'ground'; readonly at: Vec2 }
  | { readonly kind: 'none' };

/**
 * Ce que le clic produit. `card` : le texte d'une carte (seule surface où un nombre se lit avec le bracelet). `response` : la clé de chaîne
 * du monde, gratuite. `act` : un acte sans jour ni minute que le pilote pose. `approach` : marcher d'abord, rejouer à l'arrivée.
 */
export type Resolution =
  | { readonly type: 'card'; readonly cardId: string }
  | { readonly type: 'response'; readonly key: string }
  | { readonly type: 'act'; readonly kind: string; readonly id: string; readonly option: string | null }
  | { readonly type: 'approach'; readonly to: Vec2 }
  | { readonly type: 'none' };

/** Les sept passants à carte [plan 02a T7 : Nadia, Joaquim, Léonie, Théodore, Dario, Amara, Émile] : un passant qui en est un rend sa carte. */
export const CARD_IDS: ReadonlySet<string> = new Set(['nadia', 'joaquim', 'leonie', 'theodore', 'dario', 'amara', 'emile']);

const CARD_KEY_PREFIX = 'w10.card.';
const NPC_CLICKABLE = 'npc';
const PASSERBY_CLICKABLE = 'passerby';

/** Distance en mètres entre la joueuse et un point de la rue. */
export function rangeTo(player: Vec2, at: Vec2): number {
  const dx = at.x - player.x, dz = at.z - player.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Palier courant : celui du dernier relevé, `courtesy` avant le premier [même lecture que `checkpoint.ts`]. */
function palierOf(s: StreetState): Palier {
  return s.readings.at(-1)?.palier ?? 'courtesy';
}

/** Réponse d'un cliquable : la carte quand sa clé en est une (étal de Nadia, banc de Théodore), sinon la clé de réponse du monde. */
function answer(key: string): Resolution {
  return key.startsWith(CARD_KEY_PREFIX) ? { type: 'card', cardId: key.slice(CARD_KEY_PREFIX.length) } : { type: 'response', key };
}

/** Une fiche dont le porteur est aussi un PNJ nommé n'existe que s'il est là ; les autres cartes (passants) ne dépendent d'aucun horaire. */
function cardPresent(id: string, st: StreetState, ctx: StreetContext): boolean {
  return !ctx.street.npcs.some((n) => n.id === id) || presentAt(id, st.day, st.clock.minute, palierOf(st), ctx.street);
}

function responseOf(id: string, st: StreetState, ctx: StreetContext): Resolution {
  const c = ctx.street.clickables.find((x) => x.id === id);
  if (c === undefined) return { type: 'none' };
  const r = answer(c.responseKey);
  return r.type === 'card' && !cardPresent(r.cardId, st, ctx) ? { type: 'none' } : r;      // l'étal de Nadia fermé ne rend pas sa fiche
}

/** Une personne touchée : sa carte si elle en a une, sinon le PNJ nommé présent, sinon un passant quelconque [R-02a.11]. */
function resolvePerson(id: string, st: StreetState, ctx: StreetContext): Resolution {
  if (CARD_IDS.has(id) && cardPresent(id, st, ctx)) return { type: 'card', cardId: id };
  const named = ctx.street.npcs.some((n) => n.id === id) && presentAt(id, st.day, st.clock.minute, palierOf(st), ctx.street);
  return responseOf(named ? NPC_CLICKABLE : PASSERBY_CLICKABLE, st, ctx);
}

/**
 * Un clic. Le sol marche. Une cible hors de `interactRangeM` fait marcher d'abord (`approach`, rien ne change à distance) ; à portée,
 * un objet rend sa réponse ou sa carte, une personne sa carte, la réponse du PNJ ou celle d'un passant.
 */
export function resolveClick(hit: HitInfo, player: Vec2, st: StreetState, ctx: StreetContext, d: InteractData): Resolution {
  if (hit.kind === 'none') return { type: 'none' };
  if (hit.kind === 'ground') return { type: 'approach', to: hit.at };
  if (hit.kind === 'clickable' && !ctx.street.clickables.some((c) => c.id === hit.id)) return { type: 'none' };
  if (rangeTo(player, hit.at) > d.interact.interactRangeM.v) return { type: 'approach', to: hit.at };
  if (hit.kind === 'passerby') {
    return hit.id === PASSERBY_CLICKABLE || hit.id === NPC_CLICKABLE ? responseOf(hit.id, st, ctx) : resolvePerson(hit.id, st, ctx);
  }
  return responseOf(hit.id, st, ctx);
}

/** Clé de fermeture d'un choix : `${jour}.${id}` dans `confirmed` [même clé que `choices.ts`, privée là-bas]. */
const closedFor = (s: StreetState, id: string): boolean => `${s.day}.${id}` in s.confirmed;

/**
 * Les choix à présenter ici, deux sources distinctes [R-02a.11, R-02a.16]. (a) `pendingChoices` : les choix qui retiennent et les jalons dus,
 * présentés partout, sans zone. (b) Les choix de `street.choices` ouverts ce jour, filtrés par leur zone (dans le rayon) ou, sans zone, tout le jour.
 * Ordre : (a) dans l'ordre du moteur, puis (b) dans l'ordre des données, sans doublon. Le moteur reste juge au `designate`. Jamais un minuteur.
 * `view` donné : un choix de lieu ne s'ouvre que si son lieu est EN VUE (`inView`), il ne surgit pas dans le dos [retour de playtest 2026-11-03] ;
 * un choix déjà ouvert (`view.keep`) reste ouvert tant que la joueuse est dans la zone, même si elle se retourne (aucun clignotement).
 */
export function choicesToPresent(st: StreetState, player: Vec2, ctx: StreetContext, d: InteractData, view?: PresentView): readonly string[] {
  const out = [...pendingChoices(st, ctx)];
  for (const c of ctx.street.choices) {
    if (c.id === DOOR_NOON || out.includes(c.id) || !c.days.includes(st.day) || closedFor(st, c.id)) continue;   // door.noon : `pendingChoices` en est la seule source [R-02a.21]
    const t = d.triggers[c.id];
    if (t === undefined) { out.push(c.id); continue; }
    if (rangeTo(player, t.at.v) > t.radiusM.v) continue;
    if (view === undefined || view.keep.includes(c.id) || inView(player, view.facing, t.at.v, d)) out.push(c.id);
  }
  return out;
}

/** Ce que la vue sait de la joueuse pour ouvrir un choix de lieu : la direction de son regard (vecteur, non nul) et les choix déjà ouverts. */
export interface PresentView { readonly facing: Vec2; readonly keep: readonly string[] }

/**
 * Le lieu est-il en vue ? Oui à portée de main (`interactRangeM`), sinon si le cosinus entre le regard et la direction du lieu atteint
 * `viewMinCos` (0 : le lieu n'est pas dans le dos). Pur, sans trigonométrie ni rendu : c'est la direction du regard, pas un test d'occlusion.
 */
export function inView(player: Vec2, facing: Vec2, at: Vec2, d: Pick<InteractData, 'interact'>): boolean {
  const dist = rangeTo(player, at);
  if (dist <= d.interact.interactRangeM.v) return true;
  const len = rangeTo({ x: 0, z: 0 }, facing);
  if (len === 0) return true;
  return facing.x * (at.x - player.x) + facing.z * (at.z - player.z) >= d.interact.viewMinCos.v * dist * len - 1e-9;
}
