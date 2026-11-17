/** Données de SOURCES & HONESTY [GDD 06 §3.8 ; plan 03 T11 ; décision 8]. Pur : des clés et des comptes, aucun texte, aucune remontée. */
import type { CoreData } from '../data/schema/core';
import type { WorldData } from '../data/schema/world';
import type { HypothesisRow, SourceLabel, SourcesScreen } from '../shared/types/bilan';
import type { BilanCommon } from '../shared/types/bilan';
import type { RunResult } from '../shared/types/run';
import type { ArrivalWorldId } from '../shared/types/world';

/** Les quatre étiquettes de source, dans l'ordre de la légende [GDD 06 §3.8 point 1]. */
export const SOURCE_LABELS: readonly SourceLabel[] = ['sourced', 'unreopened', 'extrapolated', 'gameHypothesis'];

/** Clé de la ligne des mondes rares [GDD 06 §3.8 point 8] : le texte est au writer, les parts viennent de `shares`. */
export const RARE_LINE_KEY = 'sources.rare.line';

/** Mondes d'extinction : pas d'arrivée, donc hors du tableau des parts [GDD 06 §3.8 point 8]. */
const EXTINCTION_WORLDS: ReadonlySet<string> = new Set(['w07', 'w12']);

/** Ce que `buildSources` lit : les données centrales, les réglages communs, le fichier du monde calculé s'il existe dans la build [R-03.18]. */
export interface SourcesContext { readonly core: CoreData; readonly common: BilanCommon; readonly computedFile: WorldData | null }

/** Les sept réponses `hypothesis: true` du questionnaire, dans l'ordre de lecture, jamais la remontée du joueur. */
function hypothesesOf(core: CoreData): readonly HypothesisRow[] {
  return [...core.questionnaire.questions].sort((a, b) => a.order - b.order)
    .flatMap((q) => q.answers.filter((a) => a.hypothesis).map((a) => ({ question: q.key, answer: a.key })));
}

/**
 * L'écran SOURCES & HONESTY de la partie : le monde de l'HISTOIRE (calculé, ou d'extinction), son tableau s'il a un fichier (sinon `null`),
 * les hypothèses, les notes, la ligne rare et les parts d'arrivée des dix mondes d'arrivée (le total compte aussi les deux extinctions).
 */
export function buildSources(run: RunResult, ctx: SourcesContext): SourcesScreen {
  const o = run.outcome;
  const world = o.kind === 'extinction' ? o.world : o.computedWorld;
  const file = ctx.computedFile;
  if (file !== null && file.id !== world) throw new Error(`sources : le fichier ${file.id} n'est pas le monde calculé ${world}`);
  const b = file?.bilan;
  return {
    world,
    worldRows: b !== undefined && 'sources' in b ? b.sources : null,
    hypotheses: hypothesesOf(ctx.core),
    noteKeys: ctx.common.noteKeys,
    rareLineKey: RARE_LINE_KEY,
    shares: {
      total: ctx.common.total,
      rows: ctx.common.counts.filter((c) => !EXTINCTION_WORLDS.has(c.world)).map((c) => ({ world: c.world as ArrivalWorldId, count: c.count })),
    },
  };
}
