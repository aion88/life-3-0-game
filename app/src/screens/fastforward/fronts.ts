/**
 * Unes du fast-forward : une par année civile, de 2027 à l'année du dernier pas [Cynthia 2026-11-03 : « des unes de news fictives qui résument tout ce qui s'est passé »].
 * Pur : n'invente rien hors de la partie. Une une porte les titres que `scheduleHeadlines` a gardés pour cette année (au plus deux, GDD 02 §3.7)
 * et les mouvements de la trajectoire sur l'année (`ff.une.<axe>.<up|down>`, textes PROVISIONAL du writer) : voir `planFronts`.
 */
import type { HeadlineVariant } from '../../data/schema/headlines';
import { yearOfStep } from '../../fastforward';
import { STEPS_PER_YEAR } from '../../fastforward/timeline';
import type { RunResult } from '../../shared/types/run';
import { WORLD_VARS, type WorldVar } from '../../shared/types/world';

/** Une ligne d'une une : clé de texte, et la table de variantes qui remplit sa marque. */
export interface FrontLine {
  readonly id: string;
  readonly key: string;
  readonly variant: number | null;
  readonly variantKind: HeadlineVariant | null;
}

/** Une une : son année, l'instant d'écran de son premier pas, ses lignes (manchette d'abord), et d'où elles viennent. */
export interface PlannedFront {
  readonly year: number;
  readonly shownAtSec: number;
  readonly source: 'headlines' | 'movement';
  readonly lines: readonly FrontLine[];
}

/** Titre retenu pour l'écran, daté par son pas de déclenchement. */
export interface FrontHeadline extends FrontLine { readonly year: number }

/** Premier pas de l'année `year` : 12 (year − 2027) + 1. */
export const firstStepOfYear = (year: number): number => STEPS_PER_YEAR * (year - yearOfStep(1)) + 1;

/** Un mouvement de l'année : axe, sens, ampleur. */
interface Move { readonly axis: WorldVar; readonly dir: 'up' | 'down'; readonly size: number }

const moveLine = (m: Move): FrontLine => ({ id: `une.${m.axis}.${m.dir}`, key: `ff.une.${m.axis}.${m.dir}`, variant: null, variantKind: null });
const STILL: FrontLine = { id: 'une.still', key: 'ff.une.still', variant: null, variantKind: null };

/** Sous-titres d'une une, au plus [Cynthia 2026-11-03, via team-lead : « deux ou trois sous-titres »]. */
export const MAX_SUBS = 3;

/** Axes qui ont bougé sur l'année (pas du premier au dernier de l'année, borné au dernier pas), du plus fort au plus faible, ordre de `WORLD_VARS` à égalité. */
function movesOf(run: RunResult, year: number, lastStep: number): Move[] {
  const steps = run.trajectory.steps;
  const from = steps[firstStepOfYear(year) - 1]!;
  const to = steps[Math.min(firstStepOfYear(year) + STEPS_PER_YEAR - 1, lastStep)]!;
  return WORLD_VARS.map((axis) => ({ axis, d: to[axis] - from[axis] }))
    .filter((x) => x.d !== 0)
    .map(({ axis, d }): Move => ({ axis, dir: d > 0 ? 'up' : 'down', size: Math.abs(d) }))
    .sort((a, b) => b.size - a.size);   // tri stable : WORLD_VARS départage
}

/**
 * Unes de 2027 à l'année de `lastStep`, dans l'ordre. `headlines` sont les titres que l'écran montre (masque adouci déjà appliqué),
 * dans l'ordre d'écran ; `stepSec` le temps d'écran de chaque pas.
 * Manchette : le premier titre de l'année ; sans titre, le plus fort mouvement dont l'axe n'a pas encore fait de manchette (à défaut le plus fort),
 * `ff.une.still` seulement si rien n'a bougé. Sous-titres : le second titre de l'année, puis les autres mouvements de l'année, ceux pas encore
 * montrés d'abord, jusqu'à `MAX_SUBS`. Rien n'est écrit qui ne vienne de la partie.
 */
export function planFronts(run: RunResult, headlines: readonly FrontHeadline[], stepSec: readonly number[], lastStep: number): readonly PlannedFront[] {
  const leadAxes = new Set<WorldVar>();
  const shown = new Set<WorldVar>();
  const out: PlannedFront[] = [];
  for (let year = yearOfStep(1); year <= yearOfStep(lastStep); year++) {
    const shownAtSec = stepSec[firstStepOfYear(year)]!;
    const own: FrontLine[] = headlines.filter((h) => h.year === year).map(({ id, key, variant, variantKind }) => ({ id, key, variant, variantKind }));
    const moves = movesOf(run, year, lastStep);
    let leadMove: Move | null = null;
    if (own.length === 0) leadMove = moves.find((m) => !leadAxes.has(m.axis)) ?? moves[0] ?? null;
    if (leadMove !== null) { leadAxes.add(leadMove.axis); shown.add(leadMove.axis); }
    const rest = moves.filter((m) => m !== leadMove);
    const ordered = [...rest.filter((m) => !shown.has(m.axis)), ...rest.filter((m) => shown.has(m.axis))];
    const subMoves = ordered.slice(0, Math.max(0, MAX_SUBS - own.slice(1).length));
    for (const m of subMoves) shown.add(m.axis);
    const subs = [...own.slice(1), ...subMoves.map(moveLine)];
    const lead = own[0] ?? (leadMove === null ? STILL : moveLine(leadMove));
    out.push({ year, shownAtSec, source: own.length > 0 ? 'headlines' : 'movement', lines: [lead, ...subs] });
  }
  return out;
}
