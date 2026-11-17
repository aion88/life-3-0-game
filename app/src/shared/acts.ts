/**
 * Actes de la joueuse : kinds de base et validation structurelle [plan 01 T15 ; plan 00 `ActValidation`].
 * Pur : aucune dépendance, aucune exception levée.
 */
import type { ActRecord } from './types';
import { CLOSING_MINUTE, MORNING_MINUTE } from './types/street';

/**
 * Les trois `ActRecord.kind` de base [lead-programmer ; à confirmer par le plan 02b] :
 * `routine` (id = clé d'écho de `pushRoutine`), `milestone` (id = jalon de `applyMilestone`),
 * `survival` (id = source de `survivalEntry`). Le plan 02b y ajoute ses propres kinds.
 */
export const baseActKeys: ReadonlySet<string> = Object.freeze(new Set(['routine', 'milestone', 'survival']));

/** Première et dernière minute d'un acte, bornes comprises [plan 00, `GameClock`]. */
const MINUTE_MIN = MORNING_MINUTE;
const MINUTE_MAX = CLOSING_MINUTE;

/**
 * Vrai si l'acte est structurellement valide : jour entier de 1 à 7, minute entière de 420 à 1320,
 * `kind` connu (jamais une clé composée `kind.id`), `id` non vide, `option` nulle ou non vide.
 * Ne lève jamais : une valeur malformée rend faux.
 */
export function isValidAct(act: ActRecord, known: ReadonlySet<string>): boolean {
  const { day, minute, kind, id, option } = act;
  return (
    Number.isInteger(day) && day >= 1 && day <= 7 &&
    Number.isInteger(minute) && minute >= MINUTE_MIN && minute <= MINUTE_MAX &&
    typeof kind === 'string' && known.has(kind) &&
    typeof id === 'string' && id.length > 0 &&
    (option === null || (typeof option === 'string' && option.length > 0))
  );
}
