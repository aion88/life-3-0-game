/**
 * Corps de la rue guidée [rue guidée T14, revue #2] : réveil dans le logement 9-D, scène de Mme Roux au palier (du même côté de la cloison), marche qui sort de
 * l'immeuble par la porte au lieu de traverser cloisons et logements voisins.
 */
import { describe, expect, it } from 'vitest';
import { actorSpot, createActors, insideBuilding, placeSpot, walkPath } from '../../../src/street/guided/actors';
import { SCENE } from '../../support/street_walk';
import { parseWorld } from '../../../src/data/schema/world';
import { cat, w10Raw } from '../../fixtures/data/factories';

const half = SCENE.layout.halfWidthM.v;

describe('rue guidée : corps', () => {
  it('test_home_and_landing_places_are_inside_the_building', () => {
    expect(insideBuilding(SCENE, placeSpot(SCENE, 'unit.9-D'))).toBe(true);
    expect(insideBuilding(SCENE, placeSpot(SCENE, 'door.9-C'))).toBe(true);
    expect(insideBuilding(SCENE, placeSpot(SCENE, 'street.mid'))).toBe(false);
  });

  /** Cloisons du logement (z), d'après `cutaway.units` : début du logement, puis la fin de chaque logement. */
  const partitions = (): number[] => [SCENE.layout.places.logement.z.v, ...SCENE.cutaway.units.map((u) => u.zEnd.v)];
  const crossesPartition = (a: { z: number }, b: { z: number }): number | null =>
    partitions().find((z) => (a.z - z) * (b.z - z) < 0) ?? null;

  // retour Cynthia 2026-11-08 (b) : « Tu parles à Madame Roux à travers un mur. » La personne se tenait de l'autre côté de la cloison 9-D / 9-C.
  it('test_indoor_actor_stands_on_the_player_side_of_the_partition_within_talk_range', () => {
    const at = placeSpot(SCENE, 'door.9-C');
    const who = actorSpot(SCENE, 'door.9-C', 'roux');
    expect(crossesPartition(at, who)).toBeNull();
    expect(who.z).toBe(at.z);
    expect(Math.hypot(who.x - at.x, who.z - at.z)).toBeCloseTo(SCENE.interact.interactRangeM.v / 2, 9);
    expect(insideBuilding(SCENE, who)).toBe(true);
  });

  it('test_no_guided_scene_puts_a_partition_between_player_and_actor', () => {
    const scenes = (parseWorld(w10Raw, cat).street.guided?.scenes ?? []).filter((s) => s.actor !== null && insideBuilding(SCENE, placeSpot(SCENE, s.place)));
    expect(scenes.map((s) => s.id)).toContain('j1.roux');
    for (const s of scenes) {
      const at = placeSpot(SCENE, s.place), who = actorSpot(SCENE, s.place, s.actor!.id);
      expect(crossesPartition(at, who), `${s.id} : ${s.actor!.id}, cloison`).toBeNull();
      expect(insideBuilding(SCENE, who), `${s.id} : ${s.actor!.id}, façade`).toBe(true);   // ni dans la rue, de l'autre côté de la façade
      expect(Math.sign(who.x), `${s.id} : ${s.actor!.id}, même immeuble`).toBe(Math.sign(at.x));
    }
  });

  it('test_walk_out_of_the_building_goes_through_the_door', () => {
    const from = placeSpot(SCENE, 'unit.9-D'), to = placeSpot(SCENE, 'street.mid');
    const path = walkPath(SCENE, from, to);
    expect(path).toHaveLength(2);
    expect(Math.abs(path[0]!.x)).toBeLessThanOrEqual(half);   // la porte, au pied de la façade
    expect(path[0]!.z).toBe(from.z);
    expect(path.at(-1)).toEqual(to);
  });

  it('test_walk_inside_one_building_is_straight', () => {
    expect(walkPath(SCENE, placeSpot(SCENE, 'unit.9-D'), placeSpot(SCENE, 'door.9-C'))).toEqual([placeSpot(SCENE, 'door.9-C')]);
  });

  it('test_actors_walk_home_to_street_and_arrive', () => {
    const a = createActors(SCENE, placeSpot(SCENE, 'unit.9-D'));
    a.walkTo('street.mid');
    let arrived = false;
    for (let i = 0; i < 4000 && !arrived; i++) arrived = a.step(SCENE.walk.maxDtMs.v);
    expect(arrived).toBe(true);
    expect(a.player()).toEqual(placeSpot(SCENE, 'street.mid'));
  });
});
