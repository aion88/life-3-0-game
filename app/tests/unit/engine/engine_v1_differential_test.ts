/**
 * Différentiel avec la v1 : T-1a (pas quotidien et porte), T-1b (6 050 scénarios au décimal exact), T-1c (flux aléatoire).
 *
 * DÉCISION [lead-programmer, laissée au plan 01 par le plan 00 et par GDD 03 §3.2, T-1c] : le port n'a AUCUN balayage
 * aléatoire des événements ordinaires.
 * - Un événement ordinaire de la v2 est un texte ou une réplique, que le plan 02b déclenche à une heure écrite, sans effet
 *   sur `ws` [D128].
 * - Un jalon est déclenché par un acte, sans tirage [D116 (2)].
 * - `eligible`, `fire` et `scan` de la v1 n'ont donc pas d'équivalent à comparer.
 * - T-1c se réduit, comme GDD 03 le prévoit pour ce cas, à `makeRng` bit à bit, sur `rng-golden.json` du plan 00
 *   [GDD 03 T-1c]. `LegacyStreamDice` (tests/support/legacy-dice.ts) rejoue ce flux ; c'est une aide de test, elle ne sert
 *   à aucun balayage.
 * - N de T-1a = 10 000 vecteurs par monde [lead-programmer] ; tout cas dont une comparaison tombe à moins de 0,05 d'un
 *   seuil est écarté à l'enregistrement [GDD 03 T-1a], car le flottant de la v1 et l'entier du port y divergent par nature
 *   (T-1b mesure cette zone au décimal exact).
 *
 * Fixtures : `v1-differential.json` (tools/golden/record_v1.mjs, exécute js/worldstate.js et js/map.js dans node:vm),
 * `scan-seuils.oracle.json` (tools/golden/export_scan_seuils.py, tools/port/scan_seuils.py sans modification).
 */
import { expect, it } from 'vitest';
import rngGolden from '../../fixtures/rng-golden.json';
import scanSeuils from '../../fixtures/scan-seuils.oracle.json';
import v1Differential from '../../fixtures/v1-differential.json';
import { foldUint32 } from '../../support/checksum';
import { LegacyStreamDice } from '../../support/legacy-dice';
import { firedSteps, stepOnce, testWorld } from '../../support/week';
import { gateStatuses } from '../../../src/engine/week';
import { WORLD_VARS, type ArrivalWorldId, type Delta, type WorldVector } from '../../../src/shared/types/world';


/** Six entiers en millièmes, dans l'ordre de WORLD_VARS, vers un vecteur. */
const vec = (a: readonly number[]): WorldVector =>
  Object.fromEntries(WORLD_VARS.map((k, i) => [k, a[i]!])) as unknown as WorldVector;
/** Six entiers vers une variation, zéros omis. */
const delta = (a: readonly number[]): Delta =>
  Object.fromEntries(WORLD_VARS.flatMap((k, i) => (a[i] === 0 ? [] : [[k, a[i]!]]))) as unknown as Delta;
const same = (x: WorldVector, a: readonly number[]): boolean => WORLD_VARS.every((k, i) => x[k] === a[i]);

it('test_t1a_daily_tick_matches_v1_off_threshold', { timeout: 30_000 }, () => {
  expect(v1Differential.meta.vars).toEqual([...WORLD_VARS]);
  expect(v1Differential.dailyTick.length).toBe(10);
  const misses: unknown[] = [];
  for (const w of v1Differential.dailyTick) {
    const world = testWorld(w.world as ArrivalWorldId);
    // les données de la v1 (drift, couplingScale) égalent celles du monde de test
    expect({ drift: w.drift, couplingScale100: w.couplingScale100 }).toEqual({ drift: world.engine.drift, couplingScale100: world.engine.couplingScale100 });
    expect(w.drawn).toBe(10_000);
    expect(w.cases.length).toBe(w.drawn - w.discarded);
    for (const c of w.cases) {
      const start = vec(c.slice(0, 6)), echo = delta(c.slice(6, 12));
      const noEcho = stepOnce(start, world, {}), withEcho = stepOnce(start, world, echo);
      if (!same(noEcho, c.slice(12, 18)) && misses.length < 3) misses.push({ world: w.world, start, echo: 'aucun', port: noEcho, v1: c.slice(12, 18) });
      if (!same(withEcho, c.slice(18, 24)) && misses.length < 3) misses.push({ world: w.world, start, echo, port: withEcho, v1: c.slice(18, 24) });
    }
  }
  expect(misses).toEqual([]);
});

it('test_t1a_gate_matches_v1_gate_closed', () => {
  expect(v1Differential.gates.length).toBe(10);
  const misses: unknown[] = [];
  for (const g of v1Differential.gates) {
    const world = testWorld(g.world as ArrivalWorldId);
    const when = world.engine.gates[0]!.when;
    expect({ var: when.var, cmp: when.cmp, above: when.threshold / 1000 }).toEqual({ var: g.var, cmp: '>', above: g.above });
    for (const c of g.cases) {
      const closed = gateStatuses(vec(c.slice(0, 6)), world)[0]!.closed;
      if (closed !== (c[6] === 1) && misses.length < 3) misses.push({ world: g.world, ws: c.slice(0, 6), port: closed, v1: c[6] === 1 });
    }
  }
  expect(misses).toEqual([]);
});

it('test_t1b_port_follows_exact_decimal_on_6050', () => {
  const S = scanSeuils;
  expect(S.meta.vars).toEqual([...WORLD_VARS]);
  expect(S.scenarios.length).toBe(6050);
  const misses: unknown[] = [];
  for (const c of S.scenarios) {
    const port = firedSteps(vec(c.start), testWorld(c.world as ArrivalWorldId), 9);
    if (JSON.stringify(port) !== JSON.stringify(c.exact) && misses.length < 3) misses.push({ world: c.world, start: c.start, port, exact: c.exact });
  }
  expect(misses).toEqual([]);
  expect(S.scenarios.filter((c) => c.floatDiverges).length).toBe(79); // [exécuté: tools/port/scan_seuils.py]
});

it('test_t1c_legacy_stream_replays_rng_golden', () => { // T-1c réduit à makeRng bit à bit [décision en tête de fichier]
  expect(rngGolden.seeds.length).toBe(10);
  for (const g of rngGolden.seeds) {
    const d = new LegacyStreamDice(g.seed);
    let h = 0x811c9dc5;
    const first: number[] = [];
    for (let i = 0; i < rngGolden.count; i++) {
      const x = d.next();
      if (i < 8) first.push(x);
      h = foldUint32(h, x);
    }
    expect(first).toEqual(g.first8);
    expect(h >>> 0).toBe(g.checksum);
  }
});
