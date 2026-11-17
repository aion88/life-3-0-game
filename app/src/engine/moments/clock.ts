/**
 * Horloge entière de la rue et moment de la journée [GDD 05 §3.1 ; bible w10 §5.0].
 * Entiers seulement : `minutes = ⌊(carry + realMs × 60) / msPerHour⌋`, `carry` = le reste. Toute borne vient de `street`
 * (R-01.4), aucune valeur de jeu en dur. La marche n'avance rien ; la file, la scène et l'attente avancent au même taux.
 */
import type { StreetData } from '../../data/schema/street';
import type { DayIndex, GameClock, MomentId } from '../../shared/types/street';
import type { Activity, StreetState } from './types';

/** Horloge du jour et reste de millisecondes (en minutes × ms, toujours inférieur à `msPerHour`). */
export interface ClockState { readonly clock: GameClock; readonly carry: number }

/** Les trois signaux de l'écran ; la règle qui en tire une {@link Activity} est ici, dans le moteur [bible w10 §5.0]. */
export interface ActivityInput { readonly moving: boolean; readonly inQueue: boolean; readonly inDialogue: boolean }

/** Minutes de jeu par heure de jeu : 60, une unité de temps et non une donnée de jeu [GDD 05 F1]. */
const MINUTES_PER_HOUR = 60;

/** Début d'un jour : à l'heure d'ouverture de la rue, sans reste. */
export function startDay(day: DayIndex, street: StreetData): ClockState {
  return { clock: { day, minute: street.clock.dayStartMinute }, carry: 0 };
}

/** Fait courir l'horloge de `realMs` millisecondes réelles (tronquées à l'entier ; négatif ou non fini vaut 0). `walk` ne touche à rien, reste compris. Plafond : `dayEndMinute`. */
export function advance(c: ClockState, realMs: number, activity: Activity, street: StreetData): ClockState {
  const ms = Number.isFinite(realMs) ? Math.trunc(realMs) : 0;
  if (activity === 'walk' || ms <= 0) return c;
  const total = c.carry + ms * MINUTES_PER_HOUR;
  const gained = Math.floor(total / street.clock.msPerHour);
  const minute = c.clock.minute + gained;
  if (minute >= street.clock.dayEndMinute) return { clock: { day: c.clock.day, minute: street.clock.dayEndMinute }, carry: 0 };
  return { clock: { day: c.clock.day, minute }, carry: total - gained * street.clock.msPerHour };
}

/**
 * Ce que fait la joueuse : la file du checkpoint, sinon la marche, sinon un échange (réplique, lecture, panneau de choix
 * ouvert, c'est-à-dire `phase` `designated`), sinon l'attente immobile [bible w10 §5.0 ; GDD 05 §5].
 */
export function activityOf(s: StreetState, input: ActivityInput): Activity {
  if (input.inQueue) return 'queue';
  if (input.moving) return 'walk';
  if (input.inDialogue || s.phase === 'designated') return 'scene';
  return 'wait';
}

/** Le moment de l'état, dans l'ordre : nuit, soir, lever, travail, rue de mi-journée, rue aller [GDD 05 §3.1 ; R-L3]. */
export function momentOf(s: Pick<StreetState, 'clock' | 'location' | 'flags'>, street: StreetData): MomentId {
  const { minute } = s.clock;
  if (minute >= street.clock.dayEndMinute || s.flags.slept) return 'nuit';
  if (minute >= street.moments.eveningMinute) return 'soir';
  if (s.location === 'home' && !s.flags.left) return 'lever';
  if (s.location === 'registre') return 'travail';
  if (s.flags.workDone) return 'rueMidi';
  // Hors du logement dès midi : Registre fermé ce jour ou jamais atteint, les deux cas sont `!workDone` ici (la rue aller a pour limite midi).
  if (minute >= street.moments.noonMinute && s.location !== 'home') return 'rueMidi';
  return 'rueAller';
}
