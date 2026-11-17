/**
 * Checkpoint : trois voies, voie courtoisie, porte fermée [bible w10 §5.0, §7.1, §7.4 ; GDD 03 §3.4 ; plan 02b T7].
 * Pur : chaque nombre vient du bloc `street.checkpoint` [R-01.4]. `laneOutcome` ne touche ni le kit ni les bons ni les drapeaux :
 * T10 applique `kitAfter` d'après `KIT_EVENT_BY_ENTRY` [R-02b.23] et pose les entrées de l'option une seule fois [R-02b.52].
 * La porte fermée et le guide de Yusuf se lisent dans `flags.gateClosed` et `flags.guide`, écrits par T10 [R-02b.45].
 */
import type { CheckpointData } from '../../data/schema/street';
import type { ActRecord } from '../../shared/types/street';
import type { Palier } from '../../survival';
import { nominalLaneMinutes } from './schedule';
import type { StreetContext, StreetState } from './types';

/** Les voies du checkpoint. `refuse` (le demi-tour) est une option de choix, jamais une voie [R-02b.52]. */
export type Lane = 'comply' | 'buy' | 'bypass' | 'courtesy';

/** Ce que coûte et change une voie passée : entrées de relevé, mots forcés, minutes perdues, `comply` imposé après une patrouille. */
export interface LaneOutcome {
  readonly entries: readonly string[]; readonly words: number; readonly minutes: number; readonly forcedComply: boolean;
}

/** La file à un instant : `permille` entier de 0 à 1000 [bible w10 §5.0, l'écran du 02a anime la file]. */
export interface QueuePosition {
  readonly lane: Lane; readonly startMinute: number; readonly endMinute: number; readonly permille: number;
}

const BYPASS_KEY = 'checkpoint.bypass';
const INFORMANT_KEY = 'checkpoint.informant';

/** Palier courant : celui du dernier relevé, `courtesy` avant tout relevé (le J1) [bible w10 §7.1]. */
function palierOf(s: StreetState): Palier {
  return s.readings.at(-1)?.palier ?? 'courtesy';
}

/** Voies ouvertes ce jour-là : `courtesy` seulement au palier `courtesy` [bible w10 §7.1]. */
export function lanesOpen(s: StreetState, ctx: StreetContext): readonly Lane[] {
  void ctx;                        // la règle ne lit aucune donnée : le contexte est dans la signature pour la symétrie avec `laneOutcome`
  return palierOf(s) === 'courtesy' ? ['comply', 'buy', 'bypass', 'courtesy'] : ['comply', 'buy', 'bypass'];
}

type Kind = 'comply' | 'buy' | 'bypass' | 'courtesy' | 'refuse';

function kindOf(option: string | null): Kind {
  if (option === 'comply' || option === 'bypass' || option === 'courtesy' || option === 'refuse') return option;
  if (option === 'buy:bons' || option === 'buy:permission' || option === 'buy:component') return 'buy';
  throw new Error(`voie inconnue : ${String(option)}`);
}

/** Index tiré dans les poids cumulés : ⌊r × total⌋ placé dans les tranches. */
function drawIndex(r: number, weights: readonly number[]): number {
  const total = weights.reduce((a, w) => a + w, 0);
  const target = Math.floor(r * total);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]!;
    if (target < acc) return i;
  }
  return weights.length - 1;
}

type Draw = 'free' | 'nacelle' | 'patrol';

/** Le tirage du contournement, un par jour et par graine : même jour, même résultat. */
function bypassDraw(s: StreetState, ctx: StreetContext, day: number): Draw {
  const c: CheckpointData = ctx.street.checkpoint;
  const r = ctx.dice.roll('street', day, c.drawAnchorHour, BYPASS_KEY);
  if (s.flags.gateClosed === true) return (['free', 'nacelle', 'patrol'] as const)[drawIndex(r, c.closedGateWeights)]!;
  if (s.flags.guide === true) return (['free', 'patrol'] as const)[drawIndex(r, c.guideWeights)]!;
  return (['free', 'nacelle', 'patrol'] as const)[drawIndex(r, c.bypassWeights)]!;
}

function complyMinutes(s: StreetState, c: CheckpointData): number {
  return nominalLaneMinutes({ checkpoint: c }, 'comply', s.flags.gateClosed === true);   // même règle que la preuve (N7)
}

/** Minutes que prend la voie de l'acte, sans contrôle de stock : sert aussi à la file d'un acte déjà accepté. */
function laneMinutes(s: StreetState, ctx: StreetContext, a: ActRecord): number {
  const c = ctx.street.checkpoint;
  switch (kindOf(a.option)) {
    case 'comply': case 'courtesy': return complyMinutes(s, c);
    case 'buy': return c.minutes.buy;
    case 'bypass': return bypassDraw(s, ctx, a.day) === 'patrol' ? c.minutes.patrol : c.minutes.bypass;   // libre ou nacelle : 1 à 2 h de jeu, milieu de la fourchette [bible w10 §7.4 ; team-lead 2026-11-03]
    case 'refuse': return 0;
  }
}

/**
 * Effet d'une voie. `comply` et `courtesy` : `found7` si le composant est sur soi, un composant laissé au logement n'est pas fouillé
 * [bible w10 §7.4] ; la courtoisie est `comply` en file courte, mêmes mots, mêmes entrées, même durée [§7.4 l. 529].
 * `buy` : `bribe`, puis `informant` si le tirage est sous 1 sur 4 ; `buy:bons` exige le prix en bons, `buy:component` le composant sur soi.
 * `bypass` : tirage libre, nacelle ou patrouille ; la patrouille coûte `minutes.patrol` puis force `comply`. `refuse` : demi-tour,
 * entrée `absentRegistre`, aucune voie passée. Lève sur une option inconnue ou une condition non remplie.
 */
export function laneOutcome(s: StreetState, ctx: StreetContext, a: ActRecord): LaneOutcome {
  const c = ctx.street.checkpoint;
  switch (kindOf(a.option)) {
    case 'comply': case 'courtesy':
      return {
        entries: s.kit['component'] === 'kept' ? ['found7'] : [], words: c.forcedWords.comply, minutes: complyMinutes(s, c), forcedComply: false,
      };
    case 'buy': {
      const price = s.flags.gateClosed === true ? c.bonsPrice.closedGate : c.bonsPrice.normal;
      if (a.option === 'buy:bons' && s.bons < price) throw new Error(`buy:bons exige ${price} bons, ${s.bons} en stock`);
      if (a.option === 'buy:component' && s.kit['component'] !== 'kept') throw new Error('buy:component exige le composant sur soi');
      const [num, den] = c.informant;
      const tipped = ctx.dice.roll('street', a.day, c.drawAnchorHour, INFORMANT_KEY) * den < num;
      return { entries: tipped ? ['bribe', 'informant'] : ['bribe'], words: c.forcedWords.buy, minutes: c.minutes.buy, forcedComply: false };
    }
    case 'bypass': {
      const d = bypassDraw(s, ctx, a.day);
      if (d === 'patrol') return { entries: ['patrol'], words: 0, minutes: c.minutes.patrol, forcedComply: true };
      return { entries: d === 'nacelle' ? ['bypassNacelle'] : [], words: 0, minutes: c.minutes.bypass, forcedComply: false };
    }
    case 'refuse': return { entries: ['absentRegistre'], words: 0, minutes: 0, forcedComply: false };
  }
}

/**
 * Position dans la file à `minute`, d'après le dernier acte `lane` du jour : début = sa minute, fin = début + durée de la voie,
 * `permille` = ⌊(minute − début) × 1000 / durée⌋ borné à 0..1000. `null` sans acte `lane` ou pour le demi-tour. Une voie sans durée
 * (contournement libre) vaut 1000 dès son début. Le jeu en direct n'écrit rien : l'écran passe sa propre minute [bible w10 §5.0].
 */
export function queuePositionOf(s: StreetState, ctx: StreetContext, minute: number): QueuePosition | null {
  let a: ActRecord | undefined;
  for (const x of s.acts) if (x.kind === 'lane' && x.day === s.day) a = x;
  if (a === undefined) return null;
  const kind = kindOf(a.option);
  if (kind === 'refuse') return null;
  const duration = laneMinutes(s, ctx, a);
  const lane: Lane = kind;
  const permille = duration === 0
    ? (minute >= a.minute ? 1000 : 0)
    : Math.min(1000, Math.max(0, Math.floor(((minute - a.minute) * 1000) / duration)));
  return { lane, startMinute: a.minute, endMinute: a.minute + duration, permille };
}
