/**
 * Preuve de la semaine [plan rue guidée J3-J7, T3] : mémoire par projection (décision 1), routes S2 suivies et filtrées par les marques
 * (décision 3), mémoire complète gardée jusqu'au J2 et bornée (décision 2), budget en visites, `guided.linkRef`, `guided.endingUnknown`,
 * `opensBy` dans `validateGuided`.
 *
 * Comptes calculés à la main AVANT l'implémentation (fixtures écrites par `gen_week_fixtures.py`, voir chaque fixture) :
 *
 * week-route.json (J1-J2) : J1 j1.a (R1 : fille 0, yusuf 5, rien 9 mots) -> j1.b (S1, 3 options) -> j1.c : 9 chemins. J2 : j2.wake route
 * sur R1 (fille -> j2.daughter, sinon j2.other), chacune 3 options, -> j2.c (R2, S2, 3 options) : 9 + 9 = 18 chemins du jour, dont 9
 * cohérents par état. Projection après J1 : R1 lu par une route du J2 (b) -> 3 états (S1 n'est ni lu, ni dernier, ni `from`).
 * `pathsOf(…, 2, 'projection')` = 3 × 9 finaux + (9 - 3) chemins du J1 couverts = 33. Preuve : 9 + 27 = 36 visites.
 *
 * week-seven.json : 7 jours, chaque jour jN.a (K, 3 options) -> jN.b (M, 3 options) -> jN.c : 9 chemins du jour ; N1 sur j1.a, N7
 * maillon de nuit (nuit du J6, daté J7) qui lit N1. Mémoire 'marks' : 9 états après J1, 81, 729, 6 561 après J4 > 2 000 -> lève.
 * Projection : (a) {K, M, N} toujours ; (b) aucune route ; (c) derniers maillons K7, M7 non posés avant le J7, N7 posé à la nuit du J6
 * avec la variante de N1 ; (d) présence de N1, toujours là. États : 1 après chaque jour (après J6, N7 a la variante de N1 du seul
 * représentant gardé après J1 : la variante de N1 n'est pas dans la projection, seule sa présence l'est).
 * WEEK_SEVEN_VISITS = 9 (J1) + 6 × 9 × 1 (J2 à J7) = 63 [corrigé après mesure : le premier calcul à la main disait 81, en comptant
 * 3 variantes de N7 après J6 ; il oubliait que la mise en commun du J1 n'en garde qu'une].
 *
 * week-carry.json (J1-J4, mémoire 'marks' faisable : 54 états après J1), une clause de la décision 1 par piège :
 *   J1 : j1.a (k -> j1.k [K1] | n) -> j1.b (d -> j1.d [D1] | m) -> j1.c [B1, L1, D0 ; v1 0, v2 5, v3 15] -> j1.e [B0 ; w1 0, w2 9]
 *   J2 : j2.a (l -> j2.l [L2] | o) -> j2.b [E2] -> j2.c ; nuit du J2 : BN (daté J3) lit B0
 *   J3 : j3.a [E3] -> j3.b -> j3.c ; nuit du J3 : DN (daté J4) lit D1
 *   J4 : j4.a route B1 (v2 -> j4.x [o0, o20] | sinon j4.y [o0, o1]) -> j4.r2 route BN (w2 -> j4.z [o0, o7] | sinon j4.w)
 *        -> j4.end (no -> nuit | kk -> j4.kk [K4])
 *   Chaînes : K (K1, K4 ; opensBy 4, lastDay 5), L (L1, L2 ; lastDay 2), B (B1, B0, BN ; lastDay 3), D (D0, D1, DN ; lastDay 5), E (E2, E3).
 *   Modes du J4 (muet 0, couloir 5..10, bavard >= 15) : couloir seulement par j4.z (BN = w2), bavard seulement par j4.x (B1 = v2).
 * Mémoire complète, ordre des visites (premières options d'abord) :
 *   - J1 = (k, x, d, …), J2 = j2.a=o : L2 absent -> guided.chainIncomplete (L, lastDay 2 <= 4) ;
 *   - premier J1 sans D1 : (k, x, m, …), J4 j4.end=no : DN absent, K4 absent -> aucun maillon au J4 -> guided.noLinkOnDay, perDayMin[4] = 0 ;
 *   - premier J1 sans K1 : (n, …), J4 j4.end=no : K fermée, exigée (opensBy 4) -> guided.chainNotOpened (K) ;
 *   - couloir et bavard atteints (w2 et v2 gardés) -> aucun guided.modeUnreachable.
 *   WEEK_CARRY_CODES = [chainIncomplete, noLinkOnDay, chainNotOpened] ; WEEK_CARRY_DAY4_MIN = 0.
 * Clause retirée, ce qui doit changer (les états fusionnés gardent le premier, celui des premières options) :
 *   (a) K ouverte et fermée fusionnent après le J1 -> plus de chainNotOpened ;
 *   (b) B1 et B0 perdent leur variante -> v2 et w2 jamais suivis -> modeUnreachable couloir et bavard au J4 ;
 *       (b, seule la récursion) B0 perd sa variante après le J1, BN la prend du représentant (w1) -> modeUnreachable couloir ;
 *   (c) L2 présent et absent fusionnent après le J2 -> plus de chainIncomplete ;
 *   (d) D1 présent et absent fusionnent après le J1 -> plus de noLinkOnDay, perDayMin[4] = 1.
 */
import { describe, expect, it } from 'vitest';
import crossUnknown from '../../fixtures/guided/cross-unknown.json';
import day2NoLink from '../../fixtures/guided/day2-no-link.json';
import factBible from '../../fixtures/guided/fact-bible.json';
import factUnsourced from '../../fixtures/guided/fact-unsourced.json';
import laneLink from '../../fixtures/guided/lane-link.json';
import lateWithoutAbsent from '../../fixtures/guided/late-without-absent.json';
import minimal from '../../fixtures/guided/minimal.json';
import modesNoBavard from '../../fixtures/guided/modes-no-bavard.json';
import noSilenceVariant from '../../fixtures/guided/no-silence-variant.json';
import recapAbsent from '../../fixtures/guided/recap-absent.json';
import textAbsent from '../../fixtures/guided/text-absent.json';
import threeChainsWeek from '../../fixtures/guided/three-chains-week.json';
import twoChainsWeek from '../../fixtures/guided/two-chains-week.json';
import weekCarry from '../../fixtures/guided/week-carry.json';
import weekMin from '../../fixtures/guided/week-min.json';
import weekOpensBy from '../../fixtures/guided/week-opens-by.json';
import weekRoute from '../../fixtures/guided/week-route.json';
import weekRouteBad from '../../fixtures/guided/week-route-bad.json';
import weekSeven from '../../fixtures/guided/week-seven.json';
import wide from '../../fixtures/guided/wide.json';
import { cat, realInput, w10Raw } from '../../fixtures/data/factories';
import { parseGuided, type GuidedData } from '../../../src/data/schema/guided';
import type { StreetData } from '../../../src/data/schema/street';
import { parseWorld } from '../../../src/data/schema/world';
import type { Issue } from '../../../src/shared/types/common';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import {
  mustOpenOf, pathsOf, proveGuided, refOf, validateGuided, type GuidedMemo, type GuidedPath, type GuidedRef,
} from '../../../src/validate/guided';
import { pairCover, pairsOfPath, routeConsistent, w10Street } from '../../support/guided';

type Raw = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON brut de fixture

/** Fixtures guidées de 4 jours au plus que le chargeur accepte (week-seven : 7 jours ; week-route-bad : refusée par le schéma). */
const ALL_FIXTURES: Readonly<Record<string, unknown>> = {
  'cross-unknown.json': crossUnknown, 'day2-no-link.json': day2NoLink, 'fact-bible.json': factBible, 'fact-unsourced.json': factUnsourced,
  'lane-link.json': laneLink, 'late-without-absent.json': lateWithoutAbsent, 'minimal.json': minimal, 'modes-no-bavard.json': modesNoBavard,
  'no-silence-variant.json': noSilenceVariant, 'recap-absent.json': recapAbsent, 'text-absent.json': textAbsent,
  'three-chains-week.json': threeChainsWeek, 'two-chains-week.json': twoChainsWeek, 'week-carry.json': weekCarry, 'week-min.json': weekMin,
  'week-opens-by.json': weekOpensBy, 'week-route.json': weekRoute, 'wide.json': wide,
};
const OTHERS: Readonly<Record<string, unknown>> = { 'week-seven.json': weekSeven };

const WEEK_SEVEN_VISITS = 63;
const WEEK_CARRY_CODES = ['guided.chainIncomplete', 'guided.noLinkOnDay', 'guided.chainNotOpened'];
const WEEK_CARRY_DAY4_MIN = 0;
/** `pathsOf(week-route, 2, 'projection')` : 27 finaux + 6 couverts. */
const WEEK_ROUTE_PATHS = 33;

const loadW10 = () => parseWorld(w10Raw, cat);

/** Le `street` de w10 portant la fixture `name` comme `guided`, validée par le chargeur réel. */
function streetWith(name: string): StreetData {
  return { ...w10Street, guided: parseGuided(structuredClone(ALL_FIXTURES[name] ?? OTHERS[name]), w10Street) };
}

/** Mots du jour par la somme des options narratives des actes `scene`, lues dans le `guided` du `street`. */
function wordsOf(street: StreetData): (day: DayIndex, acts: readonly ActRecord[]) => number {
  const words = new Map<string, number>();
  for (const s of street.guided?.scenes ?? []) if (s.ask.kind === 'narrative') for (const o of s.ask.options) words.set(`${s.id}.${o.id}`, o.words);
  return (day, acts) => acts.filter((a) => a.day === day && a.kind === 'scene').reduce((n, a) => n + (words.get(`${a.id}.${a.option}`) ?? 0), 0);
}
const refFor = (street: StreetData): GuidedRef =>
  ({ worldId: 'w10', hasKey: () => true, questionKeys: new Set(['Q04', 'Q11', 'Q16']), wordsOfDay: wordsOf(street) });
const lastDayOf = (street: StreetData): DayIndex => Math.max(...street.guided!.days.map((d) => d.day)) as DayIndex;

/** `proveGuided` jusqu'au dernier jour écrit, chaînes exigées comme `validateGuided`, mémoire forcée. w10 : référence réelle. */
function proveWith(street: StreetData, memo: GuidedMemo, ref: GuidedRef = refFor(street), through?: DayIndex) {
  const throughDay = through ?? lastDayOf(street);
  return proveGuided(street, { throughDay, mustOpen: mustOpenOf(street.guided!, throughDay), memo }, ref);
}

const codes = (r: { readonly issues: readonly Issue[] }): readonly string[] => r.issues.map((i) => i.code);
const opts2 = { throughDay: 2, mustOpen: [] } as const;

/** Tous les couples (étape, option) des données, comme `pairsOfPath` : options narratives, branches de route (`~*` compris), étapes sans question. */
function allPairs(street: StreetData): readonly string[] {
  const out = new Set<string>();
  for (const s of street.guided!.scenes) {
    const a = s.ask;
    if (a.kind === 'none') out.add(`j${s.day}:${s.id}`);
    if (a.kind === 'narrative') a.options.forEach((o) => out.add(`j${s.day}:${s.id}=${o.id}`));
    if (a.kind === 'route') [...Object.keys(a.next), '*'].forEach((b) => out.add(`j${s.day}:${s.id}~${b}`));
    if (a.kind === 'priced') throw new Error('allPairs : choix à prix hors de ce test');
  }
  return [...out].sort();
}
const pairsOf = (ps: readonly GuidedPath[]): readonly string[] => [...new Set(ps.flatMap(pairsOfPath))].sort();

/** L'entrée réelle dont w10 porte la fixture `name` comme `guided`. */
function inputWithGuided(name: string, patch: (g: Raw) => void = () => undefined) {
  const input = realInput();
  const w = input.worlds.find((x) => x.id === 'w10')!;
  const raw = structuredClone(ALL_FIXTURES[name]) as Raw;
  patch(raw);
  return { ...input, worlds: [{ ...w, street: { ...w.street, guided: parseGuided(raw, w10Street) } }] };
}

describe('validate : preuve de la semaine [plan rue guidée J3-J7, T3]', () => {
  it('test_projection_equals_full_marks_on_j1_j2', () => {   // Review Focus 1 : même verdict, mémoire complète contre projection
    const w10 = loadW10().street;
    // w10 est comparé sur J1-J2, comme le nom du test le dit : avec le J4 écrit (T10) la mémoire complète dépasse MARKS_MEMO_MAX_STATES après le J3
    // (mesuré, 'marks' lève), et c'est le signal voulu du plan (prendre 'projection'). Les fixtures de 4 jours au plus gardent la comparaison entière.
    const cases: readonly (readonly [string, StreetData, GuidedRef, DayIndex | undefined])[] = [
      ['w10', w10, refOf(realInput()), 2],
      ...Object.keys(ALL_FIXTURES).map((n) => { const st = streetWith(n); return [n, st, refFor(st), undefined] as const; }),
    ];
    for (const [name, st, ref, through] of cases) {
      const full = proveWith(st, 'marks', ref, through), proj = proveWith(st, 'projection', ref, through);
      expect({ name, codes: codes(proj) }).toEqual({ name, codes: codes(full) });
      expect({ name, proof: { ...proj.proof, paths: 0, visits: 0 } }).toEqual({ name, proof: { ...full.proof, paths: 0, visits: 0 } });
    }
  });
  it('test_week_carry_fixture_is_load_bearing', () => {   // [PHASE V] w10 J1-J2 et les fixtures de deux jours n'ont qu'une mise en commun
    const r = proveWith(streetWith('week-carry.json'), 'marks');
    expect(codes(r)).toEqual(WEEK_CARRY_CODES);
    expect(r.proof.perDayMin[4]).toBe(WEEK_CARRY_DAY4_MIN);
    expect(r.proof.modes[4]).toEqual(['muet', 'couloir', 'bavard']);
  });
  it('test_route_link_kept_in_projection', () => {
    const st = streetWith('week-route.json');
    const r = proveGuided(st, { throughDay: 2, mustOpen: [] }, refFor(st));
    expect(r.issues).toEqual([]);
    expect(r.proof.visits).toBe(36);
    const keys = pathsOf(st, 2, 'projection').map((p) => p.key);
    expect(keys).toHaveLength(WEEK_ROUTE_PATHS);
    expect(keys.filter((k) => k.includes('~'))).toEqual(expect.arrayContaining([expect.stringContaining('j2.wake~fille'), expect.stringContaining('j2.wake~*')]));
  });
  it('test_route_branch_contradicting_marks_is_dropped', () => {   // aucune clé « ~fille » sans marque fille la veille, aucune « ~* » avec
    const st = streetWith('week-route.json');
    const ps = pathsOf(st, 2, 'projection');
    for (const p of ps) expect(routeConsistent(st, p)).toBe(true);
    expect(ps.filter((p) => p.key.includes('j2.wake~fille')).every((p) => p.key.includes('j1.a=fille'))).toBe(true);
    expect(ps.filter((p) => p.key.includes('j2.wake~*')).every((p) => !p.key.includes('j1.a=fille'))).toBe(true);
  });
  it('test_route_on_later_link_is_named', () => {   // week-route-bad.json : j2.wake (420) lit R2, posé à j2.c (440) le même jour
    expect(() => parseGuided(structuredClone(weekRouteBad), w10Street)).toThrow(/n'est pas antérieur/);   // le schéma le refuse déjà
    const st = { ...w10Street, guided: structuredClone(weekRouteBad) as unknown as GuidedData };   // lu sans le schéma : le double contrôle
    expect(proveGuided(st, opts2, refFor(st)).issues).toContainEqual(expect.objectContaining({ code: 'guided.linkRef', path: 'street.guided.scenes.j2.wake.ask' }));
  });
  it('test_route_star_key_is_named', () => {   // une branche « * » serait masquée par `otherwise` (`leaveStep`, `ROUTE_OTHERWISE`)
    const st = streetWith('week-route.json');
    const wake = st.guided!.scenes.find((s) => s.id === 'j2.wake')!;
    const bad = { ...wake, ask: { ...wake.ask, next: { ...(wake.ask as { next: Record<string, string> }).next, '*': 'j2.daughter' } } } as typeof wake;
    const g = { ...st.guided!, scenes: st.guided!.scenes.map((s) => (s.id === 'j2.wake' ? bad : s)) };
    expect(proveGuided({ ...st, guided: g }, opts2, refFor(st)).issues)
      .toContainEqual(expect.objectContaining({ code: 'guided.linkRef', path: 'street.guided.scenes.j2.wake.ask.next.*' }));
    expect(codes(proveGuided(st, opts2, refFor(st)))).not.toContain('guided.linkRef');
  });
  it('test_linked_beat_unknown_variant_is_named', () => {   // S1 : `keys` hors des options du maillon
    const st = streetWith('week-min.json');
    const g = st.guided!;
    const scenes = g.scenes.map((s) => (s.id !== 'j2.b' ? s : { ...s, beats: [{ voice: 'person' as const, lit: null, byLink: { link: 'A1', keys: { zz: 'w10.x' }, otherwise: null } }] }));
    expect(proveGuided({ ...st, guided: { ...g, scenes } }, opts2, refFor(st)).issues)
      .toContainEqual(expect.objectContaining({ code: 'guided.linkRef', path: 'street.guided.scenes.j2.b.beats.0.byLink.zz' }));
    expect(codes(proveGuided(st, opts2, refFor(st)))).not.toContain('guided.linkRef');
  });
  it('test_ending_on_unknown_end_is_named', () => {   // week-min.json : `ending.outcomes` released, arrestedAudition
    const st = streetWith('week-min.json');
    const ref = { ...refFor(st), endIds: new Set(['arrested', 'arrestedAudition', 'recruited']) };
    expect(proveGuided(st, opts2, ref).issues).toContainEqual(expect.objectContaining({ code: 'guided.endingUnknown', path: 'street.guided.ending.outcomes.released' }));
    expect(codes(proveGuided(st, opts2, { ...ref, endIds: new Set([...ref.endIds, 'released']) }))).not.toContain('guided.endingUnknown');
    expect(refOf(realInput()).endIds).toEqual(new Set(['arrested', 'arrestedAudition', 'released', 'recruited']));   // w10 bilan.fate.ends
  });
  it('test_text_keys_read_name_and_ending_keys', () => {   // `nameKey` des variantes, toutes les clés de `ending`
    const st = streetWith('week-min.json');
    const paths = proveGuided(st, opts2, { ...refFor(st), hasKey: () => false }).issues.filter((i) => i.code === 'guided.keyMissing').map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['w10.name.A1.a', 'w10.end.released.regime', 'w10.end.released.n2', 'w10.end.arrestedNight', 'w10.end.weekButton']));
  });
  it('test_opens_by_delays_must_open', () => {   // C1 sur un chemin du J1 sur deux, aucun autre maillon de C d'ici le J2, opensBy 3
    const errs = (patch?: (g: Raw) => void) => validateGuided(inputWithGuided('week-opens-by.json', patch)).errors.map((e) => e.code);
    expect(errs()).not.toContain('guided.chainNotOpened');
    expect(errs((g) => { g.chains.find((c: Raw) => c.id === 'C').opensBy = null; })).toContain('guided.chainNotOpened');   // sans opensBy : exigée au J2
  });
  it('test_wide_memo_still_81', () => { const st = streetWith('wide.json'); expect(proveGuided(st, opts2, refFor(st)).proof.paths).toBe(81); });   // W1 est un dernier maillon : sa variante reste dans la projection
  it('test_marks_memo_refuses_the_week', () => {   // défaut au-delà du J2 : 'projection' (décision 2)
    const st = streetWith('week-seven.json');
    expect(() => pathsOf(st, 7, 'marks')).toThrow(/projection/);
    expect(pathsOf(st, 7).length).toBeGreaterThan(0);
  });
  it('test_seven_day_fixture_visits_bounded', () => {
    const st = streetWith('week-seven.json');
    const r = proveGuided(st, { throughDay: 7, mustOpen: [] }, refFor(st));
    expect(r.issues).toEqual([]);
    expect(r.proof.visits).toBe(WEEK_SEVEN_VISITS);
  });
  it('test_pair_cover_has_every_option_once', () => {
    const st = streetWith('week-route.json');
    const ps = pairCover(st, 2);
    expect(pairsOf(ps)).toEqual(allPairs(st));
    expect(ps.length).toBeLessThan(pathsOf(st, 2, 'projection').length);
  });
  // Mémoire 'marks' par défaut jusqu'au J2. N7 (requires de j2.agentReturn) : 18 états après le J1 × 156 chemins du J2 (312 avant, la
  // moitié portait la branche du jalon que le moteur ne joue pas) + 3 402 chemins du J1 couverts = 6 210 [mesuré ; 9 018 avant N7].
  it('test_j1j2_pins_unchanged', () => { expect(pathsOf(loadW10().street, 2).length).toBe(6210); });
});

describe('N7 : la preuve ne garde que les chemins que le moteur joue (I-1 minutes, I-2 requires, I-4 ifUnavailable)', () => {
  // Règle du moteur : `jalonDue` (`engine/moments/choices.ts`), lue par `pendingChoices` et par `walkDay`. Jalon dû : seule la branche `go` ;
  // jalon non dû : seule la branche `ifUnavailable` (ou la nuit), comme `present` puis `leaveStep(null)` au metteur en scène.
  const tokensOf = (p: GuidedPath, day: number): readonly string[] => p.key.split(' | ').find((k) => k.startsWith(`j${day}:`))!.slice(3).split('>');
  it('test_requires_of_agent_return_follows_the_component_choice', () => {   // w10.json : j2.agentReturn exige j2.component ∈ {keep, leaveVisible}
    for (const p of pathsOf(loadW10().street, 2)) {
      const t = tokensOf(p, 2);
      const due = t.includes('j2.component=keep') || t.includes('j2.component=leaveVisible');
      expect(t.includes('j2.agentReturn=go'), p.key).toBe(due);
      expect(t.includes('j2.agentReturn=-'), p.key).toBe(!due);
    }
  });
  it('test_always_due_jalon_has_no_unavailable_branch', () => {   // j4.door : requires null, sa scène pose `exit home` (waitsFor exitBuilding) : toujours dû
    const day4 = new Set(pathsOf(loadW10().street, 4).map((p) => tokensOf(p, 4).join('>')));
    expect([...day4].some((k) => k.includes('j4.door=-'))).toBe(false);
    expect([...day4].every((k) => k.includes('j4.door=go'))).toBe(true);
  });
  // I-1 : la voie comply ou courtesy dure `comply` porte ouverte, `closedGate` porte fermée (jauge, inconnue de la preuve). Fourchette :
  // deux horloges par jour (`acts` porte ouverte, `closedGateActs` porte fermée) ; une lecture de l'heure où elles divergent sépare le chemin.
  it('test_lane_range_forks_a_late_read_between_the_bounds', () => {
    // w10 retouché : j4.relecture (ancre 540) en retard après 560. Après comply à j4.checkpoint (475) : 535 -> 540 porte ouverte (à l'heure),
    // 595 porte fermée (en retard). Après buy:permission (10 min) : 540 dans les deux cas, pas de séparation.
    const raw = structuredClone(w10Raw) as Raw;
    const rel = raw.street.guided.scenes.find((x: Raw) => x.id === 'j4.relecture');
    rel.late = { afterMinute: 560, next: 'j4.evening', lineKey: 'w10.scene.j1.registre.lateLine' };
    const day4 = pathsOf(parseWorld(raw, cat).street, 4).filter((p) => p.key.includes('j4:'));
    const seg = (p: GuidedPath): string => p.key.split(' | ')[3]!;
    const comply = day4.filter((p) => seg(p).includes('checkpoint.j4=comply'));
    const onTime = comply.filter((p) => !seg(p).includes('j4.relecture@late'));
    const late = comply.filter((p) => seg(p).includes('j4.relecture@late'));
    expect(onTime.length).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(0);
    for (const p of onTime) expect(p.gates[4], p.key).toBe('open');
    for (const p of late) expect(p.gates[4], p.key).toBe('closed');
    const bought = day4.filter((p) => seg(p).includes('checkpoint.j4=buy:permission'));
    expect(bought.length).toBeGreaterThan(0);
    for (const p of bought) { expect(seg(p)).not.toContain('@late'); expect(p.gates[4]).toBeUndefined(); }
  });
  // w10 tel quel : J1 sans porte fermée possible ; J4, comply à 475, l'entrée au Registre (transit de j4.relecture, posé avant l'ancre 540)
  // tombe à 475 + 60 = 535 porte ouverte, 475 + 120 = 595 porte fermée.
  it('test_closed_gate_acts_carry_the_closed_gate_minutes', () => {
    const p = pathsOf(loadW10().street, 4).find((x) => x.key.includes('checkpoint.j4=comply'))!;
    const enter = (acts: readonly ActRecord[]) => acts.find((a) => a.day === 4 && a.kind === 'enter' && a.id === 'registre')!.minute;
    expect([enter(p.acts), enter(p.closedGateActs)]).toEqual([535, 595]);
    expect(p.closedGateActs.filter((a) => a.day === 1)).toEqual(p.acts.filter((a) => a.day === 1));
    expect(p.closedGateActs.map((a) => `${a.kind}:${a.id}:${a.option}`)).toEqual(p.acts.map((a) => `${a.kind}:${a.id}:${a.option}`));
  });
});
