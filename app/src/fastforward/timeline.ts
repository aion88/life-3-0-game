/** Temps d'écran du fast-forward : seule source de la formule [GDD 02 §3.8 ; F16]. Frontière d'affichage : flottants permis. */
import type { EngineConfig } from '../data/schema/engine';
import { STEPS_PER_YEAR } from '../engine/projection';
import type { RunResult } from '../shared/types/run';


/** Pas par année civile : une seule définition, côté moteur [GDD 03 §3.1 ; D129]. */
export { STEPS_PER_YEAR };
/** Secondes d'écran par année, voie principale, pas 1 à `choiceStep` : 14 s, soit 56 s pour 48 pas [GDD 02 §3.8, table]. */
export const MAIN_SECONDS_PER_YEAR = 14;
/** Secondes d'écran par année en extinction après le pas `choiceStep` : 7 s, soit 0,583 s par pas [GDD 02 §3.8, table]. */
export const EXTINCTION_SECONDS_PER_YEAR = 7;

/** Cadence d'écran : secondes par année sur la voie principale et, en extinction, après `choiceStep`. */
export interface Pace { readonly mainSecPerYear: number; readonly extinctionSecPerYear: number }

/** Cadence du GDD 02 §3.8 (14 s puis 7 s par année) : défaut des formules pures. */
export const GDD_PACE: Pace = { mainSecPerYear: MAIN_SECONDS_PER_YEAR, extinctionSecPerYear: EXTINCTION_SECONDS_PER_YEAR };

/**
 * Cadence de l'écran tirée d'une durée totale jusqu'au pas `choiceStep` (le jeton `timing.fastForward.toChoiceSec`, Cynthia 2026-11-03).
 * La suite d'une extinction garde le rapport du GDD 02 §3.8 : une année y dure la moitié d'une année de la voie principale (7/14).
 */
export function paceOf(toChoiceSec: number, engine: EngineConfig): Pace {
  const main = (toChoiceSec * STEPS_PER_YEAR) / engine.steps.choiceStep;
  return { mainSecPerYear: main, extinctionSecPerYear: (main * EXTINCTION_SECONDS_PER_YEAR) / MAIN_SECONDS_PER_YEAR };
}

/**
 * Temps d'écran du pas `step`, à ×1, en secondes [GDD 02 §3.8, F16] :
 * `step × M/12` jusqu'au pas `choiceStep` ; puis, en extinction seulement et sans maintien d'arrivée,
 * `choiceStep × M/12 + (step − choiceStep) × X/12`, avec M et X la cadence (`GDD_PACE` : 14 et 7).
 * Hors extinction, un pas au-delà de `choiceStep` n'existe pas : levée.
 */
export function screenSecondsOfStep(step: number, engine: EngineConfig, inExtinction: boolean, pace: Pace = GDD_PACE): number {
  const { choiceStep } = engine.steps;
  if (!Number.isInteger(step) || step < 0) throw new RangeError(`pas invalide : ${step}`);
  if (step <= choiceStep) return (step * pace.mainSecPerYear) / STEPS_PER_YEAR;
  if (!inExtinction) throw new RangeError(`pas ${step} au-delà du pas ${choiceStep} hors extinction`);
  const mainEnd = (choiceStep * pace.mainSecPerYear) / STEPS_PER_YEAR;
  return mainEnd + ((step - choiceStep) * pace.extinctionSecPerYear) / STEPS_PER_YEAR;
}

/** Maintien de l'écran d'arrivée, en secondes, ajouté au temps des 48 pas [GDD 02 F16, §3.8, §4.6]. */
export const ARRIVAL_HOLD_SECONDS = 5.0;
/** Maintien de l'écran d'extinction, en secondes, ajouté au temps jusqu'à la rupture [GDD 02 F16, §3.8, §4.6]. */
export const EXTINCTION_HOLD_SECONDS = 15.0;

/**
 * Durée d'une extinction à ×1, en auto, écran des causes exclu [GDD 02 F16, §3.8, §4.6] :
 * `(min(r, 48) × 14 + max(r − 48, 0) × 7)/12 + 15,0`, avec r le pas de rupture.
 */
export function extinctionSeconds(ruptureStep: number, engine: EngineConfig, pace: Pace = GDD_PACE): number {
  return screenSecondsOfStep(ruptureStep, engine, true, pace) + EXTINCTION_HOLD_SECONDS;
}

/**
 * Durée d'une partie à ×1, en auto, écran des causes exclu [GDD 02 F16, §3.8, §4.6] :
 * arrivée = temps des `choiceStep` pas + 5,0 s (56,0 + 5,0 = 61,0) ; extinction = `extinctionSeconds`.
 */
export function timelineSeconds(run: RunResult, engine: EngineConfig, pace: Pace = GDD_PACE): number {
  const { outcome } = run;
  if (outcome.kind === 'extinction') return extinctionSeconds(outcome.ruptureStep, engine, pace);
  return screenSecondsOfStep(engine.steps.choiceStep, engine, false, pace) + ARRIVAL_HOLD_SECONDS;
}
