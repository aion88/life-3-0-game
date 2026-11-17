import { describe, expect, it } from 'vitest';
import { journeys } from '../../../src/worlds/catalogue';
import { atelierRoutes, episodeRoutes } from '../../../src/worlds/atelierRoutes';
import { decide, startJourney } from '../../../src/worlds/state';
import { choose, ending, freshEpisode } from '../../../src/street/episode/story';

const EXPECTED_ENDINGS: Record<string, number> = { w01: 5, w02: 3, w03: 4, w04: 3, w05: 3, w06: 4, w08: 3, w09: 3, w11: 3 };

describe('atelierRoutes', () => {
  const all = atelierRoutes(journeys);

  it('test_atelier_routes_runtimeWorlds_oneRoutePerEnding', () => {
    // Arrange: le catalogue réel ; Act: les chemins calculés ; Assert: 31 fins, par monde.
    const runtime = Object.entries(all).filter(([world]) => world !== 'w10').flatMap(([, entry]) => entry.routes);
    expect(runtime).toHaveLength(31);
    for (const [world, count] of Object.entries(EXPECTED_ENDINGS)) {
      expect(runtime.filter(route => route.world === world).map(route => route.ending), world).toHaveLength(count);
    }
    expect(new Set(runtime.map(route => `${route.world}/${route.ending}`)).size).toBe(31);
  });

  it('test_atelier_routes_shape_isPerWorldWithLabelledPath', () => {
    expect(Object.keys(all).sort()).toEqual(['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w08', 'w09', 'w10', 'w11']);
    for (const entry of Object.values(all)) for (const route of entry.routes) for (const step of route.path) expect(step.label.length).toBeGreaterThan(0);
    expect(all['w10']!.routes[0]!.path[0]).toMatchObject({ scene: 'arrival', option: expect.any(String), label: expect.any(String) });
  });

  it('test_atelier_routes_singleList_neverContainsASceneDecidedOnAnyRoute', () => {
    for (const [world, entry] of Object.entries(all)) {
      const decided = new Set(entry.routes.flatMap(route => route.path).filter(step => step.decision).map(step => step.scene));
      expect(entry.single.filter(scene => decided.has(scene)), world).toEqual([]);
    }
    // w01 `crossing` est appliquée seule sur certains chemins et décidée sur d'autres : décision par étape, absente de `single`.
    const crossing = all['w01']!.routes.flatMap(route => route.path).filter(step => step.scene === 'crossing');
    expect(crossing.some(step => step.decision)).toBe(true);
    expect(all['w01']!.single).not.toContain('crossing');
  });

  it('test_atelier_routes_everyRuntimeRoute_replayedByDecideReachesAnnouncedEnding', () => {
    for (const route of Object.entries(all).filter(([world]) => world !== 'w10').flatMap(([, entry]) => entry.routes)) {
      const journey = journeys[route.world as keyof typeof journeys];
      let state = startJourney(journey);
      for (const step of route.path) {
        expect(state.scene, `${route.world} ${route.ending}`).toBe(step.scene);
        const after = decide(journey, state, step.option);
        expect(after, `${route.world} ${step.scene}/${step.option} refusé`).not.toBe(state);
        state = after;
      }
      expect(state.scene).toBe(route.ending);
      expect(journey.scenes.find(s => s.id === state.scene)?.ending).toBeDefined();
    }
  });

  it('test_atelier_routes_decisionCount_excludesSingleOptionScenes', () => {
    const w01 = all['w01']!.routes;
    for (const route of w01) {
      expect(route.path.filter(step => step.scene === 'papers').every(step => !step.decision)).toBe(true);
      expect(route.decisions).toBe(route.path.filter(step => step.decision).length);
    }
    expect(all['w01']!.single).toContain('papers');
    expect(all['w04']!.single).toContain('trial');
    expect(all['w10']!.single).toEqual(expect.arrayContaining(['stall', 'confession', 'departure']));
  });

  it('test_atelier_routes_w10_everyRouteReachesItsComposedEnding', () => {
    const routes = episodeRoutes();
    expect(routes.every(route => route.world === 'w10')).toBe(true);
    expect(routes).toHaveLength(15);
    for (const route of routes) {
      let state = freshEpisode();
      for (const step of route.path) {
        expect(state.scene).toBe(step.scene);
        const after = choose(state, step.option);
        expect(after).not.toBe(state);
        state = after;
      }
      expect(state.scene).toBe('end');
      expect(ending(state)).toBe(route.endingText);
    }
    const texts = routes.map(route => route.endingText ?? '');
    expect(new Set(texts).size).toBe(routes.length);
    // Les fins couvrent le transfert suspendu ET non suspendu.
    expect(texts.some(text => text.includes('suspendu quarante-huit heures'))).toBe(true);
    expect(texts.some(text => text.includes('Tu n’as pas suspendu le transfert'))).toBe(true);
  });
});
