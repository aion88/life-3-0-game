/**
 * « Les chaînes de ta semaine » [plan rue guidée J3-J7, T7] : pur, relit les marques de chaîne de toute la partie pour la page du bilan.
 * Une entrée par chaîne ouverte (au moins un maillon non `absent`), ordre de `guided.chains` ; ses maillons dans l'ordre jour puis minute,
 * jamais un `absent`. Les marques se lisent comme le matin qui suit le dernier jour joué : un maillon d'un jour jamais atteint n'a pas de
 * marque. Arrestation anticipée (`earlyEnd`) : la nuit d'arrestation est le jour du dernier `sleep` des actes, rien n'est montré au-delà.
 * Aucun texte : des clés. `BilanData` n'est pas touché (décision 12) : l'écran appelle cette lecture à part.
 */
import { itemOf, type RecapItem } from '../engine/moments/recap';
import { marksOf } from '../engine/moments/marks';
import type { ChainSpec, GuidedData } from '../data/schema/guided';
import type { ClockData } from '../data/schema/street';
import type { BilanInput } from '../shared/types/bilan';
import type { AnswerKey, QuestionKey } from '../shared/types/questionnaire';
import type { DayIndex } from '../shared/types/street';

export interface WeekChainEntry {
  readonly chainId: string; readonly titleKey: string;
  /** Maillons non `absent`, ordre jour puis minute. */
  readonly items: readonly RecapItem[];
  readonly questionKey: string; readonly answer: AnswerKey | null; readonly linkKey: string | null; readonly fact: ChainSpec['fact'];
}
export interface WeekChains {
  readonly chains: readonly WeekChainEntry[];
  /** Clés `nameKey` des marques non `absent` de la partie, ordre jour puis minute. */
  readonly names: readonly string[];
  /** Nuit de l'arrestation anticipée (jour du dernier `sleep` des actes) quand la partie finit par `earlyEnd` ; `null` sinon. */
  readonly arrestedNight: DayIndex | null;
  /** `ending.arrestedNightKey` quand `arrestedNight` est posée et que le monde a une fin ; `null` sinon. */
  readonly arrestedLineKey: string | null;
}

const ABSENT = 'absent';

/** Les chaînes de la partie, pour le bilan. `answers` : les réponses sauvegardées (`run.answers`). */
export function weekChains(
  input: Pick<BilanInput, 'entry' | 'acts'>, guided: GuidedData, clock: Pick<ClockData, 'dayStartMinute'>,
  answers: Readonly<Partial<Record<QuestionKey, AnswerKey>>>,
): WeekChains {
  const sleeps = input.acts.filter((a) => a.kind === 'sleep').map((a) => a.day);
  const arrestedNight = input.entry === 'earlyEnd' && sleeps.length > 0 ? (Math.max(...sleeps) as DayIndex) : null;
  const lastDay = input.acts.length === 0 ? null : Math.max(...input.acts.map((a) => a.day));
  if (lastDay === null) return { chains: [], names: [], arrestedNight, arrestedLineKey: null };
  // le matin qui suit le dernier jour joué : tout maillon franchi est marqué, tout maillon d'un jour joué non franchi est `absent`
  const all = marksOf(input.acts, { day: (lastDay + 1) as DayIndex }, guided, clock);
  // la nuit d'arrestation coupe : un maillon de nuit daté du matin qui n'a pas eu lieu n'est pas montré
  const kept = all.filter((m) => m.variant !== ABSENT && (arrestedNight === null || m.day <= arrestedNight));
  const chains = guided.chains.flatMap((c): WeekChainEntry[] => {
    const marks = kept.filter((m) => m.chainId === c.id);
    if (marks.length === 0) return [];
    const answer = answers[c.question.key as QuestionKey] ?? null;
    return [{
      chainId: c.id, titleKey: c.titleKey, items: marks.map((m) => itemOf(m, guided)),
      questionKey: c.question.key, answer, linkKey: answer === null ? null : c.question.linkKeys[answer] ?? null, fact: c.fact,
    }];
  });
  const names = kept.filter((m) => m.v.nameKey !== null).map((m) => m.v.nameKey!);
  const arrestedLineKey = arrestedNight !== null && guided.ending !== null ? guided.ending.arrestedNightKey : null;
  return { chains, names, arrestedNight, arrestedLineKey };
}
