import { describe, expect, it } from 'vitest';
import { journeys } from '../../../src/worlds/catalogue';
import { narrativeScene } from '../../../src/worlds/narrative';
import { reviews } from '../../../src/worlds/review';
import { blockedReason, decide, startJourney } from '../../../src/worlds/state';
import type { JourneyState, JourneyWorldId } from '../../../src/worlds/types';

/** Revue de contenu du lot M2 : w06, w08, w09, w11. Plan : plan-semaine-1984-3d.md, section « M1 et M2 ». */
const WORLDS: readonly JourneyWorldId[] = ['w06', 'w08', 'w09', 'w11'];
const LEGACY = /^(encounter_|aftermath_|handoff_)/;
const ENDINGS: Record<string, readonly string[]> = {
  w06: ['common', 'dry', 'owned', 'owned_private'],
  w08: ['archive', 'living', 'silent'],
  w09: ['empty', 'private', 'show'],
  w11: ['cold', 'temporary', 'warm'],
};

/** Mots lus : les signes de ponctuation isolés (« », :, ;) ne comptent pas. */
const words = (text: string): number => text.split(/\s+/).filter(token => /[\p{L}\p{N}]/u.test(token)).length;

/** Tous les états atteignables par des options disponibles, dédoublonnés par scène, ressource et inventaire. */
function reachable(id: JourneyWorldId): JourneyState[] {
  const journey = journeys[id];
  const queue: JourneyState[] = [startJourney(journey)];
  const seen = new Set<string>();
  const states: JourneyState[] = [];
  for (let i = 0; i < queue.length; i++) {
    const state = queue[i]!;
    const key = JSON.stringify([state.scene, state.resource, [...state.inventory].sort()]);
    if (seen.has(key)) continue;
    seen.add(key);
    states.push(state);
    const scene = journey.scenes.find(s => s.id === state.scene)!;
    if (scene.ending) continue;
    for (const option of scene.options) {
      if (blockedReason(state, option, journey) === null) queue.push(decide(journey, state, option.id));
    }
  }
  return states;
}

/** Texte affiché pour un état : celui que rend `runtime.ts` (`narrativeScene`), pas seulement `scene.text`. */
const displayed = (id: JourneyWorldId, state: JourneyState): string => {
  const scene = journeys[id].scenes.find(s => s.id === state.scene)!;
  return narrativeScene(id, scene, state).text;
};

describe('revue M2 (w06, w08, w09, w11)', () => {
  it.each(WORLDS)('test_review_m2_%s_displayedTextOnEveryReachableState_staysUnderFortyWords', (id) => {
    // Arrange
    const states = reachable(id).filter(state => !LEGACY.test(state.scene));
    // Act + Assert
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      const text = displayed(id, state);
      expect(words(text), `${id}/${state.scene} : ${text}`).toBeLessThanOrEqual(40);
    }
  });

  it.each(WORLDS)('test_review_m2_%s_everySpokenLine_fitsTwoPhoneLines', (id) => {
    // Arrange
    const states = reachable(id).filter(state => !LEGACY.test(state.scene));
    // Act + Assert : une réplique entre guillemets tient en 90 caractères environ.
    for (const state of states) {
      const text = displayed(id, state);
      for (const match of text.matchAll(/«\s*([^»]+?)\s*»/g)) {
        expect(match[1]!.length, `${id}/${state.scene} : ${match[1]}`).toBeLessThanOrEqual(90);
      }
    }
  });

  it.each(WORLDS)('test_review_m2_%s_reviewAndDisplayedText_haveNoDashNoDuCoup', (id) => {
    // Arrange
    const texts: string[] = [];
    for (const [sceneId, change] of Object.entries(reviews[id])) {
      texts.push(`${sceneId}`, change.text ?? '', change.title ?? '', change.objective ?? '');
      for (const option of Object.values(change.options ?? {})) texts.push(option.label ?? '', option.consequence ?? '');
    }
    for (const state of reachable(id)) texts.push(displayed(id, state));
    // Act + Assert
    for (const text of texts) {
      expect(text, text).not.toContain('—');
      expect(text.toLowerCase(), text).not.toContain('du coup');
    }
  });

  it.each(WORLDS)('test_review_m2_%s_reviewedOptions_carryOneGestureAndNoPrice', (id) => {
    // Arrange
    const reviewed = Object.values(reviews[id]).flatMap(change => Object.values(change.options ?? {}));
    // Act + Assert : le socle affiche le prix depuis `cost`, le libellé ne le répète pas.
    expect(reviewed.length).toBeGreaterThan(0);
    for (const option of reviewed) {
      if (option.label === undefined) continue;
      expect(option.label, option.label).not.toMatch(/·|\d/);
      expect(option.label.length, option.label).toBeLessThanOrEqual(45);
    }
  });

  it.each(WORLDS)('test_review_m2_%s_everyOptionConsequence_isAFactOfMoreThanFifteenCharacters', (id) => {
    // Arrange
    const scenes = journeys[id].scenes.filter(scene => !LEGACY.test(scene.id));
    // Act + Assert
    for (const scene of scenes) {
      for (const option of scene.options) expect(option.consequence.length, `${id}/${scene.id}/${option.id}`).toBeGreaterThan(15);
    }
  });

  it.each(WORLDS)('test_review_m2_%s_allEndings_stayReachable', (id) => {
    // Arrange
    const journey = journeys[id];
    // Act
    const reached = new Set(reachable(id).map(state => state.scene).filter(scene => journey.scenes.find(s => s.id === scene)!.ending));
    // Assert
    expect([...reached].sort()).toEqual([...ENDINGS[id]!]);
  });

  it('test_review_m2_hiddenOptions_areExactlyTheListedOnes', () => {
    // Arrange
    const hidden: string[] = [];
    for (const id of WORLDS) {
      for (const [sceneId, change] of Object.entries(reviews[id])) {
        for (const [optionId, option] of Object.entries(change.options ?? {})) {
          if (option.hideWhenBlocked) hidden.push(`${id}.${sceneId}.${optionId}`);
        }
      }
    }
    // Act + Assert : la liste est relue par Cynthia dans textes-m2.md ; aucun masquage en silence.
    expect(hidden.sort()).toEqual([
      'w06.repair.contract',
      'w06.repair.contract_private',
      'w06.repair.share',
      'w11.assembly.surrender',
      'w11.pylons.read',
    ]);
  });
});
