// @vitest-environment happy-dom
/**
 * Régression (PHASE V du 14 novembre) : à la fin d'un monde exploré par « Un autre monde », le bouton Atlas doit allumer le monde JOUÉ,
 * pas le monde calculé par le questionnaire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStreetScreen } from '../../../src/street/screen';
import { fakeApp } from '../../support/street_screen';
import type { RunResult } from '../../../src/shared/types';

const COMPUTED_WORLD = 'w01';
const PLAYED_WORLD = 'w05';
type EndLinks = (world: string) => HTMLElement[];

let root: HTMLElement;
beforeEach(() => { window.history.replaceState({}, '', '/'); root = document.body.appendChild(document.createElement('div')); });
afterEach(() => root.remove());

describe('atlas opened from the end of a world', () => {
  it('test_atlas_arrival_from_explored_world_lights_played_world', async () => {
    // Arrange : le questionnaire a calculé w01, le joueur finit w05
    const app = fakeApp(); window.history.replaceState({}, '', '/');   // parcours public : `fakeApp` pose sa propre adresse
    const run = { ...app.payload.run, outcome: { ...app.payload.run.outcome, kind: 'arrival', computedWorld: COMPUTED_WORLD } } as RunResult;
    const mountSituations = vi.fn<(root: HTMLElement, search?: string, options?: { endLinks?: EndLinks }) => Promise<() => void>>(async () => () => undefined);
    const screen = createStreetScreen(app.ctx, { run }, { loadSituations: async () => ({ mountSituations }) });
    await screen.mount(root);
    const endLinks = mountSituations.mock.calls[0]![2]!.endLinks!;

    // Act : le lecteur de situations demande les liens de fin pour le monde joué, le joueur ouvre l'Atlas
    const atlas = endLinks(PLAYED_WORLD).find((link) => link.dataset['ui'] === 'open-atlas')!;
    atlas.click();

    // Assert
    expect(app.navigate).toHaveBeenCalledWith('atlas', { arrival: PLAYED_WORLD, back: { id: 'street', run } });
    screen.unmount();
  });
});
