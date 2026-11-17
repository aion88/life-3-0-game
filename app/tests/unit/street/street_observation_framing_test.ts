import { describe, expect, it } from 'vitest';
import { cameraPose } from '../../../src/engine/view/camera';
import { queueSlots } from '../../../src/engine/view/crowd';
import type { Vec2 } from '../../../src/engine/moments/types';
import { CAM, SCENE } from '../../support/street_walk';

/**
 * Cadrage de la caméra d'observation dans la file [plan 02a T13-fix]. Cause du défaut : la caméra se tenait SUR l'axe de la file, six mètres
 * derrière la joueuse ; les voisins de file (x = 0, un pas de 0,8 m) passaient entre elle et l'objectif, et un corps de dos remplissait le cadre.
 * Modèle d'occultation : chaque personne est un cylindre vertical de rayon `BODY_RADIUS_M`, vu en plan (la caméra est à hauteur de tête).
 * `BODY_RADIUS_M` est une valeur de test, pas une donnée de jeu : demi-épaule d'un corps adulte, supposée.
 */
const BODY_RADIUS_M = 0.25;
const ASPECT = 16 / 9;                    // l'aspect du rendu (`PerspectiveCamera(…, 16 / 9, …)` de runtime.ts)
const wallZ = SCENE.interactions['wall']!.at.v.z;

interface Seen { readonly inFrame: boolean; readonly occluded: boolean }

function seen(cam: readonly [number, number, number], target: readonly [number, number, number], fovDeg: number, p: Vec2, others: readonly Vec2[]): Seen {
  const fx = target[0] - cam[0], fz = target[2] - cam[2], fl = Math.hypot(fx, fz);
  const dx = p.x - cam[0], dz = p.z - cam[2], dl = Math.hypot(dx, dz);
  const cosA = (fx * dx + fz * dz) / (fl * dl);
  const halfH = Math.atan(Math.tan((fovDeg * Math.PI) / 360) * ASPECT);   // demi-champ horizontal
  const inFrame = cosA > 0 && Math.acos(cosA) + Math.atan(BODY_RADIUS_M / dl) <= halfH;   // le corps entier tient dans le champ
  const occluded = others.some((o) => {
    const ox = o.x - cam[0], oz = o.z - cam[2];
    const t = (ox * dx + oz * dz) / (dl * dl);
    if (t <= 0 || t >= 1) return false;                                   // pas entre la caméra et la personne
    return Math.hypot(ox - t * dx, oz - t * dz) < BODY_RADIUS_M;
  });
  return { inFrame, occluded };
}

describe('caméra d\'observation : cadrage de la file', () => {
  const frontZ = wallZ + SCENE.checkpoint.booth.depthM.v / 2 + SCENE.walk.bodyRadiusM.v;   // où le joueur s'arrête devant le mur de télés
  const visibleOf = (player: Vec2, permille: number): { player: boolean; neighbours: number } => {
    const pose = cameraPose('observation', player, false, CAM);
    const slots = queueSlots(SCENE, permille);
    const ps = seen(pose.pos, pose.target, pose.fovDeg, player, slots);
    const neighbours = slots.filter((s) => Math.hypot(s.x - player.x, s.z - player.z) < SCENE.queue.lengthM.v)
      .filter((p) => { const v = seen(pose.pos, pose.target, pose.fovDeg, p, [player, ...slots.filter((o) => o !== p)]); return v.inFrame && !v.occluded; });
    return { player: ps.inFrame && !ps.occluded, neighbours: neighbours.length };
  };
  for (const permille of [0, 500, 1000]) {
    for (const x of [0, -0.4, -0.9]) {
      it(`test_observation_shows_the_player_in_the_file_and_two_neighbours_unoccluded_permille_${permille}_x_${x}`, () => {
        const player = { x, z: queueSlots(SCENE, permille)[5]!.z + 0.4 };
        const v = visibleOf(player, permille);
        expect(v.player, 'le joueur est dans le cadre et non occulté').toBe(true);
        expect(v.neighbours, 'au moins deux voisins de file visibles').toBeGreaterThanOrEqual(2);
      });
    }
    it(`test_observation_shows_the_player_in_front_of_the_tv_wall_not_hidden_by_it_permille_${permille}`, () => {
      expect(visibleOf({ x: 0, z: frontZ }, permille).player).toBe(true);
    });
  }

  // Cadrage du checkpoint [TV-02a-T13-fix] : le mur de télés SOLIDE arrête le joueur à `frontZ`, et la pose centrée sur lui ne montrait que le mur (4 m de large à 85 mm),
  // ni la guérite ni l'enfilade de la file. Au front, la caméra doit cadrer le mur ET la guérite (et le joueur) dans le champ horizontal.
  describe('cadrage de la scène du checkpoint', () => {
    const ck = SCENE.checkpoint, halfH = (fovDeg: number): number => Math.atan(Math.tan((fovDeg * Math.PI) / 360) * ASPECT);
    const angleOff = (pose: ReturnType<typeof cameraPose>, p: Vec2): number => {
      const fx = pose.target[0] - pose.pos[0], fz = pose.target[2] - pose.pos[2], dx = p.x - pose.pos[0], dz = p.z - pose.pos[2];
      return Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
    };
    const faceZ = wallZ + ck.booth.depthM.v / 2;
    const wallLeft = { x: ck.boothX.v - ck.booth.widthM.v / 2 - ck.wall.widthM, z: faceZ };
    const boothRight = { x: ck.boothX.v + ck.booth.widthM.v / 2, z: faceZ };
    for (const player of [{ x: 0, z: frontZ }, { x: 0.75, z: frontZ }, { x: -0.5, z: frontZ + 0.2 }]) {
      it(`test_observation_frames_wall_booth_and_player_at_the_checkpoint_x_${player.x}`, () => {
        const pose = cameraPose('observation', player, false, CAM), lim = halfH(pose.fovDeg);
        for (const [name, p] of [['bord gauche du mur', wallLeft], ['bord droit de la guérite', boothRight], ['le joueur', player]] as const)
          expect(angleOff(pose, p), `${name} dans le champ horizontal`).toBeLessThanOrEqual(lim);
      });
    }
    it('test_observation_camera_stays_inside_the_street_and_never_below_the_art_bible_focal', () => {
      for (const z of [frontZ, frontZ + 1, frontZ + 2, frontZ + 4, frontZ + 8]) {
        const pose = cameraPose('observation', { x: 0, z }, false, CAM);
        expect(Math.abs(pose.pos[0])).toBeLessThan(SCENE.layout.halfWidthM.v);
        expect(pose.pos[2]).toBeLessThanOrEqual(SCENE.layout.zMax.v);
      }
      expect(CAM.observation.focalMm.v).toBeGreaterThanOrEqual(CAM.observation.focalMmMin.v);
    });
    it('test_observation_pose_is_continuous_while_the_player_advances_in_the_file', () => {
      let prev = cameraPose('observation', { x: 0, z: frontZ + 12 }, false, CAM);
      for (let z = frontZ + 12; z >= frontZ; z -= 0.05) {
        const q = cameraPose('observation', { x: 0, z }, false, CAM);
        for (let i = 0; i < 3; i++) { expect(Math.abs(q.pos[i]! - prev.pos[i]!)).toBeLessThan(0.3); expect(Math.abs(q.target[i]! - prev.target[i]!)).toBeLessThan(0.3); }
        prev = q;
      }
    });
  });
});
