import { describe, expect, it } from 'vitest';
import { CLIP_NAMES, GlbFormatError, readGlb } from '../../../src/engine/view/glb';
import { CharacterContractError } from '../../../src/street/render/characters/provider';
import { createGlbProvider } from '../../../src/street/render/characters/glbProvider';
import { createMannequinProvider } from '../../../src/street/render/characters/mannequin';
import { REQUIRED_BODIES, SCENE, assetsWith, delivered, manifestWith, shippedCharacterFiles, skipReason, syntheticAssets, syntheticManifest, validGlb, writeGlb } from '../../support/street_crowd';

const scene = () => SCENE;

describe('lecture et contrat des .glb', () => {
  it('test_readglb_reads_clips_bones_triangles', () => { const g = readGlb(writeGlb({ animations: ['idle', 'walk'], bones: ['hips', 'spine'], triangles: 12 })); expect(g).toMatchObject({ animations: ['idle', 'walk'], bones: ['hips', 'spine'], triangles: 12 }); });
  it('test_readglb_reports_bytes_and_reads_non_ascii_names', () => { const b = writeGlb({ animations: ['marché'], bones: ['épaule'], triangles: 1 }); expect(readGlb(b)).toMatchObject({ animations: ['marché'], bones: ['épaule'], bytes: b.byteLength }); });
  it.each([[new ArrayBuffer(8)], [new ArrayBuffer(64)]])('test_readglb_refuses_a_file_that_is_not_a_glb_%#', (b) => { expect(() => readGlb(b)).toThrow(GlbFormatError); });
  it('test_readglb_refuses_a_truncated_json_block', () => { expect(() => readGlb(validGlb().slice(0, 40))).toThrow(/tronqué/); });
  it('test_clip_set_is_the_five_named_clips', () => { expect([...CLIP_NAMES]).toEqual(['idle', 'walk', 'turn', 'talk', 'queue']); });
  it('test_provider_rejects_a_body_with_a_missing_clip_and_names_it', () => { expect(() => createGlbProvider(assetsWith({ 'char.a': writeGlb({ animations: ['idle'], bones: ['hips'], triangles: 1 }) }), manifestWith('char.a'))).toThrow(/char\.a.*walk/); });
  it('test_provider_error_is_a_character_contract_error', () => { expect(() => createGlbProvider(assetsWith({ 'char.a': writeGlb({ animations: [], bones: [], triangles: 1 }) }), manifestWith('char.a'))).toThrow(CharacterContractError); });
  it('test_provider_rejects_bodies_with_different_bones', () => {
    const a = writeGlb({ animations: CLIP_NAMES, bones: ['hips', 'spine'], triangles: 1 }), b = writeGlb({ animations: CLIP_NAMES, bones: ['hips', 'neck'], triangles: 1 });
    expect(() => createGlbProvider(assetsWith({ 'char.a': a, 'char.b': b }), manifestWith('char.a', 'char.b'))).toThrow(/char\.b.*char\.a/);
  });
  it('test_provider_rejects_a_manifest_entry_without_its_file_and_an_unreadable_file', () => {
    expect(() => createGlbProvider(assetsWith({}), manifestWith('char.a'))).toThrow(/char\.a.*absent/);
    expect(() => createGlbProvider(assetsWith({ 'char.a': new ArrayBuffer(64) }), manifestWith('char.a'))).toThrow(/char\.a/);
  });
  it('test_provider_ignores_non_character_assets_and_refuses_an_unknown_body', () => {
    const p = createGlbProvider(assetsWith({ 'char.a': validGlb() }), manifestWith('char.a', 'prop.lamp'));
    expect(() => p.acquire({ id: 'x', kind: 'npc', bodyId: 'zzz', seed: 1 })).toThrow(/char\.zzz/);
  });
  it('test_mannequin_is_a_labelled_neutral_test_double', () => { const p = createMannequinProvider(); expect(p.neutral).toBe(true); expect(createGlbProvider(syntheticAssets(), syntheticManifest()).neutral).toBe(false); });
});

describe.skipIf(!delivered)(`réception des corps livrés (${delivered ? 'tous livrés' : skipReason})`, () => {
  it('test_every_shipped_character_has_the_five_named_clips', () => { expect(shippedCharacterFiles().map(f => f.id)).toEqual(expect.arrayContaining(REQUIRED_BODIES)); for (const f of shippedCharacterFiles()) expect(CLIP_NAMES.every(c => readGlb(f.buf).animations.includes(c))).toBe(true); });
  it('test_all_bodies_share_one_bone_set_so_clips_are_interchangeable', () => { expect(shippedCharacterFiles().map(f => f.id)).toEqual(expect.arrayContaining(REQUIRED_BODIES)); const sets = shippedCharacterFiles().map(f => readGlb(f.buf).bones.join('|')); expect(new Set(sets).size).toBe(1); });
  it('test_each_body_stays_under_the_byte_budget_and_triangles_are_reported', () => { expect(shippedCharacterFiles().map(f => f.id)).toEqual(expect.arrayContaining(REQUIRED_BODIES)); for (const f of shippedCharacterFiles()) { expect(f.buf.byteLength).toBeLessThanOrEqual(scene().characters.maxBytesPerBody.v); expect(readGlb(f.buf).triangles).toBeGreaterThan(0); } });
});

describe('décodage échoué [R-02a.22 (4)]', () => {
  it('test_decode_failure_surfaces_a_named_error_with_the_body_id_never_an_invisible_body', async () => {
    // valide pour le contrat (cinq clips, os), mais le décodeur glTF refuse l'accesseur sans vue de tampon ni mesh complet
    const bad = writeGlb({ animations: CLIP_NAMES, bones: ['hips'], triangles: 1 });
    const p = createGlbProvider(assetsWith({ 'char.a': bad }), manifestWith('char.a'));
    const h = p.acquire({ id: 'x', kind: 'npc', bodyId: 'a', seed: 1 });
    let err: unknown = null;
    for (let i = 0; i < 50 && err === null; i++) {
      await new Promise((r) => setTimeout(r, 5));
      try { h.tick(16); } catch (e) { err = e; }
    }
    expect(err).toBeInstanceOf(CharacterContractError);
    expect((err as Error).message).toMatch(/char\.a/);
  });
});
