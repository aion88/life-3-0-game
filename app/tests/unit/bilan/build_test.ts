/** Assemblage pur du bilan [plan 03 T11 ; GDD 06 §3.1, §3.9, §3.11, §8.2 B-V8, B-V10 ; D140]. */
import { describe, expect, it, vi } from 'vitest';
import { buildBilan, shownYears } from '../../../src/bilan/build';
import { canonicalJson } from '../../../src/shared/canonical';
import { yearOfStep } from '../../../src/fastforward/headlines';
import type { BilanInput } from '../../../src/shared/types/bilan';
import type { RunResult } from '../../../src/shared/types/run';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import { replay } from '../../../src/engine/moments/replay';
import { toBilanInput } from '../../../src/engine/moments/bilan';
import { ctxW10 } from '../../support/street';
import { actsOfProfile } from '../../support/profile_acts';
import { partialWeek } from '../../support/bilan_curve';
import { bctx, weekEndOf, W10 } from '../../support/bilan_build';
import { runOf } from '../../support/run';

const EXT = runOf('CBCCBDBACCD');
const REDIRECTED = runOf('AAAAAAAAAAA');
const extinctionInput = (run: RunResult = EXT): BilanInput => ({ entry: 'extinction', run, week: null, survival: null, acts: [] });
const earlyNullWeek = (): BilanInput => ({ ...weekEndOf('Un nom, J4'), entry: 'earlyEnd', week: null, survival: null });
const twice = <T,>(fn: () => T): T => { const a = fn(); expect(canonicalJson(fn())).toBe(canonicalJson(a)); return a; };

describe('buildBilan [plan 03 T11]', () => {
  it('test_build_bilan_twice_same', () => {
    for (const i of [weekEndOf(), earlyNullWeek(), extinctionInput()]) twice(() => buildBilan(i, bctx(i.entry === 'extinction' ? { lived: null } : {})));
  });

  it('test_build_bilan_leaves_save_untouched', () => {
    // buildBilan ne reçoit aucun magasin ; l'espion vérifie en plus qu'il ne touche ni l'horloge ni le hasard.
    const spies = [vi.spyOn(Date, 'now'), vi.spyOn(Math, 'random')];
    buildBilan(weekEndOf(), bctx());
    for (const s of spies) { expect(s).not.toHaveBeenCalled(); s.mockRestore(); }
    const input = weekEndOf();
    const before = canonicalJson(input);
    buildBilan(input, bctx());
    expect(canonicalJson(input)).toBe(before);
  });

  it('test_week_end_input_has_full_blocks_for_w10', () => {
    const b = buildBilan(weekEndOf(), bctx());
    expect(b.entry).toBe('weekEnd');
    expect(b.sheet!.days.length).toBeGreaterThan(0);
    expect(b.curve.street).not.toBeNull();
    expect(b.curve.withEcho).not.toBeNull();
    expect(b.dossier).not.toBeNull();
    expect(b.rights).toHaveLength(8);
    expect(b.traceback.length).toBeGreaterThanOrEqual(2);
    expect(b.others.locked).toBe(b.others.lines.length === 0);
    expect(b.sources.world).toBe('w10');
    expect(b.softened).toBe(false);
  });

  it('test_early_end_with_partial_week_keeps_curve_and_stops_street_at_day_done', () => {
    // R-03.14 : earlyEnd = readings.length ; weekEnd = 1 + readings.length (relevés de nuits closes de `StreetState`).
    for (const [profile, entry] of [['Bavard', 'earlyEnd'], ['Muet', 'earlyEnd'], ['Bavard, quatre noms', 'earlyEnd'], ['Zéro nom', 'weekEnd']] as const) {
      const st = ctxW10();
      const r = replay(actsOfProfile(profile), st);
      const input = toBilanInput(r.state, r.week, st);
      expect(input.entry).toBe(entry);
      const b = buildBilan(input, bctx());
      expect(b.curve.street!.length).toBe(entry === 'earlyEnd' ? r.state.readings.length : 1 + r.state.readings.length);
    }
  });

  it('test_early_end_with_partial_week_curve_is_the_days_done', () => {
    const week = partialWeek(3);
    const input: BilanInput = { ...weekEndOf('Un nom, J4'), entry: 'earlyEnd', week, survival: null };
    const b = buildBilan(input, bctx());
    expect(b.curve.street).toEqual(week.curve);
    expect(b.curve.street!.length).toBeLessThan(8);
    expect(b.curve.fastForward.length).toBeGreaterThan(0);
  });

  it('test_early_end_with_null_week_degrades_to_bascule_none', () => {
    const b = buildBilan(earlyNullWeek(), bctx());
    expect(b.curve.street).toBeNull();
    expect(b.curve.bascule.case).toBe('none');
    expect(b.curve.withEcho).toBeNull();
    expect(b.sheet).not.toBeNull();
  });

  it('test_extinction_entry_has_no_sheet_days_no_kit_no_redirect', () => {
    const b = buildBilan(extinctionInput(), bctx({ lived: null }));
    expect(b.sheet).toBeNull();
    expect(b.dossier).toBeNull();
    expect(b.rights).toBeNull();
    expect(b.redirect).toBeNull();
    expect(b.worldBlockId).toBeNull();
    expect(b.curve.street).toBeNull();
    expect(b.traceback.length).toBeGreaterThanOrEqual(2);
    expect(b.sources.world).toBe('w07');
  });

  it('test_redirect_block_and_sheet_name_both_worlds', () => {
    expect(REDIRECTED.outcome).toMatchObject({ kind: 'arrival', computedWorld: 'w03', livedWorld: 'w10', redirected: true });
    const b = buildBilan(weekEndOf('Zéro nom', REDIRECTED), bctx());
    expect(b.redirect).toEqual({ computed: 'w03', lived: 'w10' });
    expect(b.sheet).toMatchObject({ computedWorld: 'w03', livedWorld: 'w10', redirected: true });
    expect(b.curve).toMatchObject({ historyWorld: 'w03', lifeWorld: 'w10' });     // deux mondes, jamais mêlés
    expect(b.sources.world).toBe('w03');                                          // l'histoire, pas la vie
    expect(b.worldBlockId).toBe('w10.dossier');                                   // la vie
  });

  it('test_lived_null_and_redirected_keeps_redirect_and_life_world', () => {
    const b = buildBilan(weekEndOf('Zéro nom', REDIRECTED), bctx({ lived: null }));
    expect(b.redirect).toEqual({ computed: 'w03', lived: 'w10' });
    expect(b.curve.lifeWorld).toBe('w10');
    expect(b.sheet).toBeNull();
  });

  it('test_not_redirected_has_null_redirect', () => {
    const run = runOf('ACBACBACAAD');
    const b = buildBilan(weekEndOf('Zéro nom', run), bctx());
    expect(b.redirect).toBeNull();
    expect(b.sheet!.redirected).toBe(false);
  });

  it('test_world_block_id_is_lived_world_or_null', () => {
    expect(buildBilan(weekEndOf(), bctx()).worldBlockId).toBe('w10.dossier');
    expect(buildBilan(extinctionInput(), bctx({ lived: null })).worldBlockId).toBeNull();
    // un monde vécu sans fichier dans la build : pas de bloc propre, ni fiche ni dossier ni droits
    const b = buildBilan(weekEndOf(), bctx({ lived: null }));
    expect([b.worldBlockId, b.sheet, b.dossier, b.rights]).toEqual([null, null, null, null]);
  });

  it('test_lived_file_must_be_the_lived_world', () => {
    expect(() => buildBilan(weekEndOf(), bctx({ lived: { ...W10, id: 'w03' } as typeof W10 }))).toThrow(/monde vécu/);
  });

  it('test_computed_file_feeds_the_sources_rows_only', () => {
    expect(buildBilan(weekEndOf(), bctx({ computedFile: W10 })).sources.worldRows).not.toBeNull();
    expect(buildBilan(weekEndOf(), bctx()).sources.worldRows).toBeNull();
    // redirigé : le tableau est celui du monde CALCULÉ (w03, sans fichier), jamais celui de w10 vécu
    expect(buildBilan(weekEndOf('Zéro nom', REDIRECTED), bctx()).sources.worldRows).toBeNull();
    expect(() => buildBilan(weekEndOf('Zéro nom', REDIRECTED), bctx({ computedFile: W10 }))).toThrow(/monde calculé/);
  });

  it('test_softened_flag_does_not_change_data_only_flags_it', () => {
    const input = weekEndOf();
    const soft = { ...input, run: { ...input.run, softened: true } };
    const a = buildBilan(input, bctx());
    const b = buildBilan(soft, bctx());
    expect(b.softened).toBe(true);
    expect({ ...b, softened: false }).toEqual(a);
  });

  it('test_b_v10_softened_build_has_no_rupture_year_string', () => {
    const plain = buildBilan(extinctionInput(), bctx({ lived: null }));
    expect(shownYears(plain)).toEqual({ rupture: yearOfStep(60), projected: null });
    const soft = buildBilan(extinctionInput({ ...EXT, softened: true }), bctx({ lived: null }));
    expect(soft.softened).toBe(true);
    expect(shownYears(soft)).toEqual({ rupture: null, projected: null });
    expect(canonicalJson(shownYears(soft))).not.toContain(String(yearOfStep(60)));
    // la ligne de projection d'extinction d'une partie d'arrivée suit la même règle
    const arrival = weekEndOf();
    const a = buildBilan(arrival, bctx());
    expect(a.curve.projectedExtinctionYear).not.toBeNull();
    expect(shownYears(a).projected).toBe(a.curve.projectedExtinctionYear);
    expect(shownYears(buildBilan({ ...arrival, run: { ...arrival.run, softened: true } }, bctx())).projected).toBeNull();
  });

  it('test_fr_and_en_build_same_ids', () => {
    const lang = (l: 'fr' | 'en') => buildBilan(weekEndOf(), bctx({}, l));
    const a = lang('fr'), b = lang('en');
    const ids = (d: typeof a) => ({
      days: d.sheet!.days.map((x) => [x.day, x.origin, x.textKey]), kit: d.sheet!.kit.map((x) => x.itemId),
      others: d.others.lines.map((x) => [x.question, x.answer]), trace: d.traceback.map((x) => [x.question, x.answer]),
      rights: d.rights!.map((x) => x.lineKey), names: d.dossier!.names.length, files: d.dossier!.files.length,
    });
    expect(ids(b)).toEqual(ids(a));
    expect(Object.keys(fr).length).toBe(Object.keys(en).length);
  });
});
