import { describe, expect, it } from 'vitest';
import { captureEnabled, createControl, createStepLoop, plateFov } from '../../../src/street/capture';

/** Une image de la boucle : ce que le runtime enregistre auprès de `frames.request`. */
function harness(maxDtMs = 50) {
  const ctl = createControl('');
  const loop = createStepLoop(ctl, maxDtMs);
  const seen: { now: number; render: boolean }[] = [];
  const frame = (now: number): void => { seen.push({ now, render: ctl.render }); loop.frames.request(frame); };
  loop.frames.request(frame);
  return { ctl, loop, seen };
}

describe('step loop', () => {
  it('test_step_advances_the_clock_in_bounded_sub_steps_and_renders_only_the_last', () => {
    const { loop, seen } = harness(50);
    loop.step(120);
    expect(seen.map((s) => s.now)).toEqual([50, 100, 120]);
    expect(seen.map((s) => s.render)).toEqual([false, false, true]);
  });
  it('test_step_zero_runs_exactly_one_frame_without_moving_the_clock', () => {
    const { loop, seen } = harness();
    loop.step(0);
    expect(seen).toEqual([{ now: 0, render: true }]);
  });
  it('test_step_continues_the_virtual_clock_across_calls', () => {
    const { loop, seen } = harness();
    loop.step(30); loop.step(30);
    expect(seen.map((s) => s.now)).toEqual([30, 60]);
  });
  it('test_render_false_skips_every_render', () => {
    const { loop, seen } = harness();
    loop.step(100, { render: false });
    expect(seen.length).toBe(2);
    expect(seen.every((s) => !s.render)).toBe(true);
  });
  it('test_a_cancelled_loop_does_not_run', () => {
    const ctl = createControl('');
    const loop = createStepLoop(ctl, 50);
    let ran = 0;
    const h = loop.frames.request(() => { ran++; });
    loop.frames.cancel(h);
    loop.step(100);
    expect(ran).toBe(0);
  });
  it('test_render_flag_is_restored_after_a_step', () => {
    const { loop, ctl } = harness();
    loop.step(100, { render: false });
    expect(ctl.render).toBe(true);
  });
});

describe('control from the query', () => {
  it('test_bloom_lut_and_screens_are_read_from_the_query', () => {
    expect(createControl('bloom=0&lut=off')).toMatchObject({ bloom: 0, lut: 'off' });
    expect(createControl('lut=identity')).toMatchObject({ bloom: null, lut: 'identity' });
    expect(createControl('')).toMatchObject({ bloom: null, lut: 'data', light: null, pose: null });
  });
  it('test_an_unknown_lut_value_is_ignored', () => {
    expect(createControl('lut=banana').lut).toBe('data');
  });
});

describe('capture gate', () => {
  it('test_capture_is_off_under_vitest', () => {
    // MODE vaut `test` : les tests du plan 02a montent la rue sans `window.__street`
    expect(captureEnabled()).toBe(false);
  });
});

describe('plate optics', () => {
  it('test_fov_of_85_mm_on_a_24_mm_sensor_is_16_degrees', () => {
    expect(plateFov(85, 24)).toBeCloseTo(16.07, 2);
  });
});
