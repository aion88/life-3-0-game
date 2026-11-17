/** Résultat de partie : fast-forward, issue, titres, gelé en profondeur [GDD 02 §3.9, §4.7 ; plan 00 RunResult]. */
import type { CoreData } from '../data/schema/core';
import type { HeadlineSet } from '../data/schema/headlines';
import { pushOf } from '../questionnaire';
import { runSeed } from '../shared/seed';
import type { RunResult } from '../shared/types/run';
import type { ArrivalWorldId } from '../shared/types';
import type { Answers } from '../shared/types';
import { arrivalOutcome } from './arrival';
import { fireHeadlines } from './headlines';
import { simulateFastForward } from './simulate';

/**
 * Copie en profondeur puis gèle : le résultat ne partage aucun objet avec ses entrées
 * (ni `engine.v0`, ni les réponses de l'appelant), donc geler ne mute jamais de données partagées.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  const copy: unknown = Array.isArray(value)
    ? value.map((x: unknown) => deepFreeze(x))
    : Object.fromEntries(Object.entries(value).map(([k, x]) => [k, deepFreeze(x)]));
  return Object.freeze(copy) as T;
}

/**
 * Joue le fast-forward des réponses et rend le `RunResult` gelé [GDD 02 §3.9, §4.7].
 * `softened` est porté tel quel : il ne change ni la trajectoire, ni l'issue, ni les titres.
 * Les réponses sont copiées avant le gel : l'objet de l'appelant n'est jamais gelé.
 */
export function runFastForward(core: CoreData, headlines: HeadlineSet, answers: Answers, softened: boolean, playableWorlds?: readonly ArrivalWorldId[]): RunResult {
  const mine = { ...answers } as Answers;
  const push = pushOf(core.questionnaire, mine);
  const ff = simulateFastForward(push, core.engine);
  const outcome = ff.extinction ? ({ kind: 'extinction', ...ff.extinction } as const) : arrivalOutcome(ff.atChoice, playableWorlds ? { ...core, build: { ...core.build, streetWorlds: playableWorlds } } : core);
  return deepFreeze({
    answers: mine,
    push,
    seed: runSeed(mine),
    trajectory: ff.trajectory,
    outcome,
    headlines: fireHeadlines(ff, mine, headlines),
    softened,
  });
}
