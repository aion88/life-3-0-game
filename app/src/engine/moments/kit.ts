/**
 * Kit : états des objets portés [bible w10 §6, §7.4, §7.7, §8.1 ; GDD 05 3.7 ; D138].
 * Pur et total : un événement inconnu rend le kit tel quel. Seuls `component`, `phone`
 * et `machineReceipt` bougent ; `letter` s'ajoute à `letter.keep`. Les états `seized`,
 * `declared` et `handedOver` sont terminaux. Un composant `left` ne se donne ni ne se
 * saisit tant que le joueur n'est pas rentré : seul `j2.keep` (choix pris au logement)
 * le remet à `kept`. Les drapeaux (`hidden`, `permitBookHalved`) sont écrits par T10
 * d'après `KIT_FLAG_BY_EVENT`.
 */
import type { KitItemState } from '../../shared/types/street';
import type { StreetFlag } from './types';

export type Kit = Readonly<Record<string, KitItemState>>;

/** Événements du composant : [état source → état cible], `*` = tout état non terminal. */
const COMPONENT: Readonly<Record<string, Readonly<Record<string, KitItemState>>>> = {
  'j1.component.leave': { kept: 'left' },
  'j2.hide': { kept: 'left' },
  'j2.keep': { left: 'kept' },
  'j2.declare': { kept: 'declared', left: 'declared' },
  'j2.leaveVisible': { kept: 'seized', left: 'seized' },
  'comply.found': { kept: 'seized' },
  'm5.exchange': { kept: 'handedOver' },
  'buy:component': { kept: 'handedOver' },
};

const PHONE: Readonly<Record<string, Readonly<Record<string, KitItemState>>>> = { 'j1.phone.leave': { kept: 'left' } };
const RECEIPT: Readonly<Record<string, Readonly<Record<string, KitItemState>>>> = { 'j2.showReceipt': { kept: 'declared' } };

/** Événements compris sans effet sur le kit (le choix « prendre », la demande de permis). */
const NO_OP: readonly string[] = ['j1.component.take', 'j1.phone.take', 'permit.request'];

/** Tout événement que `kitAfter` comprend (T10 valide contre cet ensemble). */
export const KIT_EVENTS: ReadonlySet<string> = new Set([
  ...Object.keys(COMPONENT), ...Object.keys(PHONE), ...Object.keys(RECEIPT), 'letter.keep', ...NO_OP,
]);

/** Événement de kit → drapeau de rue que T10 écrit [bible w10 §7.7]. */
export const KIT_FLAG_BY_EVENT: Readonly<Record<string, StreetFlag>> = { 'j2.hide': 'hidden', 'permit.request': 'permitBookHalved' };

/** Entrée de voie → événement de kit (`buy:component` est déjà l'id de l'option : appliqué tel quel). */
export const KIT_EVENT_BY_ENTRY: Readonly<Record<string, string>> = { found7: 'comply.found' };

function step(kit: Kit, id: string, table: Readonly<Record<string, Readonly<Record<string, KitItemState>>>>, event: string): Kit {
  const cur = kit[id]; const to = cur === undefined ? undefined : table[event]?.[cur];
  return to === undefined || to === cur ? kit : { ...kit, [id]: to };
}

/** État du kit après un événement. Ne mute pas son entrée. */
export function kitAfter(kit: Kit, event: string): Kit {
  if (event === 'letter.keep') return kit.letter === undefined ? { ...kit, letter: 'kept' } : kit;
  return step(step(step(kit, 'component', COMPONENT, event), 'phone', PHONE, event), 'machineReceipt', RECEIPT, event);
}
