/**
 * Le joueur automatique des jours de montage [plan semaine condensée, T2, décisions 2 à 4 ; D2]. Pur : ni DOM, ni pilote, ni état écrit.
 * Il dit dans quelle posture un jour résumé est joué et quelle option chaque étape y prend ; le metteur en scène (`director.ts`) pose
 * les actes par le pilote, comme un joueur humain (ruling R-COND.1).
 */
import { modesOf, type GuidedData, type SpeechMode, type SpeechModeId } from '../../data/schema/guided';
import { buildLedger } from '../../engine/moments/words';
import type { StreetContext } from '../../engine/moments/types';
import type { ActRecord, DayIndex } from '../../shared/types/street';

/** Repli sans mode atteint et sans jour joué avant : le mode du milieu [plan, décision 4, égalité]. */
const MIDDLE: SpeechModeId = 'couloir';

/**
 * Mode des `words` mots du jour [décision 4] : le mode atteint (`modesOf`, même règle que le validateur) ; entre deux modes, celui dont
 * la borne est la plus proche ; égalité -> `couloir`.
 */
export function nearestMode(m: SpeechMode, words: number): SpeechModeId {
  const reached = modesOf(m, words);
  if (reached.length > 0) return reached[0]!;
  const dist: Readonly<Record<SpeechModeId, number>> = {
    muet: Math.max(0, words - m.muet),
    couloir: words < m.couloir[0] ? m.couloir[0] - words : Math.max(0, words - m.couloir[1]),
    bavard: Math.max(0, m.bavard - words),
  };
  const best = Math.min(dist.muet, dist.couloir, dist.bavard);
  return dist.couloir === best ? MIDDLE : dist.muet === best ? 'muet' : 'bavard';
}

/**
 * Posture d'un jour de montage [D2] : `montage.posture` s'il n'est pas `inherit`, sinon le mode des mots du dernier jour `played` avant
 * `day` (`buildLedger(jour, acts, ctx).wordsSpent`, lecture seule), règle de `nearestMode`. Aucun jour joué avant : `couloir`.
 */
export function postureOf(g: GuidedData, ctx: StreetContext, acts: readonly ActRecord[], day: DayIndex): SpeechModeId {
  const spec = g.days.find((d) => d.day === day)?.montage;
  if (spec === undefined || spec === null) throw new Error(`montage : le jour ${day} n'est pas un jour de montage`);
  if (spec.posture !== 'inherit') return spec.posture;
  const last = g.days.filter((d) => d.kind === 'played' && d.day < day).map((d) => d.day).sort((a, b) => b - a)[0];
  if (last === undefined) return MIDDLE;
  const modes = g.speechModes[last];
  if (modes === undefined) throw new Error(`montage : aucun speechModes pour le jour ${last}`);
  return nearestMode(modes, buildLedger(last, acts, ctx).wordsSpent);
}

/**
 * Option jouée à l'étape `stepId` (id de scène) d'un jour de montage : `'ask'` si l'étape est présentée sur la carte (`asks`), sinon
 * `picks[posture][stepId]`. Lève si l'option manque : le validateur (T4) prouve que tout chemin joué en a une.
 */
export function montagePick(g: GuidedData, day: DayIndex, posture: SpeechModeId, stepId: string): string {
  const spec = g.days.find((d) => d.day === day)?.montage;
  if (spec === undefined || spec === null) throw new Error(`montage : le jour ${day} n'est pas un jour de montage`);
  if (spec.asks.includes(stepId)) return 'ask';
  const pick = spec.picks[posture][stepId];
  if (pick === undefined) throw new Error(`montage : jour ${day}, posture ${posture}, aucune option pour l'étape ${stepId}`);
  return pick;
}
