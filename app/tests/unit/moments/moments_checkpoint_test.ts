/**
 * Checkpoint : trois voies, voie courtoisie, porte fermée [plan 02b T7 ; bible w10 §5.0, §7.1, §7.4 ; GDD 03 §3.4].
 * Les tirages sont pilotés par `diceStub` : une valeur `r` choisit l'index ⌊r × total⌋ dans les poids cumulés.
 */
import { describe, expect, it } from 'vitest';
import { replay } from '../../../src/engine/moments/replay';
import { lanesOpen, laneOutcome, queuePositionOf } from '../../../src/engine/moments/checkpoint';
import type { StreetState } from '../../../src/engine/moments/types';
import { createDice } from '../../../src/shared/dice';
import { act, closedGate, ctxW10, diceStub, J1, withBons, withGuide, withKit, withPalier } from '../../support/street';

const ctx = ctxW10();
const lane = (opt: string, s: StreetState = J1(), d = diceStub([0])) =>
  laneOutcome(s, { ...ctx, dice: d }, act(s.day, 600, 'lane', 'checkpoint', opt));
const clean = () => withKit(J1(), { component: 'left' });

describe('checkpoint : trois voies, courtoisie, porte fermée', () => {
  it('test_courtesy_lane_only_at_courtesy_palier', () => {
    expect(lanesOpen(J1(), ctx)).toContain('courtesy');                                  // le J1, avant tout relevé : palier courtesy
    expect(lanesOpen(withPalier(J1(), 'thanks'), ctx)).not.toContain('courtesy');
    expect(lanesOpen(withPalier(J1(), 'courtesy'), ctx)).toContain('courtesy');
  });
  it('test_open_lanes_are_comply_buy_bypass_and_never_refuse', () => {
    expect(lanesOpen(withPalier(J1(), 'patience'), ctx)).toEqual(['comply', 'buy', 'bypass']);
  });
  it('test_comply_clean_costs_14_words_and_one_hour', () => {
    expect(lane('comply', clean())).toEqual({ entries: [], words: 14, minutes: 60, forcedComply: false });
  });
  it('test_comply_with_component_on_you_is_found', () => {
    expect(lane('comply', withKit(J1(), { component: 'kept' })).entries).toEqual(['found7']);
  });
  it('test_component_left_home_is_not_searched', () => {
    expect(lane('comply', clean()).entries).toEqual([]);
  });
  it('test_courtesy_is_comply_in_a_short_queue', () => {
    expect(lane('courtesy', clean())).toEqual(lane('comply', clean()));
  });
  it('test_buy_costs_3_words_10_minutes_and_bribe', () => {
    expect(lane('buy:permission', J1(), diceStub([0.25]))).toEqual({ entries: ['bribe'], words: 3, minutes: 10, forcedComply: false });
  });
  it.each([[0.249, ['bribe', 'informant']], [0.25, ['bribe']]])('test_informant_one_in_four_%s', (r, e) => {
    expect(lane('buy:permission', J1(), diceStub([r])).entries).toEqual(e);
  });
  it('test_buy_with_bons_needs_8_or_16_when_closed', () => {
    const quiet = diceStub([0.25]);
    expect(() => lane('buy:bons', withBons(J1(), 7), quiet)).toThrow();
    expect(lane('buy:bons', withBons(J1(), 8), diceStub([0.25])).entries).toEqual(['bribe']);
    expect(() => lane('buy:bons', withBons(closedGate(J1()), 15), diceStub([0.25]))).toThrow();
    expect(lane('buy:bons', withBons(closedGate(J1()), 16), diceStub([0.25])).entries).toEqual(['bribe']);
  });
  it('test_buy_with_component_needs_it_on_you', () => {
    expect(() => lane('buy:component', withKit(J1(), { component: 'left' }), diceStub([0.25]))).toThrow();
    expect(lane('buy:component', J1(), diceStub([0.25])).entries).toEqual(['bribe']);
  });
  it.each([[0.24, []], [0.25, ['bypassNacelle']], [0.74, ['bypassNacelle']], [0.75, ['patrol']]])('test_bypass_draw_%s', (r, e) => {
    expect(lane('bypass', J1(), diceStub([r])).entries).toEqual(e);                    // 25 / 50 / 25 %
  });
  it('test_patrol_loses_2h_then_forces_comply', () => {
    expect(lane('bypass', J1(), diceStub([0.9]))).toMatchObject({ minutes: 120, forcedComply: true });
  });
  it.each([[0.874, []], [0.875, ['patrol']]])('test_bypass_with_yusuf_guide_%s', (r, e) => {
    expect(lane('bypass', withGuide(J1()), diceStub([r])).entries).toEqual(e);         // patrouille 1 sur 8, plus de nacelle
  });
  it.each([[0.24, []], [0.25, ['bypassNacelle']], [0.5, ['patrol']]])('test_bypass_gate_closed_%s', (r, e) => {
    expect(lane('bypass', closedGate(J1()), diceStub([r])).entries).toEqual(e);        // 25 / 25 / 50 %
  });
  it('test_bypass_draws_with_the_street_domain_the_day_and_the_anchor_hour', () => {
    const seen: unknown[][] = [];
    const spy = { roll: (...a: [string, number, number, string]) => { seen.push(a); return 0; } };
    lane('bypass', J1(), spy as never);
    expect(seen).toEqual([['street', 1, ctx.street.checkpoint.drawAnchorHour, 'checkpoint.bypass']]);
  });
  it('test_closed_gate_comply_costs_2h', () => {
    expect(lane('comply', closedGate(clean())).minutes).toBe(120);
  });
  it('test_refuse_passes_no_lane_and_costs_nothing', () => {
    expect(lane('refuse')).toEqual({ entries: ['absentRegistre'], words: 0, minutes: 0, forcedComply: false });
  });
  it('test_unknown_lane_option_throws', () => {
    expect(() => lane('teleport')).toThrow();
  });
  it('test_same_day_same_draw', () => {
    const d = createDice(0);
    expect(d.roll('street', 2, 7, 'checkpoint.bypass')).toBe(d.roll('street', 2, 7, 'checkpoint.bypass'));
    expect(d.roll('street', 2, 7, 'checkpoint.bypass')).not.toBe(d.roll('street', 3, 7, 'checkpoint.bypass'));
  });
  const queued = (opt: string) => ({ ...clean(), acts: [act(1, 600, 'lane', 'checkpoint', opt)] });
  it.each([[599, 0], [600, 0], [630, 500], [660, 1000], [700, 1000]])('test_queue_position_at_%i_is_%i', (minute, permille) => {
    expect(queuePositionOf(queued('comply'), ctx, minute)).toMatchObject({ lane: 'comply', startMinute: 600, endMinute: 660, permille });
  });
  it('test_queue_position_is_null_without_a_lane_act', () => {
    expect(queuePositionOf(J1(), ctx, 600)).toBeNull();
  });
  it('test_queue_position_is_null_for_refuse', () => {
    expect(queuePositionOf(queued('refuse'), ctx, 630)).toBeNull();
  });
  it('test_queue_position_reads_the_last_lane_act_of_the_day', () => {
    const s = { ...clean(), acts: [act(1, 540, 'lane', 'checkpoint', 'bypass'), act(1, 600, 'lane', 'checkpoint', 'comply')] };
    expect(queuePositionOf(s, ctxW10(undefined, diceStub([0.9])), 630)).toMatchObject({ lane: 'comply', startMinute: 600, permille: 500 });
  });
  it('test_queue_position_uses_buy_duration', () => {
    expect(queuePositionOf(queued('buy:bons'), ctx, 605)).toMatchObject({ lane: 'buy', endMinute: 610, permille: 500 });
  });
});

describe('checkpoint : le contournement prend du temps de jeu [bible w10 §7.4 : 1 à 2 h ; team-lead 2026-11-03 : 90 min, valeur de la donnée]', () => {
  const BYPASS = ctx.street.checkpoint.minutes.bypass;
  it('test_bypass_minutes_come_from_the_data_not_from_the_code', () => { expect(BYPASS).toBe(90); });
  it.each([[0.0, []], [0.3, ['bypassNacelle']]])('test_free_and_nacelle_bypass_cost_the_data_minutes_%s', (r, e) => {
    expect(lane('bypass', J1(), diceStub([r]))).toMatchObject({ entries: e, minutes: BYPASS });
  });
  it('test_patrol_bypass_keeps_its_own_minutes', () => { expect(lane('bypass', J1(), diceStub([0.9]))).toMatchObject({ minutes: ctx.street.checkpoint.minutes.patrol }); });
  it('test_free_bypass_queue_runs_for_the_data_minutes', () => {
    const c = ctxW10(undefined, diceStub([0]));
    const s = { ...clean(), acts: [act(1, 600, 'lane', 'checkpoint', 'bypass')] };
    expect(queuePositionOf(s, c, 645)).toMatchObject({ lane: 'bypass', startMinute: 600, endMinute: 600 + BYPASS, permille: 500 });
  });
  it('test_replay_advances_the_clock_by_the_bypass_minutes_and_is_deterministic', () => {
    const c = ctxW10(undefined, diceStub([0]));
    const acts = [act(1, 420, 'choice', 'j1.phone', 'take'), act(1, 421, 'choice', 'j1.component', 'leave'), act(1, 430, 'exit', 'home', null), act(1, 540, 'lane', 'checkpoint', 'bypass')];
    const a = replay(acts, c), b = replay(acts, ctxW10(undefined, diceStub([0])));
    expect(a.rejected).toEqual([]);
    expect(a.state.clock.minute).toBe(540 + BYPASS);                    // 540 + 90 : l'acte écrit à 9 h laisse l'horloge à 10 h 30
    expect(b.state).toEqual(a.state);
  });
});
