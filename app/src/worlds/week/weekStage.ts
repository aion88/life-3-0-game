import {ACESFilmicToneMapping, BoxGeometry, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer} from 'three';
import {createStationActor} from '../controlStationActor';
import {createCastLoader, type CastActor} from './weekCast';
import type {CreateWeekStage, SetMarks, StageAct, WeekCast, WeekPlace, WeekProp, WeekSet, WeekStageDriver, WeekStageOptions} from './weekContracts';

/** Where the player stands to present the ticket: same stop as `approach()` of the control view. */
const READER_STOP = new Vector3(-1.10, 0, .78);
const WALK_SPEED = 1.3;
/** Pull-back limit and share of the frame (NDC) people must stay within. */
const MAX_ZOOM = 3;
const FRAME_MARGIN = .92;

interface Segment { duration: number; start?: () => void; update?: (t: number) => void; end?: () => void }

const PROP_LOOK: Record<WeekProp, {size: [number, number, number]; color: string}> = {
  lettre: {size: [.22, .012, .15], color: '#e5d4a5'},
  stylo: {size: [.14, .016, .016], color: '#182d32'},
  dossier: {size: [.30, .04, .22], color: '#803a40'},
  carnet: {size: [.16, .022, .11], color: '#214f50'},
};

/** Default renderer: same settings as the control view. */
function defaultRenderer(host: HTMLElement): WebGLRenderer {
  const win = host.ownerDocument.defaultView!;
  const renderer = new WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(win.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = .96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  return renderer;
}

/**
 * Creates the 3D stage of the week: one WebGL context, global lights, the player, the cast of the
 * current place and the current set (injected, never imported). The stage owns the context: `dispose()`
 * ends it (`renderer.dispose()` + `forceContextLoss()`) so that W3 can mount the control view next.
 * Host attributes written (contract section 7): data-place, data-cast, data-speaker, data-segment,
 * data-draw-calls, data-reader, data-barrier. Not thread-safe; call from the main thread only.
 * @example
 * const stage = await createWeekStage(viewport, {buildSet: buildWeekSet});
 * await stage.show('palier', ['roux']);
 * stage.speak('roux');
 * await stage.act('enter');
 * stage.dispose();
 */
export const createWeekStage: CreateWeekStage = async (host: HTMLElement, options: WeekStageOptions): Promise<WeekStageDriver> => {
  const doc = host.ownerDocument;
  const win = doc.defaultView!;
  const seams = options.seams ?? {};
  const renderer = seams.createRenderer ? seams.createRenderer() : defaultRenderer(host);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-label', 'La semaine, en scène');
  host.append(canvas);

  const scene = new Scene();
  scene.background = new Color('#8eafb1');
  scene.fog = new Fog('#8eafb1', 25, 60);
  const camera = new PerspectiveCamera(43, 1, .05, 85);
  const cameraLook = new Vector3(0, 1, 1);
  const cameraOffset = new Vector3(2.2, 1.55, 3.7);
  let zoomNow = 1, zoomTarget = 1;

  // Global lights, copied from the control view. Sets add only local lamps.
  const sun = new DirectionalLight('#ffedcf', 3.1);
  sun.position.set(-6, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -9, right: 9, top: 10, bottom: -10, near: .5, far: 30});
  sun.shadow.normalBias = .022;
  sun.shadow.bias = -.0001;
  scene.add(sun, new HemisphereLight('#c4d8e0', '#555160', 1.8));
  const bounce = new DirectionalLight('#c0dad5', .8);
  bounce.position.set(5, 3, 7);
  scene.add(bounce);

  const createActor = seams.createActor ?? createStationActor;
  let actor: Awaited<ReturnType<typeof createStationActor>>;
  try {
    actor = await createActor();
  } catch (error) {
    sun.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    throw error;
  }
  scene.add(actor.root);
  const cast = createCastLoader(seams.loadGltf);

  let disposed = false, paused = false, raf = 0, last = 0, moving = false;
  let showToken = 0;
  let place: WeekPlace | null = null;
  let set: WeekSet | null = null;
  let marks: SetMarks | null = null;
  let npcs: CastActor[] = [];
  let speaker: WeekCast | 'player' | null = null;
  const props = new Map<WeekProp, Mesh>();
  const frameWaiters: Array<() => void> = [];

  // Sequences (enter, checkpoint-pass...), same runner principle as the control view.
  let queue: Segment[] = [], qi = 0, qStarted = false, qElapsed = 0;
  let qDone: (() => void) | null = null;

  const emit = (event: string) => { if (!disposed) options.onEvent?.(event); };
  const reduced = () => Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const setBarrierAttr = (t: number) => { host.dataset['barrier'] = t >= .999 ? 'open' : t <= 0 ? 'closed' : 'opening'; };
  const setReader = (text: string, ok: boolean) => { host.dataset['reader'] = text; set?.setReader?.(text, ok); };
  const setBarrier = (t: number) => { setBarrierAttr(t); set?.setBarrier?.(t); };

  const finishSequence = () => {
    moving = false; queue = []; qi = 0; qStarted = false; qElapsed = 0;
    zoomTarget = fitZoom();
    const done = qDone; qDone = null;
    done?.();
  };
  const startSegment = () => {
    const s = queue[qi];
    if (!s) { finishSequence(); return; }
    qStarted = true; qElapsed = 0;
    s.start?.(); s.update?.(0);
  };
  /** Finishes the running sequence instantly: every remaining segment is played to its end state. */
  const skip = () => {
    if (!queue.length) return;
    for (; qi < queue.length; qi++) {
      const s = queue[qi]!;
      if (!qStarted) s.start?.();
      s.update?.(1); s.end?.(); qStarted = false;
    }
    actor.update(1 / 30, false);
    snapCamera();
    finishSequence();
  };
  const run = (parts: Segment[]): Promise<void> => {
    if (disposed || !parts.length) return Promise.resolve();
    skip();
    queue = parts; qi = 0; qStarted = false;
    const promise = new Promise<void>(resolve => { qDone = resolve; });
    startSegment();
    if (reduced()) skip();
    return promise;
  };
  const walk = (to: Vector3, duration: number, from?: Vector3): Segment => {
    const start = new Vector3();
    return {
      duration,
      start: () => { start.copy(from ?? actor.root.position); moving = true; actor.setGesture('rest'); },
      update: t => {
        actor.root.position.lerpVectors(start, to, t);
        const d = to.clone().sub(start);
        if (d.lengthSq() > .0001) actor.setHeading(Math.atan2(d.x, d.z), .06);
      },
      end: () => { moving = false; },
    };
  };
  const faceYaw = (yaw: number): Segment => ({duration: .35, update: () => actor.setHeading(yaw, .15), end: () => { actor.root.rotation.y = yaw; }});

  const clearProps = () => {
    for (const m of props.values()) { m.removeFromParent(); m.geometry.dispose(); (m.material as MeshStandardMaterial).dispose(); }
    props.clear();
  };
  const clearPlace = () => {
    clearProps();
    for (const n of npcs) n.dispose();
    npcs = [];
    if (set) { scene.remove(set.root); set.dispose(); set = null; }
    marks = null;
  };

  // The camera frames the place as authored when the player stands on `marks.player`, and follows
  // the player when a sequence moves him (checkpoint-pass walks to the reader, far from his mark).
  const desiredLook = (out: Vector3): Vector3 => {
    if (!marks) return out.copy(cameraLook);
    return out.copy(marks.camera.look).add(actor.root.position).sub(marks.player);
  };
  const lookTarget = new Vector3();
  const probe = new Vector3();
  /**
   * Smallest camera pull-back (1 to MAX_ZOOM) that keeps the player and every person of the cast inside
   * the frame at the current aspect ratio. Portrait phones see a much narrower slice than desktop.
   */
  const fitZoom = (): number => {
    const look = desiredLook(lookTarget).clone();
    const points = [actor.root.position, ...npcs.map(n => n.root.position)];
    const saved = camera.position.clone();
    let zoom = 1;
    for (; zoom < MAX_ZOOM; zoom += .1) {
      camera.position.copy(look).addScaledVector(cameraOffset, zoom);
      camera.lookAt(look);
      camera.updateMatrixWorld(true);
      const ok = points.every(p => [1, 1.65].every(y => {
        probe.copy(p).setY(y).project(camera);
        return Math.abs(probe.x) <= FRAME_MARGIN && Math.abs(probe.y) <= FRAME_MARGIN && probe.z < 1;
      }));
      if (ok) break;
    }
    camera.position.copy(saved);
    return Math.min(zoom, MAX_ZOOM);
  };
  /** Look only: the zoom keeps the value fitted for the cast, the player stays framed as at his mark. */
  const snapLook = () => { cameraLook.copy(desiredLook(lookTarget)); };
  const snapCamera = () => { cameraLook.copy(desiredLook(lookTarget)); zoomTarget = fitZoom(); zoomNow = zoomTarget; };

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || disposed) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < .9 ? 59 : 43;
    camera.updateProjectionMatrix();
    zoomTarget = fitZoom();
    renderer.render(scene, camera);
  };
  const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(resize) : null;
  observer?.observe(host);
  resize();

  const headingTarget = (): number => {
    if (speaker && speaker !== 'player') {
      const i = npcs.findIndex(n => n.cast === speaker);
      const mark = i >= 0 ? marks?.npcs[Math.min(i, marks.npcs.length - 1)] : undefined;
      if (mark) return Math.atan2(mark.at.x - actor.root.position.x, mark.at.z - actor.root.position.z);
    }
    return marks?.playerYaw ?? actor.root.rotation.y;
  };

  const tick = (now: number) => {
    if (disposed) return;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    if (!paused && !doc.hidden) {
      if (queue.length) {
        const s = queue[qi];
        if (s) {
          qElapsed += dt;
          const t = s.duration > 0 ? Math.min(1, qElapsed / s.duration) : 1;
          s.update?.(t);
          if (t === 1) { s.end?.(); qi++; qStarted = false; startSegment(); }
        }
      } else if (marks) {
        // The player turns (the body: no head API) toward whoever speaks.
        actor.setHeading(headingTarget(), dt);
      }
      actor.update(dt, moving);
      for (const n of npcs) n.update(dt);
    }
    if (!paused && !doc.hidden) {
      const k = 1 - Math.exp(-dt * 4);
      cameraLook.lerp(desiredLook(lookTarget), k);
      zoomNow += (zoomTarget - zoomNow) * k;
    }
    camera.position.copy(cameraLook).addScaledVector(cameraOffset, zoomNow);
    camera.lookAt(cameraLook);
    renderer.render(scene, camera);
    host.dataset['segment'] = queue.length ? String(qi) : 'idle';
    host.dataset['drawCalls'] = String(renderer.info?.render.calls ?? 0);
    for (const w of frameWaiters.splice(0)) w();
    raf = win.requestAnimationFrame(tick);
  };
  raf = win.requestAnimationFrame(tick);

  const show = async (next: WeekPlace, who: readonly WeekCast[]): Promise<void> => {
    if (disposed) return;
    const token = ++showToken;
    skip();
    clearPlace();
    speaker = null;
    place = next;
    host.dataset['place'] = next;
    host.dataset['cast'] = who.join(',');
    host.dataset['speaker'] = 'none';
    host.dataset['reader'] = '';
    setBarrierAttr(0);
    const built = options.buildSet(next, doc);
    set = built;
    marks = built.marks;
    scene.add(built.root);
    actor.root.position.copy(built.marks.player);
    actor.root.rotation.y = built.marks.playerYaw;
    actor.setGesture('rest');
    snapCamera();
    cameraOffset.copy(built.marks.camera.offset);
    // Only the bodies of this cast are loaded; a failure leaves the person absent, not the stage broken.
    const arrivals = await Promise.all(who.map(w => cast.spawn(w).catch(() => null)));
    if (disposed || token !== showToken) {
      // Disposed or superseded while loading: free what just arrived, touch neither scene nor DOM.
      for (const a of arrivals) a?.dispose();
      return;
    }
    arrivals.forEach((a, i) => {
      if (!a) return;
      const mark = built.marks.npcs[Math.min(i, built.marks.npcs.length - 1)];
      if (mark) { a.root.position.copy(mark.at); a.root.rotation.y = mark.yaw; }
      scene.add(a.root);
      npcs.push(a);
    });
    snapCamera();
    host.dataset['cast'] = npcs.map(n => n.cast).join(',');
    emit(`show:${next}`);
    // Resolves on the first rendered frame.
    await new Promise<void>(resolve => { frameWaiters.push(resolve); });
  };

  const act = (a: StageAct): Promise<void> => {
    if (disposed || !marks) return Promise.resolve();
    const m = marks;
    emit(`act:${a}`);
    if (a === 'enter') {
      const dist = m.entry.distanceTo(m.player);
      return run([
        {duration: 0, start: () => { actor.root.position.copy(m.entry); snapLook(); }},
        walk(m.player.clone(), Math.max(.5, dist / WALK_SPEED), m.entry.clone()),
        faceYaw(m.playerYaw),
      ]);
    }
    if (a === 'checkpoint-pass') {
      if (place !== 'controle') return Promise.resolve();
      const dist = actor.root.position.distanceTo(READER_STOP);
      return run([
        walk(READER_STOP.clone(), Math.max(.4, dist / WALK_SPEED)),
        faceYaw(Math.PI),
        {duration: 1.5, start: () => { actor.setGesture('ticket'); setReader('LECTURE…', false); }},
        {duration: .65, start: () => setReader('−14 MOTS', true)},
        {duration: 1.3, update: t => setBarrier(t), end: () => setBarrier(1)},
        {duration: .4, start: () => actor.setGesture('rest')},
      ]);
    }
    return run([{duration: .6, start: () => actor.setGesture(a === 'phone-up' ? 'phone' : 'rest')}]);
  };

  const driver: WeekStageDriver = {
    show,
    speak: who => {
      if (disposed) return;
      speaker = who;
      host.dataset['speaker'] = who ?? 'none';
      for (const n of npcs) n.setTalking(n.cast === who);
    },
    prop: (id, visible) => {
      if (disposed) return;
      const existing = props.get(id);
      if (existing) existing.visible = visible;
      const at = marks?.props[id];
      if (!visible || existing || !at) return;
      const look = PROP_LOOK[id];
      const mesh = new Mesh(new BoxGeometry(...look.size), new MeshStandardMaterial({color: look.color, roughness: .75}));
      mesh.name = `week.prop.${id}`;
      mesh.castShadow = true;
      mesh.position.copy(at).y += look.size[1] / 2;
      scene.add(mesh);
      props.set(id, mesh);
    },
    act,
    pause: value => { paused = value; host.dataset['paused'] = String(value); },
    skip,
    dispose: () => {
      if (disposed) return;
      skip();
      disposed = true;
      win.cancelAnimationFrame(raf);
      observer?.disconnect();
      clearPlace();
      actor.dispose();
      cast.dispose();
      sun.shadow.dispose();
      scene.clear();
      for (const w of frameWaiters.splice(0)) w();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
  emit('ready');
  return driver;
};
