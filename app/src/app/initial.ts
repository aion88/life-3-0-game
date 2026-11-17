import type { Questionnaire } from '../data/load';
import type { SaveData } from '../save/save';
import type { Answers } from '../shared/types';
import type { ScreenId } from './shell';

/**
 * Écran de reprise d'après la sauvegarde [GDD 01 §3.3 ; plan 00 Task 8, PHASE V m16].
 * Sans partie : la langue. Réponses incomplètes : le questionnaire. Réponses complètes en
 * `fastforward`, `street` ou `bilan` : l'écran du fast-forward, parce que la rue et le bilan se
 * reconstruisent en rejouant le fast-forward puis les actes (le plan 03 saute l'écran s'il n'a rien à montrer).
 */
export function initialScreen(save: SaveData, questionnaire: Questionnaire): ScreenId {
  if (save.phase === 'new') return 'lang';
  const complete = questionnaire.questions.every((qu) => save.answers[qu.key] !== undefined);
  if (!complete) return 'questionnaire';
  return save.phase === 'questionnaire' ? 'questionnaire' : 'fastforward';
}

/**
 * Charge utile de l'écran `fastforward` à la reprise : les réponses sauvées, complètes par construction
 * quand {@link initialScreen} rend `fastforward` [GDD 01 §3.3 ; plan 00 Task 8].
 */
export function initialPayload(save: SaveData): { readonly answers: Answers } {
  return { answers: save.answers as Answers };
}
