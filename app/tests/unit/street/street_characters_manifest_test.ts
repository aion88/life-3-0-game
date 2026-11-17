import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAYER_BODY_ID } from '../../../src/engine/view/crowd';
import { parseManifest } from '../../../src/street/load/worldPayload';
import { CHARACTERS_DIR, REQUIRED_BODIES, SCENE, W10_MANIFEST_PATH, delivered, shippedCharacterFiles, skipReason } from '../../support/street_crowd';

const w10Manifest: unknown = JSON.parse(readFileSync(W10_MANIFEST_PATH, 'utf8'));
const scene = () => SCENE;
const declaredBodies = () => [...REQUIRED_BODIES, ...scene().characters.crowdBodies.v];

describe('corps de personnages : manifeste, liste exigée et scène', () => {
  it('test_manifest_scene_and_required_bodies_agree', () => {
    const entries = parseManifest(w10Manifest).assets.filter(a => a.id.startsWith('char.')).map(a => a.id.slice(5));
    const bodies = [PLAYER_BODY_ID, ...Object.values(scene().npcPlaces).map(p => p.bodyId), ...scene().characters.crowdBodies.v];
    expect(new Set(bodies).size).toBe(bodies.length);                                                   // un corps par personne, jamais partagé hors foule
    for (const id of REQUIRED_BODIES) expect(bodies).toContain(id);                                     // la liste exigée vient de la scène
    for (const id of entries) expect(declaredBodies()).toContain(id);                                   // aucune entrée orpheline dans le manifeste
    for (const f of shippedCharacterFiles()) expect(entries, `${CHARACTERS_DIR}char.${f.id}.glb sans entrée de manifeste`).toContain(f.id);
    expect(REQUIRED_BODIES.filter(id => id.startsWith('npc.')).length).toBe(Object.values(scene().npcPlaces).filter(p => p.kind === 'person').length);
    for (const v of Object.values(scene().npcPlaces).filter(p => p.kind === 'vehicle')) expect(REQUIRED_BODIES).not.toContain(v.bodyId);   // la voiture n'est pas un corps exigé
  });
});

describe.skipIf(!delivered)(`entrées de manifeste des corps livrés (${delivered ? 'tous livrés' : skipReason})`, () => {
  it('test_character_entries_are_own_name_their_mpfb_base_and_sit_in_core', () => { const c = parseManifest(w10Manifest).assets.filter(a => a.id.startsWith('char.')); expect(c.map(a => a.id.slice(5))).toEqual(expect.arrayContaining(REQUIRED_BODIES)); for (const a of c) { expect(a.license).toBe('own'); expect(a.tier).toBe('core'); expect(a.source).toMatch(/MPFB/); } });
});
