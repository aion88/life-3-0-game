/**
 * Plan de l'arrivée au logement [retour Cynthia 2026-11-08 (c) : « Quand j'arrive, je ne vois plus les artefacts, téléphone, etc. C'est juste
 * une vue de loin de lui sur son bureau vide. »]. Les lignes d'accueil du J1 (le Service de courtoisie présente le kit, objet par objet) sont
 * posées APRÈS la carte du jour et AVANT que la première scène (`j1.wake`) soit entrée : à leur temps, aucune scène n'est présente
 * (`director.sceneId()` vaut `null`, le montage garde `spec = null` depuis la carte). Le plan doit être celui du bureau, pas celui de la rue.
 */
import { describe, expect, it } from 'vitest';
import { shotKindOf } from '../../../src/street/guidedRuntime';
import type { Beat } from '../../../src/street/guided/director';
import { parseOnboarding } from '../../../src/street/onboarding';
import onboardingRaw from '../../../src/street/data/w10.onboarding.json';
import { ctxW10 } from '../../support/street';

const line = (lit: string | null): Beat => ({ kind: 'line', voice: 'regime', key: 'k', speaker: null, lit });

describe('rue guidée : plan des lignes d accueil, avant la première scène', () => {
  it('test_guided_welcome_line_that_lights_a_kit_object_frames_the_desk', () => {
    const welcome = parseOnboarding(onboardingRaw, ctxW10().street).welcome.lines;
    const lit = welcome.filter((l) => l.lit !== null);
    expect(lit.map((l) => l.lit)).toContain('phone');
    for (const l of lit) expect(shotKindOf(line(l.lit), null, 'unit.9-D'), String(l.lit)).toBe('desk');
  });

  it('test_guided_welcome_line_without_object_stays_at_home_not_in_the_street', () => {
    expect(shotKindOf(line(null), null, 'unit.9-D')).toBe('home');
    expect(shotKindOf({ kind: 'right', right: 'privacy' }, null, 'unit.9-D')).toBe('home');   // droit du réveil, avant la première scène
  });
});
