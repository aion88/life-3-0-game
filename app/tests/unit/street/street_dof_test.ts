import { describe, expect, it } from 'vitest';
import { PLATE_POSES } from '../../../src/street/capture';
import { blurAt, chromaticEdgeSeparationPx, dofZoneHalfM, effectiveDepth, sharpHalfZoneM } from '../../../src/engine/view/dof';
import { parseScene } from '../../../src/engine/view/sceneSchema';
import w10SceneRaw from '../../../src/street/data/w10.scene.json';
import { ctxW10 } from '../../support/street';

describe('profondeur de champ : zone nette et mise au point [TV-02a-render]', () => {
  it('test_effective_depth_is_the_focus_inside_the_sharp_zone', () => {
    expect(effectiveDepth(15.6, 15.2, 2.6)).toBe(15.2);   // un mur oblique de 0,4 m en avant du plan net reste net
    expect(effectiveDepth(14.2, 15.2, 2.6)).toBe(15.2);
  });
  it('test_effective_depth_grows_from_the_edge_of_the_sharp_zone_both_sides', () => {
    expect(effectiveDepth(20, 15, 2)).toBeCloseTo(18, 9);   // 5 m derrière : 3 m au-delà de la zone
    expect(effectiveDepth(10, 15, 2)).toBeCloseTo(12, 9);   // 5 m devant : de même
  });
  it('test_zone_follows_the_focus_distance_squared', () => {
    const wall = dofZoneHalfM({ focalMm: 85, fNumber: 2.8, circleMm: 0.03 }, 15.2);
    const face = dofZoneHalfM({ focalMm: 85, fNumber: 2.8, circleMm: 0.03 }, 2);
    expect(wall).toBeGreaterThan(2.5);   // le mur de télés et son texte (profondeur oblique de +-0,6 m) tiennent dedans
    expect(face).toBeLessThan(0.1);      // à 2 m le fond flotte, le visage seul est net [art bible §C.2]
    expect(face).toBeCloseTo(sharpHalfZoneM(85, 2.8, 2, 0.03), 12);
  });
  it('test_the_checkpoint_plate_keeps_the_whole_wall_and_text_sharp', () => {
    // pose `checkpoint-large` : caméra (-3,2 ; 1,55 ; 3,5), visée (1,2 ; 2,0 ; -11), mur plan z = -10,9 de x = -2,1 à 2,1, compteur à y = 3,6
    const cam = [-3.2, 1.55, 3.5], aim = [1.2, 2, -11];
    const axis = aim.map((a, i) => a - cam[i]!); const len = Math.hypot(...axis); const u = axis.map((a) => a / len);
    const depth = (p: number[]) => p.reduce((s, c, i) => s + (c - cam[i]!) * u[i]!, 0);
    const half = dofZoneHalfM({ focalMm: 85, fNumber: 2.8, circleMm: 0.03 }, len);
    for (const x of [-2.1, 0, 2.1]) for (const y of [0.3, 3.6]) {
      expect(Math.abs(depth([x, y, -10.9]) - len)).toBeLessThanOrEqual(half);   // dans la zone nette : aucun flou
    }
  });
  it('test_scene_data_gives_a_sharp_zone_for_both_modes', () => {
    const d = parseScene(w10SceneRaw, ctxW10().street).dof;
    for (const m of [d.walk, d.observation]) { expect(m.fNumber.v).toBeGreaterThan(0); expect(m.circleMm.v).toBeGreaterThan(0); }
  });
  it('test_chromatic_aberration_is_discreet_at_the_edge', () => {
    const px = chromaticEdgeSeparationPx(parseScene(w10SceneRaw, ctxW10().street).postfx.chromatic.v, 1920);
    expect(px).toBeLessThanOrEqual(2.5);   // écart rouge-bleu au bord de l'image : un liseré, pas des franges
    expect(chromaticEdgeSeparationPx(0.6, 1920)).toBeGreaterThan(20);   // la valeur rejetée : franges RVB sur les fenêtres
  });
});

describe('grain et liseré : réglages lisibles [TV-02a-render]', () => {
  it('test_shadow_grain_never_exceeds_the_art_bible_table', () => {
    const s = parseScene(w10SceneRaw, ctxW10().street);
    const w = s.postfx.grainLumaWeight;
    expect(w.dark.v).toBeGreaterThan(w.bright.v);   // plus fort dans les ombres [art bible §E.9]
    for (const st of ['jour', 'heureBleue', 'nuit'] as const) {
      expect(s.grade.states[st].grain.v * w.dark.v).toBeLessThanOrEqual(s.grade.states[st].grain.v + 1e-9);   // écart-type d'ombre au plus la table §D.1 (1,4 la dépassait de 40 % : 6,3 % de nuit, jugé trop fort sur plaque)
    }
  });
  it('test_chromatic_fringe_stays_under_a_pixel_at_the_edge', () => {
    expect(chromaticEdgeSeparationPx(parseScene(w10SceneRaw, ctxW10().street).postfx.chromatic.v, 1920)).toBeLessThanOrEqual(1);   // 0,04 laissait un liseré rouge net sur les fenêtres HDR
  });
});

describe('plaque rue-nuit : les personnages au premier plan sont nets [TV-02a-render]', () => {
  it('test_rue_nuit_focus_keeps_the_passers_at_4_to_8_m_sharp', () => {
    const pose = PLATE_POSES['rue-nuit']!;
    const d = parseScene(w10SceneRaw, ctxW10().street).dof.observation;
    expect(pose.focusM).toBeDefined();
    const half = dofZoneHalfM({ focalMm: pose.dofFocalMm ?? pose.focalMm, fNumber: d.fNumber.v, circleMm: d.circleMm.v }, pose.focusM!);
    expect(pose.focusM! - half).toBeLessThanOrEqual(4);
    expect(pose.focusM! + half).toBeGreaterThanOrEqual(8);
  });
  it('test_other_plates_keep_their_focus_on_the_target', () => {
    for (const name of ['checkpoint-large', 'place-jour', 'personnage-2m']) expect(PLATE_POSES[name]!.focusM).toBeUndefined();
  });
});

describe('caméra joueur : les personnes proches restent lisibles [TV-02a-render]', () => {
  const sc = () => parseScene(w10SceneRaw, ctxW10().street);
  const LEGIBLE = 0.5;   // au plus la moitié du flou : silhouette et démarche identifiables
  it('test_walk_a_passer_at_8_m_is_not_blurred_past_half', () => {   // art bible §C.2 : silhouette identifiable à 8 m
    const s = sc(); const m = s.dof.walk;
    const focus = s.camera.walk.distanceM.v;
    const half = dofZoneHalfM({ focalMm: s.camera.walk.movingFocalMm.v, fNumber: m.fNumber.v, circleMm: m.circleMm.v }, focus);
    expect(blurAt(8, focus, half, m.focalLengthM.v)).toBeLessThanOrEqual(LEGIBLE);
    expect(blurAt(8, focus, half, 2.4)).toBeGreaterThan(0.9);   // l'ancienne rampe : 8 m était déjà quasi flou total
  });
  it('test_observation_queue_neighbours_within_2_m_are_legible', () => {
    const s = sc(); const m = s.dof.observation;
    const focus = s.camera.observation.distanceM.v;
    const half = dofZoneHalfM({ focalMm: s.camera.observation.focalMm.v, fNumber: m.fNumber.v, circleMm: m.circleMm.v }, focus);
    for (const d of [-2, -1, 1, 2]) expect(blurAt(focus + d, focus, half, m.focalLengthM.v)).toBeLessThanOrEqual(LEGIBLE);
    expect(blurAt(focus + 2, focus, half, 0.75)).toBeGreaterThan(0.9);
  });
});
