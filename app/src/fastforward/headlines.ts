/** Titres du journal : déclenchement sur la trajectoire et planning d'affichage [GDD 02 §3.7, §3.8 ; TRAJ §5]. Pur : le cœur ne tire rien. */
import { holds } from '../engine/conditions';
import type { EngineConfig } from '../data/schema/engine';
import type { Headline, HeadlineCond, HeadlineSet } from '../data/schema/headlines';
import type { Answers } from '../shared/types';
import type { HeadlineFire, RunResult } from '../shared/types/run';
import type { FastForwardRun } from './simulate';
import { STEPS_PER_YEAR, screenSecondsOfStep } from './timeline';

/** Titres affichés au plus par année civile du pas de déclenchement [GDD 02 §3.7]. */
export const MAX_HEADLINES_PER_YEAR = 2;
/** Espacement minimal de temps d'écran entre deux titres, et durée d'un titre, en secondes [GDD 02 §3.7]. */
export const HEADLINE_SPACING_SEC = 4.0;
/** Année du pas 0 [GDD 03 §3.1] : `yearOfStep(t)` = 2026 + ⌈t / 12⌉. */
export const BASE_YEAR = 2026;

/** Un titre affiché : le pas de déclenchement date, `shownAtSec` (×1) place à l'écran, `variant` indexe les tables [GDD 02 §3.7]. */
export interface HeadlineShown {
  readonly id: string;
  readonly firedAtStep: number;
  readonly year: number;
  readonly shownAtSec: number;
  /** Indice dans la table de variantes, `null` si le titre n'en a pas. */
  readonly variant: number | null;
}

/** Année civile d'un pas : 2026 + ⌈t / 12⌉ [GDD 03 §3.1]. */
export function yearOfStep(step: number): number {
  return BASE_YEAR + Math.ceil(step / STEPS_PER_YEAR);
}

const byPriorityThenId = (a: Headline, b: Headline): number => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Une condition au pas `t` ; `yearDelta` et `twoYears` lisent le pas t − 12 et exigent t ≥ 12. */
function condHolds(c: HeadlineCond, ff: FastForwardRun, answers: Answers, t: number): boolean {
  const steps = ff.trajectory.steps;
  const now = steps[t]!;
  switch (c.kind) {
    case 'state': return c.all.every((x) => holds(now, x));
    case 'yearDelta': {
      if (t < STEPS_PER_YEAR) return false;
      const d = now[c.var] - steps[t - STEPS_PER_YEAR]![c.var];
      return c.cmp === '>=' ? d >= c.delta : d <= c.delta;
    }
    case 'twoYears': {
      if (t < STEPS_PER_YEAR) return false;
      const before = steps[t - STEPS_PER_YEAR]!;
      return c.all.every((x) => holds(now, x) && holds(before, x));
    }
    case 'answer': return answers[c.question] === c.answer;
    case 'atStep': return t >= c.step;
    case 'rupture': return ff.extinction !== null && t === ff.extinction.ruptureStep;
  }
}

/**
 * Un passage sur la trajectoire : chaque titre se déclenche au premier pas (1..dernier) où toutes ses conditions
 * tiennent, une fois par partie. Un titre de portée `w07` ou `w12` n'existe que dans une partie qui finit là [GDD 02 §3.7].
 * Rend les déclenchements par pas, puis priorité, puis identifiant.
 */
export function fireHeadlines(ff: FastForwardRun, answers: Answers, set: HeadlineSet): readonly HeadlineFire[] {
  const pending = set.headlines
    .filter((h) => h.scope === 'all' || h.scope === ff.extinction?.world)
    .sort(byPriorityThenId);
  const out: HeadlineFire[] = [];
  const last = ff.trajectory.steps.length - 1;
  for (let t = 1; t <= last && pending.length > 0; t++) {
    for (let i = 0; i < pending.length; ) {
      const h = pending[i]!;
      if (h.when.every((c) => condHolds(c, ff, answers, t))) {
        out.push({ id: h.id, firedAtStep: t });
        pending.splice(i, 1);
      } else i++;
    }
  }
  return out;
}

/**
 * Titres affichés, dans l'ordre d'écran [GDD 02 §3.7, §3.8]. Au plus deux par année civile du pas de déclenchement :
 * un titre `alwaysShown` prend sa place d'abord et compte dans les deux, puis les plus petites priorités ; dans un même pas,
 * priorité puis identifiant. `shownAtSec` = temps d'écran du pas de déclenchement, ou 4,0 s après le titre précédent
 * s'il est encore affiché. `year` date par le pas de déclenchement, jamais par l'affichage.
 */
export function scheduleHeadlines(run: RunResult, set: HeadlineSet, engine: EngineConfig): readonly HeadlineShown[] {
  const meta = new Map(set.headlines.map((h) => [h.id, h]));
  const rows = run.headlines.map((f) => {
    const h = meta.get(f.id);
    if (h === undefined) throw new Error(`titre déclenché inconnu du jeu de données : ${f.id}`);
    return { fire: f, h, year: yearOfStep(f.firedAtStep) };
  });
  const rank = (a: (typeof rows)[number], b: (typeof rows)[number]): number =>
    Number(b.h.alwaysShown) - Number(a.h.alwaysShown) || byPriorityThenId(a.h, b.h);
  const kept = new Set<(typeof rows)[number]>();
  for (const year of new Set(rows.map((r) => r.year))) {
    rows.filter((r) => r.year === year).sort(rank).slice(0, MAX_HEADLINES_PER_YEAR).forEach((r) => kept.add(r));
  }
  const ordered = rows
    .filter((r) => kept.has(r))
    .sort((a, b) => a.fire.firedAtStep - b.fire.firedAtStep || byPriorityThenId(a.h, b.h));
  const inExtinction = run.outcome.kind === 'extinction';
  let previous = Number.NEGATIVE_INFINITY;
  return ordered.map((r) => {
    const shownAtSec = Math.max(screenSecondsOfStep(r.fire.firedAtStep, engine, inExtinction), previous + HEADLINE_SPACING_SEC);
    previous = shownAtSec;
    const size = r.h.variant === null ? null : set.variantSizes[r.h.variant];
    return {
      id: r.fire.id, firedAtStep: r.fire.firedAtStep, year: r.year, shownAtSec,
      variant: size === null ? null : run.seed % size,
    };
  });
}
