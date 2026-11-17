/**
 * J1 et J2 de w10 écrits [plan rue guidée J1-J2, T5 ; spec §4 à §7, §11] : le bloc `guided` réel passe le schéma, la preuve des chaînes
 * (A, B, E ouvertes sur chaque suite, un maillon par jour, 3 à 5 scènes), les modes de parole de la grille B-1, la politique des nombres.
 * Contenu PROVISOIRE (writer, narrative-director, world-builder) ; les prix de la bible sont figés par `w10-choices-before.json`.
 */
import { describe, expect, it } from 'vitest';
import { parseWorld } from '../../../src/data/schema/world';
import { proveGuided, pathsOf, refOf } from '../../../src/validate/guided';
import { PROVISIONAL } from '../../../src/validate/provisional';
import { replay } from '../../../src/engine/moments/replay';
import type { Issue } from '../../../src/shared/types/common';
import frJson from '../../../src/data/strings/fr.json';
import metaJson from '../../../src/data/strings/meta.json';
import W10_CHOICES_BEFORE from '../../fixtures/guided/w10-choices-before.json';
import { cat, realInput, w10Raw } from '../../fixtures/data/factories';
import { modeWords } from '../../support/narrative_words_grid';
import { ctxW10 } from '../../support/street';
import { nightValue, palierAfter, pathOf, sceneIdsOf, withNarrativeWordsZero, withOrderValue } from '../../support/guided';

const FR = frJson as Record<string, string>;
const loadW10 = () => parseWorld(w10Raw, cat);
const codes = (r: { readonly issues: readonly Issue[] }): readonly string[] => r.issues.map((i) => i.code);
const ctx = ctxW10();
/** Reste-t-il un chiffre une fois les jetons déclarés retirés du texte ? */
const digitsBeyondTokens = (text: string, tokens: readonly string[]): boolean => /\d/u.test(tokens.reduce((t, k) => t.split(k).join(''), text));

describe('guided w10 (J1, J2)', () => {
  it('test_w10_guided_parses', () => { expect(loadW10().street.guided?.scenes.length).toBeGreaterThan(0); });
  it('test_every_day_has_three_to_five_scenes_on_every_path', () => {
    expect(codes(proveGuided(loadW10().street, { throughDay: 2, mustOpen: [] }, refOf(realInput())))).not.toContain('guided.stageCount');   // scènes = `stage` (décision 11), pas étapes
  });
  it('test_default_comply_path_reaches_registre_on_time', () => {
    const st = loadW10().street;
    expect(sceneIdsOf(pathOf(st, { 'j1.street': 'straight', 'checkpoint.j1': 'comply' }))).toContain('j1.registre');
    expect(sceneIdsOf(pathOf(st, { 'j1.street': 'scan', 'm1.scan': 'scan', 'checkpoint.j1': 'comply' }))).toContain('j1.registre.late');
  });
  it('test_speech_modes_match_the_grid', () => {
    for (const d of [1, 2] as const) {
      expect(loadW10().street.guided!.speechModes[d]).toEqual({ muet: modeWords('muet', d, false), couloir: [40, modeWords('couloir', d, false)], bavard: modeWords('bavard', d, false) });
    }   // 14, [40, 60], 70 ; modeWords de app/tests/support/narrative_words_grid.ts (9c0ccf2)
  });
  it('test_w10_days_reach_muet_couloir_bavard', () => {
    const r = proveGuided(loadW10().street, { throughDay: 2, mustOpen: [] }, refOf(realInput()));
    expect(codes(r)).not.toContain('guided.modeUnreachable');
    expect(r.proof.modes).toEqual({ 1: ['muet', 'couloir', 'bavard'], 2: ['muet', 'couloir', 'bavard'] });
  });
  it('test_narrative_words_effect_is_measured', () => {   // B-1 : rend VISIBLE l'effet des mots narratifs par chemin ; le verdict, lui, vient de la grille remesurée
    // La nuit 1 ne lit que les actes du J1 : une ligne par préfixe J1 distinct de `pathsOf` (sans perte). Un chemin que le moteur refuse
    // avant la nuit 1 (voie non ouverte : `pathsOf` ne lit pas l'état, filtre `availableOptions` en T6) est compté par raison.
    const zero = withNarrativeWordsZero(ctx);
    const preN8 = withOrderValue(ctx, 0);   // moteur d'avant N8 : aucune consigne payée (aucun `obey` dans la rue)
    const ref = refOf(realInput());
    const all = pathsOf(loadW10().street, 2);
    const byJ1 = new Map(all.map((p) => [p.key.split(' | ')[0]!, p] as const));
    const refused: Record<string, number> = {};
    const tiers: Record<string, { words: Record<string, number>; zero: Record<string, number> }> = {};
    const deltas: number[] = [];
    const bump = (t: Record<string, number>, k: string): void => { t[k] = (t[k] ?? 0) + 1; };
    for (const p of byJ1.values()) {
      const j1 = p.acts.slice(0, p.acts.findIndex((a) => a.day === 1 && a.kind === 'sleep') + 1);
      const no = replay(j1, ctx).rejected[0];
      if (no !== undefined) { bump(refused, `${no.act.kind} ${no.act.option} : ${no.reason}`); continue; }
      const n1 = nightValue(p, 1, ctx), n1zero = nightValue(p, 1, zero);
      // N8 : la seule différence avec le moteur d'avant (consigne à 0) est +2 la nuit 1 si la voie du J1 fait la file (comply, courtesy).
      const queued = j1.some((a) => a.kind === 'lane' && (a.option === 'comply' || a.option === 'courtesy'));
      expect(n1 - nightValue(p, 1, preN8), p.key).toBe(queued ? 2 : 0);
      expect(n1).toBeGreaterThanOrEqual(n1zero - 8);   // le terme silence est plafonné à 8 (integrity.ts:76-84) : parler ne peut coûter plus que ce plafond par rapport au silence
      deltas.push(n1 - n1zero);
      const w = ref.wordsOfDay(1, j1);   // mode de parole du J1, bornes de speechModes (14, [40, 60], 70)
      const mode = w <= 14 ? 'muet' : w >= 40 && w <= 60 ? 'couloir' : w >= 70 ? 'bavard' : 'horsMode';
      const t = (tiers[mode] ??= { words: {}, zero: {} });
      bump(t.words, palierAfter(p, 1, ctx)); bump(t.zero, palierAfter(p, 1, zero));
    }
    expect({ paths: all.length, j1Paths: byJ1.size }).toEqual({ paths: 6210, j1Paths: 3420 });   // N7 : 9 018 avant (branche de j2.agentReturn hors `requires`), J1 inchangé
    expect(refused).toEqual({ 'lane buy:bons : bonsInsufficient': 576, 'lane buy:component : unknownOption': 288 });
    // palier du J2 (relevé de la nuit 1) par mode de parole du J1, avec les mots narratifs (`words`) et sans (`zero`). N8 : chaque bascule de
    // palier vient du +2 de la nuit 1 des chemins à file (épinglé chemin par chemin ci-dessus) ; avant N8 : muet 352/244, couloir thanks 696
    // courtesy 156 (zero 480/372), bavard 64/64 (zero 64/64), horsMode thanks 804 patience 176 (zero 544/436). Totaux par mode inchangés.
    expect(tiers).toEqual({
      muet: { words: { patience: 320, thanks: 276 }, zero: { patience: 320, thanks: 276 } },
      couloir: { words: { thanks: 600, courtesy: 252 }, zero: { patience: 384, thanks: 468 } },
      bavard: { words: { patience: 64, thanks: 64 }, zero: { patience: 32, thanks: 96 } },
      horsMode: { words: { thanks: 868, patience: 112 }, zero: { patience: 416, thanks: 564 } },
    });
    expect({ min: Math.min(...deltas), max: Math.max(...deltas) }).toEqual({ min: -4, max: 14 });   // n1 - n1zero, en points
  });
  it('test_path_of_returns_paths_the_engine_accepts', () => {
    const st = loadW10().street;
    for (const picks of [{}, { 'j1.street': 'straight', 'checkpoint.j1': 'comply' }, { 'j1.street': 'scan', 'm1.scan': 'scan', 'checkpoint.j1': 'comply' }]) {
      expect(replay(pathOf(st, picks).acts, ctx).rejected).toEqual([]);
    }
  });
  it('test_every_path_links_each_day_and_opens_a_b_e', () => {
    const r = proveGuided(loadW10().street, { throughDay: 2, mustOpen: ['A', 'B', 'E'] }, refOf(realInput()));
    expect(r.issues).toEqual([]);
    expect(r.proof.perDayMin).toEqual({ 1: expect.any(Number), 2: expect.any(Number) });
    expect(Math.min(r.proof.perDayMin[1]!, r.proof.perDayMin[2]!)).toBeGreaterThanOrEqual(1);
    expect(r.proof.opened).toEqual(['A', 'B', 'E']);
  });
  it('test_every_scene_has_a_person_doing_something', () => {   // spec §9.3
    const NO_ACTOR = ['j1.wake', 'j1.component', 'j2.wake'];   // au logement, seuls le téléphone et le narrateur parlent
    for (const s of loadW10().street.guided!.scenes.filter((x) => x.day <= 2)) {   // J3 et suite : guided_week_test.ts
      if (NO_ACTOR.includes(s.id)) { expect(s.actor).toBeNull(); expect(s.stage).toBe('home'); continue; }
      expect(s.actor).not.toBeNull(); expect(FR[s.actor!.nameKey]).toBeTruthy(); expect(FR[s.actor!.actionKey]).toBeTruthy();
    }
  });
  it('test_guided_text_is_provisional_with_owners', () => {
    expect(PROVISIONAL).toContainEqual(expect.objectContaining({ prefix: 'w10.scene', owner: 'writer' }));
    expect(PROVISIONAL).toContainEqual(expect.objectContaining({ prefix: 'w10.chain', owner: 'narrative-director' }));
    expect(PROVISIONAL).toContainEqual(expect.objectContaining({ kind: 'world', world: 'w10', path: 'street.guided', owner: 'world-builder' }));
  });
  it('test_priced_prices_unchanged', () => {   // W10_CHOICES_BEFORE : fixture écrite AVANT la première édition de w10.json
    expect(loadW10().street.choices).toEqual(W10_CHOICES_BEFORE);
    expect(W10_CHOICES_BEFORE).toHaveLength(32);
  });
  it('test_voice_lines_have_no_digit', () => {
    const meta = metaJson as Record<string, { readonly allowTokens?: readonly string[] }>;
    // une clé qui déclare ses chiffres en `allowTokens` (« 2026 » de l'encart du relevé) n'est exemptée que de CES jetons
    for (const [k, v] of Object.entries(FR)) if (/^w10\.(scene|chain|recap|demo)\./.test(k)) expect(digitsBeyondTokens(v, meta[k]?.allowTokens ?? []), k).toBe(false);
  });
  it('test_digit_exemption_is_scoped_to_declared_tokens', () => {
    expect(digitsBeyondTokens('En 2026', ['2026'])).toBe(false);
    expect(digitsBeyondTokens('En 2026, pas 2025', ['2026'])).toBe(true);
    expect(digitsBeyondTokens('En 2026', [])).toBe(true);
    const box = metaJson as Record<string, { readonly allowTokens?: readonly string[] }>;
    expect(box['w10.recap.box2026']?.allowTokens).toEqual(['2026']);
    expect(digitsBeyondTokens(FR['w10.recap.box2026']!.replace('2026', '2025'), box['w10.recap.box2026']!.allowTokens!)).toBe(true);
  });
});
