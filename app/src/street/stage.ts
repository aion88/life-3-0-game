/**
 * Montage 3D commun [rue guidée T13] : chargement du monde et des corps, moteur de rendu, quartier, chaînes de post-traitement,
 * lumière par image. La rue libre (`runtime.ts`) et la rue guidée s'y branchent ; aucune règle de jeu ici, le pilote écrit, la scène lit.
 * Ordre de montage : monde et charge utile `core` -> corps -> moteur de rendu -> scène -> quartier -> pilote -> chaînes.
 */
import { Color, Fog, PerspectiveCamera, Scene, SRGBColorSpace, Vector3 } from 'three/webgpu';
import { DataLoadError } from '../data/schema/common';
import type { AppContext } from '../app/shell';
import type { RunResult } from '../shared/types';
import { createDice } from '../shared/dice';
import type { CameraMode, CameraPose } from '../engine/view/camera';
import { PLAYER_BODY_ID } from '../engine/view/crowd';
import { createDriver, type StreetDriver } from '../engine/view/driver';
import { dofZoneHalfM, type Optics } from '../engine/view/dof';
import { lightStateAt, stepBlend, type LightBlend } from '../engine/view/grade';
import { parseScene, type SceneData } from '../engine/view/sceneSchema';
import type { StreetContext } from '../engine/moments/types';
import { lightRig } from './render/lighting';
import { createCrowdView, type CrowdView } from './render/characters/crowdView';
import type { CharacterProvider } from './render/characters/provider';
import { GraphicsUnavailable, forceWebGLFromSearch, type RenderBackend } from './render/backend';
import type { PostOptions } from './render/pipeline';
import { buildDistrict, type DistrictHandle } from './render/scene';
import { loadWorldPayloadStaged, parseManifest, payloadCache } from './load/worldPayload';
import type { UiHandle } from './ui';
import type { CaptureControl } from './capture';
import type { RenderPost, RuntimeDeps } from './runtime';
import sceneRaw from './data/w10.scene.json';

/** Des corps exigés ne sont pas livrés : l'écran dit lesquels, il ne les remplace jamais. */
export class BodiesMissingError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`corps non livrés : ${missing.join(', ')}`);
    this.name = 'BodiesMissingError';
  }
}

const BODY_PREFIX = 'char.';
/** Distance devant la caméra, au sol, du point autour duquel on choisit les lampadaires à sources réelles. */
const LAMP_LOOK_AHEAD_M = 8;
const lookDir = new Vector3();

/** Corps exigés : la joueuse, chaque PNJ qui est une personne, au moins un corps de foule [R-02a.12 b]. */
export function requiredBodies(scene: SceneData): string[] {
  return [
    PLAYER_BODY_ID,
    ...Object.values(scene.npcPlaces).filter((p) => p.kind === 'person').map((p) => p.bodyId),
    scene.characters.crowdBodies.v[0] as string,
  ];
}

export interface Stage {
  readonly view: Scene;
  readonly camera: PerspectiveCamera;
  district(): DistrictHandle;
  readonly provider: CharacterProvider;
  readonly crowd: CrowdView;
  readonly sctx: StreetContext;
  readonly scene: SceneData;
  readonly driver: StreetDriver;
  /** Moteur de rendu monté (la prise de vue en a besoin). */
  readonly backend: RenderBackend;
  /** Conteneur du canevas : dimensions et événements de pointeur. */
  readonly canvasHost: HTMLElement;
  /** Indicateur de chargement ; retiré à la première image rendue. */
  readonly loading: HTMLElement;
  /** Redimensionne le moteur, la caméra et les chaînes sur `canvasHost`. */
  resize(): void;
  /** Lumière, grade, ciel, lampadaires, mise au point et rendu d'une image, depuis l'état du pilote et la pose donnée. */
  render(dtMs: number, pose: CameraPose, focusM: number): void;   // bandes lues de `pose.letterbox` seulement (source unique, T8)
  dispose(): void;
}

export interface StageOptions {
  /**
   * `core` : quartier de base, remplacé par la charge différée (intérieurs meublés) quand elle arrive.
   * `deferred` : attend la charge différée et monte le quartier meublé d'emblée (repli sur la base si elle échoue).
   */
  readonly interiors: 'core' | 'deferred';
  /** Contrôle de prise de vue (rue libre en développement) ; `null` ou absent en production. */
  readonly capture?: CaptureControl | null;
}

/** Monte la scène 3D dans `host`. `'noGpu'` : l'interface l'a dit. `BodiesMissingError` : renvoyée, pas levée, l'appelant l'affiche. */
export async function mountStage(ctx: AppContext, run: RunResult, host: HTMLElement, deps: RuntimeDeps, ui: UiHandle, opts: StageOptions): Promise<Stage | 'noGpu' | BodiesMissingError> {
  const { i18n } = ctx;
  const doc = host.ownerDocument;
  const ctl = opts.capture ?? null;
  const cleanups: (() => void)[] = [];
  const disposeAll = (): void => { for (const c of cleanups.splice(0).reverse()) { try { c(); } catch { /* un nettoyage raté ne bloque pas les autres */ } } };

  // le canevas et l'indicateur passent sous l'interface déjà montée : même ordre dans le DOM qu'avant l'extraction
  const canvasHost = doc.createElement('div');
  canvasHost.style.cssText = 'position:absolute;inset:0';
  host.insertBefore(canvasHost, host.firstChild);
  const loading = doc.createElement('progress');
  loading.dataset['ui'] = 'loading';
  loading.max = 1; loading.value = 0;
  loading.setAttribute('aria-label', i18n.t('app.loading'));
  canvasHost.after(loading);
  cleanups.push(() => { canvasHost.remove(); loading.remove(); });   // le démontage rend `host` tel qu'il était : ni canevas ni indicateur

  try {
    const worldId = ctx.core.build.streetWorlds[0]!;
    const world = await ctx.worlds.load(worldId);
    const scene = parseScene(sceneRaw, world.street);

    const manifestRes = await deps.fetch(`/worlds/${worldId}/manifest.json`).catch((e: unknown) => {
      throw new DataLoadError('fetch', 'manifest.json', '', e instanceof Error ? e.message : String(e));
    });
    if (!manifestRes.ok) throw new DataLoadError('fetch', 'manifest.json', '', `réponse ${manifestRes.status}`);
    const manifest = parseManifest(await manifestRes.json());
    const staged = loadWorldPayloadStaged(manifest, { fetch: deps.fetch, onProgress: (done, total) => { loading.value = total > 0 ? done / total : 1; } }, payloadCache(worldId));
    const assets = await staged.core;

    const missing = requiredBodies(scene).filter((id) => !assets.has(`${BODY_PREFIX}${id}`));
    if (missing.length > 0) { loading.remove(); return new BodiesMissingError(missing); }
    const provider = deps.characters(assets, manifest, { floorGain: scene.characters.floorGain.v });

    let backend: RenderBackend;
    try {
      backend = await deps.backend(canvasHost, { forceWebGL: forceWebGLFromSearch(typeof location === 'undefined' ? '' : location.search, import.meta.env.DEV || import.meta.env.VITE_CAPTURE === '1') });
    } catch (e) {
      if (!(e instanceof GraphicsUnavailable)) throw e;
      loading.remove();
      ui.showNoGpu();                                   // la sauvegarde n'a pas bougé
      return 'noGpu';
    }
    cleanups.push(() => { (backend.renderer as { dispose?: () => void }).dispose?.(); });

    const view = new Scene();
    view.background = new Color();
    const fog = new Fog(new Color(), scene.sky.fogNearM.v, scene.sky.fogFarM.v);
    view.fog = fog;
    const camera = new PerspectiveCamera(30, 16 / 9, 0.1, (scene.layout.zMax.v - scene.layout.zMin.v) * 2);
    const textOpt = deps.textSurface === undefined ? {} : { textSurface: deps.textSurface };
    // `deferred` : on attend les intérieurs meublés ; si la charge échoue, la base reste (même repli que la rue libre)
    let deferredReady = false;
    if (opts.interiors === 'deferred') deferredReady = await staged.all.then(() => true, () => false);
    let district = buildDistrict(scene, assets, { interiors: deferredReady ? 'deferred' : 'core', i18n, ...textOpt });
    view.add(district.root);
    cleanups.push(() => { district.dispose(); });

    const sctx: StreetContext = { street: world.street, world, core: ctx.core, run, dice: createDice(run.seed) };
    const driver = createDriver({
      ctx: sctx, sink: deps.sink, savedActs: ctx.save.load().data.acts, scene,
      district: { setVisible: (id, v) => { district.setVisible(id, v); } },
    });

    const crowd = createCrowdView(provider, view);
    cleanups.push(() => { crowd.dispose(); });

    const initialGrade = driver.grade();
    const light0 = lightStateAt(driver.state().live.clock.minute, driver.state().street.flags.slept === true, scene.light);
    let blend: LightBlend = { from: light0, to: light0, t: 1 };
    const identity = ctl?.lut === 'identity';
    const luts = Object.fromEntries((['jour', 'heureBleue', 'nuit'] as const).map((k) => [k, identity ? { contrast: 1, saturation: 1, tint: [1, 1, 1] as const } : {
      contrast: scene.lut[k].contrast.v, saturation: scene.lut[k].saturation.v, tint: scene.lut[k].tint.v as unknown as readonly [number, number, number],
    }])) as PostOptions['luts'];
    const bloomGain = ctl?.bloom ?? null;
    const postfx = bloomGain === null ? scene.postfx : { ...scene.postfx, bloom: { ...scene.postfx.bloom, strength: { ...scene.postfx.bloom.strength, v: scene.postfx.bloom.strength.v * bloomGain } } };
    const dofOf = (m: CameraMode): { focalLengthM: number; bokehScale: number } => ({ focalLengthM: scene.dof[m === 'walk' ? 'walk' : 'observation'].focalLengthM.v, bokehScale: scene.dof[m === 'walk' ? 'walk' : 'observation'].bokehScale.v });
    // optique de la mise au point : focale de la donnée de caméra, ouverture et cercle de confusion de la donnée `dof` [art bible §D.2]
    const opticsOf = (m: CameraMode): Optics => {
      const d = scene.dof[m === 'walk' ? 'walk' : 'observation'];
      return { focalMm: m === 'walk' ? scene.camera.walk.movingFocalMm.v : scene.camera.observation.focalMm.v, fNumber: d.fNumber.v, circleMm: d.circleMm.v };
    };
    const chain = (m: CameraMode): RenderPost => deps.post(backend, view, camera, {
      // FXAA coupé quand une requête de prise de vue (`?bloom=`, `?lut=`) isole une étape : l'AA est non linéaire, un écart de 1 niveau en amont en fait 30 en aval
      aberration: true, letterbox: m === 'observation', antialias: ctl === null || (ctl.lut === 'data' && ctl.bloom === null), dof: dofOf(m), luts, postfx, bypassLut: ctl?.lut === 'off',
      initial: { grade: initialGrade, blend, focusM: scene.camera[m].distanceM.v },
    });
    const posts: Record<CameraMode, RenderPost> = { walk: chain('walk'), observation: chain('observation') };
    cleanups.push(() => { posts.walk.dispose(); posts.observation.dispose(); });

    let disposed = false;
    let firstRendered = false;
    let elapsed = 0;
    cleanups.push(() => { disposed = true; });

    // La charge différée (intérieurs meublés) remplace le quartier de base quand elle est arrivée ; un échec ici n'arrête pas l'écran.
    if (opts.interiors === 'core') {
      void staged.all.then(() => {
        if (disposed) return;
        const next = buildDistrict(scene, assets, { interiors: 'deferred', i18n, ...textOpt });
        next.setVisible('greyCar', district.places.get('voitureGrise')!.visible);
        district.dispose(); district = next; view.add(next.root);
      }, () => { /* palier différé indisponible : on garde le quartier de base */ });
    }

    const stage: Stage = {
      view, camera, provider, crowd, sctx, scene, driver, backend, canvasHost, loading,
      district: () => district,
      resize() {
        const w = canvasHost.clientWidth || 1280, h = canvasHost.clientHeight || 720;
        (backend.renderer as { setPixelRatio?: (r: number) => void }).setPixelRatio?.(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
        (backend.renderer as { setSize?: (w: number, h: number) => void }).setSize?.(w, h);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        posts.walk.setAspect(w / h); posts.observation.setAspect(w / h);
      },
      render(dtMs, pose, focusM) {
        elapsed += dtMs;
        const live = driver.state();
        const forcedLight = ctl?.light ?? null;
        blend = forcedLight !== null ? { from: forcedLight, to: forcedLight, t: 1 } : stepBlend(blend, lightStateAt(live.live.clock.minute, live.street.flags.slept === true, scene.light), dtMs, scene.light.blendMs.v);
        const grade = forcedLight !== null && ctl?.forcedGrade != null ? ctl.forcedGrade(forcedLight) : driver.grade();
        district.setGrade(grade);
        const rig = lightRig(blend, scene.lightRigs);
        district.setLight(rig);
        (view.background as Color).setRGB(...rig.horizon, SRGBColorSpace);   // repli sous le dôme : la couleur de l'horizon de l'état
        (fog.color as Color).setRGB(...rig.horizon, SRGBColorSpace);        // brouillard accordé à l'horizon [ciel-jour-spec §4.4]
        district.setSky(rig, camera.position);                              // position de l'image précédente, comme avant l'extraction
        camera.position.set(...pose.pos); camera.lookAt(...pose.target); camera.fov = pose.fovDeg;
        camera.updateProjectionMatrix();
        // la source unique des bandes 2,39:1 est la pose : elle choisit la chaîne et l'optique
        const shotMode: CameraMode = pose.letterbox ? 'observation' : 'walk';
        const post = posts[shotMode];
        post.setGrade(grade, blend);
        // lampadaires : les sources réelles vont aux plus proches du point regardé (8 m devant la caméra, au sol) [TV-02a-render]
        camera.getWorldDirection(lookDir);
        district.setLamps(rig.lampLevel, { x: camera.position.x + lookDir.x * LAMP_LOOK_AHEAD_M, z: camera.position.z + lookDir.z * LAMP_LOOK_AHEAD_M });
        const forcedFocal = ctl?.pose?.dofFocalMm;
        post.setFocus(focusM, dofZoneHalfM(forcedFocal === undefined ? opticsOf(shotMode) : { ...opticsOf(shotMode), focalMm: forcedFocal }, focusM));
        post.setDof(dofOf(shotMode));
        post.setTime(elapsed / 1000);
        if (ctl === null || ctl.render) post.render();
        if (!firstRendered) { firstRendered = true; loading.remove(); }
      },
      dispose: disposeAll,
    };
    return stage;
  } catch (e) {
    disposeAll();
    throw e;
  }
}
