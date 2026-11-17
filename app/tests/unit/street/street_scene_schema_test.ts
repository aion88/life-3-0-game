import { describe, expect, it } from 'vitest';
import { parseScene } from '../../../src/engine/view/sceneSchema';
import w10SceneRaw from '../../../src/street/data/w10.scene.json';
import pinned from '../../fixtures/street/street_supposed.json';
import { lampZs, supposedPaths, withSupposedNoOwner } from '../../support/street_helpers';
import { ctxW10, withStreet } from '../../support/street';

const scene = () => parseScene(w10SceneRaw, ctxW10().street);

describe('scène de w10 : schéma strict', () => {
  it('test_scene_parses_strict', () => {
    expect(() => parseScene({ ...w10SceneRaw, layoutx: 1 }, ctxW10().street)).toThrow(/layoutx/);
  });
  it('test_street_is_92_m_long', () => { const l = scene().layout; expect(l.zMax.v - l.zMin.v).toBe(92); });   // 44 - (-48)
  it('test_lamps_six_per_side', () => { expect(lampZs(scene())).toEqual([44, 26, 8, -10, -28, -46]); });
  it('test_wall_is_4_by_4_with_one_orange_screen', () => {
    const w = scene().checkpoint.wall;
    expect(w.cols.v * w.rows.v).toBe(16);
    expect(w.widthM).toBeCloseTo(4.2, 5);    // 4 x 1,05
    expect(w.heightM).toBeCloseTo(3.5, 5);   // 4 x 0,8 + 0,3
    expect(w.orange).toEqual({ row: 3, col: 2 });
  });
  it('test_nacelles_follow_the_engine_not_a_copy', () => {
    const S = ctxW10().street;
    expect(scene().nacelles.map((n) => n.id)).toEqual(S.gaze.nacelleZ.map((z) => `n${z}`));
    expect(Object.keys(scene())).not.toContain('nacelleZ');   // une seule source par valeur
  });
  it('test_every_supposed_value_is_owned_dated_and_pinned', () => {
    const s = supposedPaths(scene());
    expect(s.length).toBeGreaterThan(0);
    for (const p of s) {
      expect(p.owner).toBeTruthy();
      expect(pinned.some((b) => b.path === p.path && b.owner === p.owner && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.reason)).toBe(true);
    }
    for (const b of pinned) expect(s.some((p) => p.path === b.path)).toBe(true);   // aucune entrée périmée
    expect(() => parseScene(withSupposedNoOwner(w10SceneRaw), ctxW10().street)).toThrow(/owner/);
  });
  it('test_light_has_one_step_and_no_night_step', () => {
    expect(scene().light.steps).toEqual([{ fromMinute: 420, state: 'heureBleue' }]);   // H.4
  });
  it('test_every_npc_has_a_place', () => { for (const n of ctxW10().street.npcs) expect(scene().npcPlaces[n.id]?.at).toBeDefined(); });
  it('test_every_clickable_has_a_position', () => { for (const c of ctxW10().street.clickables) expect(scene().interactions[c.id]?.at).toBeDefined(); });
  it('test_walk_speed_is_sourced', () => { expect(scene().walk.speedMps.status).toBe('sourced'); expect(scene().walk.speedMps.v).toBe(1.6); });
  it('test_grade_gains_are_null_until_someone_writes_them', () => {
    for (const g of Object.values(scene().grade.gains)) expect(g).toBeNull();   // aucune valeur de DA inventée
  });
  it('test_grade_base_values_are_the_art_bible_d1_table', () => {
    const g = scene().grade.states;
    expect([g.jour.grain.v, g.heureBleue.grain.v, g.nuit.grain.v]).toEqual([2.5, 3.5, 4.5]);
    expect([g.jour.vignetteIL.v, g.heureBleue.vignetteIL.v, g.nuit.vignetteIL.v]).toEqual([-0.3, -0.5, -0.7]);
  });
  const raw = w10SceneRaw as unknown as Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any
  it('test_wall_z_is_the_engines_checkpoint_z', () => {
    const moved = withStreet((d) => { d.checkpoint.z = -14; });
    expect(() => parseScene(w10SceneRaw, moved)).toThrow(/checkpoint\.z/);
  });
  it('test_orange_screen_stays_inside_the_wall', () => {
    const bad = { ...raw, checkpoint: { ...raw.checkpoint, wall: { ...raw.checkpoint.wall, orange: { row: 9, col: 2 } } } };
    expect(() => parseScene(bad, ctxW10().street)).toThrow(/orange/);
  });
  it('test_written_gains_carry_provenance', () => {
    const withGain = (g: unknown) => ({ ...raw, grade: { ...raw.grade, gains: { ...raw.grade.gains, grain: g } } });
    expect(() => parseScene(withGain({ aiPower: 0.5 }), ctxW10().street)).toThrow();
    const ok = parseScene(withGain({ aiPower: { v: 0.5, src: 'x', status: 'sourced' } }), ctxW10().street);
    expect(ok.grade.gains.grain?.['aiPower']?.v).toBe(0.5);
  });
  it('test_max_dt_is_supposed_and_owned_by_the_lead_programmer', () => {
    const m = scene().walk.maxDtMs; expect([m.v, m.status, m.owner]).toEqual([50, 'supposed', 'lead-programmer']);
  });
  it('test_gain_keys_are_world_variables', () => {
    const bad = { ...raw, grade: { ...raw.grade, gains: { ...raw.grade.gains, grain: { bogus: { v: 1, src: 'x', status: 'sourced' } } } } };
    expect(() => parseScene(bad, ctxW10().street)).toThrow();
  });
  it('test_exposure_adapts_faster_dark_to_light', () => {
    const a = scene().grade.exposure.adapt; expect(a.upRatePerS.v).toBeGreaterThan(a.downRatePerS.v);   // art bible §E.5
  });
});

describe('couleur de la bande noire [R-02a.22 (5)]', () => {
  it('test_barrier_black_is_a_supposed_palette_entry_and_not_a_literal_in_checkpoint', async () => {
    const s = parseScene(w10SceneRaw, ctxW10().street);
    expect(s.build.palette.barrierBlack).toMatchObject({ v: '#0B0D0F', status: 'supposed', owner: 'technical-artist' });
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/street/render/scene/checkpoint.ts', 'utf8')).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
