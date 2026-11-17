/** Aide de test : partie complète d'une ligne de réponses [R-01.3]. */
import headlinesRaw from '../../src/data/headlines.json';
import { loadCore } from '../../src/data/load';
import { parseHeadlines } from '../../src/data/schema/headlines';
import { runFastForward } from '../../src/fastforward/run';
import type { Answers } from '../../src/shared/types';
import type { RunResult } from '../../src/shared/types/run';
import type { WorldId } from '../../src/shared/types/world';
import { ans } from './answers';

const core = loadCore();
const H = parseHeadlines(headlinesRaw);

/** `runOf('ACBACBACAAD')` : `runFastForward(core, H, ans(line), false)`. Accepte aussi des réponses déjà bâties (`replaceOne`). */
export function runOf(line: string | Answers): RunResult {
  return runFastForward(core, H, typeof line === 'string' ? ans(line) : line, false);
}

/**
 * Destination d'une partie : le monde d'extinction si l'issue en est une, sinon le monde CALCULÉ,
 * jamais le monde vécu [R-01.3 ; D140 (3)].
 */
export function destinationOf(run: RunResult): WorldId {
  return run.outcome.kind === 'extinction' ? run.outcome.world : run.outcome.computedWorld;
}
