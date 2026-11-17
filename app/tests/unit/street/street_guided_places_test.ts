/**
 * Lieux de la semaine guidée [rue guidée J3-J7, T8, T9] : chaque lieu d'une scène de w10 est déclaré dans `guided.places`. Les jours
 * écrits sont lus dans les scènes réelles ; les lieux des jours encore absents (J4 à J7, T10 à T13) restent la liste ci-dessous, tirée
 * des tables §4 (colonne « étape, lieu » de `design/gdd/2026-11-05-rue-guidee-j3-j7.md`), à retirer quand leur jour est écrit.
 */
import { describe, expect, it } from 'vitest';
import { SCENE } from '../../support/street_walk';
import { insideBuilding } from '../../../src/street/guided/actors';
import { parseWorld } from '../../../src/data/schema/world';
import { cat, w10Raw } from '../../fixtures/data/factories';

/** Lieux des jours pas encore écrits (J4 à J7) : conception §4.2 à §4.5. */
const PLACES_OF_UNWRITTEN_DAYS = ['unit.9-D', 'door.9-B', 'door.9-C', 'anchor.cp.head', 'place.registre', 'shop.yusuf', 'stairs.9', 'anchor.greycar', 'room.audition'] as const;
const scenePlaces = (): readonly string[] => (parseWorld(w10Raw, cat).street.guided?.scenes ?? []).map((s) => s.place);

describe('rue guidée : lieux de la semaine', () => {
  it('test_every_scene_place_is_declared', () => {
    const places = Object.keys(SCENE.guided.places);
    const wanted = new Set([...scenePlaces(), ...PLACES_OF_UNWRITTEN_DAYS]);
    expect(scenePlaces()).toEqual(expect.arrayContaining(['place.pylone', 'bench.theodore', 'place.cantine']));   // J3 lu dans les scènes
    for (const p of wanted) expect(places, p).toContain(p);
  });
  it('test_new_places_on_their_side', () => {
    expect(SCENE.guided.places['anchor.stall.front']!.v.x).toBeLessThan(0);   // convention : l'étal est à l'ouest, x < 0
    expect(SCENE.guided.places['shop.yusuf']!.v.x).toBeGreaterThan(0);
    expect(SCENE.guided.places['place.pylone']!.v.x).toBeGreaterThan(0);
    expect(SCENE.guided.places['bench.theodore']!.v.x).toBeLessThan(0);
    expect(SCENE.guided.places['place.cantine']!.v.x).toBeLessThan(0);
    expect(SCENE.guided.places['anchor.greycar']!.v.x).toBeGreaterThan(0);
  });
  it('test_stairs_and_audition_are_inside_the_building', () => {
    expect(insideBuilding(SCENE, SCENE.guided.places['stairs.9']!.v)).toBe(true);
    expect(insideBuilding(SCENE, SCENE.guided.places['room.audition']!.v)).toBe(true);
  });
});
