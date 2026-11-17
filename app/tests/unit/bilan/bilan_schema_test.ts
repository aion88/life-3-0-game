import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadBilanCommon } from '../../../src/data/bilanLoad';
import { sharePercent } from '../../../src/bilan/share';
import { bilanWorldSchema } from '../../../src/data/schema/bilan';
import { createI18n, ruleFor, type StringMeta } from '../../../src/i18n/i18n';
import { validateContent } from '../../../src/validate/content';
import { parseWorld } from '../../../src/data/schema/world';
import { RIGHT_IDS } from '../../../src/shared/types/street';
import frJson from '../../../src/data/strings/fr.json';
import enJson from '../../../src/data/strings/en.json';
import metaJson from '../../../src/data/strings/meta.json';
import gridOracle from '../../fixtures/grid.oracle.json';
import { cat, realInput, w10Raw } from '../../fixtures/data/factories';

const meta = metaJson as StringMeta;
const bilanRaw = () => structuredClone(w10Raw['bilan']) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function sourcesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourcesOf(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('bilan : réglages communs', () => {
  it('test_sigma100_read_from_bilan_data', () => {
    expect(loadBilanCommon().sigma100).toBe(100);
    for (const f of sourcesOf('src/bilan')) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\b100\b/);   // aucune constante 100 dans src/bilan
  });
  it('test_bilan_counts_sum_to_total', () => {
    const c = loadBilanCommon();
    expect(c.counts).toHaveLength(12);
    expect(c.counts.reduce((s, r) => s + r.count, 0)).toBe(746_496);
    expect(c.total).toBe(746_496);
  });
  it('test_bilan_counts_match_plan01_grid_oracle', () => {
    for (const r of loadBilanCommon().counts) expect(r.count, r.world).toBe((gridOracle.counts as Record<string, number>)[r.world]);
  });
  it('test_bilan_settings_follow_gdd06_tuning_knobs', () => {
    const c = loadBilanCommon();
    expect(c.sheetMaxLines).toBe(7); expect(c.others).toEqual({ min: 0, max: 4 }); expect(c.traceback).toEqual({ min: 2, max: 3 }); expect(c.rightsCount).toBe(8);
    expect(c.contentPoints).toHaveLength(8);
  });
});

describe('bilan : parts', () => {
  it('test_share_percent_fr_en', () => {
    expect(sharePercent(235_696, 746_496, 'fr')).toBe('31,6 %');
    expect(sharePercent(235_696, 746_496, 'en')).toBe('31.6%');
  });
  it('test_share_one_in_n_for_rare_world', () => { expect(Math.round(746_496 / 814)).toBe(917); });
  it('test_arrival_rows_are_the_ten_arrival_worlds', () => {
    const arrival = loadBilanCommon().counts.filter((r) => cat.byId[r.world].kind === 'arrival');
    expect(arrival).toHaveLength(10);
    const ext = loadBilanCommon().counts.filter((r) => cat.byId[r.world].kind === 'extinction');
    expect(ext.map((r) => r.world)).toEqual(['w07', 'w12']);
    expect(arrival.reduce((s, r) => s + r.count, 0) + ext.reduce((s, r) => s + r.count, 0)).toBe(746_496);   // w07 et w12 sont dans le total, pas dans le tableau
  });
});

describe('bilan : schéma du monde', () => {
  it('test_real_w10_bilan_parses_and_world_still_loads', () => {
    expect(bilanWorldSchema.safeParse(w10Raw['bilan']).success).toBe(true);
    expect(parseWorld(w10Raw, cat).bilan).toMatchObject({ worldBlockId: expect.any(String) });
  });
  it('test_empty_bilan_block_is_still_a_valid_world_for_other_files', () => {
    const raw = structuredClone(w10Raw); raw['bilan'] = {};
    expect(parseWorld(raw, cat).bilan).toEqual({});
  });
  it('test_bilan_world_schema_is_strict', () => {
    const b = bilanRaw(); b['inconnu'] = 1; expect(bilanWorldSchema.safeParse(b).success).toBe(false);
    const d = bilanRaw(); d.dossier.extra = 1; expect(bilanWorldSchema.safeParse(d).success).toBe(false);
  });
  it('test_world_with_unknown_bilan_key_is_refused_by_parse_world', () => {
    const raw = structuredClone(w10Raw); raw['bilan'].inconnu = 1;
    expect(() => parseWorld(raw, cat)).toThrow();
  });
  it('test_w10_bilan_rejects_missing_right_carrier', () => {
    const b = bilanRaw(); delete b.rights.carriers.speak; expect(bilanWorldSchema.safeParse(b).success).toBe(false);
    expect(Object.keys(bilanRaw().rights.carriers).sort()).toEqual([...RIGHT_IDS].sort());
  });
  it('test_right_carrier_var_is_a_world_var', () => {
    const b = bilanRaw(); b.rights.carriers.move.var = 'gauge'; expect(bilanWorldSchema.safeParse(b).success).toBe(false);
    const s = bilanRaw(); s.rights.carriers.move.sign = 0; expect(bilanWorldSchema.safeParse(s).success).toBe(false);
  });
  it('test_w10_bilan_has_no_copy_of_relecture_lines', () => {
    const text = JSON.stringify(w10Raw['bilan']);
    expect(text).not.toMatch(/relecture/);
    expect(text).not.toMatch(/w10\.doc/);
  });
  it('test_emphasis_is_the_variables_named_by_the_w10_slopes', () => {
    const named = new Set((w10Raw['engine'].slopes as { readings: { var: string }[] }[]).flatMap((s) => s.readings.map((r) => r.var)));
    expect(new Set(bilanRaw().emphasis)).toEqual(named);
  });
  it('test_sources_need_at_least_one_sourced_row', () => {
    const b = bilanRaw(); b.sources = b.sources.filter((r: { label: string }) => r.label !== 'sourced');
    expect(bilanWorldSchema.safeParse(b).success).toBe(false);
  });
  it('test_share_format_is_nullable_pair_by_decision_9', () => {
    expect(bilanRaw().share).toEqual({ width: null, height: null });
    const b = bilanRaw(); b.share = { width: 1080, height: 1350 }; expect(bilanWorldSchema.safeParse(b).success).toBe(true);
    b.share = { width: 0, height: null }; expect(bilanWorldSchema.safeParse(b).success).toBe(false);
  });
  it('test_dossier_ids_are_w10_street_ids', () => {
    const choices = new Map((w10Raw['street'].choices as { id: string; options: { id: string }[] }[]).map((c) => [c.id, c.options.map((o) => o.id)]));
    const d = bilanRaw().dossier;
    for (const n of d.names) { expect(choices.get(n.choiceId)).toContain(n.nameOption); expect(choices.get(n.choiceId)).toContain(n.refuseOption); }
    expect(choices.get(d.audition.choiceId)).toEqual(expect.arrayContaining(Object.keys(d.audition.keys)));
    expect(Object.keys(d.mentionKeys).sort()).toEqual(['declaredLeaver', 'radioFromInside', 'savedByName', 'twoNamesThenArrested']);
  });
});

describe('bilan : politiques de chaînes', () => {
  it('test_meta_prefix_policies', () => {
    expect(ruleFor(meta, 'lang.title').policy).toBe('voice');
    expect(ruleFor(meta, 'bilan.sheet.title').policy).toBe('bilan');
    expect(ruleFor(meta, 'w10.bilan.file.noneFlagged').policy).toBe('bilan');
    expect(ruleFor(meta, 'sources.label.sourced').policy).toBe('sources');
    expect(ruleFor(meta, 'redirect.arrival').policy).toBe('bilan');
    expect(ruleFor(meta, 'ff.ui.pause').policy).toBe('voice');
    expect(ruleFor(meta, 'world.w10.name').allowCalendar).toBe(true);
    expect(ruleFor(meta, 'w10.day.1.date').allowCalendar).toBe(true);
    expect(ruleFor(meta, 'w10.bilan.file.noneFlagged').numericParams).toEqual(expect.arrayContaining(['title', 'label', 'world', 'year', 'n', 'lived', 'computed']));
  });
  it('test_longest_prefix_wins', () => {
    const m: StringMeta = { bilan: { policy: 'bilan' }, 'bilan.x': { policy: 'voice' } };
    expect(ruleFor(m, 'bilan.x.y').policy).toBe('voice'); expect(ruleFor(m, 'bilan.z').policy).toBe('bilan');
  });
  const strings = { fr: { k: 'texte' }, en: { k: 'text' } };
  // `guided` retiré : ses clés de texte ne sont pas dans la table réduite `strings` (rue guidée T5)
  const withMeta = (rule: StringMeta[string]) => {
    const input = realInput();
    return { ...input, worlds: input.worlds.map((w) => ({ ...w, street: { ...w.street, guided: null } })), strings, meta: { k: rule } as StringMeta };
  };
  it('test_numeric_params_allowed_under_bilan_forbidden_under_voice', () => {
    expect(validateContent(withMeta({ policy: 'bilan', numericParams: ['year'] })).errors).toEqual([]);
    expect(validateContent(withMeta({ policy: 'voice', numericParams: ['year'] })).errors.map((e) => e.code)).toContain('GDD05-V8-numeric-params-under-voice');
  });
  const i18nFor = (rule: StringMeta[string], tpl: string, mode: 'dev' | 'prod' = 'dev', report: (i: unknown) => void = () => {}) =>
    createI18n({ fr: { 'k.t': tpl }, en: { 'k.t': tpl } }, { k: rule }, 'fr', { mode, report });
  it('test_world_name_1984_counts_as_numeric_param', () => {
    expect(i18nFor({ policy: 'bilan', numericParams: ['world'] }, 'monde {world}').t('k.t', { world: '1984' })).toBe('monde 1984');
    expect(() => i18nFor({ policy: 'bilan' }, 'monde {world}').t('k.t', { world: '1984' })).toThrow(/numeric/);
  });
  it('test_zero_numeric_param_refused_under_bilan', () => {
    const seen: { code: string }[] = [];
    i18nFor({ policy: 'bilan', numericParams: ['n'] }, '{n}', 'prod', (i) => seen.push(i as { code: string })).t('k.t', { n: 0 });
    expect(seen.map((i) => i.code)).toEqual(['numeric-param']);
    expect(() => i18nFor({ policy: 'bilan', numericParams: ['n'] }, '{n}').t('k.t', { n: 0 })).toThrow(/zero/);
  });
  it('test_real_meta_declares_world_param_on_redirect_and_bilan', () => {
    const t = createI18n({ fr: { 'redirect.arrival': 'ici {lived} la {computed}', 'bilan.others.line': '{label} {title} {world}' }, en: {} }, meta, 'fr', { mode: 'dev', report: () => {} });
    expect(t.t('redirect.arrival', { lived: '1984', computed: 'Gatekeeper' })).toBe('ici 1984 la Gatekeeper');
    expect(t.t('bilan.others.line', { label: 'x', title: 'y', world: '1984' })).toBe('x y 1984');
  });
  it('test_both_languages_ship_the_same_bilan_keys', () => {
    const fr = Object.keys(frJson).filter((k) => k.startsWith('bilan.')).sort(); const en = Object.keys(enJson).filter((k) => k.startsWith('bilan.')).sort();
    expect(fr.length).toBeGreaterThan(0); expect(en).toEqual(fr);
  });
});
