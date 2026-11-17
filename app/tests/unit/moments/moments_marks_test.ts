import { describe, expect, it } from 'vitest';
import laneJson from '../../fixtures/guided/lane-link.json';
import minimalJson from '../../fixtures/guided/minimal.json';
import { parseGuided } from '../../../src/data/schema/guided';
import { linksOfDay, marksOf, openedChains } from '../../../src/engine/moments/marks';
import type { ActRecord } from '../../../src/shared/types/street';
import { w10Street } from '../../support/guided';
import { act } from '../../support/street';

const G = parseGuided(minimalJson, w10Street);
const G_LANE = parseGuided(laneJson, w10Street);
const CLK = { dayStartMinute: 420 };
const scene = (d: 1 | 2, m: number, id: string, o: string): ActRecord => act(d, m, 'scene', id, o);
const sleep = (d: 1 | 2, m: number): ActRecord => act(d, m, 'sleep', 'bed');
const lane = (d: 1 | 2, m: number, id: string, o: string): ActRecord => act(d, m, 'lane', id, o);
const anchorOf = (id: string): number => G.scenes.find((s) => s.id === id)!.anchorMinute;

describe('moments : marques de chaîne [plan rue guidée J1-J2, T3]', () => {
  it('test_scene_option_selects_variant', () => {
    expect(marksOf([scene(1, 440, 'j1.roux', 'c')], { day: 1 }, G, CLK).map((m) => [m.linkId, m.variant])).toEqual([['A1', 'c']]);
  });
  it('test_night_link_inherits_from_variant', () => {
    const m = marksOf([scene(1, 440, 'j1.roux', 'a'), sleep(1, 1100)], { day: 2 }, G, CLK);
    expect(m.find((x) => x.linkId === 'A2')).toMatchObject({ variant: 'a', day: 2, minute: 420 });
    expect(linksOfDay(2, m).map((x) => x.linkId)).toContain('A2');
  });
  it('test_missed_link_is_absent_after_its_day', () => {
    expect(marksOf([sleep(1, 1100)], { day: 2 }, G, CLK).find((x) => x.linkId === 'A1'))
      .toMatchObject({ variant: 'absent', day: 1, minute: anchorOf('j1.roux') });
    expect(marksOf([], { day: 1 }, G, CLK)).toEqual([]);   // le jour n'est pas passé
    expect(marksOf([sleep(1, 1100)], { day: 2 }, G, CLK).find((x) => x.linkId === 'A2')).toMatchObject({ variant: 'absent', day: 2, minute: 420 });
  });
  it('test_lane_link_reads_effective_option', () => {
    const m = marksOf([lane(1, 445, 'checkpoint.j1', 'bypass')], { day: 1 }, G_LANE, CLK);
    expect(m.find((x) => x.linkId === 'L1')).toMatchObject({ variant: 'bypass', day: 1, minute: 445 });
    expect(marksOf([lane(1, 445, 'checkpoint', 'comply')], { day: 1 }, G_LANE, CLK).find((x) => x.linkId === 'L1')?.variant).toBe('comply');
  });
  it('test_marks_are_order_independent_of_input', () => {
    const sorted = [scene(1, 440, 'j1.roux', 'b'), lane(1, 445, 'checkpoint.j1', 'comply'), sleep(1, 1100)];
    const shuffled = [sorted[2]!, sorted[0]!, sorted[1]!];
    expect(marksOf(shuffled, { day: 2 }, G_LANE, CLK)).toEqual(marksOf(sorted, { day: 2 }, G_LANE, CLK));
  });
  it('test_opened_chains_ignores_absent_marks', () => {
    expect(openedChains(marksOf([sleep(1, 1100)], { day: 2 }, G_LANE, CLK))).toEqual([]);
    expect(openedChains(marksOf([scene(1, 440, 'j1.roux', 'a'), lane(1, 445, 'checkpoint.j1', 'comply')], { day: 1 }, G_LANE, CLK))).toEqual(['chain.A', 'chain.L']);
  });
});
