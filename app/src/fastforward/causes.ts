/** Écran des causes : beats allumés, ligne affichée, éditions datées [bible w07 §3, bible w12 §3 ; D74, D81, D82]. Pur : ni DOM ni hasard. */
import type { CauseSet, Beat, CauseAnswer } from '../data/schema/causes';
import type { HeadlineSet } from '../data/schema/headlines';
import type { Questionnaire } from '../data/schema/questionnaire';
import type { Answers } from '../shared/types';
import type { RunResult } from '../shared/types/run';
import { EDITION_COUNT } from '../data/schema/causes';
import { yearOfStep } from './headlines';

export { EDITION_COUNT, EDITION_LOTS } from '../data/schema/causes';

/** Une édition (lot) : année, drapeau « dernière » pour la version adoucie [D82], beats avec leur clé de chaîne. */
export interface Edition {
  readonly index: 1 | 2 | 3;
  readonly year: number | null;
  readonly isLast: boolean;
  readonly beats: readonly { readonly beatId: string; readonly lit: boolean; readonly lineKey: string | null }[];
}

const has = (answers: Answers, a: CauseAnswer): boolean => answers[a.question] === a.answer;

/** Allumage de chaque beat, dans l'ordre : réponse principale ou « aussi » ; la somme des autres l'est si un autre beat l'est [D74]. */
export function litBeats(beats: readonly Beat[], answers: Answers): readonly boolean[] {
  const own = beats.map((b) => b.main !== 'sumOfOthers' && (has(answers, b.main) || b.also.some((a) => has(answers, a))));
  const anyOwn = own.some(Boolean);
  return beats.map((b, i) => (b.main === 'sumOfOthers' ? anyOwn : own[i]!));
}

/**
 * Ligne affichée d'un beat [D81] : celle de la réponse principale si le joueur l'a ; sinon celle de la réponse « aussi »
 * qui maximise sens × poussée sur la variable du beat, l'ordre d'écriture départageant. `null` si rien n'allume le beat.
 */
export function lineOf(beat: Beat, answers: Answers, q: Questionnaire): CauseAnswer | null {
  if (beat.main === 'sumOfOthers') return null;
  if (has(answers, beat.main)) return beat.main;
  let best: CauseAnswer | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const a of beat.also) {
    if (!has(answers, a)) continue;
    const chosen = q.questions.find((x) => x.key === a.question)?.answers.find((x) => x.key === a.answer);
    if (!chosen) throw new Error(`réponse inconnue du questionnaire : ${a.question} ${a.answer}`);
    const score = beat.sense * chosen.push[beat.var];
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return best;
}

/** Clé de chaîne de la ligne d'un beat : `cause.<monde>.<beat>.<Q05B>` ou `.sum` pour la somme des autres. */
const lineKeyOf = (world: string, beat: Beat, line: CauseAnswer | null): string | null =>
  beat.main === 'sumOfOthers' ? `cause.${world}.${beat.id}.sum` : line === null ? null : `cause.${world}.${beat.id}.${line.question}${line.answer}`;

/**
 * Éditions de l'écran des causes, `[]` pour une arrivée. L'année d'un beat est celle du pas de déclenchement de son titre lié
 * (`run.headlines`, issu de `fireHeadlines`, jamais du planning d'affichage) ; un titre absent du jeu ou non déclenché ne date rien [D82].
 * L'année d'une édition est la plus tardive de ses beats allumés, jamais 2026 ; la dernière prend l'année de rupture.
 */
export function causeEditions(run: RunResult, headlines: HeadlineSet, causes: CauseSet, q: Questionnaire): readonly Edition[] {
  if (run.outcome.kind !== 'extinction') return [];
  const { world, ruptureStep } = run.outcome;
  const beats = causes.byExtinction[world];
  const lit = litBeats(beats, run.answers);
  const known = new Set(headlines.headlines.map((h) => h.id));
  const fireStep = new Map(run.headlines.filter((f) => known.has(f.id)).map((f) => [f.id, f.firedAtStep]));
  const yearOf = (b: Beat): number | null => {
    if (b.linkedHeadline === 'rupture') return yearOfStep(ruptureStep);
    const step = fireStep.get(b.linkedHeadline);
    return step === undefined ? null : yearOfStep(step);
  };
  const out: Edition[] = [];
  for (let index = 1; index <= EDITION_COUNT; index++) {
    const inLot = beats.map((b, i) => ({ b, lit: lit[i]! })).filter((x) => x.b.edition === index);
    const isLast = index === EDITION_COUNT;
    const years = inLot.filter((x) => x.lit).map((x) => yearOf(x.b)).filter((y): y is number => y !== null);
    out.push({
      index: index as 1 | 2 | 3,
      year: isLast ? yearOfStep(ruptureStep) : years.length > 0 ? Math.max(...years) : null,
      isLast,
      beats: inLot.map((x) => ({
        beatId: x.b.id,
        lit: x.lit,
        lineKey: x.lit ? lineKeyOf(world, x.b, lineOf(x.b, run.answers, q)) : null,
      })),
    });
  }
  return out;
}
