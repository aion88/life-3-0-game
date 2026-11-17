/** Fabriques de fixtures de données : clonent le JSON réel et changent un champ [Testing Standards]. */
import catalogueJson from '../../../src/data/catalogue.json';
import engineJson from '../../../src/data/engine.json';
import questionnaireJson from '../../../src/data/questionnaire.json';
import questionnaireSkeletonJson from './questionnaire.skeleton.json';
import w10Json from '../../../src/data/worlds/w10.json';
import { parseCatalogue, type Catalogue } from '../../../src/data/schema/catalogue';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const clone = <T>(v: T): T => structuredClone(v);

/** JSON réel de `worlds/w10.json`. */
export const w10Raw: Json = w10Json;
/** JSON réel de `engine.json`. */
export const engineRaw: Json = engineJson;
/** JSON réel de `questionnaire.json`. */
export const qRaw: Json = questionnaireJson;
/** Copie figée du squelette du plan 00 (status `skeleton`, poussées nulles) : pour les tests qui doivent voir un squelette. */
export const qSkeletonRaw: Json = questionnaireSkeletonJson;
/** Catalogue réel, parsé. */
export const cat: Catalogue = parseCatalogue(catalogueJson);

/** Dérive de w10 avec des variables remplacées (points). */
export function withDrift(raw: Json, drift: Record<string, number>): Json {
  const r = clone(raw);
  Object.assign(r['engine'].drift, drift);
  return r;
}

/** `couplingScale` de w10 remplacé (points). */
export function withScale(raw: Json, scale: number): Json {
  const r = clone(raw);
  r['engine'].couplingScale = scale;
  return r;
}

/** Magnitude (points) du couplage `id` remplacée. */
export function withCouplingMagnitude(raw: Json, id: string, magnitude: number): Json {
  const r = clone(raw);
  const c = (r['couplings'] as Json[]).find((x) => x['id'] === id);
  if (!c) throw new Error(`couplage inconnu : ${id}`);
  c['magnitude'] = magnitude;
  return r;
}

/** Comparateur de la première condition du premier couplage remplacé. */
export function withCouplingCmp(raw: Json, cmp: string): Json {
  const r = clone(raw);
  r['couplings'][0].when[0].cmp = cmp;
  return r;
}

/** Comparateur de la première porte remplacé. */
export function withGateCmp(raw: Json, cmp: string): Json {
  const r = clone(raw);
  r['engine'].gates[0].when.cmp = cmp;
  return r;
}

/** Cible de la première pente remplacée. */
export function withSlopeTo(raw: Json, to: string): Json {
  const r = clone(raw);
  r['engine'].slopes[0].to = to;
  return r;
}

/** Question vide à deux réponses, `key` et `order` donnés, ajoutée à la fin. */
export function withExtraQuestion(raw: Json, key: string, order: number): Json {
  const r = clone(raw);
  const push = { aiPower: 0, order: 0, abundance: 0, freedom: 0, surveillance: 0, unrest: 0 };
  r['questions'].push({
    key,
    order,
    answers: [
      { key: 'A', push: { ...push }, hypothesis: false },
      { key: 'B', push: { ...push }, hypothesis: false },
    ],
  });
  return r;
}

/** Poussée `variable` de la réponse `answer` de `question` remplacée. */
export function withPush(raw: Json, question: string, answer: string, variable: string, value: number): Json {
  const r = clone(raw);
  const q = (r['questions'] as Json[]).find((x) => x['key'] === question);
  const a = q?.['answers'].find((x: Json) => x['key'] === answer);
  if (!a) throw new Error(`réponse inconnue : ${question} ${answer}`);
  a.push[variable] = value;
  return r;
}

/** `order` de la question `key` remplacé (laisse un trou dans la suite, comme après un retrait). */
export function withOrder(raw: Json, key: string, order: number): Json {
  const r = clone(raw);
  const q = (r['questions'] as Json[]).find((x) => x['key'] === key);
  if (!q) throw new Error(`question inconnue : ${key}`);
  q['order'] = order;
  return r;
}

// --- Validateurs de contenu (Task 6) ---------------------------------------
import { loadCore } from '../../../src/data/load';
import { parseWorld, type WorldData } from '../../../src/data/load';
import type { ContentInput } from '../../../src/validate/content';
import type { StringRule } from '../../../src/i18n/i18n';
import frJson from '../../../src/data/strings/fr.json';
import enJson from '../../../src/data/strings/en.json';
import metaJson from '../../../src/data/strings/meta.json';

/** Entrée réelle : `loadCore()`, `worlds/w10.json` et les vraies tables de chaînes [GDD 05 §8.2]. */
export function realInput(): ContentInput {
  return {
    core: loadCore(),
    worlds: [parseWorld(w10Json, cat)],
    strings: { fr: frJson, en: enJson },
    meta: metaJson as Record<string, StringRule>,
  };
}

function withWorldEngine(patch: Partial<WorldData['engine']>): ContentInput {
  const base = realInput();
  const w = base.worlds[0]!;
  return { ...base, worlds: [{ ...w, engine: { ...w.engine, ...patch } }] };
}

/** Entrée réelle avec un événement ajouté au monde (champs omis : plafonds nuls) [GDD 03 §3.4, D128]. */
export function inputWithEvent(event: { id: string; wsEffect: Record<string, number> | null; repeatable: boolean }): ContentInput {
  const w = realInput().worlds[0]!;
  return withWorldEngine({
    events: [...w.engine.events, { perOccurrenceCap: null, maxPerWeek: null, ...event } as unknown as WorldData['engine']['events'][number]],
  });
}

/** Entrée réelle avec un jalon ajouté et `milestoneCapPerVar` fixé (millièmes ou null) [GDD 03 §3.3, K3b]. */
export function inputWithMilestone(milestone: { id: string; wsDelta: Record<string, number> | null }, cap: number | null): ContentInput {
  const w = realInput().worlds[0]!;
  return withWorldEngine({
    milestones: [...w.engine.milestones, milestone as unknown as WorldData['engine']['milestones'][number]],
    milestoneCapPerVar: cap as WorldData['engine']['milestoneCapPerVar'],
  });
}

/** Entrée réelle avec des règles de méta ajoutées [GDD 05 V8]. */
export function inputWithMeta(extra: Record<string, StringRule>): ContentInput {
  const base = realInput();
  return { ...base, meta: { ...base.meta, ...extra } };
}
