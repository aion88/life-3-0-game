import { describe, expect, it } from 'vitest';
import themeRaw from '../../../src/data/ui/theme.json';
import triptychRaw from '../../../src/data/ui/triptych.json';
import timingRaw from '../../../src/data/ui/timing.json';
import { DataLoadError, loadCore } from '../../../src/data/load';
import { parseTheme, parseTiming, parseTriptych } from '../../../src/data/schema/ui';
import { loadUi } from '../../../src/data/ui/load';
import { ARRIVAL_HOLD_SECONDS, extinctionSeconds, screenSecondsOfStep } from '../../../src/fastforward/timeline';
import { WORLD_VARS } from '../../../src/shared/types';

describe('données de l\'interface', () => {
  it('test_ui_data_is_strict : une clé inconnue dans un des trois JSON lève DataLoadError', () => {
    expect(() => parseTheme({ ...themeRaw, extra: 1 })).toThrow(DataLoadError);
    expect(() => parseTriptych({ ...triptychRaw, extra: 1 })).toThrow(DataLoadError);
    expect(() => parseTiming({ ...timingRaw, extra: 1 })).toThrow(DataLoadError);
    expect(() => parseTheme({ ...themeRaw, colors: { ...themeRaw.colors, extra: '#000000' } })).toThrow(DataLoadError);
    expect(() => parseTheme({ ...themeRaw, colors: { ...themeRaw.colors, base: 'rouge' } })).toThrow(DataLoadError);
  });

  it('les trois fichiers réels se chargent', () => {
    const ui = loadUi();
    expect(ui.theme.colors.base).toBe('#2B3138');
    expect(ui.timing.speeds).toEqual([1, 2, 4]);
  });

  it('test_triptych_pairing_covers_six_vars_once : union = WORLD_VARS, intersections vides', () => {
    const { bands } = loadUi().triptych;
    const all = [...bands.sky, ...bands.city, ...bands.ground];
    expect([...all].sort()).toEqual([...WORLD_VARS].sort());
    expect(new Set(all).size).toBe(6);
    expect(() => parseTriptych({ ...triptychRaw, bands: { ...triptychRaw.bands, ground: ['freedom', 'order'] } })).toThrow(DataLoadError);
    expect(() => parseTriptych({ ...triptychRaw, bands: { ...triptychRaw.bands, ground: ['freedom', 'freedom'] } })).toThrow(DataLoadError);
  });

  it('test_screen_plan_matches_timeline_seconds : 61 s, 78 s, 83,8333 s lus du moteur de temps, pas de timing.json [R-03.3]', () => {
    const engine = loadCore().engine;
    const choice = engine.steps.choiceStep;
    expect(screenSecondsOfStep(choice, engine, false) + ARRIVAL_HOLD_SECONDS).toBeCloseTo(61, 9);
    expect(extinctionSeconds(60, engine)).toBeCloseTo(78, 9);
    expect(extinctionSeconds(70, engine)).toBeCloseTo(83.8333333333, 9);
    expect(Object.keys(timingRaw)).not.toContain('yearSeconds');
  });

  it('test_causes_editions_total_40_seconds : 14 + 14 + 12, le bouton « Rejoue » arrive 55 s après la rupture, 118 s après le début d\'une extinction à 78 s', () => {
    const { causesEditionsMs } = loadUi().timing;
    const total = causesEditionsMs.reduce((a, b) => a + b, 0);
    expect(total).toBe(40000);
    expect(15 + total / 1000).toBe(55);
    expect(78 + total / 1000).toBe(118);
  });
});
