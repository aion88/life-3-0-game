import { expect, it } from 'vitest';
import w10Raw from '../../../src/data/worlds/w10.json';
import { loadCore } from '../../../src/data/load';
import { parseWorld } from '../../../src/data/schema/world';
import { gateStatuses } from '../../../src/engine/week';
import { DOOR_TABLE } from '../../fixtures/door-table';
import { v } from '../../support/vec';
import {
  MAX_ECHO, NONE, PHONE_ONCE_A_DAY, gateClosedOn, gateValueAfter, litSequence, playWeek, runLivingIn, slopeGaps, testWorld,
} from '../../support/week';

const core = loadCore();
const W10 = parseWorld(w10Raw, core.catalogue);

it('test_door_table_5_7_all_worlds', () => { // T-10
  expect(DOOR_TABLE.length).toBe(28);
  for (const row of DOOR_TABLE) expect(gateValueAfter(testWorld(row.world), row.steps, row.echo), `${row.world} ${row.steps} ${row.echo}`).toBe(row.expected);
  for (const row of DOOR_TABLE.filter((r) => r.world === 'w10')) expect(gateValueAfter(W10, row.steps, row.echo)).toBe(row.expected); // données réelles
  expect(playWeek(runLivingIn('w02'), testWorld('w02'), core, NONE).ws.unrest).toBe(11_500); // w02 après la clôture [GDD 03 §10.1]
  expect(playWeek(runLivingIn('w09'), testWorld('w09'), core, NONE).ws.unrest).toBe(42_000); // C3 compris
  expect([gateClosedOn(testWorld('w05'), NONE), gateClosedOn(testWorld('w01'), NONE)]).toEqual([1, null]); // w05 fermée dès le J1, w01 jamais
});

it('test_w10_gate_closes_j5_j2_j3', () => {
  expect([NONE, MAX_ECHO, PHONE_ONCE_A_DAY].map((g) => gateClosedOn(W10, g))).toEqual([5, 2, 3]);
});

it('test_reading_hysteresis_vs_strict_gate', () => {
  const lit = [60, 59.5, 59, 58.9].map((ap) => v(ap, 90, 55, 15, 95, 45)).reduce(litSequence(W10, 'to-w06.aiPower'), []);
  expect(lit).toEqual([true, true, true, false]); // éteinte seulement sous 60 − 1
  expect(gateStatuses(v(25, 90, 55, 15, 96, 45), W10)[0]!.closed).toBe(false); // 96 n'est pas > 96
  expect(gateStatuses(v(25, 90, 55, 15, 96, 45), W10)[0]!.distance).toBe(0); // 96 : ouverte, pile sur le seuil
  expect(gateStatuses(v(25, 90, 55, 15, 90, 45), W10)[0]).toMatchObject({ closed: false, distance: 6000 });
  expect(gateStatuses(v(25, 90, 55, 15, 97.1, 45), W10)[0]).toMatchObject({ closed: true, distance: 0 }); // fermée : distance 0
});

it('test_t14_slope_thresholds_vs_midpoint', () => { // T-14 [GDD 03 T-14, D121 (4)]
  expect(slopeGaps(W10, core.catalogue)).toEqual([
    { slope: 'to-w06', var: 'aiPower', data: 60_000, midpoint: 50_000 },
    { slope: 'to-w03', var: 'freedom', data: 50_000, midpoint: 52_500 },
    { slope: 'to-w03', var: 'abundance', data: 68_000, midpoint: 67_500 },
  ]); // écarts listés, pas masqués ; le neutre 82,5 est aligné
});
