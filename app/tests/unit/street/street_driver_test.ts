import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { aimOf, aimVector } from '../../../src/engine/view/gaze';
import { pendingChoices } from '../../../src/engine/moments/choices';
import { braceletCount, buildLedger } from '../../../src/engine/moments/words';
import { act, ctxW10, SCRIPT_J1_J2, TO_J7_EVENING } from '../../support/street';
import { drain, drive, EXIT_HOME, FAR, FULL_WEEK, GOOD, makeDriver, makeSink, REST, stayInCone, WALKING, type TestSink } from '../../support/street_driver';
import { P0, S, SCENE } from '../../support/street_walk';
import { expectSameTwice } from '../../support/determinism';

const ctx = ctxW10();
const N16 = { id: 'n16', pos: { x: SCENE.nacelles[1]!.x.v, z: 16 } };   // n16 : 6,7 m de l'axe, z = 16
let sink: TestSink;
beforeEach(() => { sink = makeSink(); });

const kinds = (es: readonly { type: string }[]): string[] => es.map((e) => e.type);

describe('street driver', () => {
  it('test_accepted_act_is_saved_once_then_state_changes', () => {
    const d = makeDriver(sink); d.act(EXIT_HOME); sink.appendAct.mockClear();
    const before = d.state().street; expect(d.act(GOOD).ok).toBe(true);
    expect(sink.appendAct).toHaveBeenCalledTimes(1); expect(d.state().street).not.toEqual(before);
  });
  it('test_rejected_act_writes_nothing_and_keeps_state', () => {
    const d = makeDriver(sink); const before = d.state().street; const r = d.act(act(1, 430, 'nonsense', 'x'));
    expect(r.ok).toBe(false); expect(sink.appendAct).not.toHaveBeenCalled(); expect(d.state().street).toEqual(before);
    expect(drain(d)).toEqual([{ type: 'rejected', rejected: { act: act(1, 430, 'nonsense', 'x'), reason: 'unknownKind' } }]);
  });
  it('test_failed_write_advances_the_state_and_reports_unsaved', () => {
    sink.persistent.mockReturnValue(false); const d = makeDriver(sink); const before = d.state().street; d.act(EXIT_HOME);
    expect(d.state().street).not.toEqual(before); expect(kinds(drain(d))).toContain('unsaved');
  });
  it('test_resume_by_replay_equals_the_live_state_at_the_last_act', () => {
    const d1 = makeDriver(sink); for (const a of SCRIPT_J1_J2) d1.act(a);
    const d2 = makeDriver(sink, { savedActs: sink.saved }); expect(d2.state().street).toEqual(d1.state().street); expect(d2.state().week).toEqual(d1.state().week);
  });
  it('test_waited_minutes_after_the_last_act_are_lost_and_carry_is_zero', () => {
    const d1 = makeDriver(sink); drive(d1, [GOOD]);
    for (let i = 0; i < 200; i++) d1.tick(50, REST, FAR, []);   // 200 pas de 50 ms = 10 000 ms = 60 minutes (msPerHour 10 000)
    const d2 = makeDriver(sink, { savedActs: sink.saved });
    expect(d1.state().live.clock.minute).toBeGreaterThan(d2.state().live.clock.minute);
    expect(d2.state().live.clock.minute).toBe(d2.state().street.clock.minute); expect(d2.state().live.carry).toBe(0);
  });
  it('test_designating_writes_nothing_and_confirming_writes_one_act', () => {
    const d = makeDriver(sink); const c = S.choices.find((x) => x.id === 'j1.phone')!; const opt = c.options[0]!.id;
    expect(d.designate(c.id, opt)).toHaveProperty('price'); expect(d.state().street.phase).toBe('designated'); expect(sink.appendAct).not.toHaveBeenCalled();
    expect(d.confirm()).toEqual({ ok: true }); expect(sink.appendAct).toHaveBeenCalledTimes(1);
    expect(sink.saved[0]).toMatchObject({ kind: 'choice', id: 'j1.phone', option: opt });
  });
  it('test_checkpoint_choice_is_written_as_a_lane_act', () => {
    const d = makeDriver(sink); d.act(EXIT_HOME);
    const c = S.choices.find((x) => x.id.startsWith('checkpoint.'))!; d.designate(c.id, c.options[0]!.id); expect(d.confirm()).toEqual({ ok: true });
    expect(d.state().street.acts.filter((a) => a.kind === 'lane' && a.id === 'checkpoint')).toHaveLength(1);
    expect(d.state().street.phase).toBe('idle');
  });
  it('test_confirm_is_not_applied_twice', () => {
    const d = makeDriver(sink); const c = S.choices.find((x) => x.id === 'j1.phone')!; d.designate(c.id, c.options[0]!.id); d.confirm();
    expect(d.state().street.acts.filter((a) => a.id === 'j1.phone')).toHaveLength(1); expect(d.confirm()).toBeNull();
  });
  it('test_reload_drops_a_designation_that_was_never_confirmed', () => {
    const d = makeDriver(sink); const c = S.choices.find((x) => x.id === 'j1.phone')!; d.designate(c.id, c.options[0]!.id);
    expect(makeDriver(sink, { savedActs: sink.saved }).state().street.phase).toBe('idle');
  });
  it('test_designating_an_unknown_choice_writes_and_emits_nothing', () => {
    const d = makeDriver(sink); const before = d.state().street;
    expect(d.designate('nope.j9', 'x')).toEqual({ ok: false, reason: 'unknownChoice' });
    expect(d.state().street).toEqual(before); expect(sink.appendAct).not.toHaveBeenCalled(); expect(drain(d)).toEqual([]);
  });
  it('test_designating_null_clears_the_designation', () => {
    const d = makeDriver(sink); const c = S.choices.find((x) => x.id === 'j1.phone')!; const before = d.state().street;
    d.designate(c.id, c.options[0]!.id); expect(d.designate(c.id, null)).toEqual({ ok: true, price: null });
    expect(d.state().street).toEqual(before); expect(sink.appendAct).not.toHaveBeenCalled(); expect(d.confirm()).toBeNull();
  });
  it('test_a_jalon_is_chosen_through_reduce_act_never_designated', () => {
    const d = makeDriver(sink, { savedActs: TO_J7_EVENING.filter((a) => a.day <= 2) });          // le J3 à 7 h
    const jalon = 'j3.marlene.late';
    expect(d.present(FAR)).not.toContain(jalon);
    for (let i = 0; i < 4000 && !d.present(FAR).includes(jalon); i++) d.tick(50, REST, FAR, []);
    expect(d.present(FAR)).toContain(jalon);                                           // lu sur l'horloge de session
    expect(pendingChoices(d.state().street, ctx)).not.toContain(jalon);                // le moteur ne date l'état qu'aux actes
    sink.appendAct.mockClear();
    expect(d.designate(jalon, 'x')).toEqual({ ok: false, reason: 'unknownChoice' });
    expect(sink.appendAct).not.toHaveBeenCalled();
    expect(d.choose(jalon, 'x')).toEqual({ ok: true });
    expect(sink.appendAct).toHaveBeenCalledTimes(1); expect(sink.saved.at(-1)).toMatchObject({ kind: 'choice', id: jalon, option: 'x' });
    expect(d.present(FAR)).not.toContain(jalon);
  });
  it('test_sleep_writes_a_sleep_act_at_the_session_minute', () => {
    const d = makeDriver(sink); drive(d, []);
    for (let i = 0; i < 200; i++) d.tick(50, REST, FAR, []);
    const minute = d.state().live.clock.minute; sink.appendAct.mockClear();
    d.sleep(); expect(sink.saved.at(-1)).toMatchObject({ kind: 'sleep', id: 'night', minute });
  });
  it('test_aim_picks_the_nearest', () => {
    expect(aimOf(N16, [{ id: 'b', pos: { x: 0, z: 12 } }, { id: 'a', pos: { x: 0, z: 30 } }], 12)?.pos).toEqual({ x: 0, z: 12 });   // sqrt(6,7² + 4²) = 7,80 contre 15,5
  });
  it('test_aim_tie_resolves_to_smaller_id', () => {
    expect(aimOf(N16, [{ id: 'b', pos: { x: 0, z: 10 } }, { id: 'a', pos: { x: 0, z: 22 } }], 12)).toEqual({ id: 'a', pos: { x: 0, z: 22 } });   // dz = 6 des deux côtés
  });
  it('test_aim_ignores_targets_beyond_range', () => { expect(aimOf(N16, [{ id: 'a', pos: { x: 0, z: 60 } }], 12)).toBeNull(); });
  it('test_aim_vector_is_the_normalised_direction_or_the_rest_axis', () => {
    expect(aimVector({ x: 0, z: 0 }, { id: 't', pos: { x: 0, z: 12 } }, { x: 1, z: 0 })).toEqual({ x: 0, z: 1 });
    expect(aimVector({ x: 0, z: 0 }, null, { x: 1, z: 0 })).toEqual({ x: 1, z: 0 });
  });
  it('test_a_glance_is_written_once_and_not_recounted_after_reload', () => {
    const d1 = makeDriver(sink); const e1 = stayInCone(d1, 5000); expect(e1.filter((e) => e.type === 'glance')).toHaveLength(1);
    expect(sink.saved.filter((a) => a.kind === 'glance')).toHaveLength(1);
    const e2 = stayInCone(makeDriver(sink, { savedActs: sink.saved }), 5000); expect(e2.filter((e) => e.type === 'glance')).toHaveLength(0);
  });
  it('test_bracelet_is_the_same_after_a_reload', () => {
    const d1 = makeDriver(sink); for (const a of SCRIPT_J1_J2) d1.act(a); const d2 = makeDriver(sink, { savedActs: sink.saved });
    expect(braceletCount(buildLedger(1, d2.state().street.acts, ctx))).toBe(braceletCount(buildLedger(1, d1.state().street.acts, ctx)));
  });
  it('test_hooks_come_from_ctx_on_hook_not_from_a_dependency', () => {
    const d = makeDriver(sink); for (const a of SCRIPT_J1_J2) d.act(a);
    expect(drain(d).filter((e) => e.type === 'hook').length).toBeGreaterThan(0);
  });
  it('test_resume_does_not_replay_past_hooks_as_events', () => {
    const d = makeDriver(sink, { savedActs: SCRIPT_J1_J2 }); expect(drain(d).filter((e) => e.type === 'hook')).toEqual([]);
  });
  it('test_grey_car_visibility_follows_present_at_on_the_morning_hook', () => {
    const seen: boolean[] = []; const d = makeDriver(sink, { onGreyCar: (v) => seen.push(v) });
    expect(seen).toHaveLength(1); for (const a of SCRIPT_J1_J2) d.act(a);
    expect(seen.length).toBeGreaterThan(1);
  });
  it('test_acts_after_the_end_are_refused_with_reason_ended', () => {
    const d = makeDriver(sink, { savedActs: FULL_WEEK }); expect(d.state().street.ended).not.toBeNull();
    const r = d.act(act(7, 1200, 'use', 'phone')); expect(r.ok).toBe(false); if (!r.ok) expect(r.rejected.reason).toBe('ended');
    expect(sink.appendAct).not.toHaveBeenCalled(); expect(drain(d).map((e) => e.type)).toContain('rejected');
  });
  it('test_tick_uses_the_engine_activity_rule', () => {
    const d = makeDriver(sink); const m0 = d.state().live.clock.minute;
    for (let i = 0; i < 200; i++) d.tick(50, WALKING, P0, []); expect(d.state().live.clock.minute).toBe(m0);
    for (let i = 0; i < 200; i++) d.tick(50, REST, FAR, []); expect(d.state().live.clock.minute).toBeGreaterThan(m0);
  });
  it('test_tick_step_is_capped_by_the_scene_data', () => {
    const d = makeDriver(sink); const m0 = d.state().live.clock.minute;
    const cap = SCENE.walk.maxDtMs.v; const msPerHour = S.clock.msPerHour;
    d.tick(10 * msPerHour, REST, FAR, []);                                         // un pas géant vaut un pas plafonné
    expect(d.state().live.clock.minute - m0).toBe(Math.floor((cap * 60) / msPerHour));
    expect(d.state().live.carry).toBe(cap * 60 - Math.floor((cap * 60) / msPerHour) * msPerHour);
  });
  it('test_finish_day_waits_for_ended', () => {
    expect(makeDriver(sink).finishDay()).toBeNull(); expect(makeDriver(makeSink(), { savedActs: FULL_WEEK }).finishDay()).not.toBeNull();
  });
  it('test_grade_uses_the_week_start_world_and_is_deterministic', () => {
    expectSameTwice(() => { const d = makeDriver(makeSink()); d.tick(50, REST, FAR, []); return d.grade(); });
    const g = makeDriver(sink).grade(); for (const k of ['grain', 'exposure', 'veil', 'accent', 'curvature'] as const) expect(Number.isFinite(g[k])).toBe(true);
  });
  it('test_driver_is_deterministic', () => {
    expectSameTwice(() => { const s = makeSink(); const d = makeDriver(s); for (const a of SCRIPT_J1_J2) d.act(a); stayInCone(d, 5000); return [s.saved, d.state().street]; });
  });
  it('test_no_wall_clock_or_random_in_the_driver', () => {
    for (const f of ['src/engine/view/driver.ts', 'src/engine/view/gaze.ts']) expect(readFileSync(f, 'utf8')).not.toMatch(/Math\.random|Date\.now|performance\.now/);
  });
  it('test_no_literal_dt_cap_in_the_driver', () => { expect(readFileSync('src/engine/view/driver.ts', 'utf8')).not.toMatch(/\b50\b/); });
});
