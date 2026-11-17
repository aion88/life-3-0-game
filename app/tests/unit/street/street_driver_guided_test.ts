import { beforeEach, describe, expect, it } from 'vitest';
import { queuePositionOf } from '../../../src/engine/moments/checkpoint';
import { createDriver, type StreetDriver } from '../../../src/engine/view/driver';
import { ctxGuided } from '../../support/guided';
import { EXIT_HOME, makeSink, type TestSink } from '../../support/street_driver';
import { SCENE } from '../../support/street_walk';

const ctx = ctxGuided;
let sink: TestSink;
beforeEach(() => { sink = makeSink(); });

function driverAt(minute: number): StreetDriver {
  const d = createDriver({ ctx, sink, savedActs: [], scene: SCENE });
  d.skipTo(minute);
  return d;
}
function confirmLane(d: StreetDriver, option: string): void {
  d.act({ ...EXIT_HOME, minute: d.state().live.clock.minute });
  expect(d.designate('checkpoint.j1', option)).toHaveProperty('price');
  expect(d.confirm()).toEqual({ ok: true });
}

describe('driver guidé', () => {
  it('test_skip_to_moves_live_clock_writes_nothing', () => {
    const d = driverAt(430); d.skipTo(470);
    expect(d.state().live.clock.minute).toBe(470); expect(sink.saved).toEqual([]);
  });
  it('test_skip_to_never_goes_back_nor_past_day_end', () => {
    const d = driverAt(430); d.skipTo(470); d.skipTo(450);
    expect(d.state().live.clock.minute).toBe(470);
    d.skipTo(2000);
    expect(d.state().live.clock.minute).toBe(ctx.street.clock.dayEndMinute); expect(sink.saved).toEqual([]);
  });
  it('test_queue_skip_lands_on_lane_end_minute', () => {
    const d = driverAt(445); const before = d.state().live.clock.minute;
    confirmLane(d, 'comply');
    const q = queuePositionOf(d.state().street, ctx, before)!;
    expect(d.state().live.clock.minute).toBe(q.endMinute);
    expect(queuePositionOf(d.state().street, ctx, d.state().live.clock.minute)!.permille).toBe(1000);
  });
  it('test_scene_writes_one_scene_act_at_session_minute', () => {
    const d = driverAt(450);
    expect(d.scene('j1.roux', 'c')).toEqual({ ok: true });
    expect(sink.saved).toEqual([{ day: 1, minute: 450, kind: 'scene', id: 'j1.roux', option: 'c' }]);
  });
  it('test_scene_refusals_write_nothing', () => {
    const d = driverAt(450);
    expect(d.scene('nope', 'c')).toMatchObject({ ok: false, rejected: { reason: 'unknownChoice' } });
    expect(d.scene('j1.roux', 'zz')).toMatchObject({ ok: false, rejected: { reason: 'unknownOption' } });
    expect(d.scene('j1.roux', 'c').ok).toBe(true);
    expect(d.scene('j1.roux', 'c')).toMatchObject({ ok: false, rejected: { reason: 'choiceClosed' } });
    expect(sink.saved).toHaveLength(1);
  });
});
