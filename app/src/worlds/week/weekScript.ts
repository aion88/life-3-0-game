/**
 * Script de la semaine 1984 : un générateur qui émet les beats du contrat (`weekContracts.ts` §7)
 * dans l'ordre des règles d'émission, et lit les réponses du joueur (indice de cible ou de ligne).
 * Il mute l'état passé en argument ; le shell relit cet état après chaque beat.
 *
 * Spec : production/session-state/plan-semaine-1984-3d.md §7, §8, §10 (W1).
 * Source : prototypes/semaine-1984-objets/index.html lignes 338-453. Aucune valeur de jeu ici :
 * tout vient de `weekContent.ts`. Ni horloge ni hasard : mêmes réponses, mêmes beats.
 */

import type { Beat, Line, PieceRow, Target, WeekCast, WeekPlace, WeekRun } from './weekContracts';
import {
  CONTESTS,
  DAY1,
  DAY2,
  DAY3,
  ENDING_FACT,
  ENDINGS,
  MACHINE_SPEAKER,
  NAMES,
  REFUS_ROWS,
  RULES,
  SCENES,
  SPEAKER_CAST,
  LABELS,
  DELTAS,
  type Choice,
  type ContestId,
  type GestureSpec,
  type LineSpec,
  type WeekName,
} from './weekContent';
import {
  closeDay,
  contest,
  endingOf,
  giveName,
  openDay,
  overrun,
  remember,
  say,
  signNotebook,
  write,
  type WeekState,
} from './weekState';

type Step<T = void> = Generator<Beat, T, number | undefined>;
type SceneId = Extract<Beat, { kind: 'scene' }>['id'];

/** Découpe un prix du prototype : `prix [· detail]`, `gain` si le prix commence par '+'. */
export function parseTarget(id: string, label: string, raw: string): Target {
  const [price = '', ...rest] = raw.split(' · ');
  const target: Target = { id, label, price };
  if (rest.length > 0) target.detail = rest.join(' · ');
  if (price.startsWith('+')) target.gain = true;
  return target;
}

function toLine([who, text]: LineSpec): Line {
  const voice = who === null ? 'narr' : MACHINE_SPEAKER.test(who) ? 'machine' : 'dit';
  const cast = who === null ? undefined : SPEAKER_CAST[who];
  return cast ? { who, text, voice, cast } : { who, text, voice };
}

const lines = (specs: readonly LineSpec[]): Beat => ({ kind: 'lines', lines: specs.map(toLine) });

function* scene(
  state: WeekState,
  id: string,
  place: WeekPlace | 'controle-j1',
  label: string,
  cast: readonly WeekCast[],
  enter: boolean,
): Step {
  yield { kind: 'scene', id, place, label, day: state.day, cast };
  if (enter) yield { kind: 'stage', act: 'enter' };
}

function* written(state: WeekState, label: string, delta: number): Step {
  write(state, label, delta);
  yield { kind: 'written', label, delta };
}

function* said(state: WeekState, words: number): Step {
  if (words <= 0) return;
  say(state, words);
  yield { kind: 'say', words };
}

function* named(state: WeekState, name: WeekName): Step {
  giveName(state, name);
  yield { kind: 'gain', words: RULES.nameWords };
  const entry = state.ledger[state.ledger.length - 1];
  if (entry) yield { kind: 'written', label: entry.label, delta: entry.delta };
}

function pick(answer: number | undefined, count: number, what: string): number {
  if (answer === undefined || !Number.isInteger(answer) || answer < 0 || answer >= count) {
    throw new RangeError(`${what} : réponse ${String(answer)} hors de 0..${count - 1}`);
  }
  return answer;
}

function gestureBeat(spec: GestureSpec): Beat {
  const targets = spec.choices.map((c) => parseTarget(c.id, c.label, c.price));
  return spec.object
    ? { kind: 'gesture', prompt: spec.prompt, object: { ...spec.object }, targets }
    : { kind: 'gesture', prompt: spec.prompt, targets };
}

/** Un geste à choix, puis ses effets (mots, écriture, trace) et sa narration. Rend l'indice choisi. */
function* ask(state: WeekState, spec: GestureSpec): Step<number> {
  const index = pick(yield gestureBeat(spec), spec.choices.length, spec.prompt);
  const choice = spec.choices[index] as Choice;
  yield* said(state, choice.words ?? 0);
  if (choice.ledger) yield* written(state, choice.ledger.label, choice.ledger.delta);
  if (choice.trace) remember(state, choice.trace);
  if (choice.after) yield lines([[null, choice.after]]);
  return index;
}

function* piece(state: WeekState, id: ContestId, title: string, rows: readonly PieceRow[]): Step {
  const rule = CONTESTS[id];
  const lineCount = rows.filter((r) => 'line' in r).length;
  const answer = yield { kind: 'piece', title, prompt: rule.prompt(rule.words), rows, none: { ...rule.none } };
  const picked = answer === undefined || answer === -1 ? -1 : pick(answer, lineCount, title);
  const result = contest(state, id, picked);
  // `contest` a déjà retiré les mots et écrit les lignes : on n'émet que les beats de retour.
  if (result.words > 0) yield { kind: 'say', words: result.words };
  for (const entry of result.written) yield { kind: 'written', label: entry.label, delta: entry.delta };
  const reply = rule.reply[result.outcome];
  if (reply) yield lines([[reply.who, reply.text]]);
}

function* evening(state: WeekState, id: SceneId): Step {
  yield* scene(state, id, 'chez-toi', 'Relevé du soir', [], false);
  const statement = closeDay(state);
  yield { kind: 'ticket', title: statement.title, rows: statement.rows, footer: statement.footer };
  openDay(state);
}

/* ------------------------------ Jour 1 ------------------------------ */

function* day1(state: WeekState): Step {
  const n = DAY1.notice;
  yield* scene(state, 'P-J1-01', 'chez-toi', SCENES.j101.label, [], true);
  yield {
    kind: 'ticket',
    title: n.title,
    rows: [n.greeting, { label: n.wordsLabel, value: String(state.budget) }, n.mother, n.invite],
    footer: n.footer,
  };

  yield* scene(state, 'P-J1-02', 'palier', SCENES.j102.label, ['roux'], true);
  yield lines(DAY1.roux.intro);
  const r = yield* ask(state, DAY1.roux.gesture);
  state.roux = (['silent', 'weather', 'laugh'] as const)[r] ?? 'silent';

  yield* scene(state, 'P-J1-03', 'rue', SCENES.j103.label, [], true);
  yield lines(DAY1.street);

  yield* scene(state, 'P-J1-04', 'controle-j1', SCENES.j104.label, [], false);
  yield { kind: 'control', act: 'approach' };
  yield lines([DAY1.checkLines]);
  yield lines([DAY1.refusedLines]);
  yield* piece(state, 'refus', CONTESTS.refus.title, REFUS_ROWS);
  yield lines(DAY1.afterContest);
  const g = pick(yield gestureBeat(DAY1.phone), DAY1.phone.choices.length, DAY1.phone.prompt);
  state.mother = g === 0;

  if (state.mother) {
    const m = DAY1.motherBranch;
    yield { kind: 'control', act: 'requestGuarantee' };
    yield* scene(state, 'P-J1-05', 'controle-j1', SCENES.j105Mother.label, [], false);
    yield lines(m.onPhone);
    yield* scene(state, 'P-J1-06', 'controle-j1', SCENES.j106Mother.label, [], false);
    yield { kind: 'control', act: 'authorize' };
    yield lines(m.accepted);
    yield* scene(state, 'P-J1-07', 'parents', SCENES.j107Mother.label, ['maman', 'papa'], true);
    yield lines(m.atTable);
    yield* written(state, LABELS.mother, RULES.motherDossier);
    remember(state, m.trace);
  } else {
    const h = DAY1.homeBranch;
    yield { kind: 'control', act: 'goHome' };
    yield* scene(state, 'P-J1-05', 'controle-j1', SCENES.j105Home.label, [], false);
    yield lines(h.message);
    yield* scene(state, 'P-J1-06', 'chez-toi', SCENES.j106Home.label, [], true);
    yield lines(h.reply);
    yield* written(state, LABELS.abandoned, RULES.abandonedDossier);
    remember(state, h.trace);
  }
  yield* evening(state, 'P-J1-R');
}

/* ------------------------------ Jour 2 ------------------------------ */

function* day2(state: WeekState): Step {
  const n = DAY2.notice;
  yield* scene(state, 'P-J2-01', 'chez-toi', SCENES.j201.label, [], true);
  const rows: PieceRow[] = [
    { heading: n.sharedName(RULES.nameWords) },
    { line: n.budget(state.budget) },
    { line: n.yesterday(state.yesterday + n.falseOffset) },
    { line: n.memory[state.roux ?? 'silent'] },
  ];
  if (state.roux === 'laugh') rows.push({ line: n.sealed });
  rows.push({ line: state.mother ? n.mother : n.noMother });
  yield* piece(state, 'avis', n.title, rows);

  yield* scene(state, 'P-J2-02', 'rue', SCENES.j202.label, ['theodore', 'nadia'], true);
  yield { kind: 'prop', id: 'lettre', visible: true };
  yield lines(DAY2.street);
  const letter = yield* ask(state, DAY2.letter);
  state.letter = letter === 0;
  yield { kind: 'prop', id: 'lettre', visible: false };
  yield* ask(state, DAY2.theodore);

  yield* scene(state, 'P-J2-03', 'chez-toi', SCENES.j203.label, ['marlene'], true);
  yield lines(DAY2.marlene.intro);
  const names = DAY2.marlene.nameChoices;
  const spec: GestureSpec = {
    prompt: DAY2.marlene.prompt,
    choices: [
      ...names.map((c) => ({ id: `marlene-${c.name.toLowerCase()}`, label: c.name, price: c.price })),
      DAY2.marlene.nobody,
    ],
  };
  const m = pick(yield gestureBeat(spec), spec.choices.length, spec.prompt);
  const given = names[m];
  if (given) {
    state.marlene = given.name as Exclude<WeekName, 'Marlène'>;
    yield* named(state, given.name);
    yield lines([[null, given.after]]);
  } else {
    state.marlene = 'rien';
    const nobody = DAY2.marlene.nobody;
    yield* said(state, nobody.words);
    yield* written(state, nobody.ledger.label, nobody.ledger.delta);
    yield lines([[null, nobody.after]]);
  }
  yield* evening(state, 'P-J2-R');
}

/* ------------------------------ Jour 3 ------------------------------ */

function* day3(state: WeekState): Step {
  const n = DAY3.notice;
  yield* scene(state, 'P-J3-01', 'chez-toi', SCENES.j301.label, [], true);
  const rows: (string | { label: string; value: string })[] = [
    n.summons,
    { label: n.wordsLabel, value: String(state.budget) },
    n.checkpoint(RULES.checkpointWords),
    n.consequence[state.marlene ?? 'rien'],
  ];
  if (state.marlene === 'Théodore' && state.letter) rows.push(n.letterInPocket);
  yield { kind: 'ticket', title: n.title, rows, footer: n.footer };

  yield* scene(state, 'P-J3-02', 'escalier', SCENES.j302.label, ['bruno'], true);
  yield { kind: 'prop', id: 'dossier', visible: true };
  yield lines(DAY3.stairs);
  yield* ask(state, { prompt: DAY3.bruno.prompt(RULES.checkpointWords), choices: DAY3.bruno.choices });
  yield lines([[null, DAY3.pen.handOver]]);
  yield { kind: 'prop', id: 'stylo', visible: true };
  const available = NAMES.filter((x) => !state.names.includes(x));
  const penSpec: GestureSpec = {
    prompt: DAY3.pen.prompt,
    object: DAY3.pen.object,
    choices: [
      ...available.map((x) => ({ id: `stylo-${x.toLowerCase()}`, label: x, price: DAY3.pen.namePrice })),
      DAY3.pen.giveBack,
    ],
  };
  const b = pick(yield gestureBeat(penSpec), penSpec.choices.length, penSpec.prompt);
  yield { kind: 'prop', id: 'stylo', visible: false };
  const chosen = available[b];
  if (chosen) {
    yield* named(state, chosen);
    remember(state, DAY3.pen.trace(chosen));
    yield lines([[null, DAY3.pen.written(chosen)]]);
  } else {
    yield* written(state, DAY3.pen.giveBack.ledger.label, DAY3.pen.giveBack.ledger.delta);
    yield lines([[null, DAY3.pen.giveBack.after]]);
  }

  yield* scene(state, 'P-J3-03', 'controle', SCENES.j303.label, [], true);
  yield lines([[null, DAY3.checkpoint.line]]);
  yield { kind: 'stage', act: 'checkpoint-pass' };
  yield* said(state, RULES.checkpointWords);
  const over = overrun(state);
  if (over > 0) yield lines([[null, DAY3.checkpoint.overrun(over)]]);

  const a = DAY3.audition;
  yield* scene(state, 'P-J3-04', 'audition', SCENES.j304.label, ['agente'], true);
  yield { kind: 'prop', id: 'dossier', visible: true };
  yield { kind: 'prop', id: 'carnet', visible: true };
  const opening: LineSpec[] = [...a.opening];
  if (state.mother) opening.push(a.mother);
  if (state.contested) opening.push(a.lifted);
  opening.push(a.reread);
  yield lines(opening);
  if (state.contested) yield* written(state, LABELS.identificationLifted, DELTAS.identificationLifted);
  const recent = state.traces.slice(-a.traceCount);
  recent.splice(a.falseLineIndex, 0, state.marlene === 'rien' ? a.falseLine.gave : a.falseLine.none);
  yield* piece(state, 'releve', CONTESTS.releve.title, recent.map((line) => ({ line })));
  yield lines([a.question]);
  const f = pick(yield gestureBeat(a.notebook), a.notebook.choices.length, a.notebook.prompt);
  if (f === 0) {
    signNotebook(state);
    yield { kind: 'written', label: LABELS.notebook, delta: RULES.notebookDossier };
  }
  const late = overrun(state);
  if (late > 0) yield* written(state, LABELS.overrun, -late);

  const ending = endingOf(state);
  yield* scene(state, `P-FIN-${ending}`, 'audition', SCENES.fin.label, ['agente'], false);
  const copy = ENDINGS[ending];
  const list = state.names.join(', ');
  const count = state.names.length;
  const fact =
    ending === 'arrete'
      ? count > 1
        ? ENDING_FACT.arrete.many
        : count === 1
          ? ENDING_FACT.arrete.one(list)
          : ENDING_FACT.arrete.none
      : ending === 'recrute'
        ? ENDING_FACT.recrute(list)
        : count > 0
          ? ENDING_FACT.relache.some(list)
          : ENDING_FACT.relache.none;
  const base = {
    kind: 'ending' as const,
    ending,
    title: copy.title,
    regime: copy.regime,
    fact,
    dossier: state.dossier,
    threshold: RULES.threshold,
    names: [...state.names],
  };
  yield ending === 'arrete' && state.mother ? { ...base, mother: ENDING_FACT.mother } : base;
}

/**
 * Joue la semaine : émet les beats dans l'ordre du plan §7 et lit les réponses
 * (indice de cible pour `gesture`, indice de ligne ou -1 pour `piece`, rien ailleurs).
 * `state` vient de `createWeek()` ; le shell le relit après chaque beat.
 */
export function* runWeek(state: WeekState): WeekRun {
  yield* day1(state);
  yield* day2(state);
  yield* day3(state);
}
