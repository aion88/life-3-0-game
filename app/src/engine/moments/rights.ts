/**
 * Droits : une ligne par moment, le butoir, le carnet [GDD 05 §3.3, §3.7 écran 10 ; bible w10 §4.5 ; plan 02b T9].
 * Pur : aucun JSON, aucune horloge système. Jours, moments et minutes des contacts sont la donnée `street.rights.contacts` ;
 * le texte des lignes vit sous `w10.right.<id>`. Aucune valeur de jauge ne naît d'un droit [R-L4].
 */
import type { MomentId, RightId } from '../../shared/types/street';
import type { RightContact } from '../../data/schema/street';
import { countWords } from './words';
import type { StreetContext, StreetFlag, StreetState } from './types';

/** Ordre des moments d'un jour : sert à reconnaître un contact daté dont le moment est passé [GDD 05 §3.1]. */
const MOMENT_ORDER: readonly MomentId[] = ['lever', 'rueAller', 'travail', 'rueMidi', 'soir', 'nuit'];

/** Les deux contacts conditionnels et le drapeau qui les arme : posé par T10 à l'acte qui les déclenche [R-02b.51]. */
const PENDING_FLAG: Readonly<Partial<Record<RightId, StreetFlag>>> = { leave: 'permitRequested', read: 'listRead' };

/** Début de la seconde moitié d'une ligne de droit, en FR et en EN [bible w10 §4.5]. */
const SECOND_HALF_MARKER = /\b(?:En|In) 2026\b/u;

/** Le drapeau qui arme le contact conditionnel de ce droit est levé. */
function isArmed(right: RightId, s: StreetState): boolean {
  const flag = PENDING_FLAG[right];
  return flag !== undefined && s.flags[flag] === true;
}

/** Le contact est échu : son jour est passé, ou il est aujourd'hui et son heure limite ou son moment daté est passé [R-L5]. */
function isDue(c: RightContact, s: StreetState): boolean {
  if (c.day < s.day) return true;
  if (c.day > s.day) return false;
  if (c.latestMinute !== null && s.clock.minute >= c.latestMinute) return true;
  return c.moment !== null && MOMENT_ORDER.indexOf(c.moment) < MOMENT_ORDER.indexOf(s.moment);
}

/**
 * Le droit à dire dans le moment courant, ou `null`. Un droit n'est dit qu'une fois, un moment ne porte qu'une ligne [R-L3] ;
 * priorité : le contact daté de ce (jour, moment), puis un contact conditionnel armé, puis un contact échu non rencontré [R-L5].
 */
export function rightLineFor(s: StreetState, ctx: StreetContext): RightId | null {
  if (s.rightLines[`${s.day}.${s.moment}`] !== undefined) return null;
  const open = ctx.street.rights.contacts.filter((c) => !s.rightsMet.includes(c.right));
  const dated = open.find((c) => c.day === s.day && c.moment === s.moment);
  if (dated !== undefined) return dated.right;
  const armed = open.find((c) => c.conditional && isArmed(c.right, s));
  if (armed !== undefined) return armed.right;
  return open.find((c) => isDue(c, s))?.right ?? null;
}

/** Le carnet : les droits rencontrés, dans l'ordre où ils l'ont été, et rien d'autre [R-L6]. */
export function carnet(s: Pick<StreetState, 'rightsMet'>): readonly RightId[] {
  return [...s.rightsMet];
}

/** Les deux moitiés d'une ligne : « Ici, … » puis « En 2026, c'est écrit : … ». Sans repère, tout est dans la première [R-L2]. */
export function lineHalves(text: string): { readonly first: string; readonly second: string } {
  const at = text.search(SECOND_HALF_MARKER);
  if (at < 0) return { first: text.trim(), second: '' };
  return { first: text.slice(0, at).trim(), second: text.slice(at).trim() };
}

/** Longueur de chaque moitié en mots, préfixes compris [R-L2]. */
export function lineLength(text: string): { readonly first: number; readonly second: number } {
  const h = lineHalves(text);
  return { first: countWords(h.first), second: countWords(h.second) };
}

/** Les trois lignes d'un droit dans la rue guidée : la phrase du monde, la source nommée, la citation officielle [spec §7]. */
export interface RightParts { readonly here: string; readonly source: string; readonly quote: string }

/**
 * `here` = première moitié de `<monde>.right.<id>` ; `rights.source.<id>` = texte, article ; `rights.quote.<id>` = citation officielle.
 * La seconde moitié de `<monde>.right.<id>` reste pour le bilan final et B-V6 : la rue ne la montre pas.
 */
export function rightParts(worldId: string, right: RightId, t: (k: string) => string): RightParts {
  return { here: lineHalves(t(`${worldId}.right.${right}`)).first, source: t(`rights.source.${right}`), quote: t(`rights.quote.${right}`) };
}
