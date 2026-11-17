// @vitest-environment happy-dom
import {describe, expect, it, vi} from 'vitest';
import {AnimationClip, BoxGeometry, Group, Mesh, MeshStandardMaterial, NumberKeyframeTrack} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../public/worlds/w10/manifest.json';
import {appearances} from '../../../../src/worlds/castAppearance';
import {WEEK_CAST, castBodyUrl, createCastLoader} from '../../../../src/worlds/week/weekCast';
import type {WeekCast} from '../../../../src/worlds/week/weekContracts';

const ALL: WeekCast[] = ['roux', 'theodore', 'nadia', 'marlene', 'bruno', 'agente', 'maman', 'papa'];

function fakeGltf(withClips = false): GLTF {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(.5, 1.8, .3), new MeshStandardMaterial({name: 'shirt'})));
  const animations = withClips
    ? [new AnimationClip('idle', 1, [new NumberKeyframeTrack('.position[x]', [0, 1], [0, 0])]), new AnimationClip('talk', 1, [new NumberKeyframeTrack('.position[x]', [0, 1], [0, 0])])]
    : [];
  return {scene, animations} as unknown as GLTF;
}

describe('week cast table', () => {
  it('test_week_cast_table_every_person_has_manifest_body_result', () => {
    // Arrange
    const ids = new Set(manifest.assets.map(a => a.id));
    // Act + Assert
    for (const who of ALL) expect(ids.has(`char.${WEEK_CAST[who].body}`), who).toBe(true);
  });

  it('test_week_cast_table_appearances_exist_except_bruno_result', () => {
    for (const who of ALL) {
      const {appearance} = WEEK_CAST[who];
      if (who === 'bruno') expect(appearance).toBeUndefined();
      else expect(appearances[appearance!], who).toBeDefined();
    }
  });

  it('test_week_cast_table_borrowed_bodies_follow_plan_result', () => {
    expect(WEEK_CAST.maman).toEqual({body: 'npc.berenice', appearance: 'mireille'});
    expect(WEEK_CAST.papa).toEqual({body: 'crowd_c', appearance: 'hubert'});
    expect(WEEK_CAST.maman.body).not.toBe(WEEK_CAST.marlene.body);
  });

  it('test_week_cast_url_body_file_result', () => {
    expect(castBodyUrl('crowd_b')).toMatch(/worlds\/w10\/characters\/char\.crowd_b\.glb$/);
  });
});

describe('week cast loader', () => {
  it('test_week_cast_loader_spawn_loads_only_requested_body_result', async () => {
    // Arrange
    const urls: string[] = [];
    const loader = createCastLoader(async url => { urls.push(url); return fakeGltf(); });
    // Act
    await loader.spawn('roux');
    // Assert
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('char.crowd_b.glb');
    expect(loader.requestedBodies()).toEqual(['crowd_b']);
  });

  it('test_week_cast_loader_same_body_is_cached_and_cloned_result', async () => {
    // Arrange
    const load = vi.fn(async () => fakeGltf());
    const loader = createCastLoader(load);
    // Act: maman and agente share npc.berenice
    const a = await loader.spawn('maman');
    const b = await loader.spawn('agente');
    // Assert
    expect(load).toHaveBeenCalledTimes(1);
    expect(a!.root).not.toBe(b!.root);
  });

  it('test_week_cast_loader_actor_is_normalised_to_player_height_result', async () => {
    const loader = createCastLoader(async () => fakeGltf());
    const actor = (await loader.spawn('bruno'))!;
    const box = new (await import('three')).Box3().setFromObject(actor.root);
    expect(box.max.y - box.min.y).toBeCloseTo(1.72, 2);
    expect(box.min.y).toBeCloseTo(0, 2);
  });

  it('test_week_cast_loader_talking_switches_clip_and_tolerates_missing_clip_result', async () => {
    const loader = createCastLoader(async () => fakeGltf(true));
    const actor = (await loader.spawn('roux'))!;
    expect(() => { actor.setTalking(true); actor.update(.1); actor.setTalking(false); }).not.toThrow();
    const bare = (await createCastLoader(async () => fakeGltf()).spawn('roux'))!;
    expect(() => { bare.setTalking(true); bare.update(.1); }).not.toThrow();
  });

  it('test_week_cast_loader_dispose_during_load_attaches_nothing_and_frees_body_result', async () => {
    // Arrange
    const gltf = fakeGltf();
    const geometry = (gltf.scene.children[0] as Mesh).geometry;
    const spy = vi.spyOn(geometry, 'dispose');
    let resolve!: (g: GLTF) => void;
    const loader = createCastLoader(() => new Promise<GLTF>(r => { resolve = r; }));
    const pending = loader.spawn('papa');
    // Act
    loader.dispose();
    resolve(gltf);
    const actor = await pending;
    await Promise.resolve();
    // Assert
    expect(actor).toBeNull();
    expect(spy).toHaveBeenCalled();
    expect(await loader.spawn('papa')).toBeNull();
  });

  it('test_week_cast_loader_actor_dispose_keeps_shared_body_result', async () => {
    // Arrange
    const gltf = fakeGltf();
    const shared = (gltf.scene.children[0] as Mesh).geometry;
    const spy = vi.spyOn(shared, 'dispose');
    const loader = createCastLoader(async () => gltf);
    const actor = (await loader.spawn('nadia'))!;
    const parent = new Group(); parent.add(actor.root);
    // Act
    actor.dispose();
    // Assert: a second actor can still be cloned, shared geometry untouched
    expect(parent.children).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
    expect(await loader.spawn('nadia')).not.toBeNull();
  });

  it('test_week_cast_loader_failed_load_can_be_retried_result', async () => {
    let calls = 0;
    const loader = createCastLoader(async () => { if (++calls === 1) throw new Error('réseau'); return fakeGltf(); });
    await expect(loader.spawn('roux')).rejects.toThrow('réseau');
    await Promise.resolve();
    expect(await loader.spawn('roux')).not.toBeNull();
  });
});
