import { describe, expect, it } from 'vitest';
import { DataLoadError, loadCore, parseBuild, parseEngine, parseWorld } from '../../../src/data/load';
import { cat, engineRaw, w10Raw, withCouplingCmp, withCouplingMagnitude, withDrift, withGateCmp, withScale, withSlopeTo } from '../../fixtures/data/factories';

describe('data schema', () => {
  it('test_core_files_parse', () => {
    const core = loadCore();
    expect(core.catalogue.entries).toHaveLength(12);
    expect(core.build.streetWorlds).toEqual(['w10']);
  });
  it('test_w10_canonical_vector_from_catalogue_not_v1_start', () => {
    const v = loadCore().catalogue.byId.w10.vector!;
    expect(v).toEqual({ aiPower: 25_000, order: 90_000, abundance: 55_000, freedom: 15_000, surveillance: 95_000, unrest: 45_000 });
  });
  it('test_w10_skeleton_parses_with_engine_values', () => {
    const w = parseWorld(w10Raw, loadCore().catalogue);
    expect(w.engine.drift).toEqual({ surveillance: 300, freedom: -200, unrest: 300 });
    expect(w.engine.couplingScale100).toBe(100);
    expect(w.engine.gates[0]!.when).toEqual({ var: 'surveillance', cmp: '>', threshold: 96_000 });
    expect(w.calendar.map((d) => d.mode)).toEqual(['contraint', 'bascule', 'bascule', 'bascule', 'bascule', 'contraint', 'contraint']);
  });
  it('test_off_grid_value_refused_with_path', () => {
    expect(() => parseWorld(withDrift(w10Raw, { unrest: 0.0005 }), cat)).toThrow(/engine\.drift\.unrest/);
    expect(() => parseWorld(withScale(w10Raw, 1.005), cat)).toThrow(DataLoadError);
  });
  it('test_coupling_non_strict_comparator_refused', () => {
    expect(() => parseEngine(withCouplingCmp(engineRaw, '>='))).toThrow(DataLoadError);
    expect(() => parseEngine(withCouplingCmp(engineRaw, '<='))).toThrow(DataLoadError);
  });
  it('test_coupling_magnitude_off_tenth_grid_refused', () => {
    expect(() => parseEngine(withCouplingMagnitude(engineRaw, 'C1', 1.25))).toThrow(DataLoadError);
  });
  it('test_gate_non_strict_comparator_refused', () => {
    expect(() => parseWorld(withGateCmp(w10Raw, '>='), cat)).toThrow(DataLoadError);
  });
  it('test_slope_to_unknown_or_extinction_refused', () => {
    expect(() => parseWorld(withSlopeTo(w10Raw, 'w13'), cat)).toThrow();
    expect(() => parseWorld(withSlopeTo(w10Raw, 'w07'), cat)).toThrow();
  });
  it('test_build_world_without_file_refused', () => {
    expect(() => parseBuild({ schema: 1, label: 'x', streetWorlds: ['w02'] }, cat, ['w10'])).toThrow(DataLoadError);
  });
});
