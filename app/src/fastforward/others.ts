/** « Les autres » : ce que chaque autre réponse aurait donné, et les lignes retenues [GDD 06 §3.5, §4 F1, F4 ; D49, D139, D140 (3)]. */
import type { CoreData } from '../data/schema/core';
import { displayRankOf, pushOf, replaceOne, SEL_ORDER } from '../questionnaire';
import type { AnswerKey, Answers, OtherLife, QuestionKey, TracebackLine } from '../shared/types';
import { questionNumber } from '../shared/types';
import { worldNumber, type WorldId } from '../shared/types/world';
import { arrivalOutcome } from './arrival';
import { simulateFastForward } from './simulate';

/** Nombre maximal de lignes de « Les autres » : un monde neuf par ligne, jusqu'à quatre [GDD 06 §4 F4 ; D139]. */
export const OTHER_LIVES_MAX_LINES = 4;

/**
 * Destination d'une vie : le monde d'extinction s'il y en a une, sinon le monde CALCULÉ, jamais le monde vécu [D140 (3)].
 * Rejouée par le fast-forward à chaque appel, jamais lue dans une table précalculée [GDD 06 §4 F1, F2 ; D49].
 */
function destinationOfAnswers(core: CoreData, answers: Answers): WorldId {
  const ff = simulateFastForward(pushOf(core.questionnaire, answers), core.engine);
  return ff.extinction ? ff.extinction.world : arrivalOutcome(ff.atChoice, core).computedWorld;
}

/** Réponses alternatives d'une question, dans l'ordre des lettres. */
function alternativesOf(core: CoreData, question: QuestionKey, given: AnswerKey): AnswerKey[] {
  const found = core.questionnaire.questions.find((q) => q.key === question);
  if (!found) throw new Error(`question inconnue : ${question}`);
  return found.answers.map((a) => a.key).filter((k) => k !== given).sort();
}

function givenOf(answers: Answers, question: QuestionKey): AnswerKey {
  const a = answers[question];
  if (a === undefined) throw new Error(`réponse manquante : ${question}`);
  return a;
}

/** Les 27 vies voisines, une par réponse non choisie, dans l'ordre du déroulé puis de la lettre [GDD 06 §4 F1 ; D49]. */
export function singleReplacements(core: CoreData, answers: Answers): readonly OtherLife[] {
  const out: OtherLife[] = [];
  const byScreen = [...SEL_ORDER].sort((a, b) => displayRankOf(core.questionnaire, a) - displayRankOf(core.questionnaire, b));
  for (const question of byScreen) {
    for (const answer of alternativesOf(core, question, givenOf(answers, question))) {
      out.push({
        question, answer,
        destination: destinationOfAnswers(core, replaceOne(answers, question, answer)),
        displayedRank: displayRankOf(core.questionnaire, question),
      });
    }
  }
  return out;
}

/**
 * Ordre de lecture des questions : celles de la remontée dans leur ordre, puis les autres par numéro croissant [D139].
 * L'outil de grille (`tests/support/grid.ts`) en garde une copie indépendante exprès, pour que les deux se contrôlent.
 */
export function readingOrder(traceback: readonly TracebackLine[]): QuestionKey[] {
  const first = traceback.map((t) => t.question);
  const rest = SEL_ORDER.filter((q) => !first.includes(q)).sort((a, b) => questionNumber(a) - questionNumber(b));
  return [...first, ...rest];
}

/**
 * « Les autres » : on lit les questions dans l'ordre de lecture, dans chaque question les remplacements par lettre puis
 * par numéro de monde, et on garde le premier remplacement de chaque monde neuf, jusqu'à {@link OTHER_LIVES_MAX_LINES}.
 * Un monde neuf n'est ni le monde du joueur (calculé, ou d'extinction) ni un monde déjà gardé ; une question sans monde
 * neuf est sautée [GDD 06 §4 F4 ; D139 et sa note du 2026-10-29 ; D140 (3)].
 */
export function otherLives(core: CoreData, answers: Answers, traceback: readonly TracebackLine[]): readonly OtherLife[] {
  const seen = new Set<WorldId>([destinationOfAnswers(core, answers)]);
  const out: OtherLife[] = [];
  for (const question of readingOrder(traceback)) {
    const replacements = alternativesOf(core, question, givenOf(answers, question))
      .map((answer) => ({ answer, destination: destinationOfAnswers(core, replaceOne(answers, question, answer)) }))
      .sort((a, b) => (a.answer < b.answer ? -1 : a.answer > b.answer ? 1 : 0) || worldNumber(a.destination) - worldNumber(b.destination));
    for (const r of replacements) {
      if (out.length >= OTHER_LIVES_MAX_LINES) return out;
      if (seen.has(r.destination)) continue;
      seen.add(r.destination);
      out.push({ question, answer: r.answer, destination: r.destination, displayedRank: displayRankOf(core.questionnaire, question) });
    }
  }
  return out;
}
