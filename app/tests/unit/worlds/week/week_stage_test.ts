// @vitest-environment happy-dom
import {afterEach, describe, expect, it, vi} from 'vitest';
import {BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, Vector3, type Camera, type PerspectiveCamera, type WebGLRenderer} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {buildWeekSet} from '../../../../src/worlds/week/weekSets';
import {createWeekStage} from '../../../../src/worlds/week/weekStage';
import type {BuildWeekSet, WeekCast, WeekPlace, WeekSet, WeekStageDriver, WeekStageSeams} from '../../../../src/worlds/week/weekContracts';
import type {createStationActor} from '../../../../src/worlds/controlStationActor';

type Actor = Awaited<ReturnType<typeof createStationActor>>;

function harness(over: Partial<WeekStageSeams> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  let scene: Scene | null = null;
  let camera: Camera | null = null;
  const renderer = {
    domElement: document.createElement('canvas'),
    info: {render: {calls: 7}},
    setSize: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn(),
    render: vi.fn((s: Scene, c: Camera) => { scene = s; camera = c; }),
  };
  const actor = {
    root: new Group(), update: vi.fn(), setGesture: vi.fn(), setHeading: vi.fn(), setAccepted: vi.fn(), dispose: vi.fn(),
  };
  const sets: Array<WeekSet & {dispose: ReturnType<typeof vi.fn>; setReader: ReturnType<typeof vi.fn>; setBarrier: ReturnType<typeof vi.fn>}> = [];
  const buildSet = vi.fn((place: WeekPlace) => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const set = {
      root,
      marks: {
        entry: new Vector3(0, 0, 6), player: new Vector3(0, 0, 2), playerYaw: Math.PI,
        npcs: [{at: new Vector3(1, 0, 0), yaw: 0}, {at: new Vector3(-1, 0, 0), yaw: 0}],
        camera: {offset: new Vector3(2, 1.5, 4), look: new Vector3(0, 1, 0)},
        props: {dossier: new Vector3(0, .8, 0)},
      },
      setReader: vi.fn(), setBarrier: vi.fn(), dispose: vi.fn(),
    };
    void place;
    sets.push(set);
    return set;
  });
  const loaded: string[] = [];
  const loadGltf = vi.fn(async (url: string): Promise<GLTF> => {
    loaded.push(url);
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(.5, 1.8, .3), new MeshStandardMaterial()));
    return {scene, animations: []} as unknown as GLTF;
  });
  const seams: WeekStageSeams = {
    createRenderer: () => renderer as unknown as WebGLRenderer,
    createActor: (async () => actor) as unknown as typeof createStationActor,
    loadGltf, ...over,
  };
  return {host, renderer, actor: actor as unknown as Actor & typeof actor, sets, buildSet, loaded, loadGltf, seams, scene: () => scene, camera: () => camera};
}

const drivers: WeekStageDriver[] = [];
afterEach(() => { for (const d of drivers.splice(0)) d.dispose(); document.body.replaceChildren(); });
async function make(h: ReturnType<typeof harness>, buildSet: BuildWeekSet = h.buildSet as unknown as BuildWeekSet) {
  const d = await createWeekStage(h.host, {buildSet, seams: h.seams});
  drivers.push(d);
  return d;
}

describe('week stage', () => {
  it('test_week_stage_show_builds_set_places_player_and_sets_attributes_result', async () => {
    // Arrange
    const h = harness(); const stage = await make(h);
    // Act
    await stage.show('palier', ['roux']);
    // Assert
    expect(h.buildSet).toHaveBeenCalledWith('palier', document);
    expect(h.actor.root.position.toArray()).toEqual([0, 0, 2]);
    expect(h.host.dataset['place']).toBe('palier');
    expect(h.host.dataset['cast']).toBe('roux');
    expect(h.host.dataset['drawCalls']).toBe('7');
    expect(h.scene()!.children).toContain(h.sets[0]!.root);
  });

  it('test_week_stage_show_twice_disposes_previous_set_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('palier', []);
    await stage.show('rue', []);
    expect(h.sets[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(h.sets[1]!.dispose).not.toHaveBeenCalled();
    expect(h.scene()!.children).not.toContain(h.sets[0]!.root);
  });

  it('test_week_stage_show_roux_loads_only_crowd_b_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('palier', ['roux']);
    expect(h.loaded).toHaveLength(1);
    expect(h.loaded[0]).toContain('char.crowd_b.glb');
  });

  it('test_week_stage_show_caches_body_across_shows_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('palier', ['roux']);
    await stage.show('rue', ['roux']);
    expect(h.loadGltf).toHaveBeenCalledTimes(1);
  });

  it('test_week_stage_show_places_cast_on_marks_in_order_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('parents', ['maman', 'papa']);
    const names = h.scene()!.children.filter(c => c.name.startsWith('week.cast.'));
    expect(names.map(c => c.name)).toEqual(['week.cast.maman', 'week.cast.papa']);
    expect(names[0]!.position.x).toBe(1);
    expect(names[1]!.position.x).toBe(-1);
  });

  it('test_week_stage_dispose_ends_context_and_frees_everything_result', async () => {
    // Arrange
    const h = harness(); const stage = await make(h);
    await stage.show('palier', ['roux']);
    stage.prop('dossier', true);
    // Act
    stage.dispose();
    // Assert
    expect(h.renderer.dispose).toHaveBeenCalled();
    expect(h.renderer.forceContextLoss).toHaveBeenCalled();
    expect(h.actor.dispose).toHaveBeenCalled();
    expect(h.sets[0]!.dispose).toHaveBeenCalled();
    expect(h.scene()!.children).toHaveLength(0);
    expect(h.host.contains(h.renderer.domElement)).toBe(false);
  });

  it('test_week_stage_dispose_during_pending_load_leaves_nothing_attached_result', async () => {
    // Arrange
    const gltf = {scene: new Group(), animations: []} as unknown as GLTF;
    const geometry = new BoxGeometry(.5, 1.8, .3);
    gltf.scene.add(new Mesh(geometry, new MeshStandardMaterial()));
    const spy = vi.spyOn(geometry, 'dispose');
    let resolve!: (g: GLTF) => void;
    const h = harness({loadGltf: () => new Promise<GLTF>(r => { resolve = r; })});
    const stage = await make(h);
    await new Promise(r => setTimeout(r, 40)); // first frame: the renderer sees the scene
    const shown = stage.show('palier', ['roux']);
    // Act
    stage.dispose();
    resolve(gltf);
    await shown;
    // Assert
    expect(h.scene()!.children).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
    expect(h.renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  });

  it('test_week_stage_superseded_show_frees_late_arrivals_result', async () => {
    // Arrange
    const resolvers: Array<(g: GLTF) => void> = [];
    const h = harness({loadGltf: () => new Promise<GLTF>(r => { resolvers.push(r); })});
    const stage = await make(h);
    const first = stage.show('palier', ['roux']);
    const second = stage.show('rue', ['theodore']);
    const mk = () => ({scene: (() => { const g = new Group(); g.add(new Mesh(new BoxGeometry(.5, 1.8, .3), new MeshStandardMaterial())); return g; })(), animations: []}) as unknown as GLTF;
    // Act
    resolvers.forEach(r => r(mk()));
    await Promise.all([first, second]);
    // Assert: only the second cast is on stage
    const people = h.scene()!.children.filter(c => c.name.startsWith('week.cast.')).map(c => c.name);
    expect(people).toEqual(['week.cast.theodore']);
  });

  it('test_week_stage_dispose_is_idempotent_result', async () => {
    const h = harness(); const stage = await make(h);
    stage.dispose(); stage.dispose();
    expect(h.renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  });

  it('test_week_stage_actor_failure_releases_context_result', async () => {
    const h = harness({createActor: (async () => { throw new Error('GLB'); }) as unknown as typeof createStationActor});
    await expect(createWeekStage(h.host, {buildSet: h.buildSet, seams: h.seams})).rejects.toThrow('GLB');
    expect(h.renderer.forceContextLoss).toHaveBeenCalled();
    expect(h.host.contains(h.renderer.domElement)).toBe(false);
  });

  it('test_week_stage_speak_sets_attribute_and_talking_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('palier', ['roux']);
    stage.speak('roux');
    expect(h.host.dataset['speaker']).toBe('roux');
    stage.speak(null);
    expect(h.host.dataset['speaker']).toBe('none');
  });

  it('test_week_stage_prop_creates_box_on_mark_and_hides_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('audition', []);
    stage.prop('dossier', true);
    const box = h.scene()!.getObjectByName('week.prop.dossier')!;
    expect(box.visible).toBe(true);
    expect(box.position.x).toBe(0);
    stage.prop('dossier', false);
    expect(box.visible).toBe(false);
    stage.prop('carnet', true); // no mark: nothing created
    expect(h.scene()!.getObjectByName('week.prop.carnet')).toBeUndefined();
  });

  it('test_week_stage_show_clears_props_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('audition', []);
    stage.prop('dossier', true);
    await stage.show('rue', []);
    expect(h.scene()!.getObjectByName('week.prop.dossier')).toBeUndefined();
  });

  it('test_week_stage_enter_then_skip_ends_on_player_mark_result', async () => {
    // Arrange
    const h = harness(); const stage = await make(h);
    await stage.show('rue', []);
    // Act
    const walking = stage.act('enter');
    expect(h.actor.root.position.z).toBeGreaterThan(2);
    stage.skip();
    await walking;
    // Assert
    expect(h.actor.root.position.toArray()).toEqual([0, 0, 2]);
    expect(h.actor.root.rotation.y).toBeCloseTo(Math.PI);
    expect(h.host.dataset['segment']).toBe('idle');
  });

  it('test_week_stage_checkpoint_pass_outside_control_is_noop_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('rue', []);
    await stage.act('checkpoint-pass');
    expect(h.sets[0]!.setReader).not.toHaveBeenCalled();
  });

  it('test_week_stage_checkpoint_pass_in_control_reads_ticket_and_opens_barrier_result', async () => {
    // Arrange
    const h = harness(); const stage = await make(h);
    await stage.show('controle', []);
    // Act
    const passing = stage.act('checkpoint-pass');
    stage.skip();
    await passing;
    // Assert
    expect(h.sets[0]!.setReader).toHaveBeenCalledWith('−14 MOTS', true);
    expect(h.sets[0]!.setBarrier).toHaveBeenLastCalledWith(1);
    expect(h.host.dataset['barrier']).toBe('open');
    expect(h.host.dataset['reader']).toBe('−14 MOTS');
    expect(h.actor.setGesture).toHaveBeenCalledWith('ticket');
  });

  it('test_week_stage_act_after_dispose_resolves_result', async () => {
    const h = harness(); const stage = await make(h);
    await stage.show('rue', []);
    stage.dispose();
    await expect(stage.act('enter')).resolves.toBeUndefined();
    await expect(stage.show('rue', [])).resolves.toBeUndefined();
  });

  it('test_week_stage_pause_sets_attribute_result', async () => {
    const h = harness(); const stage = await make(h);
    stage.pause(true);
    expect(h.host.dataset['paused']).toBe('true');
  });
});

describe('week stage framing', () => {
  const PORTRAITS: Array<[number, number]> = [[393, 654], [375, 600], [430, 780]];
  const CASTS: Record<WeekPlace, WeekCast[]> = {
    'chez-toi': ['marlene'], palier: ['roux'], rue: ['theodore', 'nadia'], controle: [], escalier: ['bruno'], audition: ['agente'], parents: ['maman', 'papa'],
  };
  const frame = () => new Promise(r => setTimeout(r, 40));
  /** Chest and head of a person must project inside the frustum (NDC in [-1, 1], in front of the camera). */
  function inView(h: ReturnType<typeof harness>, p: Vector3): boolean {
    const cam = h.camera()! as PerspectiveCamera;
    cam.updateMatrixWorld(true);
    return [1.0, 1.65].every(y => {
      const ndc = p.clone().add(new Vector3(0, y, 0)).project(cam);
      return Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1;
    });
  }
  const people = (h: ReturnType<typeof harness>) => [h.actor.root.position, ...h.scene()!.children.filter(c => c.name.startsWith('week.cast.')).map(c => c.position)];

  for (const [w, hgt] of PORTRAITS) {
    for (const place of Object.keys(CASTS) as WeekPlace[]) {
      it(`test_week_stage_framing_${place}_${w}x${hgt}_player_and_cast_in_view_result`, async () => {
        // Arrange
        const h = harness();
        Object.defineProperty(h.host, 'clientWidth', {value: w});
        Object.defineProperty(h.host, 'clientHeight', {value: hgt});
        const stage = await make(h, buildWeekSet);
        // Act + Assert: after show, then after the entry walk, then (controle) after the checkpoint walk
        await stage.show(place, CASTS[place]);
        await frame();
        for (const p of people(h)) expect(inView(h, p), `${place} show`).toBe(true);
        const entering = stage.act('enter');
        await frame(); // mid-walk: the player starts at the door, which must be in the frame too
        expect(inView(h, h.actor.root.position), `${place} walking in`).toBe(true);
        stage.skip(); await entering; await frame();
        for (const p of people(h)) expect(inView(h, p), `${place} enter`).toBe(true);
        if (place === 'controle') {
          const passing = stage.act('checkpoint-pass'); stage.skip(); await passing; await frame();
          for (const p of people(h)) expect(inView(h, p), 'checkpoint-pass').toBe(true);
        }
      });
    }
  }
});
