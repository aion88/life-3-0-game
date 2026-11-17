/**
 * Semaine guidée de w10, jour par jour [plan rue guidée J3-J7, gabarit commun T9 à T13 ; conception 2026-11-05 §3, §4, §6].
 * Un `describe` par jour écrit : la preuve jusqu'à ce jour (maillon chaque jour, trois modes de parole, chaînes exigées ouvertes), le
 * contenu valide, le rejeu par le metteur en scène des chemins couverts, la fin après le jour, une personne dans chaque scène hors logement.
 * Contenu PROVISOIRE (writer, narrative-director, world-builder) ; les prix de la bible sont figés par `w10-choices-before.json`.
 */
import { describe, expect, it } from 'vitest';
import { parseWorld } from '../../../src/data/schema/world';
import { proveGuided, picksOf, refOf, type GuidedPath } from '../../../src/validate/guided';
import { validateContent } from '../../../src/validate/content';
import type { Issue } from '../../../src/shared/types/common';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import type { StreetState } from '../../../src/engine/moments/types';
import { lanesOpen } from '../../../src/engine/moments/checkpoint';
import { replay } from '../../../src/engine/moments/replay';
import { eveningRecap } from '../../../src/engine/moments/recap';
import { buildLedger } from '../../../src/engine/moments/words';
import { relectureLineOf } from '../../../src/engine/moments/bilan';
import { weekChains } from '../../../src/bilan/chains';
import frJson from '../../../src/data/strings/fr.json';
import enJson from '../../../src/data/strings/en.json';
import W10_CHOICES_BEFORE from '../../fixtures/guided/w10-choices-before.json';
import SAVE_PLAN_J1J2 from '../../fixtures/guided/save-plan-j1j2.json';
import { cat, realInput, w10Raw } from '../../fixtures/data/factories';
import { ctxW10, loadMeta } from '../../support/street';
import { createI18n } from '../../../src/i18n/i18n';
import { narrationOf } from '../../../src/street/ui/outcome';
import { modeWords } from '../../support/narrative_words_grid';
import {
  COULOIR_PICKS, dayPathCount, directorRig, engineActsOf, mustOpenOf, nightValue, outcomeOf, pairCover, pathOf, playPath, playPicks,
  rejectedBeforeEnd, rejectedOf, sceneIdsOf, stateAfter, stateAt, stateAtEvening, stepOnce, withNightBelow, type DirectorRig,
} from '../../support/guided';

const FR = frJson as Record<string, string>;
const EN = enJson as Record<string, string>;
const loadW10 = () => parseWorld(w10Raw, cat);
const codes = (r: { readonly issues: readonly Issue[] }): readonly string[] => r.issues.map((i) => i.code);

/** Pourquoi le panneau n'offre pas une voie du contrôle : lu dans l'état du moteur, même règle que `availableOptions` (`choices.ts`). */
function laneClosedBy(st: StreetState, option: string): string {
  if (option === 'buy:bons') return `bons ${st.bons} < ${ctxW10().street.checkpoint.bonsPrice[st.flags.gateClosed === true ? 'closedGate' : 'normal']}`;
  if (option === 'buy:component') return `composant ${st.kit['component'] ?? 'absent'}`;
  if (option === 'courtesy') return lanesOpen(st, ctxW10()).includes('courtesy') ? 'palier courtesy ouvert' : 'palier sans courtoisie';
  return 'cause inconnue';
}

/**
 * Joue le chemin couvert `p` au metteur en scène, horloge vive (porte fermée et patrouille tirées au dé comprises, ce que les minutes
 * nominales de `pathsOf` ne portent pas). Chaque choix prend l'option du chemin si le panneau l'offre ; sinon la première offerte, et la
 * SUBSTITUTION est rendue avec sa cause (`checkpoint.j3 buy:bons -> comply : bons 0 < 16`) : le test affirme leur liste exacte.
 */
function playCover(r: DirectorRig, p: GuidedPath): { readonly played: ReadonlySet<string>; readonly substituted: readonly string[] } {
  const picks = picksOf(p);
  const played = new Set<string>();
  const substituted: string[] = [];
  for (let i = 0; i < 2000; i++) {
    const b = r.dir.current();
    if (b.kind === 'demoEnd' || b.kind === 'end') return { played, substituted };
    if (b.kind !== 'choice') { r.dir.advance(); continue; }
    const want = picks[b.view.id];
    const offered = b.view.options.some((o) => o.id === want);
    const opt = offered ? want! : b.view.options[0]!.id;
    if (want !== undefined && !offered) substituted.push(`${b.view.id} ${want} -> ${opt} : ${laneClosedBy(r.drv.state().street, want)}`);
    if (b.priced) r.drv.designate(b.view.id, opt);
    const res = r.dir.choose(opt);
    if (!res.ok) throw new Error(`playCover : ${b.view.id}=${opt} refusé (${res.rejected.reason})`);
    played.add(`${b.sceneId}=${opt}`);
  }
  throw new Error('playCover : plus de 2000 temps');
}

/**
 * Substitutions attendues sur `pairCover(w10, 3)` [mesuré, T9 round 1] : 7 sur 805 choix, toutes aux voies du contrôle. Causes lues dans
 * l'état, pas la porte fermée (elle ne fait que passer le prix des bons de 8 à 16) : aucun acte ne crédite de bons (`state.ts:212` les
 * débite seulement ; `m2.nadia buy` n'en donne pas), le composant est saisi au J2 sur ces chemins, le palier n'est pas la courtoisie.
 */
const EXPECTED_SUBSTITUTIONS: readonly string[] = [
  'checkpoint.j1 buy:bons -> comply : bons 0 < 8',
  'checkpoint.j2 buy:bons -> comply : bons 0 < 8',
  'checkpoint.j2 buy:component -> comply : composant seized',
  'checkpoint.j2 courtesy -> comply : palier sans courtoisie',
  'checkpoint.j3 buy:bons -> comply : bons 0 < 16',
  'checkpoint.j3 buy:component -> comply : composant seized',
  'checkpoint.j3 courtesy -> comply : palier sans courtoisie',
];

/**
 * Suites des J1-J2 qui ouvrent une voie au contrôle du J3 [mesuré sur `pathsOf(w10, 2)` joués au metteur en scène, T9 round 1] :
 * `courtesy` (palier courtoisie au matin du J3), `buy:component` (composant gardé : laissé au J1, gardé au J2).
 */
const OPENS_J3_LANE: Readonly<Record<'courtesy' | 'buy:component', Readonly<Record<string, string>>>> = {
  courtesy: {
    'j1.phone': 'take', 'j1.component': 'take', 'j1.roux': 'laugh', 'j1.marlene': 'nod', 'j1.street': 'straight', 'checkpoint.j1': 'comply',
    'm4.list': 'read', 'relecture.j1': 'flag', 'j2.component': 'declare', 'j2.marlene': 'talk', 'checkpoint.j2': 'bypass', 'relecture.j2': 'flag', 'j2.agentReturn': 'go',
  },
  'buy:component': {
    'j1.phone': 'take', 'j1.component': 'leave', 'j1.roux': 'laugh', 'j1.marlene': 'answer', 'j1.street': 'straight', 'checkpoint.j1': 'comply',
    'm4.list': 'read', 'relecture.j1': 'flag', 'j2.component': 'keep', 'j2.marlene': 'talk', 'checkpoint.j2': 'buy:permission', 'relecture.j2': 'flag', 'j2.agentReturn': 'go',
  },
};

/**
 * Clés des temps `line` du jour `day` (de sa carte à son relevé, non compris), joués par le metteur en scène sur le chemin couloir que
 * `picks` amende (le chemin couloir n'est arrêté par la jauge à aucune des nuits écrites, `test_j4_couloir_night_values_recorded`).
 */
function linesOfDay(day: DayIndex, picks: Readonly<Record<string, string>>): readonly string[] {
  const r = directorRig();
  const seen = playPath(r, { ...COULOIR_PICKS, ...picks }, (b) => b.kind === 'recap' && b.day === day);
  const from = seen.findIndex((b) => b.kind === 'card' && b.day === day);
  if (from < 0) throw new Error(`linesOfDay : pas de carte du jour ${day}`);
  return seen.slice(from).flatMap((b) => (b.kind === 'line' ? [b.key] : []));
}

/** Joue chaque chemin de `pairCover(w10, day)` (`playCover`) : couples narratifs joués, substitutions rendues avec leur cause. */
function coverRun(day: DayIndex): { readonly played: ReadonlySet<string>; readonly substituted: readonly string[]; readonly rejected: readonly string[] } {
  const played = new Set<string>();
  const substituted: string[] = [];
  const rejected: string[] = [];
  for (const p of pairCover(loadW10().street, day)) {
    const r = directorRig();
    const run = playCover(r, p);
    run.played.forEach((x) => played.add(x));
    substituted.push(...run.substituted);
    rejected.push(...rejectedBeforeEnd(rejectedOf(r)).map((x) => `${p.key} : ${x.reason}`));
  }
  return { played, substituted, rejected };
}

/** Couples (scène narrative, option) d'un jour : ceux que le joueur choisit toujours librement. */
const narrativePairs = (day: DayIndex): readonly string[] =>
  loadW10().street.guided!.scenes.filter((s) => s.day === day && s.ask.kind === 'narrative')
    .flatMap((s) => (s.ask.kind === 'narrative' ? s.ask.options.map((o) => `${s.id}=${o.id}`) : []));

describe('guided w10 : jour 3 (mercredi chômé, chaîne C)', () => {
  it('test_j3_proves_through_day_3', () => {
    const r = proveGuided(loadW10().street, { throughDay: 3, mustOpen: mustOpenOf(3) }, refOf(realInput()));
    expect(r.issues).toEqual([]);
    expect(r.proof.modes[3]).toEqual(['muet', 'couloir', 'bavard']);
    expect(r.proof.perDayMin[3]).toBeGreaterThanOrEqual(1);
  });
  it('test_j3_content_valid', () => { expect(validateContent(realInput()).errors).toEqual([]); });
  it('test_j3_cover_replays_without_rejection', () => {
    const played = new Set<string>();
    const substituted: string[] = [];
    for (const p of pairCover(loadW10().street, 3)) {
      const r = directorRig();
      const run = playCover(r, p);
      run.played.forEach((x) => played.add(x));
      substituted.push(...run.substituted);
      expect(rejectedBeforeEnd(rejectedOf(r)), p.key).toEqual([]);
    }
    for (const pair of narrativePairs(3)) expect(played, pair).toContain(pair);   // chaque option du J3 jouée au moins une fois
    expect([...substituted].sort()).toEqual(EXPECTED_SUBSTITUTIONS);   // toute autre substitution, ou une autre cause, casse ici
  });
  it.each(['courtesy', 'buy:component'] as const)('test_j3_checkpoint_lane_%s_played_when_open', (lane) => {
    const r = directorRig();
    playPath(r, { ...OPENS_J3_LANE[lane], 'j3.pylone': 'recite', 'j3.after': 'cantine' }, (b) => b.kind === 'choice' && b.view.id === 'checkpoint.j3');
    const b = r.dir.current();
    expect(b.kind === 'choice' ? b.view.options.map((o) => o.id) : []).toContain(lane);
    playPath(r, { 'checkpoint.j3': lane });
    expect(r.sink.saved).toContainEqual(expect.objectContaining({ day: 3, kind: 'lane', option: lane }));
    expect(r.sink.saved).toContainEqual(expect.objectContaining({ day: 3, kind: 'scene', id: 'j3.cantine' }));   // la voie mène à la cantine
    expect(r.dir.current().kind).toBe('end');   // la semaine va au J7 (T13)
    expect(rejectedOf(r)).toEqual([]);
  });
  it('test_j3_couloir_night_value_recorded', () => {   // signal précoce de T14 (`test_couloir_week_is_released`) : valeur de la nuit 3 du chemin couloir
    // N8 : la file du contrôle compte une consigne, +2 chaque nuit d'un jour à file ; le couloir passe la file J1 à J6, donc +2, +4, ... +12 en cumul sur 51, 50, 59, 49, 40, 29 (avant N8)
    // actes du metteur en scène (horloge vive), pas `pathOf` : aux minutes nominales, le moteur refuse la cantine à 780 quand la porte du
    // contrôle est tirée fermée au J3 (120 min au lieu de 60, `checkpoint.minutes.closedGate`) [mesuré sur `pairCover(w10, 3)`, T9]
    const r = directorRig();
    playPath(r, COULOIR_PICKS);
    expect([1, 2, 3].map((d) => nightValue({ acts: r.sink.saved }, d as DayIndex, ctxW10()))).toMatchInlineSnapshot(`
      [
        53,
        54,
        65,
      ]
    `);
  });
  it('test_j3_every_scene_has_a_person_or_is_home', () => {
    for (const s of loadW10().street.guided!.scenes.filter((x) => x.day === 3)) {
      if (s.actor === null) { expect(s.stage, s.id).toBe('home'); continue; }
      expect(FR[s.actor.nameKey], s.id).toBeTruthy(); expect(FR[s.actor.actionKey], s.id).toBeTruthy();
    }
  });
  it('test_priced_prices_unchanged', () => { expect(loadW10().street.choices).toEqual(W10_CHOICES_BEFORE); });

  it('test_j3_chain_c_opens_by_day_five_not_three', () => {
    const r = proveGuided(loadW10().street, { throughDay: 3, mustOpen: mustOpenOf(3) }, refOf(realInput()));
    expect(mustOpenOf(3)).not.toContain('C');
    expect(r.issues).toEqual([]);
  });
  it('test_j3_three_or_four_scenes', () => {
    expect(codes(proveGuided(loadW10().street, { throughDay: 3, mustOpen: [] }, refOf(realInput())))).not.toContain('guided.stageCount');
  });
  it('test_j3_letter_keep_says_its_price', () => { expect(FR['w10.price.m3.letter.keep']).toBeTruthy(); });   // conception §4.1, dit avant confirmation (D136)
  it('test_j3_day_paths_counted', () => { expect(dayPathCount(loadW10().street, 3)).toBe(198); });   // pylône 3 × (banc 2 × 3 + cantine (6 × 3 × 3 + 3) + rentrer 3) [mesuré = inféré]

  it('test_week_chains_end_on_day_seven', () => {   // conception §3.3, §3.4
    const chains = Object.fromEntries(loadW10().street.guided!.chains.map((c) => [c.id, c] as const));
    expect(Object.keys(chains).sort()).toEqual(['A', 'B', 'C', 'E']);
    for (const id of ['A', 'B', 'C', 'E']) expect(chains[id]!.lastDay, id).toBe(7);
    expect(chains.A!.crosses).toEqual(['B', 'C']);
    expect(chains.B!.crosses).toEqual(['A', 'C', 'E']);
    expect(chains.C!.crosses).toEqual(['A', 'B', 'E']);
    expect(chains.E!.crosses).toEqual(['B', 'C']);
    expect(chains.C).toMatchObject({ opensBy: 5, question: { key: 'Q05' }, fact: { source: 'research/precedents-10-12-collapses.md:55' } });
    expect(chains.C!.links[0]!.id).toBe('C1');
  });
  it('test_given_names_carry_their_name_key', () => {   // décision 6 du plan : {noms} lu dans les données
    const link = (id: string) => loadW10().street.guided!.chains.flatMap((c) => c.links).find((l) => l.id === id)!;
    expect(link('B3w').variants.theodore!.nameKey).toBe('w10.recap.noms.theodore');
    expect(link('B3w').variants.nadia!.nameKey).toBe('w10.recap.noms.nadia');
    expect(link('B3w').absent.nameKey).toBeNull();
    expect(link('E2').variants.declare!.nameKey).toBe('w10.recap.noms.blank');
    expect(FR['w10.recap.noms.blank']).toBe('une ligne vide');
  });
  it('test_j3_cantine_enters_no_registre', () => {   // Registre fermé le J3 (`registre.closedDays` [3, 7])
    const st = loadW10().street;
    expect(st.registre.closedDays).toContain(3);
    expect(st.guided!.scenes.find((s) => s.id === 'j3.cantine')!.transit).toEqual([]);
  });
  it('test_said_lines_carry_no_digit', () => {   // `street.recap.said` reçoit la ligne en paramètre `text` : un chiffre y lève en dev (i18n numeric-param), et V8 refuse numericParams sous voice
    const said = loadW10().street.guided!.chains.flatMap((c) => c.links).flatMap((l) => [l.absent, ...Object.values(l.variants)]).flatMap((v) => (v.saidKey === null ? [] : [v.saidKey]));
    for (const k of said) { expect(FR[k], k).not.toMatch(/\d/); expect(EN[k], k).not.toMatch(/\d/); }
  });
  it('test_j3_english_is_translated_not_copied', () => {   // défaut connu de J1-J2 : une jumelle EN copiée du FR
    const keys = Object.keys(FR).filter((k) => /^w10\.(scene\.j3|recap\.(A3|B3|B3w|C1|E4)|chain\.C|fact\.C)\./.test(k));
    expect(keys.length).toBeGreaterThan(60);
    const NAMES = new Set(['Théodore', 'Nadia', 'Bruno Dufour']);
    for (const k of keys) { expect(EN[k], k).toBeTruthy(); if (!NAMES.has(FR[k]!)) expect(EN[k], k).not.toBe(FR[k]); }
  });
});

/**
 * Substitutions attendues sur `pairCover(w10, 4)` [mesuré, T10] : celles du J3, rejouées à l'identique sur les J1-J3, plus trois au contrôle
 * du J4, mêmes causes lues dans l'état. `buy:bons` n'est jamais offert : aucun acte ne crédite de bons (défaut moteur signalé en T9,
 * enquête en cours, non corrigé ici) ; le prix lu est 16, porte tirée fermée au J4 sur ce chemin. `courtesy` et `buy:component` sont
 * offerts au J4 sur les chemins de `OPENS_J4_LANE` (`test_j4_checkpoint_lane_*_played_when_open`).
 */
const EXPECTED_SUBSTITUTIONS_J4: readonly string[] = [
  ...EXPECTED_SUBSTITUTIONS,
  'checkpoint.j4 buy:bons -> comply : bons 0 < 16',
  'checkpoint.j4 buy:component -> comply : composant seized',
  'checkpoint.j4 courtesy -> comply : palier sans courtoisie',
].sort();

/**
 * Suites des J1-J3 qui ouvrent une voie au contrôle du J4 [mesuré, T10, 90 suites du J3 jouées après `OPENS_J3_LANE.courtesy` : 33 gardent
 * la courtoisie au J4, toutes avec le nom donné à Marlène] : `courtesy` = J1-J2 de `OPENS_J3_LANE` puis le J3 couloir (nom donné) ;
 * `buy:component` = J1-J2 de `OPENS_J3_LANE` puis un J3 qui ne passe pas par le contrôle (le composant reste gardé).
 */
const OPENS_J4_LANE: Readonly<Record<'courtesy' | 'buy:component', Readonly<Record<string, string>>>> = {
  courtesy: { ...OPENS_J3_LANE.courtesy, 'j3.pylone': 'recite', 'j3.after': 'cantine', 'checkpoint.j3': 'comply', 'j3.cantine': 'work', 'j3.marlene': 'name', 'j3.who': 'theodore' },
  'buy:component': { ...OPENS_J3_LANE['buy:component'], 'j3.pylone': 'recite', 'j3.after': 'home', 'j3.marlene': 'banal' },
};

describe('guided w10 : jour 4 (jeudi, le voisin est pris)', () => {
  it('test_j4_proves_through_day_4', () => {
    const r = proveGuided(loadW10().street, { throughDay: 4, mustOpen: mustOpenOf(4) }, refOf(realInput()));
    expect(r.issues).toEqual([]);
    expect(r.proof.modes[4]).toEqual(['muet', 'couloir', 'bavard']);
    expect(r.proof.perDayMin[4]).toBeGreaterThanOrEqual(1);
  });
  it('test_j4_content_valid', () => { expect(validateContent(realInput()).errors).toEqual([]); });
  it('test_j4_cover_replays_without_rejection', () => {
    const run = coverRun(4);
    expect(run.rejected).toEqual([]);
    for (const pair of narrativePairs(4)) expect(run.played, pair).toContain(pair);   // chaque option du J4 jouée au moins une fois
    expect([...run.substituted].sort()).toEqual(EXPECTED_SUBSTITUTIONS_J4);   // toute autre substitution, ou une autre cause, casse ici
  });
  it('test_j4_couloir_night_values_recorded', () => {   // signal précoce de T14 : nuits 1 à 4 du chemin couloir, horloge vive
    // N8 : la file du contrôle compte une consigne, +2 chaque nuit d'un jour à file ; le couloir passe la file J1 à J6, donc +2, +4, ... +12 en cumul sur 51, 50, 59, 49, 40, 29 (avant N8)
    const r = directorRig();
    playPath(r, COULOIR_PICKS);
    expect([1, 2, 3, 4].map((d) => nightValue({ acts: r.sink.saved }, d as DayIndex, ctxW10()))).toMatchInlineSnapshot(`
      [
        53,
        54,
        65,
        57,
      ]
    `);
  });
  it('test_j4_every_scene_has_a_person_or_is_home', () => {
    for (const s of loadW10().street.guided!.scenes.filter((x) => x.day === 4)) {
      if (s.actor === null) { expect(s.stage, s.id).toBe('home'); continue; }
      expect(FR[s.actor.nameKey], s.id).toBeTruthy(); expect(FR[s.actor.actionKey], s.id).toBeTruthy();
    }
  });
  it('test_j4_right_stay_is_shown_at_wake', () => {   // droit `4.lever` (rester), né au réveil du J4 après la nuit du J3 : montré juste après la carte
    const r = directorRig();
    const seen = playPath(r, COULOIR_PICKS);
    const right = r.drv.state().street.rightLines['4.lever'];
    expect(right).toBe('stay');
    const card = seen.findIndex((b) => b.kind === 'card' && b.day === 4);
    expect(card).toBeGreaterThanOrEqual(0);
    expect(seen.slice(card)).toContainEqual({ kind: 'right', right });
  });

  it.each(['courtesy', 'buy:component'] as const)('test_j4_checkpoint_lane_%s_played_when_open', (lane) => {
    const r = directorRig();
    playPath(r, OPENS_J4_LANE[lane], (b) => b.kind === 'choice' && b.view.id === 'checkpoint.j4');
    const b = r.dir.current();
    expect(b.kind === 'choice' ? b.view.options.map((o) => o.id) : []).toContain(lane);
    playPath(r, { ...OPENS_J4_LANE[lane], 'checkpoint.j4': lane });
    expect(r.sink.saved).toContainEqual(expect.objectContaining({ day: 4, kind: 'lane', option: lane }));
    expect(r.sink.saved).toContainEqual(expect.objectContaining({ day: 4, kind: 'choice', id: 'relecture.j4' }));   // la voie mène au Registre
    expect(r.dir.current().kind).toBe('end');   // la semaine va au J7 (T13)
    expect(rejectedOf(r)).toEqual([]);
  });
  it('test_j4_door_jalon_is_due_after_exit', () => {
    const p = pathOf(loadW10().street, { 'j4.door': 'go' }, 4);
    expect(p.acts.some((a) => a.kind === 'choice' && a.id === 'j4.door' && a.day === 4)).toBe(true);
    expect(replay(p.acts, ctxW10()).rejected).toEqual([]);
  });
  it('test_j4_relecture_reads_the_9c_window', () => { expect(loadW10().street.lines.relecture['4']![0]!.key).toBe('w10.doc.relecture.j4.2'); });
  it('test_j4_bench_line_only_if_theodore_named', () => {
    expect(linesOfDay(4, { 'j3.marlene': 'name', 'j3.who': 'theodore' })).toContain('w10.scene.j4.wake.bench');
    expect(linesOfDay(4, { 'j3.marlene': 'banal' })).not.toContain('w10.scene.j4.wake.bench');
  });
  it('test_j4_stall_line_only_if_nadia_named', () => {
    expect(linesOfDay(4, { 'j3.marlene': 'name', 'j3.who': 'nadia' })).toContain('w10.scene.j4.daughter.stall');
    expect(linesOfDay(4, { 'j3.marlene': 'name', 'j3.who': 'theodore' })).toContain('w10.scene.j4.daughter.queue');
  });
  it('test_j4_extract_variant_follows_j1', () => {
    expect(linesOfDay(4, { 'j1.roux': 'laugh' })).toContain('w10.doc.extrait.j4.laugh');
    expect(linesOfDay(4, { 'j1.roux': 'silent' })).toContain('w10.doc.extrait.j4.silent');
  });
  it('test_j4_yusuf_line_follows_the_component', () => {   // S1 sur E2 : caché ou gardé -> « sans numéro » ; déclaré ou laissé en vue -> « on vous a pris »
    const at = { 'j4.evening': 'yusuf' };
    expect(linesOfDay(4, { ...at, 'j2.component': 'hide' })).toContain('w10.scene.j4.yusuf.unnumbered');
    expect(linesOfDay(4, { ...at, 'j2.component': 'declare' })).toContain('w10.scene.j4.yusuf.taken');
  });
  it('test_j4_refused_checkpoint_spends_the_evening_on_the_street', () => {   // PHASE V (1) : le refusé n'entre jamais au Registre
    const ids = sceneIdsOf(pathOf(loadW10().street, { 'checkpoint.j4': 'refuse' }, 4)).filter((id) => id.startsWith('j4.'));
    expect(ids).toContain('j4.street');
    expect(ids).not.toContain('j4.relecture');
    expect(ids).not.toContain('j4.evening');
    const g = loadW10().street.guided!;
    const street = g.scenes.find((s) => s.id === 'j4.street')!;
    const evening = g.scenes.find((s) => s.id === 'j4.evening')!;
    expect(street).toMatchObject({ stage: 'street', place: 'street.mid', anchorMinute: evening.anchorMinute, transit: [] });
    expect(street.ask).toEqual({ ...evening.ask, promptKey: (street.ask as { promptKey: string }).promptKey });   // mêmes options, mêmes suites
  });
  it('test_j4_door_action_holds_at_every_tier', () => {   // PHASE V (2) : « évite ton regard » est un signal du palier 24,5 à 39,5 (bible §7.1)
    expect(FR['w10.scene.j4.door.action']).not.toMatch(/évite|regard|par ton nom/);
  });
  it('test_j4_given_names_carry_their_name_key', () => {
    const link = (id: string) => loadW10().street.guided!.chains.flatMap((c) => c.links).find((l) => l.id === id)!;
    expect(link('B4w').variants.yusuf!.nameKey).toBe('w10.recap.noms.yusuf');
    expect(link('B4w').variants.fille!.nameKey).toBe('w10.recap.noms.fille');
    expect(link('B4w').absent.nameKey).toBeNull();
  });
  it('test_j4_links_in_design_order', () => {   // conception §4.2 : A4, A5, B4n, B4, B4w, C2, E5, ajoutés à la suite
    const ids = loadW10().street.guided!.chains.flatMap((c) => c.links.filter((l) => l.day === 4).map((l) => l.id));
    expect(ids).toEqual(['A4', 'A5', 'B4n', 'B4', 'B4w', 'C2', 'E5']);
  });
  // 3 (j4.neighbour : nom yusuf, nom fille, silence) × 3 (j4.daughter) × (6 voies × 2 relectures × 4 soirs + refus × 4) = 468 [N7, mesuré].
  // 936 avant N7 : × 2 pour la branche `ifUnavailable` de j4.door, jalon toujours dû (sa scène pose `exit home`), que le moteur ne joue pas.
  it('test_j4_day_paths_counted', () => { expect(dayPathCount(loadW10().street, 4)).toBe(468); });
  it('test_j4_english_is_translated_not_copied', () => {
    const keys = Object.keys(FR).filter((k) => /^w10\.(scene\.j4|recap\.(A4|A5|B4n|B4|B4w|C2|E5)|doc\.extrait\.j4)\./.test(k));
    expect(keys.length).toBeGreaterThan(60);
    const NAMES = new Set(['Yusuf', 'Yusuf Oren']);
    for (const k of keys) { expect(EN[k], k).toBeTruthy(); if (!NAMES.has(FR[k]!)) expect(EN[k], k).not.toBe(FR[k]); }
  });
});

/**
 * Mots dits le jour `day` sur le chemin que `picks` amende au chemin couloir (`COULOIR_PICKS`), joué par le metteur en scène, horloge
 * vive : `buildLedger(...).wordsSpent`, scènes, choix à prix et contrôle compris. `pathOf` ne convient pas ici : son horloge nominale
 * refuse le chemin couloir dès le J3 (aucun chemin accepté), et nommer le seul jour visé le fait chercher en retour arrière dans les
 * centaines de suites des jours d'avant (plus de 10 minutes sans réponse mesurés).
 */
const wordsOfDayFor = (day: DayIndex, picks: Readonly<Record<string, string>>): number => {
  const r = directorRig();
  playPath(r, { ...COULOIR_PICKS, ...picks });
  return buildLedger(day, r.sink.saved, ctxW10()).wordsSpent;
};

// Délai propre : les chemins du J5 (pathOf, dayPathCount, couverture) coûtent 4 à 30 s selon la charge, le délai par défaut est 5 s.
describe('guided w10 : jour 5 (vendredi, Bruno demande un nom)', { timeout: 300_000 }, () => {
  it('test_j5_proves_through_day_5', () => {
    const r = proveGuided(loadW10().street, { throughDay: 5, mustOpen: mustOpenOf(5) }, refOf(realInput()));
    expect(r.issues).toEqual([]);
    expect(r.proof.modes[5]).toEqual(['muet', 'couloir', 'bavard']);
    expect(r.proof.perDayMin[5]).toBeGreaterThanOrEqual(1);
  });
  it('test_j5_content_valid', () => { expect(validateContent(realInput()).errors).toEqual([]); });
  it('test_j5_cover_replays_without_rejection', () => {
    const run = coverRun(5);
    expect(run.rejected).toEqual([]);
    for (const pair of narrativePairs(5)) expect(run.played, pair).toContain(pair);
    expect([...run.substituted].sort()).toEqual(EXPECTED_SUBSTITUTIONS_J5);
  });
  it('test_j5_couloir_night_values_recorded', () => {   // signal précoce de T14 : nuits 1 à 5 du chemin couloir, horloge vive
    // N8 : la file du contrôle compte une consigne, +2 chaque nuit d'un jour à file ; le couloir passe la file J1 à J6, donc +2, +4, ... +12 en cumul sur 51, 50, 59, 49, 40, 29 (avant N8)
    const r = directorRig();
    playPath(r, COULOIR_PICKS);
    expect([1, 2, 3, 4, 5].map((d) => nightValue({ acts: r.sink.saved }, d as DayIndex, ctxW10()))).toMatchInlineSnapshot(`
      [
        53,
        54,
        65,
        57,
        50,
      ]
    `);
  });
  it('test_j5_every_scene_has_a_person_or_is_home', () => {
    for (const s of loadW10().street.guided!.scenes.filter((x) => x.day === 5)) {
      if (s.actor === null) { expect(s.stage, s.id).toBe('home'); continue; }
      expect(FR[s.actor.nameKey], s.id).toBeTruthy(); expect(FR[s.actor.actionKey], s.id).toBeTruthy();
    }
  });
  it('test_j5_route_sealed_after_naming_the_daughter', () => {
    expect(sceneIdsOf(pathOf(loadW10().street, { 'j4.neighbour': 'name', 'j4.who': 'fille' }, 5))).toContain('j5.sealed');
    expect(sceneIdsOf(pathOf(loadW10().street, { 'j4.neighbour': 'silent' }, 5))).toContain('j5.daughter');
  });
  it('test_j5_bruno_door_due_at_home', () => { expect(replay(pathOf(loadW10().street, { 'checkpoint.j5': 'refuse' }, 5).acts, ctxW10()).rejected).toEqual([]); });
  it('test_j5_right_is_privacy_without_contact', () => {
    expect(eveningRecap(stateAtEvening(pathOf(loadW10().street, {}, 5), 5, ctxW10()), ctxW10(), {}).right).toBe('privacy');
  });
  it('test_j5_bavard_without_name_reachable', () => {   // décision 14 : 30 + 14 + 26 + 0 = 70
    expect(wordsOfDayFor(5, { 'j5.daughter': 'long', 'checkpoint.j5': 'comply', 'j5.bruno.talk': 'roux', 'j5.bruno': 'refuse' })).toBe(70);
  });
  it('test_j5_roux_option_costs_26_words', () => {
    const talk = loadW10().street.guided!.scenes.find((s) => s.id === 'j5.bruno.talk')!;
    expect(talk.ask.kind === 'narrative' ? talk.ask.options.find((o) => o.id === 'roux')!.words : -1).toBe(26);
  });
  it('test_j5_checkpoint_line_follows_the_named_yusuf', () => {   // S1 sur B4w : Yusuf nommé -> rideau baissé ; sinon la file
    expect(linesOfDay(5, { 'j4.neighbour': 'name', 'j4.who': 'yusuf' })).toContain('w10.scene.j5.checkpoint.sealed');
    expect(linesOfDay(5, { 'j4.neighbour': 'silent' })).toContain('w10.scene.j5.checkpoint.queue');
  });
  it('test_j5_given_names_carry_their_name_key', () => {
    const link = (id: string) => loadW10().street.guided!.chains.flatMap((c) => c.links).find((l) => l.id === id)!;
    expect(link('C3w').variants.marlene!.nameKey).toBe('w10.recap.noms.marlene');
    expect(link('C3w').variants.berenice!.nameKey).toBe('w10.recap.noms.berenice');
    expect(link('C3w').absent.nameKey).toBeNull();
  });
  it('test_j5_links_in_chain_order', () => {   // ordre des chaînes (A6, C3t, C3, C3w, E6), pas l'ordre de lecture de conception §4.3 (A6, E6, C3t, C3, C3w)
    const ids = loadW10().street.guided!.chains.flatMap((c) => c.links.filter((l) => l.day === 5).map((l) => l.id));
    expect(ids).toEqual(['A6', 'C3t', 'C3', 'C3w', 'E6']);
  });
  it('test_j5_day_paths_counted', () => { expect(dayPathCount(loadW10().street, 5)).toBe(468); });   // main à la main : route `otherwise` 3 (fille) × 13 (6 voies × 2 relectures + refus) × 9 (3 propos × (refus + nom × 2 noms)) = 351, route `fille` 1 × 13 × 9 = 117
  it('test_j5_english_is_translated_not_copied', () => {
    const keys = Object.keys(FR).filter((k) => /^w10\.(scene\.j5|recap\.(A6|E6|C3t|C3|C3w))\./.test(k));
    expect(keys.length).toBeGreaterThan(50);
    const NAMES = new Set(['Marlène Kessel', 'Berenice Halm']);
    for (const k of keys) { expect(EN[k], k).toBeTruthy(); if (!NAMES.has(FR[k]!)) expect(EN[k], k).not.toBe(FR[k]); }
  });
});

/** Substitutions attendues sur `pairCover(w10, 5)` [mesuré, T11] : celles du J4 à l'identique, plus les trois du contrôle du J5, mêmes causes lues dans l'état. */
const EXPECTED_SUBSTITUTIONS_J5: readonly string[] = [
  ...EXPECTED_SUBSTITUTIONS_J4,
  'checkpoint.j5 buy:bons -> comply : bons 0 < 16',
  'checkpoint.j5 buy:component -> comply : composant seized',
  'checkpoint.j5 courtesy -> comply : palier sans courtoisie',
].sort();

// Délai propre : les chemins du J6 (pathOf, dayPathCount, couverture) coûtent plusieurs secondes sous charge.
describe('guided w10 : jour 6 (samedi, la coupure)', { timeout: 300_000 }, () => {
  it('test_j6_proves_through_day_6', () => {
    const r = proveGuided(loadW10().street, { throughDay: 6, mustOpen: mustOpenOf(6) }, refOf(realInput()));
    expect(r.issues).toEqual([]);
    expect(r.proof.modes[6]).toEqual(['muet', 'couloir', 'bavard']);
    expect(r.proof.perDayMin[6]).toBeGreaterThanOrEqual(1);
  });
  it('test_j6_content_valid', () => { expect(validateContent(realInput()).errors).toEqual([]); });
  it('test_j6_cover_replays_without_rejection', () => {
    const run = coverRun(6);
    expect(run.rejected).toEqual([]);
    for (const pair of narrativePairs(6)) expect(run.played, pair).toContain(pair);
    expect([...run.substituted].sort()).toEqual(EXPECTED_SUBSTITUTIONS_J6);
  });
  it('test_j6_couloir_night_values_recorded', () => {   // signal précoce de T14 : nuits 1 à 6 du chemin couloir, horloge vive
    const r = directorRig();
    playPath(r, COULOIR_PICKS);
    expect([1, 2, 3, 4, 5, 6].map((d) => nightValue({ acts: r.sink.saved }, d as DayIndex, ctxW10()))).toEqual([53, 54, 65, 57, 50, 41]);   // [mesuré, T12] 51, 50, 59, 49, 40, 29 ; N8 : +2 par nuit de file en cumul (J1 à J6), soit +2 ... +12
  });
  it('test_j6_every_scene_has_a_person_or_is_home', () => {
    for (const s of loadW10().street.guided!.scenes.filter((x) => x.day === 6)) {
      if (s.actor === null) { expect(s.stage, s.id).toBe('home'); continue; }
      expect(FR[s.actor.nameKey], s.id).toBeTruthy(); expect(FR[s.actor.actionKey], s.id).toBeTruthy();
    }
  });
  it('test_j6_route_sealed_after_naming_marlene', () => {
    expect(sceneIdsOf(pathOf(loadW10().street, { 'j5.bruno': 'name', 'j5.who': 'marlene' }, 6))).toContain('j6.sealed');
  });
  it('test_j6_route_marlene_otherwise', () => {   // jouée au metteur en scène (pathOf cherche sans fin sur ce préfixe, T11)
    expect(sceneIdsOfPlayed({ 'j5.bruno': 'name', 'j5.who': 'berenice' })).toContain('j6.marlene');
    expect(sceneIdsOfPlayed({ 'j5.bruno': 'refuse' })).toContain('j6.marlene');
  });
  it('test_j6_speech_modes_match_grid_base_40', () => {   // N9 : le bavard du J6 vaut celui de la grille (50, base 40 + 10)
    expect(loadW10().street.guided!.speechModes[6]).toEqual({ muet: modeWords('muet', 6, false), couloir: [20, modeWords('couloir', 6, false)], bavard: modeWords('bavard', 6, false) });
  });
  // I-3 de la revue T12, ruling game-designer 2026-11-07 : la falaise du sommeil. Chaque cas est une MESURE rejouée au metteur en scène, horloge vive.
  const j6Night = (picks: Readonly<Record<string, string>>) => {
    const r = directorRig();
    playPath(r, { ...COULOIR_PICKS, ...picks });
    const reading = stateAfter(r.sink.saved, ctxW10()).readings.find((x) => x.day === 6)!;
    const k = reading.ending?.kind;
    return { value: reading.value / 1000, end: k === undefined ? 'none' : k === 'arrested' ? 'arrestedAudition' : k };
  };
  const J6_SINGLE_SWAPS: readonly Readonly<Record<string, string>>[] = [{}, { 'j6.marlene': 'silent' }, { 'j6.marlene': 'talk' }, { 'j6.guichet': 'nothing' },
    { 'j6.guichet': 'permit', 'permit.j6': 'dontAsk' }, { 'j6.cut': 'remark' }, { 'relecture.j6': 'pass' }];
  // Avant N8 : 29 et 28. N8 : chaque swap garde la file J1 à J6 (comply), donc +12 en cumul à la nuit 6 : 41 et 40.
  const EXPECTED_J6_SWAP: Record<string, number> = { '{}': 41, '{"j6.marlene":"silent"}': 40, '{"j6.marlene":"talk"}': 41, '{"j6.guichet":"nothing"}': 40,
    '{"j6.guichet":"permit","permit.j6":"dontAsk"}': 40, '{"j6.cut":"remark"}': 41, '{"relecture.j6":"pass"}': 41 };
  it.each(J6_SINGLE_SWAPS)('test_j6_single_narrative_choice_never_decides_audition %o', (picks) => {
    const m = j6Night(picks);
    expect(m.value).toBe(EXPECTED_J6_SWAP[JSON.stringify(picks)]); expect(m.end).toBe('released');
  });
  // N9, verdict P-7 : la neutralité de la déclaration se prouve sur le domaine §7.5 (au plus un nom, #7 laissé), pas sur COULOIR_PICKS.
  // Valeur de la nuit 6 = base + terme des mots. Base 0 nom : n5 48, dossier -12, regards -3, consigne +2, report du refus J5 -2 = 33.
  // Base 1 nom (J3) : n5 60, même suite = 45. Base 1 nom (J4, yusuf) : n5 65, même suite = 50. Mots du J6 : W = Marlène (silent 0, banal 5, talk 21) + contrôle 14 + guichet (roux 5,
  // nothing 0, permit dontAsk 0) + coupure (listen 0, remark 15). Allocation 40 (le crédit de 15 par nom ne vaut que le jour du nom, ici le J3), sommeil si 14 <= W <= 40.
  // Hors domaine, NON garantissable (preuve de la bande de 5 points) : roux écarte W de 5 mots. En dépassement, chaque mot coûte 1 point,
  // donc roux coûte 5 points (talk/remark : W 50 contre 55). Ailleurs l'écart est d'au plus 1 point (sommeil +4 contre +5 ou +6), et aucun
  // contexte ne franchit 40 entre nothing et roux (talk/listen s'arrête à 40). Il existe donc toujours une bande de 5 points de base où la
  // déclaration décide : avec remark 15, base de 34,5 à 39,5 en talk/remark (n5 de 49,5 à 54,5). Les bases du domaine (33 et 45) en sont
  // hors ; COULOIR_PICKS (base 35, n5 50) y est : 20 avec roux, 25 avec nothing (épinglés plus bas). La garantie ne porte que sur le domaine.
  // Marge du zéro nom : 1,5 point. La base 33 est à 1,5 du bas de la bande (34,5), et talk/remark nothing (23) à 1,5 de 24,5. Si la
  // base gagne 2 points (consigne, regards, dossier), roux arrête et nothing libère : ce test le garde, 18 et 23 sont épinglés.
  const DOMAIN_0 = { 'j1.component': 'leave', 'j3.marlene': 'banal' };
  const DOMAIN_1 = { 'j1.component': 'leave' };   // COULOIR_PICKS nomme au J3 (theodore)
  const DOMAIN_1_J4 = { 'j1.component': 'leave', 'j3.marlene': 'banal', 'j4.neighbour': 'name', 'j4.who': 'yusuf' };   // M-2 rev-n9 : la base à un nom la plus proche de la bande
  const GUICHETS = [{ 'j6.guichet': 'roux' }, { 'j6.guichet': 'nothing' }, { 'j6.guichet': 'permit', 'permit.j6': 'dontAsk' }];
  // [roux, nothing, permit dontAsk] par contexte, dérivés à la main depuis le commentaire ci-dessus.
  const EXPECTED_J6_DOMAIN: Record<string, Record<string, readonly number[]>> = {
    '0': { 'silent/listen': [38, 37, 37], 'silent/remark': [39, 39, 39], 'banal/listen': [39, 38, 38], 'banal/remark': [39, 39, 39],
      'talk/listen': [39, 39, 39], 'talk/remark': [18, 23, 23] },
    '1': { 'silent/listen': [50, 49, 49], 'silent/remark': [51, 51, 51], 'banal/listen': [51, 50, 50], 'banal/remark': [51, 51, 51],
      'talk/listen': [51, 51, 51], 'talk/remark': [30, 35, 35] },
    '1 (J4)': { 'silent/listen': [55, 54, 54], 'silent/remark': [56, 56, 56], 'banal/listen': [56, 55, 55], 'banal/remark': [56, 56, 56],
      'talk/listen': [56, 56, 56], 'talk/remark': [35, 40, 40] },
  };
  it.each([['0', DOMAIN_0], ['1', DOMAIN_1], ['1 (J4)', DOMAIN_1_J4]] as const)('test_j6_declaration_does_not_touch_outcome_on_domain_%s_name', (names, base) => {   // bible w10 l. 6, amendement (7)
    for (const m of ['silent', 'banal', 'talk']) for (const c of ['listen', 'remark']) {
      const runs = GUICHETS.map((g) => j6Night({ ...base, 'j6.marlene': m, 'j6.cut': c, ...g }));
      expect(runs.map((r) => r.value), `${names} nom ${m}/${c}`).toEqual(EXPECTED_J6_DOMAIN[names]![`${m}/${c}`]);
      const end = names === '0' && m === 'talk' && c === 'remark' ? 'arrestedAudition' : 'released';   // 23 et 18 < 24,5 (bible §7.5) ; 1 nom : 30 et 35 (J3), 35 et 40 (J4)
      expect(runs.map((r) => r.end), `${names} nom ${m}/${c}`).toEqual([end, end, end]);
    }
  });
  it('test_j6_two_talkative_choices_out_of_domain_value_after_n9', () => {   // talk + remark = 55 mots, dépassement 15
    // Hors domaine (#7 sur soi, `j1.component: take`) : base 35, 35 - 15 = 20 < 24,5, arrêté à l'audition. Avant N9 : 26 (remark 9), libéré.
    // Attendu : COULOIR_PICKS est hors domaine, la neutralité n'y est pas garantie (bande de 5 points ci-dessus : nothing y vaut 25).
    expect(j6Night({ 'j6.marlene': 'talk', 'j6.cut': 'remark' })).toEqual({ value: 20, end: 'arrestedAudition' });
    // M-1 rev-n9 : la bascule hors domaine, exécutée. Même chemin, nothing : 50 mots, dépassement 10, 35 - 10 = 25 >= 24,5, libéré.
    expect(j6Night({ 'j6.marlene': 'talk', 'j6.cut': 'remark', 'j6.guichet': 'nothing' })).toEqual({ value: 25, end: 'released' });
  });
  it('test_j6_permit_request_without_name_is_released', () => {   // I-3 : 0 nom, permis demandé
    // 0 nom, J6 sous le couloir (19 mots) : W = banal 5 + 14 + permis 0 = 19, sous le plancher du couloir du J6 (20). Restants 21 :
    // sommeil +6, silence -1, mots +5 ; permis -9. 33 + 5 - 9 = 29, libéré. Ce chemin n'est pas le couloir de §7.5 : la bible n'y est
    // pas fausse. Elle donne 30 pour tout W du couloir, de 20 à 40 mots (restants au plus 20 : sommeil +6, pas de silence).
    expect(j6Night({ ...DOMAIN_0, 'j6.guichet': 'permit', 'permit.j6': 'request' })).toEqual({ value: 29, end: 'released' });
    // 0 nom, J6 dans le couloir : remark porte W à 34, restants 6, mots +6. 33 + 6 - 9 = 30, la valeur de la bible, libéré.
    expect(j6Night({ ...DOMAIN_0, 'j6.guichet': 'permit', 'permit.j6': 'request', 'j6.cut': 'remark' })).toEqual({ value: 30, end: 'released' });
    // Le « 31 » de la revue T14 est COULOIR_PICKS (hors domaine, base 35) : 35 + 5 - 9 = 31.
  });
  it('test_j6_silent_saturday_is_released', () => {   // V2-A : le muet du J6 (14 mots, 26 restants) paie encore le sommeil
    expect(j6Night({ 'j6.marlene': 'silent', 'j6.guichet': 'nothing' })).toEqual({ value: 39, end: 'released' });   // 27 avant N8, +12 (file J1 à J6)
  });
  it('test_j6_couloir_words_are_24', () => { expect(wordsOfDayFor(6, {})).toBe(24); });   // banal 5 + contrôle 14 + roux 5, conception §6
  it('test_j6_bavard_words_are_55', () => {   // talk 21 + contrôle 14 + roux 5 + remark 15 (N9)
    expect(wordsOfDayFor(6, { 'j6.marlene': 'talk', 'j6.cut': 'remark' })).toBe(55);
  });
  it('test_j6_relecture_reads_own_permit_when_requested', () => {
    const lineOn = (picks: Readonly<Record<string, string>>): string => {
      const r = directorRig();
      playPath(r, { ...COULOIR_PICKS, ...picks });
      return relectureLineOf(6, stateAfter(r.sink.saved, ctxW10()).ledgers.find((l) => l.day === 6)!, loadW10().street)!;   // le relevé de la nuit 6, rejeu moteur
    };
    expect(lineOn({ 'j6.guichet': 'permit', 'permit.j6': 'request' })).toBe('w10.doc.relecture.j6.2');
    expect(lineOn({ 'j6.guichet': 'permit', 'permit.j6': 'dontAsk' })).toBe('w10.doc.relecture.j6.1');
    expect(lineOn({ 'j6.guichet': 'roux' })).toBe('w10.doc.relecture.j6.1');
  });
  it('test_j6_moved_keyboard_after_refusing_bruno', () => {
    expect(linesOfDay(6, { 'j5.bruno': 'refuse' })).toContain('w10.scene.j6.wake.keyboard');
  });
  it('test_j6_name_lines_stay_true_at_every_tier', () => {   // PHASE V : la voiture grise est un signal de palier (absente à 59,5 ou plus), pas un fait du Jour 6
    expect(linesOfDay(6, { 'j5.bruno': 'name', 'j5.who': 'berenice' })).toContain('w10.scene.j6.wake.name');
    for (const k of ['w10.scene.j6.wake.name', 'w10.recap.C4.name']) {
      expect(FR[k], k).not.toMatch(/voiture|grise n'est/i);
      expect(EN[k], k).not.toMatch(/\bcar\b|grey car/i);
      expect(FR[k], k).toMatch(/Bruno/); expect(EN[k], k).toMatch(/Bruno/);
    }
  });
  it('test_j6_regime_line_announces_forty_words_in_letters', () => {
    expect(FR['w10.scene.j6.wake.1']).toMatch(/quarante mots/); expect(EN['w10.scene.j6.wake.1']).toMatch(/forty words/);
    expect(FR['w10.scene.j6.wake.1']).not.toMatch(/\d/);
  });
  it('test_j6_links_and_night_link', () => {   // conception §4.4 : B6, A7, C4 (ordre des chaînes A, B, C, E)
    const links = loadW10().street.guided!.chains.flatMap((c) => c.links.filter((l) => l.day === 6));
    expect(links.map((l) => l.id)).toEqual(['A7', 'B6', 'C4']);
    expect(links.find((l) => l.id === 'C4')!.at).toEqual({ kind: 'night', day: 5, from: 'C3' });
    expect(Object.keys(links.find((l) => l.id === 'A7')!.variants)).toEqual(['roux', 'permit', 'nothing']);
  });
  it('test_j6_cut_is_a_milestone_not_a_link', () => {   // la coupure n'est pas un maillon : aucune chaîne n'y accroche
    const ats = loadW10().street.guided!.chains.flatMap((c) => c.links.map((l) => JSON.stringify(l.at)));
    expect(ats.some((a) => a.includes('j6.cut') || a.includes('j6.home'))).toBe(false);
  });
  it('test_j6_day_paths_counted', () => { expect(dayPathCount(loadW10().street, 6)).toBe(388); });   // main : route S2 (Marlène 3 propos + scellée 1) × [6 voies du contrôle × (guichet : roux 2 + permit 2×2 + nothing 2 = 8 relectures) × 2 (coupure) + refus 1] = 4 × 97
  it('test_j6_english_is_translated_not_copied', () => {
    const keys = Object.keys(FR).filter((k) => /^w10\.(scene\.j6|recap\.(A7|B6|C4))\./.test(k));
    expect(keys.length).toBeGreaterThan(50);
    const NAMES = new Set<string>();
    for (const k of keys) { expect(EN[k], k).toBeTruthy(); if (!NAMES.has(FR[k]!)) expect(EN[k], k).not.toBe(FR[k]); }
  });
});

/** Les scènes du jour 6 jouées au metteur en scène sur le chemin couloir amendé par `picks` (pathOf ne convient pas : T11). */
function sceneIdsOfPlayed(picks: Readonly<Record<string, string>>): readonly string[] {
  const r = directorRig();
  const ids: string[] = [];
  for (let i = 0; i < 2000; i++) {
    const b = r.dir.current();
    if (b.kind === 'demoEnd' || b.kind === 'end') break;
    const id = r.dir.sceneId();
    if (id !== null && id.startsWith('j6.') && !ids.includes(id)) ids.push(id);
    stepOnce(r, { ...COULOIR_PICKS, ...picks });
  }
  return ids;
}

/** Substitutions attendues sur `pairCover(w10, 6)` [mesuré, T12]. */
const EXPECTED_SUBSTITUTIONS_J6: readonly string[] = [
  ...EXPECTED_SUBSTITUTIONS_J5,
  'checkpoint.j6 buy:bons -> comply : bons 0 < 16',
  'checkpoint.j6 buy:component -> comply : composant seized',
  'checkpoint.j6 courtesy -> comply : palier sans courtoisie',
].sort();

describe('guided w10 : jour 7 (dimanche, l\'audition) et la fin de la semaine', { timeout: 600_000 }, () => {
  // --- tests du brief T13 -----------------------------------------------------------------------------------------------------------
  it('test_week_proves_with_four_complete_chains', () => {
    const r = proveGuided(loadW10().street, { throughDay: 7, mustOpen: ['A', 'B', 'C', 'E'] }, refOf(realInput()));
    expect(r.issues).toEqual([]);
    expect(r.proof.completeMin).toBe(4);
    expect(r.proof.opened).toEqual(['A', 'B', 'C', 'E']);
  });
  it('test_week_visits_under_ceiling', () => {   // conception, Budget ; mesuré N7 : 12 582 visites (12 561 jusqu'au J6) ; T13 : 14 610, branches de jalon que le moteur ne joue pas comprises
    expect(proveGuided(loadW10().street, { throughDay: 7, mustOpen: [] }, refOf(realInput())).proof.visits).toBeLessThanOrEqual(20000);
  });
  it('test_week_modes_every_day', () => {
    expect(proveGuided(loadW10().street, { throughDay: 7, mustOpen: [] }, refOf(realInput())).proof.modes)
      .toEqual(Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, ['muet', 'couloir', 'bavard']])));
  });
  it('test_director_acts_equal_pathsOf_acts_week', () => {   // Review Focus 2 et revue T13 §1 : égalité acte par acte, remise par N7
    // N7 [mesuré] : chaque chemin de `pairCover(w10, 7)` est rejoué tel que le moteur le pose (`engineActsOf` : chaque jour, l'horloge de la
    // porte que le moteur lit au matin ; porte fermée dès le J3 sur ces chemins). Refus avant la fin : compté par cause. Chemin accepté
    // (jusqu'à une arrestation de nuit comprise) : le metteur en scène, joué avec les choix du chemin, pose les MÊMES actes, minute comprise.
    // Puis l'intention du Review Focus, inchangée : chaque branche de route `<scène>~<branche>` de la clé est celle que le metteur en scène
    // joue (`playScenes`, voie du contrôle substituée si fermée : une voie ne donne aucun nom, la route n'en dépend pas).
    const g = loadW10().street.guided!;
    let checked = 0, unreached = 0, equal = 0;
    const subs = new Set<string>();
    const refused: Record<string, number> = {};
    for (const p of pairCover(loadW10().street, 7)) {
      const e = engineActsOf(p, ctxW10());
      expect(e.gate, p.key).toBeNull();   // w10 : aucune lecture de l'heure ne sépare les deux horloges
      const rejected = replay(e.acts, ctxW10()).rejected;
      const first = rejectedBeforeEnd(rejected)[0];
      if (first !== undefined) {
        const cause = `${first.act.id} ${first.act.option} ${first.reason}`;
        refused[cause] = (refused[cause] ?? 0) + 1;
      } else {
        const kept = rejected.length === 0 ? e.acts : e.acts.slice(0, e.acts.indexOf(rejected[0]!.act));
        const played = playPicks(directorRig(), { key: p.key, acts: kept });
        expect(played?.acts, p.key).toEqual(kept);
        equal++;
      }
      const seen = playScenes(directorRig(), p, subs);
      for (const [id, branch] of p.key.split(' | ').flatMap(routeTokensOf)) {
        const s = g.scenes.find((x) => x.id === id)!;
        if (s.ask.kind !== 'route') throw new Error(`${id} n'est pas une route`);
        if (!seen.has(id) && ![...Object.values(s.ask.next), s.ask.otherwise].some((t) => seen.has(t))) { unreached++; continue; }   // arrêté avant ce jour
        const want = branch === '*' ? s.ask.otherwise : s.ask.next[branch]!;
        const others = [...Object.values(s.ask.next), s.ask.otherwise].filter((t) => t !== want);
        expect(seen.has(want), `${p.key} : ${id}~${branch} -> ${want}`).toBe(true);
        for (const o of others) expect(seen.has(o), `${p.key} : ${id}~${branch}, ${o} joué`).toBe(false);
        checked++;
      }
    }
    expect(equal).toBe(PROOF_EQUAL_WEEK);
    expect({ checked, unreached }).toEqual(ROUTE_TOKENS_WEEK);
    expect([...subs].sort()).toEqual(ROUTE_SUBSTITUTIONS_WEEK);
    expect(refused).toEqual(PROOF_REFUSALS_WEEK);
  });
  it('test_c7_says_the_names', () => {
    const p = pathOf(loadW10().street, { 'j3.marlene': 'name', 'j3.who': 'nadia', 'j4.neighbour': 'name', 'j4.who': 'fille', 'j5.bruno': 'name', 'j5.who': 'marlene', 'audition.j7': 'all' }, 7);
    const r = eveningRecap({ ...stateAt(7, 1080), acts: p.acts }, ctxW10(), {});
    expect(r.names).toEqual(['w10.recap.noms.nadia', 'w10.recap.noms.fille', 'w10.recap.noms.marlene']);
  });
  it('test_default_week_reaches_end_and_bilan_input', () => {   // chemin couloir joué jusqu'à l'audition : fin de semaine (pas d'arrestation de nuit), entrée bilan `weekEnd`
    const r = directorRig();
    playPath(r, COULOIR_PICKS);
    expect(r.dir.current()).toMatchObject({ kind: 'end', early: false });
    expect(r.drv.finishDay()).toMatchObject({ entry: 'weekEnd' });
    expect(rejectedOf(r)).toEqual([]);
  });
  it('test_real_early_arrest_at_night_four', () => {   // conception §7 risque 3 : partie qui tombe la nuit 4, bilan ouvert, chaînes coupées
    // M-2 (revue T13) : seuil calculé, nuit 4 + 0,5, sur un chemin dont les nuits 1 à 3 restent au-dessus. Depuis N8, `COULOIR_PICKS` ne s'y
    // prête plus (53, 54, 65, 57 : nuit 1 sous 57,5). Chemin : couloir du domaine, composant laissé (#7 jamais sur soi), aucun nom
    // (`j3.marlene: banal`) : 63, 64, 63, 55 (bible §7.5), seuil 55,5 [mesuré, T14].
    const ARREST_PICKS = { ...COULOIR_PICKS, 'j1.component': 'leave', 'j3.marlene': 'banal' };
    const free = directorRig();
    playPath(free, ARREST_PICKS);
    const nights = ([1, 2, 3, 4] as const).map((d) => nightValue({ acts: free.sink.saved }, d, ctxW10()));
    const below = nights[3]! + 0.5;
    for (const v of nights.slice(0, 3)) expect(v).toBeGreaterThanOrEqual(below);   // le chemin par défaut ne s'y prête pas : sa nuit 3 est sous sa nuit 4
    const ctx = withNightBelow(ctxW10(), below);
    const r = directorRig([], ctx);
    playPath(r, ARREST_PICKS);
    expect(r.dir.current()).toEqual({ kind: 'end', early: true, endedDay: 4 });
    const input = r.drv.finishDay()!;
    expect(input.entry).toBe('earlyEnd');
    const w = weekChains(input, ctx.street.guided!, ctx.street.clock, {});
    expect(w.arrestedNight).toBe(4);
    expect(w.arrestedLineKey).toBe('w10.end.arrestedNight');
    expect(w.chains.flatMap((c) => c.items).every((it) => it.day <= 4)).toBe(true);
    expect(w.chains.map((c) => c.chainId)).toEqual(['A', 'B', 'C', 'E']);   // C ouverte au J3 (cantine) sur ce chemin
  });
  it('test_old_saves_beyond_day_two_resume', () => {   // sauvegarde du plan J1-J2 (fixture) : reprise à la première étape non jouée du J3, jamais demoEnd
    const old = SAVE_PLAN_J1J2.acts as readonly ActRecord[];
    expect(Math.max(...old.filter((a) => a.kind === 'sleep').map((a) => a.day))).toBe(2);
    const again = directorRig(old);
    expect(again.dir.current()).toMatchObject({ kind: 'card', day: 3 });
    expect(rejectedOf(again)).toEqual([]);
    const seen = playPath(again, {}, (b) => b.kind === 'choice');
    expect(seen.some((b) => b.kind === 'demoEnd')).toBe(false);
    expect(again.dir.sceneId()).toBe('j3.pylone');
    stepOnce(again);   // une étape du J3 jouée puis reprise (anciens actes + le neuf) : la suivante, pas le pylône
    const third = directorRig([...old, ...again.sink.saved]);
    expect(third.dir.current().kind).not.toBe('demoEnd');
    expect(third.dir.sceneId()).not.toBe('j3.pylone');
    expect(rejectedOf(third)).toEqual([]);
  });

  // --- gabarit des jours ------------------------------------------------------------------------------------------------------------
  it('test_j7_content_valid', () => { expect(validateContent(realInput()).errors).toEqual([]); });
  it('test_j7_end_of_demo_is_null', () => { expect(loadW10().street.guided!.endOfDemo).toBeNull(); });
  it('test_j7_cover_replays_without_rejection', () => {
    const run = coverRun(7);
    expect(run.rejected).toEqual([]);
    for (const pair of narrativePairs(7)) expect(run.played, pair).toContain(pair);
    expect([...run.substituted].sort()).toEqual(EXPECTED_SUBSTITUTIONS_J6);   // le J7 n'a pas de contrôle : aucune substitution neuve
  });
  it('test_j7_every_scene_has_a_person_or_is_home', () => {   // sauf j7.empty : le palier vide EST la scène (conception §4.5, « personne »)
    for (const s of loadW10().street.guided!.scenes.filter((x) => x.day === 7)) {
      if (s.actor === null) { expect(s.stage === 'home' || s.id === 'j7.empty', s.id).toBe(true); continue; }
      expect(FR[s.actor.nameKey], s.id).toBeTruthy(); expect(FR[s.actor.actionKey], s.id).toBeTruthy();
    }
  });
  it('test_j7_inspector_wears_crowd_c', () => {   // P-5 : corps de foule en attendant le département 3D
    const s = loadW10().street.guided!.scenes.find((x) => x.id === 'j7.audition')!;
    expect(s.actor).toMatchObject({ id: 'inspector', bodyId: 'crowd_c', nameKey: 'w10.scene.name.inspector' });
  });
  it('test_j7_audition_enters_no_registre', () => {   // Registre fermé le J7 (`registre.closedDays` [3, 7])
    for (const s of loadW10().street.guided!.scenes.filter((x) => x.day === 7)) expect(s.transit, s.id).not.toContainEqual({ kind: 'enter', id: 'registre' });
  });
  it('test_j7_right_is_speak_without_contact', () => { expect(loadW10().street.guided!.days.find((d) => d.day === 7)!.right).toBe('speak'); });
  it('test_j7_route_empty_after_naming_the_daughter', () => {
    expect(sceneIdsOfDay(7, { 'j4.neighbour': 'name', 'j4.who': 'fille' })).toEqual(['j7.wake', 'j7.empty', 'j7.car', 'j7.audition']);
    expect(sceneIdsOfDay(7, {})).toEqual(['j7.wake', 'j7.daughter', 'j7.car', 'j7.audition']);
  });
  it('test_j7_daughter_line_follows_a5', () => {   // S1 sur A5 : la vérité dite jeudi -> « je suis convoquée » ; sinon le Registre
    expect(linesOfDay(7, { 'j4.daughter': 'truth' })).toContain('w10.scene.j7.daughter.truth');
    expect(linesOfDay(7, { 'j4.daughter': 'silent' })).toContain('w10.scene.j7.daughter.otherwise');
  });
  it('test_j7_waiting_room_shows_the_absent', () => {   // S1 sur B4w, C3w, E2
    expect(linesOfDay(7, { 'j4.neighbour': 'name', 'j4.who': 'fille' })).toContain('w10.scene.j7.audition.chair');
    const couloir = linesOfDay(7, {});
    expect(couloir).toContain('w10.scene.j7.audition.waiting');
    expect(couloir).toContain('w10.scene.j7.audition.marleneHere');
    expect(couloir).not.toContain('w10.scene.j7.audition.component');   // composant caché au J2 (couloir : hide)
    expect(linesOfDay(7, { 'j5.bruno': 'name', 'j5.who': 'marlene' })).toContain('w10.scene.j7.audition.notebook');
    expect(linesOfDay(7, { 'j5.bruno': 'name', 'j5.who': 'berenice' })).toContain('w10.scene.j7.audition.list');
    expect(linesOfDay(7, { 'j2.component': 'declare' })).toContain('w10.scene.j7.audition.component');
  });
  it('test_j7_gestures_never_change_the_outcome', () => {   // bible §7.6 : dossier clos au relevé de la nuit 6
    const ends = [{ 'j7.daughter': 'all' }, { 'j7.daughter': 'silent' }, { 'audition.j7': 'all' }, { 'audition.j7': 'silence' }].map((p) => {
      const r = directorRig();
      return outcomeOf(playPath(r, { ...COULOIR_PICKS, ...p })).endId;
    });
    expect(new Set(ends)).toEqual(new Set(['released']));
  });
  it('test_j7_outcome_lines_by_names', () => {   // conception §5.1 ; narrateur par nombre de noms (bible §7.5, §7.6)
    const e = loadW10().street.guided!.ending!;
    expect(Object.keys(e.outcomes).sort()).toEqual(['arrestedAudition', 'recruited', 'released']);
    expect(e.outcomes['arrestedAudition']!.narratorKeys).toEqual({ '2': 'w10.end.arrestedAudition.n2' });
    expect(e.outcomes['released']!.narratorKeys).toEqual({ '1': 'w10.end.released.n1' });
    expect(e.outcomes['recruited']!.narratorKeys).toEqual({});
    const couloir = outcomeOf(playPath(directorRig(), COULOIR_PICKS));   // couloir : un nom (Théodore, J3)
    expect(couloir).toMatchObject({ endId: 'released', names: 1, regimeKey: 'w10.end.released.regime', narratorKey: 'w10.end.released.n1' });
    expect(e.arrestedNightKey).toBe('w10.end.arrestedNight');
    expect(FR[e.weekButtonKey]).toBe('Voir ta semaine');
  });
  it('test_j7_released_line_says_the_given_name', () => {   // N7, revue T13 I-3 ; spec D86 : « Tu as donné ⟨nom⟩. Ils t'ont gardé. Une fois. »
    const r = directorRig();
    const o = outcomeOf(playPath(r, COULOIR_PICKS));   // couloir : un seul nom, donné au J3
    const given = eveningRecap(r.drv.state().street, ctxW10(), {}).names;   // R2 : la liste du relevé, même lecture
    expect(given).toHaveLength(1);
    expect(o).toMatchObject({ endId: 'released', names: 1, nameKeys: given, narratorKey: 'w10.end.released.n1' });
    const t = (lang: 'fr' | 'en') => narrationOf(createI18n({ fr: FR, en: EN }, loadMeta(), lang, { mode: 'dev', report: (i) => { throw new Error(i.code); } }), o);
    expect(t('fr')).toBe(`Tu as donné ${FR[given[0]!]}. Ils t'ont gardé. Une fois.`);
    expect(t('en')).toContain(EN[given[0]!]!);
    expect(EN['w10.end.released.n1']).not.toBe(FR['w10.end.released.n1']);
  });
  it('test_j7_last_recap_has_the_week_button_and_the_ends', () => {
    const r = directorRig();
    const seen = playPath(r, COULOIR_PICKS);
    const kinds = seen.slice(seen.findIndex((b) => b.kind === 'outcome')).map((b) => b.kind);
    expect(kinds).toEqual(['outcome', 'recap', 'end']);
    const recap = eveningRecap(r.drv.state().street, ctxW10(), {});
    expect(recap).toMatchObject({ day: 7, lastDay: true, weekButtonKey: 'w10.end.week', right: 'speak' });
    // ordre du relevé : jour puis minute, les maillons de nuit au matin d'abord [mesuré]
    expect(recap.items.map((i) => i.recapKey)).toEqual(['w10.recap.A9.truth', 'w10.recap.B7.silent', 'w10.recap.E7.hide', 'w10.recap.A8.some', 'w10.recap.C7.none']);
  });
  it('test_j7_c7_lines_carry_the_names_token', () => {
    for (const v of ['all', 'none', 'silence']) { expect(FR[`w10.recap.C7.${v}`]).toContain('{noms}'); expect(EN[`w10.recap.C7.${v}`]).toContain('{noms}'); }
  });
  it('test_j7_times_in_letters', () => {
    for (const k of ['w10.scene.j7.goal', 'w10.scene.j7.wake.1', 'w10.scene.j7.daughter.truth', 'w10.recap.C7.all']) { expect(FR[k], k).not.toMatch(/\d/); expect(FR[k], k).toMatch(/dix-sept heures trente/i); }
  });
  it('test_j7_speech_modes', () => { expect(loadW10().street.guided!.speechModes[7]).toEqual({ muet: 14, couloir: [40, 60], bavard: 70 }); });
  it('test_j7_links_and_ends', () => {   // conception §4.5 : A8, puis les fins A9, B7, C7, E7
    const links = loadW10().street.guided!.chains.flatMap((c) => c.links.filter((l) => l.day === 7));
    expect(links.map((l) => l.id)).toEqual(['A8', 'A9', 'B7', 'C7', 'E7']);
    expect(links.find((l) => l.id === 'A9')!.at).toEqual({ kind: 'night', day: 6, from: 'A5' });
    expect(links.find((l) => l.id === 'B7')!.at).toEqual({ kind: 'night', day: 6, from: 'B4' });
    expect(links.find((l) => l.id === 'C7')!.at).toEqual({ kind: 'choice', id: 'audition.j7' });
    expect(links.find((l) => l.id === 'E7')!.at).toEqual({ kind: 'night', day: 6, from: 'E2' });
    expect(Object.keys(links.find((l) => l.id === 'E7')!.variants)).toEqual(['hide', 'keep', 'declare', 'leaveVisible']);
  });
  it('test_j7_day_paths_counted', () => { expect(dayPathCount(loadW10().street, 7)).toBe(12); });   // main : route S2 (fille nommée : vide 1 ; sinon fille 3) × audition 3 = 3 + 9
  it('test_j7_english_is_translated_not_copied', () => {
    const keys = Object.keys(FR).filter((k) => /^w10\.(scene\.j7|recap\.(A8|A9|B7|C7|E7)|end)\./.test(k) || k === 'w10.scene.name.inspector');
    expect(keys.length).toBeGreaterThan(50);
    for (const k of keys) { expect(EN[k], k).toBeTruthy(); expect(EN[k], k).not.toBe(FR[k]); }
    expect(EN['w10.scene.j7.wake.1']).toMatch(/half past five/);
  });
});

/** Branches de route de `pairCover(w10, 7)` vérifiées au metteur en scène, et celles d'un jour que la partie n'a pas atteint [mesuré, N7 ; T13 : 266 et 13 sur 93 chemins]. */
// N8 [mesuré, T14] : sur les 91 chemins, les arrestations de nuit passent de 13 à 1 (+2 par nuit de file, en cumul). Les 12 chemins qui ne
// sont plus arrêtés atteignent le J7 et sa route `j7.wake` : 12 jetons passent de `unreached` à `checked` (somme 273 inchangée).
const ROUTE_TOKENS_WEEK = { checked: 272, unreached: 1 };
/**
 * Substitutions de `playScenes` sur `pairCover(w10, 7)` [mesuré, N7] : les voies du contrôle que l'état ferme (bons, composant, palier),
 * que la preuve ne porte pas. T13 fix 1 en comptait une 17e, `j4.door (non nommé) -> go` : la branche `ifUnavailable` d'un jalon toujours
 * dû (j4.door, sa scène pose `exit home`), et non `requires` comme le disait ce commentaire (revue T13, I-4). N7 l'a retirée de `pathsOf`.
 */
const ROUTE_SUBSTITUTIONS_WEEK: readonly string[] = [
  ...[1, 2, 3, 4, 5, 6].flatMap((d) => (d === 1 ? ['buy:bons'] : ['buy:bons', 'buy:component', 'courtesy']).map((o) => `checkpoint.j${d} ${o} -> comply`)),
].sort();
/** Chemins de `pairCover(w10, 7)` (91 depuis N7, 93 avant) que le metteur en scène rejoue acte par acte, minutes comprises [mesuré, N7 ; 0 avant]. */
const PROOF_EQUAL_WEEK = 75;
/**
 * Premier refus du moteur avant la fin, sur chaque chemin de `pairCover(w10, 7)` rejoué par `engineActsOf` [mesuré, N7] : 16, une par
 * voie du contrôle que l'état ferme (les 16 de `ROUTE_SUBSTITUTIONS_WEEK`). Aucun refus de minute, de `requires` ni d'`ifUnavailable`.
 * Avant N7 (T13 fix 1, 93 chemins) : 86 à `j2.agentReturn` (I-2) et 7 autres, attribués chemin par chemin par N7 : les 3 `registre
 * outOfOrder` du J4 sont I-1 (entrée au Registre à 535, horloge du moteur à 595 porte fermée) ; les 2 `bonsInsufficient` et les 2
 * `unknownOption` sont des voies fermées par l'état (bons, composant, courtoisie), pas l'horloge [l'inférence « I-1 » de T13 était fausse pour eux].
 */
const PROOF_REFUSALS_WEEK: Readonly<Record<string, number>> = {
  'checkpoint buy:bons bonsInsufficient': 6,
  'checkpoint buy:component unknownOption': 5,
  'checkpoint courtesy unknownOption': 5,
};

/** Jetons `<scène>~<branche>` du segment de clé d'un jour. */
const routeTokensOf = (dayKey: string): readonly (readonly [string, string])[] =>
  dayKey.slice(dayKey.indexOf(':') + 1).split('>').flatMap((t) => { const i = t.indexOf('~'); return i < 0 ? [] : [[t.slice(0, i), t.slice(i + 1)] as const]; });

/** Les étapes présentées par le metteur en scène sur le chemin `p`, joué comme `playCover` (option du chemin si offerte, sinon la première). */
function playScenes(r: DirectorRig, p: GuidedPath, subs: Set<string>): ReadonlySet<string> {
  const picks = picksOf(p);
  const seen = new Set<string>();
  for (let i = 0; i < 3000; i++) {
    const b = r.dir.current();
    if (b.kind === 'demoEnd' || b.kind === 'end') return seen;
    const id = r.dir.sceneId();
    if (id !== null) seen.add(id);
    if (b.kind !== 'choice') { r.dir.advance(); continue; }
    const want = picks[b.view.id];
    const offered = b.view.options.some((o) => o.id === want);
    const opt = offered ? want! : b.view.options[0]!.id;
    if (!offered) {   // M-1 (revue T13) : seule une voie du contrôle se remplace ; toute autre option absente lève
      if (want !== undefined && !b.view.id.startsWith('checkpoint.')) throw new Error(`playScenes : ${b.view.id}=${want} non offert hors contrôle`);
      subs.add(`${b.view.id} ${want ?? '(non nommé)'} -> ${opt}`);
    }
    if (b.priced) r.drv.designate(b.view.id, opt);
    const res = r.dir.choose(opt);
    if (!res.ok) throw new Error(`playScenes : ${b.view.id}=${opt} refusé (${res.rejected.reason})`);
  }
  throw new Error('playScenes : plus de 3000 temps');
}

/** Les scènes du jour `day` jouées au metteur en scène sur le chemin couloir amendé par `picks` (pathOf ne convient pas : T11). */
function sceneIdsOfDay(day: DayIndex, picks: Readonly<Record<string, string>>): readonly string[] {
  const r = directorRig();
  const ids: string[] = [];
  for (let i = 0; i < 3000; i++) {
    const b = r.dir.current();
    if (b.kind === 'demoEnd' || b.kind === 'end') break;
    const id = r.dir.sceneId();
    if (id !== null && id.startsWith(`j${day}.`) && !ids.includes(id)) ids.push(id);
    stepOnce(r, { ...COULOIR_PICKS, ...picks });
  }
  return ids;
}
