/**
 * Fiche de vie (plan 03, T8 ; GDD 06 §3.3) : sept jours, kit, ce qui a tenu ou tué. Entrées : profils de l'oracle de survie rejoués en actes
 * (R-03.13) ; la donnée réelle de `fate` est vide (R-03.19), les lignes de sort se testent sur un rapport synthétique.
 */
import { describe, expect, it } from 'vitest';
import frJson from '../../../src/data/strings/fr.json';
import enJson from '../../../src/data/strings/en.json';
import { buildSheet, dayLine, dayLines, kitRows } from '../../../src/bilan/sheet';
import { replay } from '../../../src/engine/moments/replay';
import { toBilanInput } from '../../../src/engine/moments/bilan';
import { eveningLines } from '../../../src/engine/moments/evening';
import { AXES } from '../../../src/engine/moments/types';
import type { StreetContext } from '../../../src/engine/moments/types';
import type { BilanInput, SurvivalReport } from '../../../src/shared/types/bilan';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import type { RunResult } from '../../../src/shared/types/run';
import { actsOfProfile } from '../../support/profile_acts';
import { act, ctxW10 } from '../../support/street';

const fr = frJson as Record<string, string>; const en = enJson as Record<string, string>;
const ctx = ctxW10();
/** Existence d'une clé FR : ce que `i18n.has` répond à l'écran. */
const has = (k: string): boolean => k in fr;

/** Entrée du bilan d'un profil de l'oracle, rejoué par le moteur (survie réelle). */
function inputOf(profile: string, opts: { audition?: string } = {}, c: StreetContext = ctx): BilanInput {
  const { state, week } = replay(actsOfProfile(profile, opts), c);
  return toBilanInput(state, week, c);
}
/** Entrée synthétique : actes à la main, survie fournie. */
function synth(acts: readonly ActRecord[], survival: SurvivalReport | null, entry: BilanInput['entry'] = 'weekEnd'): BilanInput {
  return { entry, run: ctx.run, week: null, survival, acts };
}
const REPORT: SurvivalReport = { endKind: 'derivedThreshold', endId: 'arrested', endDay: 4, pricesPaid: [], comfortsTaken: [] };
const REL = (d: DayIndex, min = 700): ActRecord => act(d, min, 'choice', `relecture.j${d}`, 'pass');

describe('buildSheet : lignes des jours', () => {
  it('test_sheet_has_one_line_per_day_done_at_most_seven', () => {
    const s = buildSheet(inputOf('Zéro nom', { audition: 'none' }), ctx, has);
    expect(s.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('test_early_end_sheet_has_only_days_done', () => {
    const s = buildSheet(inputOf('Bavard'), ctx, has);
    expect(s.days.map((d) => d.day)).toEqual([1, 2, 3, 4]);
  });
  it('test_day_line_priority_name_over_milestone', () => {
    // J2 : la déclaration (offre de nom, J2 est jalon) ; J3 : nom et geste payé le même jour, le nom l'emporte.
    const d = dayLine([act(3, 500, 'choice', 'j3.marlene', 'name'), act(3, 400, 'choice', 'relecture.j3', 'flag'), act(3, 450, 'choice', 'checkpoint.j3', 'comply')], 3, null, ctx, has);
    expect(d.origin).toBe('name'); expect(d.textKey).toBe('w10.bilan.day.j3.marlene.name');
  });
  it('test_day_line_milestone_over_paid_gesture', () => {
    const report: SurvivalReport = { ...REPORT, pricesPaid: [{ id: 'permit', day: 2, cls: 'full' }] };
    const d = dayLine([act(2, 600, 'choice', 'permit.j2', 'request'), act(2, 900, 'choice', 'j2.component', 'keep')], 2, report, ctx, has);
    expect(d.origin).toBe('milestone'); expect(d.textKey).toBe('w10.bilan.day.j2.component.keep');
  });
  it('test_paid_gesture_over_other_choice', () => {
    const report: SurvivalReport = { ...REPORT, pricesPaid: [{ id: 'permit', day: 2, cls: 'full' }] };
    const d = dayLine([act(2, 100, 'choice', 'm1.scan', 'pass'), act(2, 600, 'choice', 'permit.j2', 'request')], 2, report, ctx, has);
    expect(d.origin).toBe('paidGesture'); expect(d.textKey).toBe('w10.bilan.day.permit.j2.request');
  });
  it('test_day6_milestone_fact_beats_paid_gesture', () => {
    const report: SurvivalReport = { ...REPORT, pricesPaid: [{ id: 'permit', day: 6, cls: 'full' }] };
    const d = dayLine([act(6, 600, 'choice', 'permit.j6', 'request')], 6, report, ctx, has);
    expect(d.origin).toBe('milestoneFact'); expect(d.textKey).toBe('w10.bilan.day.fact.j6');
  });
  it('test_day6_fact_needs_the_day_lived', () => {
    const d = dayLine([], 6, null, ctx, has);
    expect(d.origin).toBe('evening');
  });
  it('test_day_line_other_choice_when_nothing_ranks_higher', () => {
    const d = dayLine([act(1, 450, 'choice', 'm1.scan', 'pass')], 1, null, ctx, has);
    expect(d.origin).toBe('otherChoice'); expect(d.textKey).toBe('w10.bilan.day.m1.scan.pass');
  });
  it('test_day_line_falls_back_to_first_rien_axis_in_axes_order', () => {
    const lines = ctx.street.evening.lines;
    const rien = (a: string): string => lines.find((l) => l.axis === a)!.rien;
    const d = dayLine([], 1, null, ctx, has);
    expect(d.origin).toBe('evening'); expect(d.textKey).toBe(rien(AXES[0]!));
    // l'axe `vie` fait (j1.phone) : la première `rien` est la suivante dans l'ordre des axes
    // un choix de l'axe `vie` sans option (non compté comme ligne) rend `vie` fait pour le relevé : la première `rien` est celle de l'axe suivant
    const d2 = dayLine([act(1, 420, 'choice', 'j1.phone', null)], 1, null, ctx, has);
    expect(d2.origin).toBe('evening'); expect(d2.textKey).toBe(rien(AXES[1]!)); expect(d2.textKey).not.toBe(rien(AXES[0]!));
    const d3 = dayLine([act(1, 600, 'lane', 'checkpoint', 'comply'), act(1, 610, 'lane', 'other', 'x')], 1, null, ctx, has);
    expect(d3.origin).toBe('evening');
    expect(d3.textKey).toBe(rien(AXES[0]!));
  });
  it('test_ties_break_by_earliest_minute_then_id', () => {
    const a = dayLine([act(1, 500, 'choice', 'm2.nadia', 'pass'), act(1, 450, 'choice', 'm1.scan', 'pass')], 1, null, ctx, has);
    expect(a.textKey).toBe('w10.bilan.day.m1.scan.pass');
    const b = dayLine([act(1, 450, 'choice', 'm2.nadia', 'pass'), act(1, 450, 'choice', 'm1.scan', 'pass')], 1, null, ctx, has);
    expect(b.textKey).toBe('w10.bilan.day.m1.scan.pass');
  });
  it('test_option_id_colon_becomes_underscore_in_key', () => {
    const d = dayLine([act(1, 450, 'choice', 'checkpoint.j1', 'buy:permission')], 1, null, ctx, has);
    expect(d.textKey).toBe('w10.bilan.day.checkpoint.j1.buy_permission');
  });
  it('test_day_line_date_comes_from_world_calendar', () => {
    const s = buildSheet(inputOf('Zéro nom', { audition: 'none' }), ctx, has);
    expect(s.days.map((d) => d.dateKey)).toEqual(ctx.world.calendar.map((c) => c.dateKey));
    expect(fr[s.days[0]!.dateKey]).toBe('lundi 4 mars'); expect(fr[s.days[6]!.dateKey]).toBe('dimanche 10 mars');
  });
  it('test_day_lines_is_the_list_of_day_line', () => {
    const input = inputOf('Zéro nom', { audition: 'none' });
    expect(dayLines(input, ctx, has).map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('test_real_profile_lines_use_the_name_offer', () => {
    const s = buildSheet(inputOf('Quatre noms', { audition: 'none' }), ctx, has);
    expect(s.days.find((d) => d.day === 3)!.origin).toBe('name');
    expect(s.days.find((d) => d.day === 5)!.textKey).toBe('w10.bilan.day.j5.bruno.name');
    expect(s.days.find((d) => d.day === 7)!.textKey).toBe('w10.bilan.day.audition.j7.none');
  });
});

describe('buildSheet : kit', () => {
  it('test_kit_rows_follow_replay_states', () => {
    const acts = actsOfProfile('Un nom, J2', { audition: 'none' });
    const rows = kitRows(acts, ctx);
    const comp = rows.find((r) => r.itemId === 'component')!;
    expect(comp.state).toBe('declared'); expect(comp.stateKey).toBe('bilan.kit.state.declared');
    expect(comp.labelKey).toBe('w10.kit.component');
    expect(rows.find((r) => r.itemId === 'phone')!.state).toBe('kept');
  });
  it('test_kit_row_for_seized_component', () => {
    const rows = kitRows(actsOfProfile('Zéro nom', { audition: 'none' }).map((a) => (a.id === 'j2.component' ? { ...a, option: 'leaveVisible' } : a)), ctx);
    expect(rows.find((r) => r.itemId === 'component')!.state).toBe('seized');
  });
  it('test_kit_rows_follow_world_kit_order', () => {
    // ordre de `kit` dans app/src/data/worlds/w10.json : bracelet, sectorCard, phone, permitBook, classSheet, machineReceipt, component
    const W10_KIT = ['bracelet', 'sectorCard', 'phone', 'permitBook', 'classSheet', 'machineReceipt', 'component'];
    expect(ctx.world.kit.map((k) => k.id)).toEqual(W10_KIT);
    const ids = kitRows([], ctx).map((r) => r.itemId);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual(W10_KIT.filter((id) => ids.includes(id)));
  });
});

describe('buildSheet : ce qui a tenu ou tué', () => {
  const bilan = ctx.world.bilan as { fate: { ends: Record<string, string>; prices: Record<string, string>; comforts: Record<string, string> } };
  const withFate = (prices: Record<string, string>, comforts: Record<string, string>): StreetContext => ({
    ...ctx, world: { ...ctx.world, bilan: { ...bilan, fate: { ...bilan.fate, prices, comforts } } as never },
  });
  const fctx = withFate({ permit: 'w10.bilan.fate.price.permit', 'offer.named': 'w10.bilan.fate.price.named' }, { rest: 'w10.bilan.fate.comfort.rest' });
  const report: SurvivalReport = {
    endKind: 'derivedThreshold', endId: 'arrested', endDay: 5,
    pricesPaid: [{ id: 'permit', day: 4, cls: 'full' }, { id: 'offer.named', day: 2, cls: 'half' }],
    comfortsTaken: [{ id: 'rest', day: 3 }],
  };
  it('test_fate_lines_sorted_by_day', () => {
    const s = buildSheet(synth([REL(1)], report, 'earlyEnd'), fctx, has);
    expect(s.fate.map((f) => f.day)).toEqual([2, 3, 4, 5]);
  });
  it('test_fate_lines_include_end_price_and_comfort', () => {
    const s = buildSheet(synth([REL(1)], report, 'earlyEnd'), fctx, has);
    expect(s.fate.map((f) => f.kind)).toEqual(['price', 'comfort', 'price', 'end']);
    expect(s.fate.at(-1)!.textKey).toBe('w10.bilan.fate.end.arrested');
    expect(s.fate[0]!.textKey).toBe('w10.bilan.fate.price.named');
  });
  it('test_fate_real_data_empty_prices_accepted', () => {
    const s = buildSheet(inputOf('Un nom, J2', { audition: 'none' }), ctx, has);
    expect(s.fate.some((f) => f.kind === 'price' || f.kind === 'comfort')).toBe(false);
    expect(s.fate.filter((f) => f.kind === 'end')).toHaveLength(1);
  });
  it('test_fate_missing_end_line_throws_named_error', () => {
    const bad: SurvivalReport = { ...REPORT, endId: 'unknownEnd' };
    expect(() => buildSheet(synth([REL(1)], bad, 'earlyEnd'), ctx, has)).toThrow(/unknownEnd/);
  });
  it('test_evening_always_gives_six_lines', () => {
    expect(eveningLines(1, [], ctx)).toHaveLength(AXES.length);
  });
  it('test_fate_without_survival_is_empty', () => {
    expect(buildSheet(synth([REL(1)], null, 'earlyEnd'), ctx, has).fate).toEqual([]);
  });
});

describe('buildSheet : monde, pureté, chiffres', () => {
  it('test_sheet_names_both_worlds_when_redirected', () => {
    const run = { ...ctx.run, outcome: { ...(ctx.run.outcome as Extract<RunResult['outcome'], { kind: 'arrival' }>), computedWorld: 'w03', livedWorld: 'w10', redirected: true } } as RunResult;
    const s = buildSheet({ ...synth([REL(1)], null, 'earlyEnd'), run }, ctx, has);
    expect(s).toMatchObject({ computedWorld: 'w03', livedWorld: 'w10', redirected: true });
  });
  it('test_sheet_not_redirected_when_same_world', () => {
    const s = buildSheet(synth([REL(1)], null, 'earlyEnd'), ctx, has);
    expect(s.redirected).toBe(false); expect(s.computedWorld).toBe(s.livedWorld);
  });
  it('test_sheet_has_no_numbers_except_dates', () => {
    const s = buildSheet(inputOf('Quatre noms', { audition: 'all' }), ctx, has);
    const keys = [...s.days.map((d) => d.textKey), ...s.kit.flatMap((k) => [k.labelKey, k.stateKey]), ...s.fate.map((f) => f.textKey)];
    for (const k of keys) {
      expect(fr[k], k).toBeDefined(); expect(en[k], k).toBeDefined();
      expect(/\d/.test(fr[k]!), `${k} FR`).toBe(false); expect(/\d/.test(en[k]!), `${k} EN`).toBe(false);
    }
    for (const d of s.days) expect(/\d/.test(fr[d.dateKey]!)).toBe(true);
  });
  it('test_every_day_line_key_exists_for_every_profile', () => {
    for (const p of ['Zéro nom', 'Quatre noms', 'Bavard', 'Muet', 'Deux noms puis arrêté']) {
      for (const d of buildSheet(inputOf(p, { audition: 'silence' }), ctx, has).days) { expect(fr[d.textKey], d.textKey).toBeDefined(); expect(en[d.textKey], d.textKey).toBeDefined(); }
    }
  });
  it('test_sheet_is_pure_same_input_same_output', () => {
    const input = inputOf('Quatre noms', { audition: 'all' });
    const frozen = structuredClone(input);
    const a = buildSheet(input, ctx, has); const b = buildSheet(input, ctx, has);
    expect(a).toEqual(b); expect(input).toEqual(frozen);
  });
  it('test_extinction_has_no_sheet', () => {
    expect(() => buildSheet({ ...synth([], null), entry: 'extinction' }, ctx, has)).toThrow();
  });
});
