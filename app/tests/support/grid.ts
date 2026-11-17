/**
 * Aide de test : la grille exhaustive des 746 496 suites de réponses et ses mesures [plan 01 T7 ; errata T7, D8].
 * La grille est un outil de test : aucun écran ne la lit, rien de ceci n'est dans `src/`.
 * Elle se construit avec les mêmes primitives que `runFastForward` (poussée, fast-forward, extinction, arrivée),
 * sans passer par `runOf` : pas de titres, pas de gel, et une simulation par poussée distincte.
 */
import { EXTINCTION_IDS, WORLD_IDS } from '../../src/data/schema/common';
import type { Catalogue } from '../../src/data/schema/catalogue';
import type { CoreData } from '../../src/data/schema/core';
import type { Questionnaire } from '../../src/data/schema/questionnaire';
import { arrivalOutcome } from '../../src/fastforward/arrival';
import { OTHER_LIVES_MAX_LINES } from '../../src/fastforward/others';
import { remontee } from '../../src/fastforward/remontee';
import { simulateFastForward } from '../../src/fastforward/simulate';
import { SEL_ORDER, answersAt, displayRankOf, indexOf, pushOf, replaceOne } from '../../src/questionnaire';
import { toAxisMilli, toMilli, type Milli } from '../../src/shared/milli';
import type { AnswerKey, OtherLife, QuestionKey } from '../../src/shared/types';
import { questionNumber } from '../../src/shared/types';
import { WORLD_VARS, worldNumber, type WorldId, type WorldVector } from '../../src/shared/types/world';

/** Second seuil d'arrivée lointaine : 70 points, soit 70 000 millièmes [GDD 02 §8.1, F10 ; brief T7 : 1 719 suites au-delà]. */
export const FAR_ARRIVAL_SECOND_THRESHOLD: Milli = toMilli(70);

/** Une suite sur ce pas est revérifiée avec `replaceOne` et `indexOf`, pour garder l'arithmétique d'indice honnête. */
const COUNTERFACTUAL_AUDIT_STRIDE = 7919;

/** La grille : une destination, un vecteur V(48) et un monde calculé par suite, indexés comme `indexOf` [GDD 01 §7]. */
export interface Grid {
  readonly size: number;
  readonly questionnaire: Questionnaire;
  /** Les données du jeu avec lesquelles la grille a été bâtie (la remontée en a besoin). */
  readonly core: CoreData;
  /** Monde calculé, ou monde d'extinction : jamais le monde vécu [D140 (3)]. */
  destinationAt(i: number): WorldId;
  /** V(48), le vecteur du pas de choix, en millièmes. */
  atChoiceAt(i: number): WorldVector;
  /** Monde d'arrivée le plus proche de V(48) [D111], y compris pour une suite qui finit en extinction. */
  computedAt(i: number): WorldId;
  /** Indices de monde (numéro - 1) des destinations, une case par suite. */
  readonly destinations: Uint8Array;
  /** V(48) à plat : six entiers par suite, dans l'ordre de `WORLD_VARS`. */
  readonly vectors: Int32Array;
  /** Pas de rupture des suites qui finissent en extinction, par indice de suite. */
  readonly ruptureSteps: ReadonlyMap<number, number>;
}

interface Solved { readonly dest: number; readonly computed: number; readonly v: readonly number[]; readonly rupture: number }

const idIndex = (id: WorldId): number => WORLD_IDS.indexOf(id);

function sizesOf(q: Questionnaire): number[] {
  return SEL_ORDER.map((k) => {
    const found = q.questions.find((x) => x.key === k);
    if (!found) throw new Error(`question inconnue : ${k}`);
    return found.answers.length;
  });
}

function lettersOf(q: Questionnaire, k: QuestionKey): AnswerKey[] {
  const found = q.questions.find((x) => x.key === k);
  if (!found) throw new Error(`question inconnue : ${k}`);
  return found.answers.map((a) => a.key);
}

/** Pas d'indice de chaque question de `SEL_ORDER` (la dernière varie le plus vite) [GDD 01 §7]. */
function stridesOf(sizes: readonly number[]): number[] {
  const out: number[] = [];
  let s = 1;
  for (let n = sizes.length - 1; n >= 0; n--) { out[n] = s; s *= sizes[n]!; }
  return out;
}

/**
 * Construit la grille. Deux suites de même poussée ont la même trajectoire : la simulation est jouée une fois
 * par poussée distincte (le fast-forward ne lit que P), l'indice et la poussée de CHAQUE suite restent calculés.
 */
export function buildGrid(core: CoreData): Grid {
  const Q = core.questionnaire;
  const size = sizesOf(Q).reduce((n, s) => n * s, 1);
  const destinations = new Uint8Array(size);
  const computed = new Uint8Array(size);
  const vectors = new Int32Array(size * WORLD_VARS.length);
  const ruptureSteps = new Map<number, number>();
  const solvedByPush = new Map<string, Solved>();
  for (let i = 0; i < size; i++) {
    const push = pushOf(Q, answersAt(Q, i));
    const key = WORLD_VARS.map((k) => push[k]).join(',');
    let s = solvedByPush.get(key);
    if (s === undefined) {
      const ff = simulateFastForward(push, core.engine);
      const arrival = arrivalOutcome(ff.atChoice, core);
      s = {
        dest: idIndex(ff.extinction ? ff.extinction.world : arrival.computedWorld),
        computed: idIndex(arrival.computedWorld),
        v: WORLD_VARS.map((k) => ff.atChoice[k]),
        rupture: ff.extinction ? ff.extinction.ruptureStep : 0,
      };
      solvedByPush.set(key, s);
    }
    destinations[i] = s.dest;
    computed[i] = s.computed;
    vectors.set(s.v, i * WORLD_VARS.length);
    if (s.rupture > 0) ruptureSteps.set(i, s.rupture);
  }
  const inRange = (i: number): number => {
    if (!Number.isInteger(i) || i < 0 || i >= size) throw new RangeError(`indice hors grille : ${i}`);
    return i;
  };
  return {
    size, questionnaire: Q, core, destinations, vectors, ruptureSteps,
    destinationAt: (i) => WORLD_IDS[destinations[inRange(i)]!]!,
    computedAt: (i) => WORLD_IDS[computed[inRange(i)]!]!,
    atChoiceAt: (i) => {
      const o = {} as Record<string, Milli>;
      WORLD_VARS.forEach((k, a) => { o[k] = vectors[inRange(i) * WORLD_VARS.length + a]! as Milli; });
      return o as WorldVector;
    },
  };
}

/** Comptes par destination ; un monde à zéro suite n'apparaît pas. */
export function tally(G: Grid): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < G.size; i++) { const id = G.destinationAt(i); out[id] = (out[id] ?? 0) + 1; }
  return out;
}

/** Comptes par destination, pour chaque réponse de la question `key` (par exemple `Q21`). */
export function tallyBy(G: Grid, key: QuestionKey): Record<string, Record<string, number>> {
  const sizes = sizesOf(G.questionnaire);
  const strides = stridesOf(sizes);
  const p = SEL_ORDER.indexOf(key);
  if (p < 0) throw new Error(`question hors grille : ${key}`);
  const letters = lettersOf(G.questionnaire, key);
  const out: Record<string, Record<string, number>> = {};
  for (const l of letters) out[l] = {};
  for (let i = 0; i < G.size; i++) {
    const bucket = out[letters[Math.floor(i / strides[p]!) % sizes[p]!]!]!;
    const id = G.destinationAt(i);
    bucket[id] = (bucket[id] ?? 0) + 1;
  }
  return out;
}

/** Vecteurs des mondes d'arrivée, dans l'ordre des numéros, en tableaux à plat. */
function arrivalTargets(catalogue: Catalogue): { ids: WorldId[]; vecs: number[][] } {
  const arrivals = catalogue.entries.filter((e) => e.kind === 'arrival').sort((a, b) => a.number - b.number);
  return { ids: arrivals.map((e) => e.id), vecs: arrivals.map((e) => WORLD_VARS.map((k) => (e.vector as WorldVector)[k])) };
}

/** d² (millièmes²) de la suite `i` à chaque monde d'arrivée. */
function distancesSq(G: Grid, i: number, vecs: readonly (readonly number[])[]): number[] {
  return vecs.map((w) => {
    let s = 0;
    WORLD_VARS.forEach((_, a) => { s += (G.vectors[i * WORLD_VARS.length + a]! - w[a]!) ** 2; });
    return s;
  });
}

const survives = (G: Grid, i: number): boolean => !G.ruptureSteps.has(i);

/**
 * Parmi les suites qui survivent : égalités exactes de distance au pas 48, et suites dont le monde change entre
 * « premier de la table » (avant D111) et la règle D111 [GDD 02 §3.6, F10].
 */
export function tieStats(G: Grid, catalogue: Catalogue): { exactTies: number; changedVsFirstOfTable: number } {
  const { ids, vecs } = arrivalTargets(catalogue);
  let exactTies = 0;
  let changedVsFirstOfTable = 0;
  for (let i = 0; i < G.size; i++) {
    if (!survives(G, i)) continue;
    const d = distancesSq(G, i, vecs);
    const min = Math.min(...d);
    if (d.filter((x) => x === min).length >= 2) exactTies++;
    if (ids[d.indexOf(min)] !== G.destinationAt(i)) changedVsFirstOfTable++;
  }
  return { exactTies, changedVsFirstOfTable };
}

/** Parmi les suites qui survivent : celles dont le monde le plus proche est à plus de `threshold`, puis de 70 points [GDD 02 §8.1, F10]. */
export function farCounts(G: Grid, catalogue: Catalogue, threshold: Milli): { over60: number; over70: number } {
  const { vecs } = arrivalTargets(catalogue);
  let over60 = 0;
  let over70 = 0;
  for (let i = 0; i < G.size; i++) {
    if (!survives(G, i)) continue;
    const min = Math.min(...distancesSq(G, i, vecs));
    if (min > threshold ** 2) over60++;
    if (min > FAR_ARRIVAL_SECOND_THRESHOLD ** 2) over70++;
  }
  return { over60, over70 };
}

/** Nombre de suites par pas de rupture [GDD 02 F9] ; les suites sans rupture n'y figurent pas. */
export function ruptureHistogram(G: Grid): Record<number, number> {
  const out: Record<number, number> = {};
  for (const step of G.ruptureSteps.values()) out[step] = (out[step] ?? 0) + 1;
  return out;
}

/**
 * `hit` suites sur `of` qui suivent le motif arrivent à `world`. Motif : une lettre par question de `SEL_ORDER`,
 * `-` pour une réponse libre [GDD 01 §7].
 */
export function patternShare(G: Grid, pattern: string, world: WorldId): { hit: number; of: number } {
  if (pattern.length !== SEL_ORDER.length) throw new Error(`motif de ${pattern.length} signes, ${SEL_ORDER.length} attendus`);
  const sizes = sizesOf(G.questionnaire);
  const strides = stridesOf(sizes);
  const fixed: { stride: number; size: number; digit: number }[] = [];
  SEL_ORDER.forEach((k, n) => {
    if (pattern[n] === '-') return;
    const digit = lettersOf(G.questionnaire, k).indexOf(pattern[n] as AnswerKey);
    if (digit < 0) throw new Error(`réponse inconnue dans le motif : ${k} ${String(pattern[n])}`);
    fixed.push({ stride: strides[n]!, size: sizes[n]!, digit });
  });
  let hit = 0;
  let of = 0;
  for (let i = 0; i < G.size; i++) {
    if (!fixed.every((f) => Math.floor(i / f.stride) % f.size === f.digit)) continue;
    of++;
    if (G.destinationAt(i) === world) hit++;
  }
  return { hit, of };
}

/**
 * Paires (suite, réponse de remplacement) qui changent la destination, comptées par réponse de remplacement,
 * clé `Q18.B` [GDD 01 §9, §5.10, D103]. Le voisin d'une suite est trouvé par arithmétique d'indice ;
 * un échantillon de paires est revérifié avec `answersAt`, `replaceOne` et `indexOf`.
 */
export function counterfactualPairs(G: Grid, Q: Questionnaire): Record<string, number> {
  const sizes = sizesOf(Q);
  const strides = stridesOf(sizes);
  const out: Record<string, number> = {};
  SEL_ORDER.forEach((k, n) => {
    const letters = lettersOf(Q, k);
    for (let x = 0; x < sizes[n]!; x++) {
      let changed = 0;
      for (let i = 0; i < G.size; i++) {
        const digit = Math.floor(i / strides[n]!) % sizes[n]!;
        if (digit === x) continue;
        const j = i + (x - digit) * strides[n]!;
        if (G.destinations[j] !== G.destinations[i]) changed++;
        if (i % COUNTERFACTUAL_AUDIT_STRIDE === 0 && indexOf(Q, replaceOne(answersAt(Q, i), k, letters[x]!)) !== j) {
          throw new Error(`arithmétique d'indice fausse : ${k} ${String(letters[x])} depuis ${i}`);
        }
      }
      out[`${k}.${String(letters[x])}`] = changed;
    }
  });
  return out;
}

/** F-8 : la suite `i` arrive à un identifiant connu, avec six axes entiers dans 0..100 000 ; lève sinon. */
export function assertValidCell(G: Grid, i: number): void {
  const id = G.destinationAt(i);
  if (!(WORLD_IDS as readonly string[]).includes(id)) throw new Error(`identifiant inconnu à ${i} : ${id}`);
  for (let a = 0; a < WORLD_VARS.length; a++) toAxisMilli(G.vectors[i * WORLD_VARS.length + a]! / 1000);
}

/**
 * Mondes atteints par les 27 remplacements de la suite `i`, un par réponse non choisie, lus dans la grille à
 * l'indice n + (a' - a_q) × pas_q sans rejouer [D139 ; lead-programmer].
 */
function neighboursAt(G: Grid, i: number): { question: QuestionKey; answer: AnswerKey; destination: WorldId }[] {
  const Q = G.questionnaire;
  const sizes = sizesOf(Q);
  const strides = stridesOf(sizes);
  const out: { question: QuestionKey; answer: AnswerKey; destination: WorldId }[] = [];
  SEL_ORDER.forEach((question, n) => {
    const digit = Math.floor(i / strides[n]!) % sizes[n]!;
    const letters = lettersOf(Q, question);
    for (let x = 0; x < sizes[n]!; x++) {
      if (x === digit) continue;
      out.push({ question, answer: letters[x]!, destination: G.destinationAt(i + (x - digit) * strides[n]!) });
    }
  });
  return out;
}

/** M : nombre de mondes distincts du monde de la suite `i` atteints par un remplacement, extinctions comprises [D139]. */
export function neighbourCountAt(G: Grid, i: number): number {
  const own = G.destinationAt(i);
  return new Set(neighboursAt(G, i).map((x) => x.destination).filter((d) => d !== own)).size;
}

/**
 * Les mêmes lignes que `otherLives`, lues dans la grille sans rejouer : mêmes règles de sélection [GDD 06 §4 F4 ; D139],
 * réécrites ici. Ordre de lecture : la remontée, puis les autres questions par numéro ; dans une question, par lettre
 * puis par numéro de monde ; premier remplacement de chaque monde neuf, quatre au plus.
 */
export function otherLivesAt(G: Grid, i: number): readonly OtherLife[] {
  const neighbours = neighboursAt(G, i);
  const traceback = remontee(G.core, answersAt(G.questionnaire, i)).map((t) => t.question);
  const order = [...traceback, ...SEL_ORDER.filter((q) => !traceback.includes(q)).sort((a, b) => questionNumber(a) - questionNumber(b))];
  const seen = new Set<WorldId>([G.destinationAt(i)]);
  const out: OtherLife[] = [];
  for (const question of order) {
    const mine = neighbours
      .filter((x) => x.question === question)
      .sort((a, b) => (a.answer < b.answer ? -1 : a.answer > b.answer ? 1 : 0) || worldNumber(a.destination) - worldNumber(b.destination));
    for (const x of mine) {
      if (out.length >= OTHER_LIVES_MAX_LINES) return out;
      if (seen.has(x.destination)) continue;
      seen.add(x.destination);
      out.push({ question, answer: x.answer, destination: x.destination, displayedRank: displayRankOf(G.questionnaire, question) });
    }
  }
  return out;
}

/** Nombre de suites par nombre de mondes voisins M, de 0 à 7 [GDD 06 §3.5 rév. 2 ter ; D139]. */
export function neighbourHistogram(G: Grid): number[] {
  const out = new Array<number>(8).fill(0);
  for (let i = 0; i < G.size; i++) out[neighbourCountAt(G, i)]!++;
  return out;
}

/** Suites dont un remplacement mène à une extinction qui n'est pas la leur [GDD 06 rév. 2 ter ; exécuté: gd-plancher]. */
export function countWithExtinctNeighbourOtherThanOwn(G: Grid): number {
  const extinct = new Set<WorldId>(EXTINCTION_IDS);
  let n = 0;
  for (let i = 0; i < G.size; i++) {
    const own = G.destinationAt(i);
    if (neighboursAt(G, i).some((x) => extinct.has(x.destination) && x.destination !== own)) n++;
  }
  return n;
}
