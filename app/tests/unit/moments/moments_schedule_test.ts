import { describe, expect, it } from 'vitest';
import minimalJson from '../../fixtures/guided/minimal.json';
import { parseGuided } from '../../../src/data/schema/guided';
import { enterStep, leaveStep, nightActs, nominalLaneMinutes, pendingTransits } from '../../../src/engine/moments/schedule';
import { w10Street } from '../../support/guided';

type Raw = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON brut de fixture

/** `minimal.json` étendue des étapes citées, ancres et coûts de la table de T5 (j1.roux 434 + 3, j1.registre 510 + 30, late après 510, j2.agent 1020 + 10). */
function extended(): Raw {
  const g = structuredClone(minimalJson) as Raw;
  const roux = g.scenes.find((s: Raw) => s.id === 'j1.roux');
  Object.assign(roux, { anchorMinute: 434, costMin: 3 });
  roux.ask.options[0].id = 'laugh';
  g.chains[0].links[0].variants = { laugh: g.chains[0].links[0].variants.a, b: g.chains[0].links[0].variants.b, c: g.chains[0].links[0].variants.c };
  g.chains[0].links[1].variants = { laugh: g.chains[0].links[1].variants.a, b: g.chains[0].links[1].variants.b, c: g.chains[0].links[1].variants.c };
  const base = { place: 'place.registre', actor: null, beats: [], waitKind: 'none' };
  g.scenes.push(
    { ...base, id: 'j1.registre', day: 1, stage: 'registre', anchorMinute: 510, costMin: 30,
      late: { afterMinute: 510, next: 'j1.registre.late', lineKey: 'w10.scene.j1.registre.late.line' },
      ask: { kind: 'priced', choiceId: 'm4.list', next: { read: 'night', pass: 'night' }, ifUnavailable: null },
      transit: [{ kind: 'enter', id: 'registre' }] },
    { ...base, id: 'j1.registre.late', day: 1, stage: 'registre', anchorMinute: 511, costMin: 0, late: null,
      ask: { kind: 'none', next: 'night' }, transit: [{ kind: 'enter', id: 'registre' }] },
    { ...base, id: 'j2.agent', day: 2, stage: 'evening', place: 'unit.9-D', anchorMinute: 1020, costMin: 10, late: null,
      ask: { kind: 'priced', choiceId: 'j2.agentReturn', next: { go: 'night' }, ifUnavailable: 'night' },
      transit: [{ kind: 'exit', id: 'registre' }, { kind: 'enter', id: 'home' }] },
  );
  return g;
}
const G = parseGuided(extended(), w10Street);

describe('moments : horaire des étapes guidées, source unique de pathsOf et du metteur en scène [plan rue guidée J1-J2, T4]', () => {
  it('test_enter_before_anchor_waits_for_anchor', () => { expect(enterStep(G, 'j1.registre', 505)).toEqual({ sceneId: 'j1.registre', minute: 510, lateLineKey: null }); });
  it('test_enter_after_late_goes_to_late_next', () => { expect(enterStep(G, 'j1.registre', 562)).toMatchObject({ sceneId: 'j1.registre.late', minute: 562, lateLineKey: expect.any(String) }); });
  it('test_enter_exactly_at_late_threshold_is_on_time', () => { expect(enterStep(G, 'j1.registre', 510).sceneId).toBe('j1.registre'); });
  it('test_leave_minute_is_at_least_anchor_plus_cost', () => { expect(leaveStep(G, 'j1.roux', 'laugh', 435).minute).toBe(437); expect(leaveStep(G, 'j1.roux', 'laugh', 450).minute).toBe(450); });   // ancre 434 + coût 3
  it('test_leave_unavailable_follows_if_unavailable', () => { expect(leaveStep(G, 'j2.agent', null, 1020).next).toBe('night'); });
  it('test_leave_none_follows_next', () => { expect(leaveStep(G, 'j1.wake', null, 420)).toEqual({ next: 'j1.roux', minute: 430 }); });
  it('test_leave_unknown_option_throws', () => { expect(() => leaveStep(G, 'j1.roux', 'zzz', 440)).toThrow(/zzz/); expect(() => enterStep(G, 'nope', 440)).toThrow(/nope/); });
  it('test_pending_transits_skip_places_already_reached', () => {
    const agent = G.scenes.find((s) => s.id === 'j2.agent')!;
    expect(pendingTransits(agent, 'registre')).toEqual({ transits: [{ kind: 'exit', id: 'registre' }, { kind: 'enter', id: 'home' }], location: 'home' });
    expect(pendingTransits(agent, 'street')).toEqual({ transits: [{ kind: 'enter', id: 'home' }], location: 'home' });
    expect(pendingTransits(agent, 'home')).toEqual({ transits: [], location: 'home' });
  });
  it('test_night_goes_home_then_sleeps_at_evening', () => {
    const st = { ...w10Street, guided: G };
    expect(nightActs(st, 1, 600, 'registre')).toEqual([
      { day: 1, minute: 600, kind: 'exit', id: 'registre', option: null },
      { day: 1, minute: 600, kind: 'enter', id: 'home', option: null },
      { day: 1, minute: w10Street.moments.eveningMinute, kind: 'sleep', id: 'night', option: null },
    ]);
    expect(nightActs(st, 2, 1100, 'home')).toEqual([{ day: 2, minute: 1100, kind: 'sleep', id: 'night', option: null }]);
  });
  it('test_night_acts_past_day_end_are_clamped_together', () => {
    const st = { ...w10Street, guided: G };
    const end = w10Street.clock.dayEndMinute;
    expect(nightActs(st, 1, end + 30, 'registre').map((a) => a.minute)).toEqual([end, end, end]);
  });
  it('test_nominal_lane_minutes_read_the_checkpoint_data', () => {
    const m = w10Street.checkpoint.minutes;
    expect(['comply', 'courtesy', 'buy:bons', 'bypass', 'refuse'].map((o) => nominalLaneMinutes(w10Street, o))).toEqual([m.comply, m.comply, m.buy, m.bypass, 0]);
  });
  it('test_lane_minutes_with_the_gate_closed', () => {   // N7 (revue T13 I-1) : porte fermée, comply et courtesy prennent `closedGate` (checkpoint.ts)
    const m = w10Street.checkpoint.minutes;
    expect(['comply', 'courtesy', 'buy:bons', 'bypass', 'refuse'].map((o) => nominalLaneMinutes(w10Street, o, true))).toEqual([m.closedGate, m.closedGate, m.buy, m.bypass, 0]);
  });
});
