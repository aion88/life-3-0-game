/**
 * Preuve des jours de montage [plan semaine condensée, T4] : parcours restreint (décision 6), `guided.montageUncovered`,
 * `guided.askNotReached` (B-4), `guided.montagePostureWords` (B-3, R-1), `guided.factPlacement` (décision 9), `guided.chainEndsEarly`
 * (chaînes finies à l'audition), contrôles par jour limités aux jours joués.
 *
 * Fixture de base `proofBase()` = `week-montage.json` (T1) amendée ici, comptes faits à la main AVANT l'implémentation :
 *   J1 joué : j1.wake -> j1.roux (a 8, b 5, c 0 mots ; maillon A1) -> j1.cafe -> nuit (A2, nuit du J1, lit A1) : 3 chemins.
 *   J2 montage, asks [j2.b] : j2.a route A1 { b: j2.b } sinon j2.d ; j2.d (caché : p 22, q 0) -> j2.b (carte : x 4, y 0 ; B1)
 *     -> j2.c (caché : p 3, q 0 ; B2 rangé) -> nuit.
 *   picks : muet { j2.d q, j2.c q }, couloir et bavard { j2.d p, j2.c p } ; cardDefaults : muet y, couloir et bavard x.
 *   Chemin de référence (route en `otherwise` -> j2.d) : muet 0 + 0 + 0 = 0 ; couloir 22 + 4 + 3 = 29 ; bavard 29.
 *   Branche b (A1 = b, j2.d sautée) : couloir 4 + 3 = 7, jamais comparée (R-1).
 *   Chemins du J2 par état : 3 postures × 2 options de carte = 6 (une seule branche de route tient par état).
 *   `pathsOf(…, 2, 'marks')` : 3 états après J1 (A1 = a, b, c) × 6 = 18 finaux, aucun couvert (chaque chemin du J1 est un état).
 *   Faits : A sur la carte du J2 (T1), B au relevé du J1 (ajouté ici).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import weekMontageJson from '../../fixtures/guided/week-montage.json';
import weekSevenJson from '../../fixtures/guided/week-seven.json';
import { parseGuided } from '../../../src/data/schema/guided';
import type { StreetData } from '../../../src/data/schema/street';
import type { Issue } from '../../../src/shared/types/common';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import { mustOpenOf, pathsOf, proveGuided, type GuidedRef } from '../../../src/validate/guided';
import { w10Street } from '../../support/guided';

type Raw = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON brut de fixture

const NEW_CODES = ['guided.montageUncovered', 'guided.askNotReached', 'guided.montagePostureWords', 'guided.factPlacement', 'guided.chainEndsEarly'];
const MONTAGE_PATHS_THROUGH_J2 = 18;
const WEEK_SEVEN_CHAINS = 3;

const sceneOf = (g: Raw, id: string): Raw => g.scenes.find((s: Raw) => s.id === id);
const dayOf = (g: Raw, day: number): Raw => g.days.find((d: Raw) => d.day === day);
const chainOf = (g: Raw, id: string): Raw => g.chains.find((c: Raw) => c.id === id);
const modes = <T>(muet: T, couloir: T, bavard: T): Raw => ({ muet, couloir, bavard });

/** Une scène narrative du J2 clonée de `j2.c` : `options` = [id, mots, suite]. */
function narrativeScene(g: Raw, id: string, anchorMinute: number, options: readonly (readonly [string, number, string])[]): Raw {
  const s = structuredClone(sceneOf(g, 'j2.c'));
  s.id = id;
  s.anchorMinute = anchorMinute;
  s.ask.options = options.map(([o, words, next]) => ({ id: o, labelKey: `w10.scene.${id}.${o}`, words, next, replyKey: null }));
  return s;
}

/** La fixture de base, voir l'en-tête. */
function proofBase(): Raw {
  const g = structuredClone(weekMontageJson) as Raw;
  sceneOf(g, 'j2.a').ask = { kind: 'route', link: 'A1', next: { b: 'j2.b' }, otherwise: 'j2.d' };
  g.scenes.push(narrativeScene(g, 'j2.d', 445, [['p', 22, 'j2.b'], ['q', 0, 'j2.b']]));
  Object.assign(dayOf(g, 2).montage, {
    picks: modes({ 'j2.d': 'q', 'j2.c': 'q' }, { 'j2.d': 'p', 'j2.c': 'p' }, { 'j2.d': 'p', 'j2.c': 'p' }),
    cardDefaults: modes({ 'j2.b': 'y' }, { 'j2.b': 'x' }, { 'j2.b': 'x' }),
    expectedWords: modes(0, 29, 29),
  });
  chainOf(g, 'chain.B').fact.shownOn = { on: 'recap', day: 1 };
  return g;
}

/** Mots du jour : somme des options narratives des actes `scene` (comme `validate_guided_week_test.ts`). */
function wordsOf(street: StreetData): (day: DayIndex, acts: readonly ActRecord[]) => number {
  const words = new Map<string, number>();
  for (const s of street.guided?.scenes ?? []) if (s.ask.kind === 'narrative') for (const o of s.ask.options) words.set(`${s.id}.${o.id}`, o.words);
  return (day, acts) => acts.filter((a) => a.day === day && a.kind === 'scene').reduce((n, a) => n + (words.get(`${a.id}.${a.option}`) ?? 0), 0);
}
const streetOf = (raw: Raw): StreetData => ({ ...w10Street, guided: parseGuided(raw, w10Street) });
const refFor = (street: StreetData): GuidedRef => ({ worldId: 'w10', hasKey: () => true, questionKeys: new Set(['Q04', 'Q11', 'Q16']), wordsOfDay: wordsOf(street) });

function prove(raw: Raw) {
  const street = streetOf(raw);
  const throughDay = Math.max(...street.guided!.days.map((d) => d.day)) as DayIndex;
  return proveGuided(street, { throughDay, mustOpen: mustOpenOf(street.guided!, throughDay), memo: 'projection' }, refFor(street));
}
const issuesOf = (raw: Raw, code: string): readonly Issue[] => prove(raw).issues.filter((i) => i.code === code);
const newCodesOf = (raw: Raw): readonly string[] => prove(raw).issues.map((i) => i.code).filter((c) => NEW_CODES.includes(c));

describe('preuve des jours de montage (T4)', () => {
  it('test_montage_base_fixture_has_no_new_issue', () => {
    expect(newCodesOf(proofBase())).toEqual([]);
  });

  it('test_montage_day_enumerates_postures_times_card_options', () => {
    const ps = pathsOf(streetOf(proofBase()), 2, 'marks');
    expect(ps).toHaveLength(MONTAGE_PATHS_THROUGH_J2);
    const day2 = ps.map((p) => p.key.split(' | ')[1]!);
    for (const m of ['muet', 'couloir', 'bavard']) expect(day2.filter((k) => k.includes(`@${m}`))).toHaveLength(6);
    // aucune option cachée hors `picks` : sur la branche de référence, j2.d ne prend que l'option de la posture
    expect(day2.filter((k) => k.includes('@muet') && k.includes('j2.d=p'))).toEqual([]);
    expect(day2.filter((k) => k.includes('@couloir') && k.includes('j2.d=q'))).toEqual([]);
  });

  it('test_montage_uncovered_step_without_pick_is_reported', () => {
    const raw = proofBase();
    delete dayOf(raw, 2).montage.picks.bavard['j2.c'];
    const got = issuesOf(raw, 'guided.montageUncovered');
    expect(got).toHaveLength(1);
    expect(got[0]!.path).toBe('street.guided.days.2.montage.picks.bavard.j2.c');
  });

  it('test_ask_not_reached_when_a_branch_skips_the_first_ask', () => {
    const raw = proofBase();
    sceneOf(raw, 'j2.a').ask.next = { b: 'j2.c' };   // A1 = b : la carte n'aurait pas de choix
    const got = issuesOf(raw, 'guided.askNotReached');
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((i) => i.path === 'street.guided.days.2.montage.asks.j2.b')).toBe(true);
  });

  it('test_second_ask_required_only_after_its_option', () => {   // B-4
    // asks [j2.b, j2.c] ; j2.b : x -> j2.r, y -> nuit (refus). j2.r route A1 { a: j2.c } sinon nuit.
    const raw = proofBase();
    const g = raw;   // alias lisible
    sceneOf(g, 'j2.b').ask.options.find((o: Raw) => o.id === 'y').next = 'night';
    sceneOf(g, 'j2.b').ask.options.find((o: Raw) => o.id === 'x').next = 'j2.r';
    const r = structuredClone(sceneOf(g, 'j2.a'));
    Object.assign(r, { id: 'j2.r', anchorMinute: 480, ask: { kind: 'route', link: 'A1', next: { a: 'j2.c' }, otherwise: 'night' } });
    g.scenes.push(r);
    const spec = dayOf(g, 2).montage;
    spec.asks = ['j2.b', 'j2.c'];
    for (const m of ['muet', 'couloir', 'bavard']) { delete spec.picks[m]['j2.c']; spec.cardDefaults[m] = { 'j2.b': 'y' }; }
    spec.expectedWords = modes(0, 22, 22);   // référence : j2.d (0 ou 22) + j2.b y 0, puis la nuit
    const got = issuesOf(raw, 'guided.askNotReached');
    // y (refus) ne mène pas à j2.c : jamais exigé ; x y mène, mais j2.r ne l'atteint que si A1 = a : rouge sur A1 = b ou c
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((i) => i.path === 'street.guided.days.2.montage.asks.j2.c' && i.message.includes('j2.b=x'))).toBe(true);
    // sans j2.r (x -> j2.c direct) : plus aucune issue, le refus y compris
    sceneOf(g, 'j2.b').ask.options.find((o: Raw) => o.id === 'x').next = 'j2.c';
    expect(issuesOf(raw, 'guided.askNotReached')).toEqual([]);
  });

  it('test_posture_words_compare_to_pinned_sums_not_band', () => {   // B-3
    const raw = proofBase();
    dayOf(raw, 2).montage.picks.muet['j2.d'] = 'p';   // muet : 22 mots, au-dessus de la bande muet (14) du J2
    dayOf(raw, 2).montage.expectedWords.muet = 22;
    expect(issuesOf(raw, 'guided.montagePostureWords')).toEqual([]);
    dayOf(raw, 2).montage.expectedWords.muet = 14;
    const got = issuesOf(raw, 'guided.montagePostureWords');
    expect(got).toHaveLength(1);
    expect(got[0]!.path).toBe('street.guided.days.2.montage.expectedWords.muet');
    expect(got[0]!.message).toContain('22');
  });

  it('test_posture_words_only_on_reference_route_branch', () => {   // R-1
    // la base : branche b (j2.d sautée) donne couloir 7, épinglé 29 : aucune issue
    expect(issuesOf(proofBase(), 'guided.montagePostureWords')).toEqual([]);
    // épinglé à la somme de la branche b : la branche `otherwise` (29) diffère, issue
    const raw = proofBase();
    dayOf(raw, 2).montage.expectedWords.couloir = 7;
    const got = issuesOf(raw, 'guided.montagePostureWords');
    expect(got.map((i) => i.path)).toEqual(['street.guided.days.2.montage.expectedWords.couloir']);
    expect(got[0]!.message).toContain('29');
  });

  it('test_fact_placement_every_fact_once_on_an_existing_screen', () => {
    const raw = proofBase();
    chainOf(raw, 'chain.B').fact.shownOn = null;   // semaine condensée : un fait sans place serait montré à chaque relevé
    expect(issuesOf(raw, 'guided.factPlacement').map((i) => i.path)).toEqual(['street.guided.chains.chain.B.fact.shownOn']);
  });

  it('test_fact_placement_refuses_sunday_recap', () => {   // décision 10 : pas de relevé le dimanche
    const raw = weekSevenMontage();
    chainOf(raw, 'M').fact.shownOn = { on: 'recap', day: 7 };
    expect(issuesOf(raw, 'guided.factPlacement').map((i) => i.path)).toEqual(['street.guided.chains.M.fact.shownOn']);
  });

  it('test_stage_count_only_on_played_days', () => {
    // toutes les scènes de la fixture sont sur la même scène (`street`) : 1 scène par jour, hors bornes
    const stage = issuesOf(proofBase(), 'guided.stageCount').map((i) => i.path);
    expect(stage).toEqual(['street.guided.days.1']);
    const noLink = issuesOf(noLinkOnMontageDay(), 'guided.noLinkOnDay').map((i) => i.path);
    expect(noLink).toEqual([]);
  });

  it('test_every_chain_ends_at_audition_on_every_path', () => {
    const r = prove(weekSevenMontage());
    expect(r.issues.map((i) => i.code).filter((c) => NEW_CODES.includes(c) || c === 'guided.chainIncomplete')).toEqual([]);
    expect(r.proof.completeMin).toBe(WEEK_SEVEN_CHAINS);
    const early = weekSevenMontage();
    chainOf(early, 'K').lastDay = 6;
    expect(issuesOf(early, 'guided.chainEndsEarly').map((i) => i.path)).toEqual(['street.guided.chains.K.lastDay']);
  });

  it('test_proof_header_says_postures_are_free', () => {
    const src = readFileSync(join(__dirname, '../../../src/validate/guided.ts'), 'utf8');
    const header = src.slice(0, src.indexOf('*/'));
    expect(header).toContain('sur-ensemble des postures');
  });
});

/** `weekSevenMontage()` dont K3 (seul maillon du J3, sur la carte) est rangé : le J3 n'a de maillon sur aucun chemin. */
function noLinkOnMontageDay(): Raw {
  const g = weekSevenMontage();
  const k = chainOf(g, 'K');
  g.setAsideLinks.K = k.links.filter((l: Raw) => l.id === 'K3');
  k.links = k.links.filter((l: Raw) => l.id !== 'K3');
  return g;
}

/**
 * `week-seven.json` dont le J3 est un jour de montage : asks [j3.a] (K3), j3.b caché (M3 rangé), picks j3.b muet o0, couloir o5,
 * bavard o9 ; cardDefaults j3.a o0 ; référence : 0, 5, 9 mots. Faits : K sur la carte du J3, M au relevé du J1, N au relevé du J2.
 */
function weekSevenMontage(): Raw {
  const g = structuredClone(weekSevenJson) as Raw;
  const m = chainOf(g, 'M');
  g.setAsideLinks = { M: m.links.filter((l: Raw) => l.id === 'M3') };
  m.links = m.links.filter((l: Raw) => l.id !== 'M3');
  Object.assign(dayOf(g, 3), {
    kind: 'montage',
    montage: {
      lines: [{ voice: 'narrator', key: 'w10.montage.d3.1', lit: null }],
      postureKeys: modes('w10.montage.d3.posture.muet', 'w10.montage.d3.posture.couloir', 'w10.montage.d3.posture.bavard'),
      posture: 'inherit', asks: ['j3.a'],
      picks: modes({ 'j3.b': 'o0' }, { 'j3.b': 'o5' }, { 'j3.b': 'o9' }),
      expectedWords: modes(0, 5, 9),
      cardDefaults: modes({ 'j3.a': 'o0' }, { 'j3.a': 'o0' }, { 'j3.a': 'o0' }),
    },
  });
  chainOf(g, 'K').fact.shownOn = { on: 'card', day: 3 };
  chainOf(g, 'M').fact.shownOn = { on: 'recap', day: 1 };
  chainOf(g, 'N').fact.shownOn = { on: 'recap', day: 2 };
  return g;
}
