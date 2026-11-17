import { describe, expect, it } from 'vitest';
import crossUnknown from '../../fixtures/guided/cross-unknown.json';
import day2NoLink from '../../fixtures/guided/day2-no-link.json';
import factBible from '../../fixtures/guided/fact-bible.json';
import factUnsourced from '../../fixtures/guided/fact-unsourced.json';
import lateWithoutAbsent from '../../fixtures/guided/late-without-absent.json';
import modesNoBavard from '../../fixtures/guided/modes-no-bavard.json';
import noSilenceVariant from '../../fixtures/guided/no-silence-variant.json';
import textAbsent from '../../fixtures/guided/text-absent.json';
import threeChainsWeek from '../../fixtures/guided/three-chains-week.json';
import twoChainsWeek from '../../fixtures/guided/two-chains-week.json';
import wide from '../../fixtures/guided/wide.json';
import { realInput } from '../../fixtures/data/factories';
import { parseGuided } from '../../../src/data/schema/guided';
import type { StreetData } from '../../../src/data/schema/street';
import type { Issue } from '../../../src/shared/types/common';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import { validateContent } from '../../../src/validate/content';
import { pathsOf, picksOf, proveGuided, refOf, validateGuided, type GuidedRef } from '../../../src/validate/guided';
import { replay } from '../../../src/engine/moments/replay';
import { w10Street } from '../../support/guided';
import { ctxW10 } from '../../support/street';

type Raw = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON brut de fixture

const FIXTURES: Readonly<Record<string, unknown>> = {
  'cross-unknown.json': crossUnknown, 'day2-no-link.json': day2NoLink, 'fact-bible.json': factBible, 'fact-unsourced.json': factUnsourced,
  'late-without-absent.json': lateWithoutAbsent, 'modes-no-bavard.json': modesNoBavard, 'no-silence-variant.json': noSilenceVariant,
  'text-absent.json': textAbsent, 'three-chains-week.json': threeChainsWeek, 'two-chains-week.json': twoChainsWeek, 'wide.json': wide,
};

/** Le `street` de w10 portant la fixture `name` comme `guided`, validée par le chargeur réel. */
function streetWith(name: string): StreetData {
  return { ...w10Street, guided: parseGuided(structuredClone(FIXTURES[name]), w10Street) };
}

/** Mots de chaque option narrative des fixtures, par `scène.option` ; une même clé ne porte jamais deux valeurs. */
const WORDS: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const [name, g] of Object.entries(FIXTURES)) for (const s of (g as Raw).scenes) {
    if (s.ask.kind !== 'narrative') continue;
    for (const o of s.ask.options) {
      const k = `${s.id}.${o.id}`;
      if (m.has(k) && m.get(k) !== o.words) throw new Error(`fixture ${name} : ${k} porte ${o.words} mots, ailleurs ${m.get(k)}`);
      m.set(k, o.words);
    }
  }
  return m;
})();
/** Somme des `words` des options des actes `scene` du jour `day`. */
function sumSceneWords(day: DayIndex, acts: readonly ActRecord[]): number {
  return acts.filter((a) => a.day === day && a.kind === 'scene').reduce((n, a) => n + (WORDS.get(`${a.id}.${a.option}`) ?? 0), 0);
}

const REF_ALL: GuidedRef = { worldId: 'w10', hasKey: () => true, questionKeys: new Set(['Q04', 'Q11', 'Q16']), wordsOfDay: sumSceneWords };
const opts2 = { throughDay: 2, mustOpen: [] } as const;
const issues = (r: { readonly issues: readonly Issue[] }): readonly Issue[] => r.issues;
const codes = (r: { readonly issues: readonly Issue[] }): readonly string[] => r.issues.map((i) => i.code);

describe('validate : preuve des chaînes sur toutes les suites de choix [plan rue guidée J1-J2, T4]', () => {
  it('test_path_without_link_on_a_day_is_named', () => { expect(codes(proveGuided(streetWith('day2-no-link.json'), opts2, REF_ALL))).toContain('guided.noLinkOnDay'); });
  it('test_missing_silence_variant_is_named', () => { expect(issues(proveGuided(streetWith('no-silence-variant.json'), opts2, REF_ALL))).toContainEqual(expect.objectContaining({ code: 'guided.variantMissing', path: expect.stringContaining('silent') })); });
  it('test_late_branch_has_variant_for_every_link', () => { expect(codes(proveGuided(streetWith('late-without-absent.json'), opts2, REF_ALL))).toContain('guided.variantMissing'); });
  it('test_proof_walks_late_branch_even_when_on_time', () => {
    // late-without-absent.json : j1.roux (ancre 430, late après 430) n'est jamais en retard à l'heure, la preuve prend quand même la branche.
    // J1 : à l'heure 3 × 2 = 6 chemins, 6 états ; en retard (j1.roux.late, 2 options) 2 × 2 = 4 chemins, 4 états (C1 nod ou rien, B1). J2 : 10 × 6 = 60.
    const r = proveGuided(streetWith('late-without-absent.json'), { ...opts2, memo: 'marks' }, REF_ALL);   // états comptés en mémoire complète (la projection en garde moins : 30)
    expect(r.proof.paths).toBe(60);   // sans la branche late : 6 × 6 = 36
    expect(pathsOf(streetWith('late-without-absent.json'), 2).some((p) => p.key.includes('@late'))).toBe(false);   // pathsOf : late seulement quand l'heure le dit
  });
  it('test_three_complete_chains_required_at_day_seven', () => { expect(codes(proveGuided(streetWith('two-chains-week.json'), { throughDay: 7, mustOpen: [] }, REF_ALL))).toContain('guided.fewCompleteChains'); expect(codes(proveGuided(streetWith('three-chains-week.json'), { throughDay: 7, mustOpen: [] }, REF_ALL))).toEqual([]); });
  it('test_unsourced_fact_is_named', () => {   // fact-unsourced.json : chaîne A, `fact.source: 'wikipedia'` ; fact-bible.json : `fact.source: 'bible w10 §1.5'`
    expect(issues(proveGuided(streetWith('fact-unsourced.json'), opts2, REF_ALL))).toContainEqual(expect.objectContaining({ code: 'guided.factUnsourced', path: expect.stringContaining('A') }));
    expect(codes(proveGuided(streetWith('fact-bible.json'), opts2, REF_ALL))).not.toContain('guided.factUnsourced');
    expect(codes(proveGuided(streetWith('fact-bible.json'), opts2, { ...REF_ALL, worldId: 'w11' }))).toContain('guided.factUnsourced');   // « bible w10 § » n'est pas la bible de w11
  });
  it('test_cross_must_name_existing_and_no_unknown', () => {   // cross-unknown.json : A `crosses: ['B', 'Z']`, B `crosses: ['A']`
    expect(issues(proveGuided(streetWith('cross-unknown.json'), opts2, REF_ALL))).toContainEqual(expect.objectContaining({ code: 'guided.crossMissing', path: expect.stringContaining('Z') }));
    expect(issues(proveGuided(streetWith('cross-unknown.json'), opts2, REF_ALL)).filter((i) => i.code === 'guided.crossMissing')).toHaveLength(1);
  });
  it('test_missing_key_and_unknown_question_are_named', () => {   // fixture text-absent.json : le texte w10.chain.A.A1.laugh manque, la question de la chaîne vaut Q99 (inconnue)
    const r = proveGuided(streetWith('text-absent.json'), opts2, { ...REF_ALL, hasKey: (k) => k !== 'w10.chain.A.A1.laugh' });
    expect(issues(r)).toContainEqual(expect.objectContaining({ code: 'guided.keyMissing', path: expect.stringContaining('w10.chain.A.A1.laugh') }));
    expect(codes(r)).toContain('guided.questionUnknown');
  });
  it('test_every_day_reaches_each_speech_mode', () => {   // modes-no-bavard.json : J1, deux étapes narratives, options [0, 8, 14] puis [0, 6, 20] ; speechModes[1] = { muet: 0, couloir: [10, 20], bavard: 40 } : totaux possibles 0..34, bavard (>= 40) inatteignable
    const r = proveGuided(streetWith('modes-no-bavard.json'), { throughDay: 1, mustOpen: [] }, REF_ALL);
    expect(issues(r)).toContainEqual(expect.objectContaining({ code: 'guided.modeUnreachable', path: expect.stringMatching(/1.*bavard/) }));
    expect(r.proof.modes[1]).toEqual(['muet', 'couloir']);   // 0 (muet) et 14 ou 20 (couloir)
    const ok = proveGuided(streetWith('modes-no-bavard.json'), { throughDay: 1, mustOpen: [] }, { ...REF_ALL, wordsOfDay: (d, a) => sumSceneWords(d, a) * 2 });   // totaux 0..68 : 40 atteint par 14 + 6 = 20, doublé
    expect(codes(ok)).not.toContain('guided.modeUnreachable'); expect(ok.proof.modes[1]).toEqual(['muet', 'couloir', 'bavard']);
  });
  it('test_memo_by_link_state_bounds_work', () => { expect(proveGuided(streetWith('wide.json'), opts2, REF_ALL).proof.paths).toBe(81); });
  // wide.json : chaque jour, trois étapes narratives en série à 3 options, toutes vers l'étape suivante ; seule la 1re étape du J1 porte un maillon (W1).
  // J1 : 3 × 3 × 3 = 27 chemins, 3 états de maillons distincts. J2 relancé une fois par état : 3 × 27 = 81 chemins complets. Sans mémoire : 27 × 27 = 729.

  it('test_must_open_chain_closed_on_a_path_is_named', () => {   // C ne s'ouvre que sur la branche `late` de j1.roux
    expect(issues(proveGuided(streetWith('late-without-absent.json'), { throughDay: 2, mustOpen: ['A', 'C'] }, REF_ALL)))
      .toContainEqual(expect.objectContaining({ code: 'guided.chainNotOpened', path: expect.stringContaining('C') }));
  });
  it('test_proof_counts_links_and_opened_chains', () => {
    const r = proveGuided(streetWith('three-chains-week.json'), { throughDay: 2, mustOpen: ['A', 'B', 'E'] }, REF_ALL);
    expect(r.issues).toEqual([]);
    expect(r.proof).toMatchObject({ paths: 36, perDayMin: { 1: 3, 2: 3 }, opened: ['A', 'B', 'E'], completeMin: 3 });   // J1 : 3 × 2 = 6 chemins, 6 états ; J2 : 6 × 3 × 2 = 36
  });
  it('test_incomplete_chain_is_named_once_its_last_day_is_proved', () => {
    expect(codes(proveGuided(streetWith('day2-no-link.json'), opts2, REF_ALL))).not.toContain('guided.chainIncomplete');
    const g = structuredClone(threeChainsWeek) as Raw;
    g.chains.find((c: Raw) => c.id === 'B').links.find((l: Raw) => l.id === 'B2').at = { kind: 'scene', id: 'j2.street' };   // B2 sur j2.street : variantes answer/nod/ignore, aucune pour straight/talk
    const st = { ...w10Street, guided: parseGuided(g, w10Street) };
    expect(codes(proveGuided(st, opts2, REF_ALL))).toEqual(expect.arrayContaining(['guided.chainIncomplete', 'guided.variantMissing']));
  });
  it('test_stage_count_outside_three_to_five_is_named', () => {
    const g = structuredClone(twoChainsWeek) as Raw;
    g.scenes.find((s: Raw) => s.id === 'j2.street').stage = 'landing';   // J2 : home, landing, landing = 2 scènes
    expect(issues(proveGuided({ ...w10Street, guided: parseGuided(g, w10Street) }, opts2, REF_ALL)))
      .toContainEqual(expect.objectContaining({ code: 'guided.stageCount', path: expect.stringContaining('2') }));
  });
  it('test_equal_minute_scene_cycle_is_rejected', () => {
    const g = structuredClone(twoChainsWeek) as Raw;
    const street = g.scenes.find((s: Raw) => s.id === 'j1.street');
    street.anchorMinute = 430;
    street.ask.options[0].next = 'j1.roux';   // j1.roux (430) -> j1.street (430) -> j1.roux : même minute, boucle
    const st = { ...w10Street, guided: parseGuided(g, w10Street) };
    expect(codes(proveGuided(st, opts2, REF_ALL))).toContain('guided.sceneCycle');
    expect(() => pathsOf(st, 2)).toThrow(/boucle/);
  });

  it('test_paths_of_carry_complete_engine_acts', () => {
    const ps = pathsOf(streetWith('two-chains-week.json'), 2);
    expect(ps).toHaveLength(36);
    const p = ps.find((x) => x.key.includes('j1.roux=silent') && x.key.includes('j2.marlene=ignore'))!;
    expect(p.acts.filter((a) => a.kind === 'sleep').map((a) => [a.day, a.minute])).toEqual([[1, w10Street.moments.eveningMinute], [2, w10Street.moments.eveningMinute]]);
    expect(p.acts.find((a) => a.kind === 'scene' && a.id === 'j1.roux')).toEqual({ day: 1, minute: 430, kind: 'scene', id: 'j1.roux', option: 'silent' });
    expect(p.acts.find((a) => a.kind === 'scene' && a.id === 'j1.street')!.minute).toBe(440);   // sortie de j1.roux à 433, ancre 440
    expect(new Set(ps.map((x) => x.key)).size).toBe(ps.length);
  });
  it('test_paths_of_replay_in_the_engine_through_checkpoint_and_registre', () => {
    // two-chains-week + J1 : sortie du logement à j1.street, voie checkpoint.j1 à 445, Registre à 510 (late après 510), m4.list.
    const g = structuredClone(twoChainsWeek) as Raw;
    const st1 = g.scenes.find((s: Raw) => s.id === 'j1.street');
    st1.transit = [{ kind: 'exit', id: 'home' }];
    st1.ask.options.forEach((o: Raw) => { o.next = 'j1.checkpoint'; });
    const lanes = ['comply', 'buy:permission', 'buy:bons', 'buy:component', 'bypass', 'courtesy'];
    const scene = (id: string, stage: string, anchorMinute: number, costMin: number, ask: Raw, extra: Raw = {}): Raw =>
      ({ id, day: 1, stage, place: `${stage}.spot`, anchorMinute, costMin, late: null, actor: null, beats: [], ask, transit: [], waitKind: 'none', ...extra });
    g.scenes.push(
      scene('j1.checkpoint', 'street', 445, 0, { kind: 'priced', choiceId: 'checkpoint.j1', next: { ...Object.fromEntries(lanes.map((l) => [l, 'j1.registre'])), refuse: 'night' }, ifUnavailable: null }),
      scene('j1.registre', 'registre', 510, 30, { kind: 'priced', choiceId: 'm4.list', next: { read: 'night', pass: 'night' }, ifUnavailable: null },
        { transit: [{ kind: 'enter', id: 'registre' }], late: { afterMinute: 510, next: 'j1.registre.late', lineKey: 'w10.scene.j1.registre.late' } }),
      scene('j1.registre.late', 'registre', 511, 0, { kind: 'none', next: 'night' }, { transit: [{ kind: 'enter', id: 'registre' }] }),
    );
    const st = { ...w10Street, guided: parseGuided(g, w10Street) };
    const ctx = ctxW10(st);   // dé à [0] : le contournement est libre, sans patrouille
    const ps = pathsOf(st, 2);
    const comply = ps.find((p) => p.key.includes('checkpoint.j1=comply') && !p.key.includes('@late'))!;
    expect(comply.acts.filter((a) => a.day === 1 && ['exit', 'enter', 'lane', 'choice', 'sleep'].includes(a.kind)).map((a) => `${a.minute} ${a.kind} ${a.id}`))
      .toEqual(['433 exit home', '445 lane checkpoint', '505 enter registre', '510 choice m4.list', '540 exit registre', '540 enter home', `${w10Street.moments.eveningMinute} sleep night`]);
    const r = replay(comply.acts, ctx);
    expect(r.rejected).toEqual([]); expect(r.state.day).toBe(3);
    const bypass = ps.find((p) => p.key.includes('checkpoint.j1=bypass'))!;
    expect(bypass.key).toContain('j1.registre@late');   // 445 + 90 = 535 > 510
    expect(replay(bypass.acts, ctx).rejected).toEqual([]);
    expect(ps.some((p) => p.key.includes('checkpoint.j1=comply') && p.key.includes('@late'))).toBe(false);   // pathsOf ne prend `late` que quand l'heure le dit
    expect(codes(proveGuided(st, opts2, REF_ALL))).not.toContain('guided.stageCount');
  });
  it('test_paths_of_keeps_every_day_choice_dropped_by_the_memo', () => {
    // wide.json : 27 chemins du J1, 3 états ; 24 chemins du J1 écartés par la mémoire, menés au bout par le premier chemin du J2.
    const ps = pathsOf(streetWith('wide.json'), 2);
    expect(ps).toHaveLength(81 + 24);
    const firstJ2 = 'j2:j2.wa=x0>j2.wb=x0>j2.wc=x0';
    expect(ps.find((p) => p.key === `j1:j1.wa=x0>j1.wb=x9>j1.wc=x5 | ${firstJ2}`)).toBeDefined();   // chemin du J1 écarté (même état que x0>x0>x0)
    expect(new Set(ps.map((p) => p.key.split(' | ')[0])).size).toBe(27);
  });
  it('test_picks_of_reads_back_every_option', () => {
    const p = pathsOf(streetWith('two-chains-week.json'), 2)[0]!;
    expect(picksOf(p)).toEqual({ 'j1.roux': 'laugh', 'j1.street': 'straight', 'j2.marlene': 'answer', 'j2.street': 'straight' });
  });
  it('test_validate_guided_reports_errors_and_is_wired_in_content', () => {
    const input = realInput();
    expect(validateGuided(input)).toEqual({ errors: [], warnings: [] });   // w10 ne porte pas encore de `guided`
    const w = input.worlds.find((x) => x.id === 'w10')!;
    const withGuided = { ...input, worlds: [{ ...w, street: { ...w.street, guided: parseGuided(structuredClone(day2NoLink), w10Street) } }] };
    expect(validateGuided(withGuided).errors.map((i) => i.code)).toContain('guided.noLinkOnDay');
    expect(validateContent(withGuided).errors.map((i) => i.code)).toContain('guided.noLinkOnDay');
  });
  it('test_ref_of_reads_strings_and_questionnaire_of_the_input', () => {
    const input = realInput();
    const ref = refOf(input);
    expect(ref.worldId).toBe('w10');
    expect(ref.questionKeys.has('Q11')).toBe(true);
    expect(ref.hasKey(Object.keys(input.strings.fr)[0]!)).toBe(true);
    expect(ref.hasKey('w10.nope.never')).toBe(false);
  });
});
