import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene } from 'three/webgpu';
import { createBackend, forceWebGLFromSearch, GraphicsUnavailable, kindOf } from '../../../src/street/render/backend';
import { createPostChain, DISPLAY_GAMMA, liftToBlackPoint, NUMBER_OPS as N, pipelineStages, sharpHalfZoneM, vignetteFactor } from '../../../src/street/render/pipeline';
import { bakeLut } from '../../../src/street/render/lut';
import { FAKE_WEBGL, FAKE_WEBGPU, graphHas, host, IDENTITY, parentsOf, postOptions, scene, scriptedMake } from '../../support/street_render';

describe('rendu de la rue : chaîne, optique, backend, LUT', () => {
  it('test_stage_order_is_the_art_bible_e', () => {
    expect(pipelineStages({ aberration: true, letterbox: true })).toEqual(['scene', 'dof', 'bloomMask', 'chromatic', 'exposure', 'toneMap', 'lut', 'antialias', 'vignette', 'grain', 'letterbox']);
    expect(pipelineStages({ aberration: false, letterbox: false })).toEqual(['scene', 'dof', 'bloomMask', 'exposure', 'toneMap', 'lut', 'antialias', 'vignette', 'grain']);
  });
  it('test_antialiasing_runs_on_the_display_image_before_vignette_and_grain', () => {
    const s = pipelineStages({ aberration: true, letterbox: true });
    expect(s.indexOf('antialias')).toBeGreaterThan(s.indexOf('lut'));         // FXAA exige de l'sRGB : après tone map et LUT
    expect(s.indexOf('antialias')).toBeLessThan(s.indexOf('vignette'));       // et le grain ne doit pas être lissé
  });
  it('test_antialiasing_can_be_left_out_of_isolated_stage_comparisons', () => {
    // `?bloom=` et `?lut=` isolent UNE étape en comparant deux images ; FXAA décide pixel par pixel et ferait basculer un écart de 1 niveau en 30
    expect(pipelineStages({ aberration: true, letterbox: true, antialias: false })).not.toContain('antialias');
    expect(pipelineStages({ aberration: true, letterbox: true })).toContain('antialias');
  });
  it('test_grain_comes_after_the_lut', () => {
    const s = pipelineStages({ aberration: false, letterbox: false });
    expect(s.indexOf('grain')).toBeGreaterThan(s.indexOf('lut'));
  });
  it('test_half_sharp_zone_matches_the_art_bible_optics', () => {
    expect(2 * sharpHalfZoneM(85, 2.8, 8, 0.03)).toBeCloseTo(1.488, 3);   // N c s² / f² = 744,1 mm, le double fait 1488 mm : « 1,5 m à 8 m » [art bible §D.2]
    expect(2 * sharpHalfZoneM(85, 4, 2, 0.03)).toBeCloseTo(0.133, 3);      // 66,4 mm, le double fait 132,9 mm : « 13 cm » [art bible §C.2]
  });
  it('test_dof_range_data_never_undercuts_the_sharp_floor', () => {
    const g = scene().dof;   // la donnée vit à `dof` à la racine de la scène, pas sous `grade`
    expect(g.observation.focalLengthM.v).toBeGreaterThanOrEqual(sharpHalfZoneM(85, 2.8, 8, 0.03));
  });
  it('test_kind_of_reads_the_engine_flag_in_one_place', () => {
    expect(kindOf({ backend: FAKE_WEBGPU })).toBe('webgpu');
    expect(kindOf({ backend: FAKE_WEBGL })).toBe('webgl2');
    expect(kindOf({})).toBe('webgl2');
  });
  it('test_backend_falls_back_to_webgl2_without_error', async () => {
    // WebGPU absent : le premier appel (forceWebGL false) REJETTE, le second (forceWebGL true) répond webgl2 [R-02a.13]
    const s = scriptedMake((force) => (force ? 'webgl2' : new Error('WebGPU absent')));
    const b = await createBackend(host, { forceWebGL: false }, s.deps);
    expect(b.kind).toBe('webgl2');
    expect(s.calls).toEqual([false, true]);
  });
  it('test_backend_webgpu_is_kept_when_the_first_call_succeeds', async () => {
    const s = scriptedMake(() => 'webgpu');
    expect((await createBackend(host, { forceWebGL: false }, s.deps)).kind).toBe('webgpu');
    expect(s.calls).toEqual([false]);
  });
  it('test_force_webgl_goes_straight_to_webgl2', async () => {
    const s = scriptedMake(() => 'webgl2');
    expect((await createBackend(host, { forceWebGL: true }, s.deps)).kind).toBe('webgl2');
    expect(s.calls).toEqual([true]);
  });
  it('test_backend_double_failure_is_reported_not_thrown_to_the_shell', async () => {
    const s = scriptedMake(() => new Error('x'));
    await expect(createBackend(host, { forceWebGL: false }, s.deps)).rejects.toBeInstanceOf(GraphicsUnavailable);
    expect(s.calls).toEqual([false, true]);
  });
  it('test_force_webgl_param_is_read_only_in_dev_and_capture_builds', () => {
    expect(forceWebGLFromSearch('?webgl', true)).toBe(true);
    expect(forceWebGLFromSearch('?a=1&webgl', true)).toBe(true);
    expect(forceWebGLFromSearch('?webgl', false)).toBe(false);
    expect(forceWebGLFromSearch('', true)).toBe(false);
  });
  it('test_lut_bytes_and_identity', () => {
    const l = bakeLut(32, IDENTITY);
    expect(l.length).toBe(131_072);
    expect(Array.from(l.slice(0, 4))).toEqual([0, 0, 0, 255]);
    const last = (31 * 32 * 32 + 31 * 32 + 31) * 4;
    expect(Array.from(l.slice(last, last + 4))).toEqual([255, 255, 255, 255]);
  });
  it('test_lut_axis_order_is_r_fastest', () => {
    const l = bakeLut(32, IDENTITY);
    expect(Array.from(l.slice(4, 8))).toEqual([8, 0, 0, 255]);        // r = 1/31 -> 8, g et b à 0
    expect(Array.from(l.slice(32 * 4, 32 * 4 + 4))).toEqual([0, 8, 0, 255]);
    expect(Array.from(l.slice(32 * 32 * 4, 32 * 32 * 4 + 4))).toEqual([0, 0, 8, 255]);
  });
  it('test_lut_params_act_on_the_colour', () => {
    const warm = bakeLut(32, { contrast: 1, saturation: 1, tint: [1, 0.5, 0.5] });
    const last = (31 * 32 * 32 + 31 * 32 + 31) * 4;
    expect(Array.from(warm.slice(last, last + 3))).toEqual([255, 128, 128]);
    const grey = bakeLut(32, { contrast: 1, saturation: 0, tint: [1, 1, 1] });
    const px = (31) * 4;   // rouge pur
    expect(grey[px]).toBe(grey[px + 1]);
    expect(grey[px + 1]).toBe(grey[px + 2]);
  });
  it('test_three_luts_weigh_393216_bytes', () => {
    expect(3 * bakeLut(32, IDENTITY).length).toBe(393_216);
  });
  it('test_post_chain_graph_builds_and_takes_grade_uniforms', () => {
    // sans GPU : le graphe TSL se construit (arguments des nœuds valides) et les uniformes se posent ; le rendu réel est vérifié en T13
    const chain = createPostChain({ toneMapping: 0, outputColorSpace: 'srgb' } as never, new Scene(), new PerspectiveCamera(), postOptions());
    expect(chain.stages).toEqual(pipelineStages({ aberration: true, letterbox: true }));
    chain.setGrade({ grain: 3.5, vignetteIL: -0.5, blackPoint: 0.02, exposure: 1.5, toneMap: 'aces', veil: 0, accent: 0, curvature: 0 }, { from: 'jour', to: 'nuit', t: 0.25 });
    chain.setFocus(8); chain.setAspect(16 / 9); chain.setTime(1);
  });
  it('test_black_point_is_the_last_colour_operation_before_the_letterbox', () => {
    // graphe construit, sans GPU : le nœud qui consomme le point noir enveloppe le grain, et le grain n'enveloppe pas le point noir
    const chain = createPostChain({ toneMapping: 0, outputColorSpace: 'srgb' } as never, new Scene(), new PerspectiveCamera(), postOptions({ letterbox: false }));
    const { blackPoint, grain, vignetteIL } = chain.uniforms;
    const consumers = parentsOf(chain.finalNode, blackPoint);
    expect(consumers.length).toBeGreaterThan(0);
    // le point noir apparaît deux fois (1 - bp, puis + bp) : l'opération qui ajoute bp enveloppe le grain et la vignette
    expect(consumers.some((c) => graphHas(c, grain) && graphHas(c, vignetteIL))).toBe(true);
    for (const g of parentsOf(chain.finalNode, grain)) expect(graphHas(g, blackPoint)).toBe(false);
    // et son arithmétique : un noir pur sort à blackPoint, un blanc reste à 1
    expect(liftToBlackPoint(N, 0, 0.02)).toBeCloseTo(0.02, 10);
    expect(liftToBlackPoint(N, 1, 0.02)).toBeCloseTo(1, 10);
  });
  it('test_letterbox_wraps_the_black_point', () => {
    const chain = createPostChain({ toneMapping: 0, outputColorSpace: 'srgb' } as never, new Scene(), new PerspectiveCamera(), postOptions({ letterbox: true }));
    const { blackPoint } = chain.uniforms;
    expect(graphHas(chain.finalNode, blackPoint)).toBe(true);
    for (const c of parentsOf(chain.finalNode, blackPoint)) expect(c).not.toBe(chain.finalNode);
  });
  it('test_vignette_corner_factor_is_in_stops_of_light_not_display_values', () => {
    // -0,5 IL aux coins (r² = 1) : 2^(-0,5/2,2) = 0,8542 en valeur d'affichage ; l'ancienne forme 2^-0,5 = 0,707 donnait un coin 1,21 fois plus sombre
    expect(vignetteFactor(N, -0.5, 1)).toBeCloseTo(0.8542, 4);
    expect(vignetteFactor(N, -0.5, 0)).toBe(1);
    // en lumière linéaire le même facteur vaut 2^-0,5 : (0,8542)^2,2 = 0,7071
    expect(vignetteFactor(N, -0.5, 1) ** DISPLAY_GAMMA).toBeCloseTo(2 ** -0.5, 4);
  });
  it('test_chain_initial_state_comes_from_the_data_not_from_literals', () => {
    const o = postOptions();
    expect(o.initial.grade.blackPoint).toBe(scene().grade.states.heureBleue.blackPoint.v);
    expect(o.postfx.bloom.strength.status).toBe('supposed');
    expect(o.postfx.grainLumaWeight.dark.owner).toBe('technical-artist');
  });
});
