import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { arrivalOutcome, nearestArrival } from '../../../src/fastforward/arrival';
import type { ArrivalWorldId } from '../../../src/shared/types/world';
import { v } from '../../support/vec';

const core = loadCore();
const ARRIVAL_IDS = core.catalogue.entries.filter((e) => e.kind === 'arrival').map((e) => e.id as ArrivalWorldId); // les dix, depuis le catalogue du plan 00
const all10 = { ...core, build: { ...core.build, streetWorlds: ARRIVAL_IDS } };

describe('monde d arrivée, écart, redirection [plan 01 T4]', () => {
  it('test_w10_line_arrives_1984_not_redirected', () => {
    const o = arrivalOutcome(v(1, 100, 43, 37, 93, 25), core);
    expect(o).toMatchObject({ computedWorld: 'w10', livedWorld: 'w10', redirected: false, distanceSq: 1708e6 });
    expect(o.offset.axes).toEqual([]);
  });
  it('test_tie_on_d2_broken_by_abs_sum', () => { // AAAAAABBDBB : w04 contre w10, sommes 104 et 122
    expect(nearestArrival(v(36, 92, 73, 48, 65, 17), core.catalogue)).toBe('w04');
  });
  it('test_full_tie_broken_by_world_number', () => {
    expect(nearestArrival(v(0, 90, 38, 45, 72, 20), core.catalogue)).toBe('w10'); // AAACCAACACD : w10 contre w11
    expect(nearestArrival(v(56, 80, 44, 47, 75, 42), core.catalogue)).toBe('w04'); // AABCADBBDCC : w04 contre w06
  });
  it('test_far_arrival_two_axes_against_computed_world', () => { // AAAAAAAAAAA : w03 à 76,54
    const o = arrivalOutcome(v(0, 90, 58, 71, 78, 0), all10);
    expect(o.computedWorld).toBe('w03');
    expect(o.offset.axes).toEqual([{ var: 'surveillance', signed: 58_000 }, { var: 'aiPower', signed: -25_000 }]); // 25 contre 25 : aiPower avant order
  });
  it('test_slice_redirects_to_w10_keeps_computed', () => { // [D140]
    const o = arrivalOutcome(v(0, 90, 58, 71, 78, 0), core); // streetWorlds = ['w10']
    expect(o).toMatchObject({ computedWorld: 'w03', livedWorld: 'w10', redirected: true });
    expect(o.offset).toEqual(arrivalOutcome(v(0, 90, 58, 71, 78, 0), all10).offset); // écart contre w03, pas contre w10
  });
  it('test_axis_weights_are_read_not_ignored', () => { // unrest 20 n'appartient qu'à w03 [calculé à la main, GDD 02 §3.6]
    const onlyUnrest = { aiPower: 0, order: 0, abundance: 0, freedom: 0, surveillance: 0, unrest: 1 };
    expect(nearestArrival(v(0, 0, 0, 0, 0, 20), core.catalogue, undefined, onlyUnrest)).toBe('w03');
    expect(nearestArrival(v(0, 0, 0, 0, 0, 20), core.catalogue)).not.toBe('w03');
  });
  it('test_slice_axis_weights_all_one', () => {
    expect(Object.values(core.engine.axisWeights)).toEqual([1, 1, 1, 1, 1, 1]);
  });
  it('test_four_world_build_redirects_to_nearest_of_four', () => { // [design §13, 2026-10-29]
    const four = { ...core, build: { ...core.build, streetWorlds: ['w10', 'w02', 'w01', 'w11'] as ArrivalWorldId[] } };
    expect(arrivalOutcome(v(0, 90, 58, 71, 78, 0), four).livedWorld).toBe('w10'); // d² 6 084 contre 6 764 (w11)
  });
});
