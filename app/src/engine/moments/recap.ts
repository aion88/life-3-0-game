/**
 * Relevé du soir précis [spec rue guidée J1-J2 §5.1, §6, §9.5, T11] : pur, lit les marques de chaîne du jour (qui, à quelle heure, ce que
 * la joueuse a dit ou son silence), la réponse 2026 de chaque chaîne ouverte, son fait sourcé et le droit dit aujourd'hui.
 * Aucun texte ici : seulement des clés. Le jour est lu COMME CLOS : un maillon du jour non franchi y paraît `absent`.
 */
import type { AnswerKey, DayIndex, QuestionKey, RightId } from '../../shared/types';
import type { GuidedData } from '../../data/schema/guided';
import type { StreetContext, StreetState } from './types';
import { linksOfDay, marksOf, type Mark } from './marks';

/**
 * `speech` : `said` = mots dits (`saidKey`) ; `silence` = scène où la joueuse n'a rien dit ; `none` = ni l'un ni l'autre (geste, nuit, maillon `absent`),
 * où « ton silence » serait faux.
 */
export type RecapSpeech = 'said' | 'silence' | 'none';
export interface RecapItem {
  readonly day: DayIndex; readonly minute: number; readonly personKey: string | null; readonly saidKey: string | null; readonly recapKey: string; readonly speech: RecapSpeech;
}
export interface Recap {
  readonly day: DayIndex; readonly items: readonly RecapItem[];
  /** Une entrée par chaîne qui a franchi ce jour un maillon non `absent`, ordre de `guided.chains` ; `answer` et `linkKey` nuls sans réponse sauvegardée. */
  readonly chains: readonly {
    readonly chainId: string; readonly titleKey: string; readonly questionKey: string; readonly questionTitleKey: string;
    readonly answer: AnswerKey | null; readonly answerLabelKey: string | null; readonly linkKey: string | null;
    readonly fact: { readonly key: string; readonly source: string; readonly sourceKey: string };
  }[];
  /** Droit dit aujourd'hui (le dernier si plusieurs) ; sinon le droit du jour des données (`days[].right`, lu par jour) ; sinon `null` [S3]. */
  readonly right: RightId | null;
  /** Clés `nameKey` des marques non `absent` jusqu'au jour lu, ordre jour puis minute : les noms que la joueuse a donnés (`{noms}` des lignes). */
  readonly names: readonly string[];
  /** Vrai quand la partie a une fin (`ending`) et que le jour lu est le dernier de `days` : le bouton du relevé mène à la fin. */
  readonly lastDay: boolean;
  /** `ending.weekButtonKey` quand `lastDay`, sinon `null` : la vue n'a que ce relevé en main. */
  readonly weekButtonKey: string | null;
}

const ABSENT = 'absent';

/** Ligne du relevé pour une marque : qui, quand, la clé de la ligne, et si la joueuse y a eu la parole. Partagé avec le bilan (`bilan/chains.ts`). */
export function itemOf(m: Mark, guided: GuidedData): RecapItem {
  const link = guided.chains.find((c) => c.id === m.chainId)?.links.find((l) => l.id === m.linkId);
  const speaks = m.variant !== ABSENT && link?.at.kind === 'scene';   // seule une scène donne la parole ; l'acte, la nuit et l'absence ne la donnent pas
  const speech: RecapSpeech = !speaks ? 'none' : m.v.saidKey === null ? 'silence' : 'said';
  return { day: m.day, minute: m.minute, personKey: m.v.personKey, saidKey: m.v.saidKey, recapKey: m.v.recapKey, speech };
}

/** R2 : les noms donnés jusqu'au jour `day`, dans l'ordre des marques (clés `nameKey`). SEULE lecture : relevé (`{noms}`) et issue de l'audition [N7]. */
export function givenNameKeys(marks: readonly Mark[], day: number): readonly string[] {
  return marks.filter((m) => m.day <= day && m.variant !== ABSENT && m.v.nameKey !== null).map((m) => m.v.nameKey!);
}

export function eveningRecap(s: StreetState, ctx: StreetContext, answers: Readonly<Partial<Record<QuestionKey, AnswerKey>>>): Recap {
  const guided = ctx.street.guided;
  const day = s.day;
  const rights = Object.entries(s.rightLines).filter(([k]) => k.startsWith(`${day}.`));
  const said = rights.length === 0 ? null : rights[rights.length - 1]![1];
  if (guided === null) return { day, items: [], chains: [], right: said, names: [], lastDay: false, weekButtonKey: null };
  // le soir clôt le jour : on lit les marques comme le lendemain matin, pour que ce qui n'a pas eu lieu aujourd'hui soit dit « absent »
  const all = marksOf(s.acts, { day: (day + 1) as DayIndex }, guided, ctx.street.clock);
  const marks = linksOfDay(day, all);
  const right = said ?? guided.days.find((x) => x.day === day)?.right ?? null;   // par jour, jamais par indice de tableau
  const names = givenNameKeys(all, day);
  const lastDay = guided.ending !== null && day === Math.max(...guided.days.map((x) => x.day));
  const items: RecapItem[] = marks.map((m) => itemOf(m, guided));
  const opened = new Set(marks.filter((m) => m.variant !== ABSENT).map((m) => m.chainId));
  const chains = guided.chains.filter((c) => opened.has(c.id)).map((c) => {
    const answer = answers[c.question.key as QuestionKey] ?? null;
    return {
      chainId: c.id, titleKey: c.titleKey, questionKey: c.question.key, questionTitleKey: `q.${c.question.key}.title`,
      answer, answerLabelKey: answer === null ? null : `q.${c.question.key}.${answer}.label`, linkKey: answer === null ? null : c.question.linkKeys[answer] ?? null, fact: c.fact,
    };
  });
  return { day, items, chains, right, names, lastDay, weekButtonKey: lastDay ? guided.ending!.weekButtonKey : null };
}
