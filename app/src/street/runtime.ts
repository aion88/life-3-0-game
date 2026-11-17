/**
 * Assemblage de l'écran `street` [plan 02a T12 ; R-02a.20] : chunk à la demande, chargé par `screen.ts` par `import()`.
 * Ordre de montage : interface (avec indicateur) -> monde et charge utile `core` -> corps -> moteur de rendu -> scène -> pilote -> premier rendu.
 * Aucune règle de jeu ici : le pilote écrit, la boucle lit. Aucun état de jeu dans la boucle. Un corps absent est une erreur nommée, jamais une doublure.
 */
import { PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3, type Object3D } from 'three/webgpu';
import type { Palier } from '../survival/integrity';
import type { AppContext } from '../app/shell';
import type { RunResult } from '../shared/types';
import type { ActRecord } from '../shared/types/street';
import { avoidSolids, cameraPose, type CameraMode, type CameraPose } from '../engine/view/camera';
import { PLAYER_BODY_ID, crowdAt, easeToward, facingYaw, npcsPresent, queueBlockers, queuePositions, stepQueue, type PersonView, type QueueState } from '../engine/view/crowd';
import { type ActSink, type DriverEvent, type StreetDriver } from '../engine/view/driver';
import { type GradeUniforms, type LightBlend } from '../engine/view/grade';
import { type HitInfo } from '../engine/view/interactions';
import { activityInput, barrierBlockers, resumeSpot, solidBlockers, stepWalk, streetBounds, type Blocker } from '../engine/view/walk';
import { createSequencer, effectEntries, parseSequences } from '../engine/view/sequence';
import { WEEK_STEPS } from '../engine/week';
import { carnet, eveningLines, momentOf, queuePositionOf, rightLineFor, sleepPriceLine, wallCounterOf } from '../engine/moments';
import { braceletCount, buildLedger, checkpointWords } from '../engine/moments/words';
import { CHECKPOINT_PREFIX } from '../engine/moments/choices';
import { lineHalves } from '../engine/moments/rights';
import { eveningPalier } from '../engine/moments/state';
import { dossierOf } from '../engine/moments/dossier';
import { loadUi } from '../data/ui/load';
import { dayDateShown } from './ui/dayDate';
import type { PriceLine, Rejected, StreetContext, Vec2 } from '../engine/moments/types';
import type { I18n } from '../i18n/i18n';
import { createGlbProvider } from './render/characters/glbProvider';
import { Box3 } from 'three';
import { bustShareOf, projectPersonRect } from './personRect';
import type { ScreenRect } from './ui/placement';
import { type CrowdPerson } from './render/characters/crowdView';
import { CharacterContractError, type CharacterHandle, type CharacterProvider } from './render/characters/provider';
import { createBackend, type RenderBackend } from './render/backend';
import { createPostChain, LETTERBOX_ASPECT, type PostOptions } from './render/pipeline';
import { usefulCrop } from '../engine/view/caps';
import { type DistrictHandle } from './render/scene';
import type { TextSurfaceFactory } from './render/scene';
import { type Manifest } from './load/worldPayload';
import { mountUi, type ChoiceView } from './ui';
import type { CaptureControl } from './capture';
import { BodiesMissingError, mountStage, requiredBodies, type Stage } from './stage';
import onboardingRaw from './data/w10.onboarding.json';
import sequencesRaw from './data/w10.sequences.json';
import { arrivalDue, arrivalKey, firstSightDue, parseOnboarding, welcomeDue, welcomeKit } from './onboarding';

/** Ce que la boucle demande à la chaîne de post-process (la vraie `PostChain` y satisfait). */
export interface RenderPost {
  setGrade(u: GradeUniforms, b: LightBlend): void;
  /** Distance de mise au point et demi-épaisseur de la zone nette (m) ; sans `halfM`, plan net seul. */
  setFocus(distanceM: number, halfM?: number): void;
  setDof(d: { readonly focalLengthM: number; readonly bokehScale: number }): void;
  setAspect(aspect: number): void;
  setTime(seconds: number): void;
  render(): void;
  dispose(): void;
}
/** Boucle d'images : `requestAnimationFrame` en production, manuelle dans les tests. */
export interface FrameLoop { request(cb: (nowMs: number) => void): number; cancel(handle: number): void }

/** La couture de test : tout ce que l'écran emprunte au monde extérieur [R-02a.15 k]. */
export interface RuntimeDeps {
  readonly fetch: typeof fetch;
  readonly backend: (host: HTMLElement, opts: { readonly forceWebGL: boolean }) => Promise<RenderBackend>;
  readonly post: (backend: RenderBackend, scene: Scene, camera: PerspectiveCamera, o: PostOptions) => RenderPost;
  readonly characters: (assets: ReadonlyMap<string, ArrayBuffer>, manifest: Manifest, opts?: { readonly floorGain?: number }) => CharacterProvider;
  readonly sink: ActSink;
  readonly frames: FrameLoop;
  readonly textSurface?: TextSurfaceFactory;
}

/** Ce que l'appelant (et les tests) tiennent d'un écran monté. */
export interface StreetRuntime {
  readonly driver: StreetDriver;
  player(): Vec2;
  district(): DistrictHandle;
  dispose(): void;
}

/** Corps exigés et erreur de corps absents : définis dans le montage commun, réexportés ici. */
export { BodiesMissingError, requiredBodies };

/** Repli d'une ligne de prix que le writer n'a pas encore écrite (`priceLineKey` nul) : le geste reste confirmable. */
const NO_PRICE_KEY = 'street.ui.continue';
/** Nom de groupe d'un jalon sans titre propre : jamais `street.ui.continue`, qui est un libellé d'action. */
const MILESTONE_KEY = 'street.ui.choices.milestone';
const SLEEP_ID = 'sleep';
/** La ligne de prix à montrer : celle du moteur, ou AUCUNE (`textKey` vide) quand le writer ne l'a pas écrite. Jamais « Continuer », qui se lit comme un prix qu'il n'est pas [GD 2026-11-02]. */
export const priceLineOf = (choiceId: string, optionId: string, p: PriceLine | null): PriceLine =>
  p !== null && p.textKey !== '' ? p : { choiceId, optionId, textKey: '', isRefusal: p?.isRefusal ?? false, inventoryParams: {} };
const JALON_OPTION = 'go';

/** Clé du libellé d'une option [D1]. Un id d'option peut porter `:` (`buy:bons`), que la grammaire des clés refuse : il devient `.`. */
export const optionLabelKey = (choiceId: string, optionId: string): string => `w10.choice.${choiceId}.${optionId.replaceAll(':', '.')}`;

/**
 * Les choix à présenter, en vues pour le panneau. Un id de `street.choices` rend ses options ; un id de jalon rend UNE option `go`
 * [R-02a.17 f] ; `blocksExit` vient de la donnée. Les libellés d'options sont `w10.choice.<choix>.<option>` [D1] ; une clé de choix absente retombe sur `street.ui.continue`.
 */
export function choiceViews(ids: readonly string[], ctx: Pick<StreetContext, 'street'>, i18n: Pick<I18n, 'has'>): readonly ChoiceView[] {
  const firstExisting = (keys: readonly string[]): string => keys.find((k) => i18n.has(k)) ?? NO_PRICE_KEY;
  const out: ChoiceView[] = [];
  for (const id of ids) {
    const c = ctx.street.choices.find((x) => x.id === id);
    if (c !== undefined) {
      out.push({
        id, blocksExit: c.blocksExit, labelKey: firstExisting([`w10.doc.${id}`, `w10.street.${id}`, `w10.choice.${id}`]),   // nom du groupe (aria-labelledby)
        options: c.options.map((o) => ({
          id: o.id, isRefusal: o.isRefusal,
          // le prix de la pièce est ce que le relevé retire : au checkpoint `forcedWords`, ailleurs `words` [décision GD 2026-11-02]
          words: id.startsWith(CHECKPOINT_PREFIX) ? checkpointWords(ctx.street.checkpoint.forcedWords, o.id) : o.words,
          labelKey: optionLabelKey(id, o.id),   // D1 : seule cette clé nomme l'option, jamais la ligne de prix
        })),
      });
    } else if (ctx.street.jalons.some((j) => j.id === id)) {
      out.push({ id, blocksExit: false, priced: false, labelKey: firstExisting([`w10.doc.${id}`, `w10.street.${id}`, `w10.choice.${id}`, MILESTONE_KEY]), options: [{ id: JALON_OPTION, labelKey: NO_PRICE_KEY, isRefusal: false, words: 0 }] });
    }
  }
  return out;
}

const withBase = (path: string): string => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return path.startsWith('/') && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
};

/** Défauts de production de la couture. */
function defaults(ctx: AppContext): RuntimeDeps {
  return {
    fetch: (input, init) => fetch(typeof input === 'string' ? withBase(input) : input, init),
    backend: (host, opts) => createBackend(host, opts),
    post: (backend, scene, camera, o) => createPostChain(backend.renderer, scene, camera, o),
    characters: (assets, manifest, opts) => createGlbProvider(assets, manifest, opts),
    sink: ctx.save,
    frames: { request: (cb) => requestAnimationFrame(cb), cancel: (h) => { cancelAnimationFrame(h); } },
  };
}

/** La couture complète : les défauts de production, surchargés par `over` (rue libre et rue guidée, même source). */
export function streetDeps(ctx: AppContext, over: Partial<RuntimeDeps> = {}): { -readonly [K in keyof RuntimeDeps]: RuntimeDeps[K] } {
  const base = defaults(ctx);
  return {
    fetch: over.fetch ?? base.fetch, backend: over.backend ?? base.backend, post: over.post ?? base.post,
    characters: over.characters ?? base.characters, sink: over.sink ?? base.sink, frames: over.frames ?? base.frames,
    ...(over.textSurface === undefined ? {} : { textSurface: over.textSurface }),
  };
}

/** Pas de la grille qui cherche un chemin de la position de reprise à l'entrée de la rue : plus fin que le rayon du corps doublé, assez gros pour rester une recherche d'une image. */
const RESUME_CELL_M = 0.5;
const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
/** Touches qui passent une séquence jouée (un clic aussi) : le clavier a le même recours que la souris. */
const SKIP_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'Escape']);

/** Monte l'écran. Lève `DataLoadError` (réseau, donnée) vers la coquille ; `GraphicsUnavailable` et les corps manquants s'affichent. */
export async function mountStreet(ctx: AppContext, run: RunResult, root: HTMLElement, over: Partial<RuntimeDeps> = {}): Promise<StreetRuntime> {
  const deps = streetDeps(ctx, over);
  // Prise de vue [plan 02a T13] : la condition est écrite en ligne pour qu'un build de production la plie en `false` et n'émette pas `capture.ts`.
  const search = typeof location === 'undefined' ? '' : location.search;
  const capMod = (import.meta.env.VITE_CAPTURE === '1' || (import.meta.env.DEV && import.meta.env.MODE !== 'test')) ? await import('./capture') : null;
  const ctl: CaptureControl | null = capMod === null ? null : capMod.createControl(search);
  const { i18n } = ctx;
  const doc = root.ownerDocument;
  const cleanups: (() => void)[] = [];
  const disposeAll = (): void => { for (const c of cleanups.splice(0).reverse()) { try { c(); } catch { /* un nettoyage raté ne bloque pas les autres */ } } };

  const host = doc.createElement('div');
  host.dataset['ui'] = 'street';
  host.style.cssText = 'position:fixed;inset:0;overflow:hidden';
  root.appendChild(host);
  cleanups.push(() => { host.remove(); });
  const ui = mountUi(host, i18n);
  cleanups.push(() => { ui.dispose(); });

  try {
    const st = await mountStage(ctx, run, host, deps, ui, { interiors: 'core', capture: ctl });
    if (st === 'noGpu') return { driver: undefined as never, player: () => ({ x: 0, z: 0 }), district: () => undefined as never, dispose: disposeAll };
    if (st instanceof BodiesMissingError) throw st;
    cleanups.push(() => { st.dispose(); });
    return assemble(st);

    function assemble(stage: Stage): StreetRuntime {
      const { view, camera, scene, sctx, driver, provider, crowd, canvasHost, loading, backend } = stage;
      const onboarding = parseOnboarding(onboardingRaw, sctx.street);   // accueil du J1, objectif du jour, premières apparitions [playtest 2026-11-03 §1 A, §3 A]
      const seq = createSequencer(parseSequences(sequencesRaw, scene, sctx.street, (k) => i18n.has(k)));   // séquences jouées : un choix confirmé se joue 3 à 8 s avant que l'acte ne soit appliqué
      const stepLoop = capMod !== null && ctl !== null && over.frames === undefined && new URLSearchParams(search).has('step') ? capMod.createStepLoop(ctl, scene.walk.maxDtMs.v) : null;
      if (stepLoop !== null) deps.frames = stepLoop.frames;

      const playerHandle: CharacterHandle = provider.acquire({ id: 'player', kind: 'player', bodyId: PLAYER_BODY_ID, seed: 0 });
      view.add(playerHandle.object);
      cleanups.push(() => { playerHandle.release(); });

      // --- état de VUE (jamais de l'état de jeu) ---
      // Sans position sauvée, on pose la joueuse là où l'état dit qu'elle est : une reprise ne rejoue pas une entrée de lieu.
      const resumedAt = driver.state().street.location;
      const places = scene.layout.places;
      const streetEntry: Vec2 = { x: 0, z: places.logement.zEnd!.v };
      const resumedSpot: Vec2 = { x: 0, z: resumedAt === 'home' ? places.logement.z.v : resumedAt === 'registre' ? (places.registre.z.v + places.registre.zEnd!.v) / 2 : streetEntry.z };
      // Reprise collée à un solide ou sans chemin jusqu'à l'entrée (barrière fermée, décor) : la joueuse repart de l'entrée de la rue [demande Cynthia 2026-11-03]
      const resumeState = driver.state(), hw = scene.layout.halfWidthM.v;
      let player: Vec2 = resumeSpot(resumedSpot, streetEntry, [...barrierBlockers(queuePositionOf(resumeState.street, sctx, resumeState.live.clock.minute), scene), ...streetBounds(scene), ...solidBlockers(scene)], {
        clearanceM: scene.walk.bodyRadiusM.v, cellM: RESUME_CELL_M, bounds: { min: { x: -hw, z: scene.layout.zMin.v }, max: { x: hw, z: scene.layout.zMax.v } },
      });
      let heading = 0;
      let moving = false;
      let mode: CameraMode = 'walk';
      let pose: CameraPose | null = null;
      let from: { pose: CameraPose; ms: number } | null = null;
      let target: Vec2 | null = null;
      let pendingHit: HitInfo | null = null;
      const keys = new Set<string>();
      let elapsed = 0;
      let last: number | null = null;
      let queueShown = 0;
      let queueZ: QueueState | null = null;      // z montré de chaque voisin de la file : sa place est réservée au joueur, glissements lissés
      let lastChoiceIds = '';
      let arrived: string | null = null;            // la ligne d'arrivée que dit le narrateur, tant qu'aucune réplique ne l'a remplacée
      let shown: readonly ChoiceView[] = [];
      let lastRight: string | null | undefined;
      let lastBracelet = '';
      let lastDossier = '';
      let lastEvening = '';
      const firstSeen = new Set<string>();             // lignes de première apparition déjà dites dans la séance
      let firstOpen: string | null = null;             // la ligne de première apparition à l'écran, pas encore lue jusqu'au bout
      let welcoming = false;                           // l'accueil du J1 est ouvert : l'horloge l'attend (une ligne de première apparition, elle, ne l'arrête pas)
      const dayDateMode = loadUi().theme.street.dayDate.v;   // P-10 : `always` par défaut
      let zoneArmed = { home: true, registre: true };
      let refused = { home: false, registre: false };
      let navigated = false;
      let rafHandle = 0;
      let armT = 0;                                   // bras de la barrière : 0 baissé, 1 levé
      let lastFade = 0;
      let widenNow = 1;                               // éloignement de la caméra de marche pendant une séquence
      let disposed = false;
      let lastBand = -1;                              // dernière bande transmise à l'interface (px)
      let passers: PersonView[] = [];
      let npcs: PersonView[] = [];

      const dtBound = (ms: number): number => Math.min(Math.max(Number.isFinite(ms) ? ms : 0, 0), scene.walk.maxDtMs.v);
      const stopM = (scene.walk.speedMps.v * scene.walk.maxDtMs.v) / 1000;
      const palierOf = (): Palier => driver.state().street.readings.at(-1)?.palier ?? 'courtesy';

      // --- interface : gestes ---
      const priceFor = priceLineOf;
      const isJalon = (id: string): boolean => sctx.street.jalons.some((j) => j.id === id);
      ui.onGesture((e) => {
        if (seq.active()) return;                                                 // la joueuse a perdu la main : aucun geste du panneau ne passe
        if (e.gesture === 'close') { shown = []; lastChoiceIds = ''; return; }   // Échap : le choix revient au tick suivant s'il est encore présentable
        if (e.gesture === 'designate') {
          if (e.optionId === null) { if (!isJalon(e.choiceId) && e.choiceId !== SLEEP_ID) driver.designate(e.choiceId, null); return; }
          if (isJalon(e.choiceId)) { ui.showPrice(priceFor(e.choiceId, e.optionId, null)); return; }
          if (e.choiceId === SLEEP_ID) { ui.showPrice(priceFor(SLEEP_ID, SLEEP_ID, sleepPriceLine(driver.state().street, sctx))); return; }
          const r = driver.designate(e.choiceId, e.optionId);
          if (r.ok) ui.showPrice(priceFor(e.choiceId, e.optionId, r.price));
          else ui.showRefusal({ act: { day: driver.state().street.day, minute: driver.state().live.clock.minute, kind: 'choice', id: e.choiceId, option: e.optionId }, reason: r.reason } as Rejected);
          return;
        }
        if (isJalon(e.choiceId)) driver.choose(e.choiceId, JALON_OPTION);
        else if (e.choiceId === SLEEP_ID) driver.sleep();
        else {
          // le jus du prix part APRÈS la confirmation : le bracelet retrouve l'option confirmée dans les vues affichées, puis le moteur ôte les mots [spec C §4, I-5]
          const o = shown.find((c) => c.id === e.choiceId)?.options.find((x) => x.id === e.optionId);
          const apply = (): void => {
            if (o !== undefined) ui.reactToConfirm({ isRefusal: o.isRefusal, words: o.words });
            driver.confirm();
            { const s = driver.state().street; ui.setBracelet(braceletCount(buildLedger(s.day, s.acts, sctx))); }   // la baisse due à la confirmation est posée dans CE tour : c'est elle qui joue le jus
          };
          // séquence jouée : séquence d'abord, acte ensuite (`onEnd`), une seule fois ; sans séquence écrite pour ce couple, l'acte part tout de suite
          const d = driver.state().street.designated;
          const snap = driver.state();
          const played = d !== null && d.choiceId === e.choiceId && d.optionId === e.optionId
            ? seq.begin(e.choiceId, e.optionId, (final) => {
              player = final; target = null; pendingHit = null;                          // là où la joueuse est arrivée (la cible, ou le point où la marche a buté)
              try { apply(); } finally { ui.showSkipHint(false); ui.pulseDossier(null); }   // la main revient et le battement s'arrête même si l'acte lève
            }, effectEntries(snap.street, sctx, snap.live.clock), { reduced: ui.reducedMotion(), day: snap.street.day })   // la variante suit l'effet RÉEL de l'acte (tirage, composant, informateur)
            : null;
          if (played === null) apply();
          else {
            ui.showChoices([]); lastChoiceIds = '';                               // le panneau se retire (la désignation reste au pilote jusqu'à l'acte) ; il se recalcule au tour qui suit la fin
            if (speaker !== null) { speaker = null; ui.clearLine(); }
            ui.setNarration(played.narrationKey); arrived = null;
            ui.showSkipHint(true);
            if (played.dossierPulse !== 0) ui.pulseDossier(played.dossierPulse, played.pulseWeight);   // effet nul : aucune pulsation
            target = null; pendingHit = null;
          }
        }
      });

      // --- paroles : la réplique d'une personne va en bulle, le reste en narration [UI-C T8] ---
      let speaker: string | null = null;                    // la personne parlée : zone interdite d'I-3 pour la bulle et le panneau d'options
      const bustShare = bustShareOf();
      const say = (r: { readonly type: string; readonly cardId?: string; readonly key?: string }, hit: HitInfo): void => {
        if (hit.kind === 'passerby') speaker = hit.id;
        if (r.type === 'card' && r.cardId !== undefined) ui.showCard(r.cardId);
        else if (r.type === 'response' && r.key !== undefined) {
          if (hit.kind === 'passerby') { const nameKey = `w10.name.${hit.id}`; ui.showLine(r.key, i18n.has(nameKey) ? { nameKey } : {}); }   // le nom est toujours dit : une fiche n'est pas lisible pour ces PNJ [P-9, tranché 2026-11-02] }
          else { ui.setNarration(r.key); arrived = null; }
        }
      };
      const projectBox = new Box3();
      /** Rectangle écran (tête et buste) de la personne `id`, `null` si elle n'est pas affichée ou derrière la caméra. */
      const rectOf = (id: string | null): ScreenRect | null => {
        const obj = id === null ? null : crowd.objectOf(id);
        if (obj === null) return null;
        camera.updateMatrixWorld(true);
        obj.updateMatrixWorld(true);                                  // les os ont bougé dans cette image, le rendu n'a pas encore recalculé leur matrice : sans cela le rectangle retarde d'une image
        return projectPersonRect(projectBox.setFromObject(obj, true), camera, { w: canvasHost.clientWidth || 1280, h: canvasHost.clientHeight || 720 }, bustShare);
      };

      // --- entrées ---
      const onKeyDown = (e: KeyboardEvent): void => {
        if (seq.active()) { if (SKIP_KEYS.has(e.code)) seq.skip(); return; }   // entrée verrouillée : seules Espace, Entrée et Échap passent la séquence
        if (KEYS.has(e.code)) { keys.add(e.code); target = null; pendingHit = null; if (speaker !== null) { speaker = null; ui.clearLine(); } }
      };
      const onKeyUp = (e: KeyboardEvent): void => { keys.delete(e.code); };
      const onBlur = (): void => { keys.clear(); };
      const onResize = (): void => { size(); };
      const size = (): void => { stage.resize(); };
      const onPointer = (e: PointerEvent): void => {
        if (seq.active()) { seq.skip(); return; }                                 // un clic passe la séquence : l'état final est posé, puis l'acte
        const rect = canvasHost.getBoundingClientRect();
        const w = rect.width || 1, h = rect.height || 1;
        const hit = hitTest(((e.clientX - rect.left) / w) * 2 - 1, -(((e.clientY - rect.top) / h) * 2 - 1));
        const out = driver.click(hit, player);
        if (out.resolution.type === 'approach') { target = out.resolution.to; pendingHit = hit.kind === 'ground' ? null : hit; }
        else say(out.resolution, hit);
      };
      window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur); window.addEventListener('resize', onResize);
      canvasHost.addEventListener('pointerdown', onPointer);
      cleanups.push(() => {
        window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur); window.removeEventListener('resize', onResize);
        canvasHost.removeEventListener('pointerdown', onPointer);
      });

      /** Rayon écran -> clic : objet du quartier, personne proche, sinon le sol. */
      const hitTest = (ndcX: number, ndcY: number): HitInfo => {
        const ray = rayFrom(camera, ndcX, ndcY);
        const meshes = [...stage.district().hitMeshes.entries()];
        let best: { id: string; d: number } | null = null;
        for (const [id, obj] of meshes) {
          const d = ray.hits(obj);
          if (d !== null && (best === null || d < best.d)) best = { id, d };
        }
        const ground = ray.ground();
        if (best !== null) { const at = scene.interactions[best.id]?.at.v; if (at !== undefined) return { kind: 'clickable', id: best.id, at: { x: at.x, z: at.z } }; }
        if (ground === null) return { kind: 'none' };
        const near = [...passers, ...npcs].find((p) => Math.hypot(p.pos.x - ground.x, p.pos.z - ground.z) <= scene.build.hitWidthM.v / 2);
        return near === undefined ? { kind: 'ground', at: ground } : { kind: 'passerby', id: near.id, at: near.pos };
      };

      // --- interface : lecture de l'état ---
      const syncUi = (): void => {
        const { street } = driver.state();
        const wall = wallCounterOf(street, sctx);
        stage.district().setWallCounter(wall);
        const bracelet = String(braceletCount(buildLedger(street.day, street.acts, sctx)));
        if (bracelet !== lastBracelet) { lastBracelet = bracelet; ui.setBracelet(Number(bracelet)); ui.showCarnet(carnet(street)); }
        const soir = momentOf({ ...street, clock: driver.state().live.clock }, sctx.street) === 'soir';   // relevé du soir ouvert : la barre y consolide la nuit
        const dossier = `${street.day}.${street.acts.length}.${street.survival.value}.${street.dayExtra.entries.length}.${street.dayExtra.spent}.${soir}`;   // un geste, le soir, une nuit : la barre se relit [GDD 2026-11-03 §2 A]
        if (dossier !== lastDossier) { lastDossier = dossier; ui.setDossier(dossierOf(street, sctx), soir); }
        const right = rightLineFor(street, sctx);
        if (right !== lastRight) {
          lastRight = right;
          ui.showRightLine(right === null ? null : lineHalves(i18n.t(`w10.right.${right}`)));
        }
        const liveClock = driver.state().live.clock;                       // l'horloge de séance court entre deux actes ; l'état du moteur, non
        const evening = momentOf({ ...street, clock: liveClock }, sctx.street) === 'soir' ? `${street.day}.${street.acts.length}` : '';
        if (evening !== lastEvening) { lastEvening = evening; ui.showEvening(evening === '' ? [] : eveningLines(street.day, street.acts, sctx), evening === '' ? null : eveningPalier(street, sctx), street.day); }
        if (welcoming && street.acts.length > 0) { welcoming = false; ui.closeWelcome(); }   // la joueuse a déjà agi : l'accueil s'efface
        if (!welcoming && (evening !== '' || mode === 'observation') && ui.welcomeOpen()) {   // le relevé du soir et la file passent devant une ligne de première apparition restée ouverte
          if (firstOpen !== null) firstSeen.delete(firstOpen);                                 // non lue : elle reviendra
          firstOpen = null; ui.closeWelcome();
        }
        ui.showObjective(welcoming ? null : street.day);
        const today = street.acts.filter((a) => a.day === street.day).length;
        ui.showDayDate(dayDateShown(dayDateMode, today) ? street.day : null);
        host.dataset['day'] = String(street.day);
        host.dataset['minute'] = String(driver.state().live.clock.minute);
        host.dataset['acts'] = String(street.acts.length);
        host.dataset['bracelet'] = bracelet;
        if (seq.active()) return;                                                 // pendant une séquence jouée, aucun choix ne s'ouvre ni ne se ferme
        const ids = [...driver.present(player, { facing: { x: Math.sin(heading), z: -Math.cos(heading) }, keep: shown.map((c) => c.id) })];   // un lieu s'ouvre en vue, jamais dans le dos [playtest 2026-11-03]
        if (street.location === 'home' && liveClock.minute >= sctx.street.moments.eveningMinute && street.day < WEEK_STEPS) ids.push(SLEEP_ID);
        // un objet qui entre dans le kit reçoit sa ligne à sa première apparition [§1 A] ; jamais dans la file (bandes 2,39:1, cadre trop court) ni au soir
        const first = ui.welcomeOpen() || lastEvening !== '' || mode === 'observation' ? null : firstSightDue(onboarding, ids, street.acts, firstSeen);
        if (first !== null) { firstSeen.add(first.choiceId); firstOpen = first.choiceId; ui.showWelcome({ lines: [first], kit: first.lit === null ? [] : [first.lit], vibrate: false }, () => { firstOpen = null; }); }
        const key = ids.join('|');
        if (key !== lastChoiceIds) {
          lastChoiceIds = key;
          const arrive = arrivalDue(shown.map((c) => c.id), ids, (k) => i18n.has(k));   // le narrateur dit où l'on est et ce qui s'y joue
          if (arrive !== null) { ui.setNarration(arrive); arrived = arrive; }
          else if (arrived !== null && !ids.some((id) => arrivalKey(id) === arrived)) { ui.clearNarration(); arrived = null; }   // le lieu est quitté : sa ligne part avec lui
          shown = ids.map((id) => id === SLEEP_ID ? { id, blocksExit: false, priced: false, labelKey: 'street.ui.sleep', options: [{ id: SLEEP_ID, labelKey: 'street.ui.sleep', isRefusal: false, words: 0 }] } : choiceViews([id], sctx, i18n)[0]!);
          ui.showChoices(shown);
        }
      };

      const handle = (events: readonly DriverEvent[]): void => {
        for (const ev of events) {
          if (ev.type === 'rejected') ui.showRefusal(ev.rejected);
          else if (ev.type === 'unsaved') ui.showNotSaved();
        }
      };

      /** Entrées et sorties des lieux, une fois par franchissement (une ligne d'acte par passage, jamais par image). */
      const zones = (): void => {
        const { street } = driver.state();
        const home = scene.layout.places.logement, reg = scene.layout.places.registre;
        const homeDeep = (home.z.v + home.zEnd!.v) / 2, regDeep = (reg.z.v + reg.zEnd!.v) / 2;
        const at = driver.state().live.clock;
        const posed = (kind: string, id: string): ActRecord => ({ day: at.day, minute: at.minute, kind, id, option: null });
        // Sortie refusée par le moteur [R-02a.21 (4)] : la joueuse est ramenée en deçà de la frontière (la vue ne dit jamais autre chose que l'état).
        // `refused` tient la zone désarmée tant qu'elle reste contre la frontière : un refus par franchissement, jamais un par image.
        const snap = (where: 'home' | 'registre', z: number): void => { player = { x: player.x, z }; target = null; pendingHit = null; refused = { ...refused, [where]: true }; };
        const away = Math.max(stopM, 0);
        if (street.location === 'home' && player.z < home.zEnd!.v) {
          if (zoneArmed.home) { zoneArmed = { ...zoneArmed, home: false }; if (!driver.act(posed('exit', 'home')).ok) snap('home', home.zEnd!.v); }
          else if (refused.home) snap('home', home.zEnd!.v);
        }
        else if (street.location === 'street' && player.z > homeDeep) { if (zoneArmed.home) { zoneArmed = { ...zoneArmed, home: false }; driver.act(posed('enter', 'home')); } }
        else if (!refused.home || player.z >= home.zEnd!.v + away) { refused = { ...refused, home: false }; zoneArmed = { ...zoneArmed, home: true }; }
        if (street.location === 'street' && player.z < regDeep) { if (zoneArmed.registre) { zoneArmed = { ...zoneArmed, registre: false }; driver.act(posed('enter', 'registre')); } }
        else if (street.location === 'registre' && player.z > reg.z.v) {
          if (zoneArmed.registre) { zoneArmed = { ...zoneArmed, registre: false }; if (!driver.act(posed('exit', 'registre')).ok) snap('registre', reg.z.v); }
          else if (refused.registre) snap('registre', reg.z.v);
        }
        else if (player.z >= regDeep && player.z <= reg.z.v - (refused.registre ? away : 0)) { refused = { ...refused, registre: false }; zoneArmed = { ...zoneArmed, registre: true }; }
      };

      const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
      /** Rapproche `v` de `to` à vitesse constante : parcourt 0 à 1 en `ms`. */
      const easeLinear = (v: number, to: number, dt: number, ms: number): number => (to > v ? Math.min(to, v + dt / ms) : Math.max(to, v - dt / ms));
      /** Une erreur dans l'image arrête la boucle et s'affiche (même alerte que les corps absents) ; la sauvegarde n'est pas touchée. */
      const failFrame = (e: unknown): void => {
        disposed = true; deps.frames.cancel(rafHandle); loading.remove();
        const p = host.appendChild(doc.createElement('p'));
        p.dataset['ui'] = 'street-error'; p.setAttribute('role', 'alert');
        p.textContent = e instanceof CharacterContractError ? i18n.t('street.ui.bodyFailed', { id: e.bodyId ?? '?' }) : i18n.t('app.error.load');
      };
      const frame = (nowMs: number): void => {
        if (disposed) return;
        rafHandle = deps.frames.request(frame);
        try { frameBody(nowMs); } catch (e) { failFrame(e); }
      };
      const frameBody = (nowMs: number): void => {
        if (ctl !== null && ctl.place !== null) { player = { x: ctl.place.x, z: ctl.place.z }; heading = ctl.place.heading; target = null; pendingHit = null; ctl.place = null; }
        const raw = last === null ? 0 : nowMs - last;
        last = nowMs;
        const dt = dtBound(raw);
        elapsed += dt;
        const snap = driver.state();

        // marche : clavier, sinon cap vers la cible d'un clic
        const sequencing = seq.active();
        const held = sequencing ? new Set<string>() : new Set(keys);
        if (target !== null && !sequencing) {
          const dx = target.x - player.x, dz = target.z - player.z;
          if (Math.hypot(dx, dz) <= stopM) {
            target = null;
            if (pendingHit !== null) { const h = pendingHit; pendingHit = null; const out = driver.click(h, player); say(out.resolution, h); }
          } else {
            if (dz < -stopM / 2) held.add('KeyW'); else if (dz > stopM / 2) held.add('KeyS');
            if (dx > stopM / 2) held.add('KeyD'); else if (dx < -stopM / 2) held.add('KeyA');
          }
        }
        const reading = queuePositionOf(snap.street, sctx, snap.live.clock.minute);
        const cues = seq.cueState();                                            // décor posé par la séquence : bras levé = ni segment de barrière ni solide du bras
        const blockers: Blocker[] = [...(cues.barrierUp ? [] : barrierBlockers(reading, scene))];
        blockers.push(...streetBounds(scene), ...solidBlockers(scene, !cues.barrierUp));
        const solids: readonly Blocker[] = [...blockers];                 // décor plein, sans la file : la perche de caméra s'y raccourcit
        if (queueZ !== null) blockers.push(...queueBlockers(scene, queueZ.zs, player));
        const auto = sequencing ? seq.step(dt, player, stopM, blockers) : null;           // marche automatique : la direction vient de la séquence, les solides restent ceux de `stepWalk`
        seq.settle(player, snap.street.day);                                    // l'indice laissé (visage, fente) s'efface hors de la zone du poste ou au jour suivant
        { const second = seq.takeSecondPulse(); if (second !== null) ui.pulseDossier(second.dir, second.weight); }   // second battement de l'effet réel (l'informateur : -4 puis -6) [GDD §0.2]
        const step = auto !== null && auto.ended ? { pos: player, heading, moving: false } : stepWalk(player, { keys: held, dtMs: dt, ...(auto?.dir == null ? {} : { dir: auto.dir }) }, scene.walk, blockers);
        player = step.pos; moving = step.moving; if (step.moving) heading = step.heading;
        if (auto?.teleport != null) { player = auto.teleport; moving = false; }     // saut de la séquence (la cour) : le fondu au noir le couvre

        // les corps des PNJ suivent l'horloge de séance, comme les choix qu'ils portent (`driver.present`) : l'horloge du moteur n'avance qu'aux actes
        passers = [...crowdAt(scene, elapsed, run.seed)];
        npcs = npcsPresent(sctx.street, scene, snap.live.clock.day, snap.live.clock.minute, palierOf()).map((n) => ({ ...n, heading: n.pos.x > 0 ? -Math.PI / 2 : Math.PI / 2 }));
        const dialogueOpen = shown.length > 0;
        const out = driver.tick(welcoming || sequencing ? 0 : dt, activityInput(moving, player, scene, dialogueOpen), player, passers.map((p) => ({ id: p.id, pos: p.pos })));
        handle(out.events);
        zones();
        syncUi();

        // fin de partie : on vide les événements en attente, puis on rend la main
        if (!navigated) {
          const bilan = driver.finishDay();
          if (bilan !== null) { navigated = true; handle(driver.drain()); void ctx.navigate('bilan', { input: bilan }); }
        }

        // vue : lumière, grade, foule, file, nacelles, caméra
        const live = driver.state();
        queueShown = easeToward(queueShown, queuePositionOf(live.street, sctx, live.live.clock.minute)?.permille ?? 0, dt, scene.view.easeRatePerS.v);
        queueZ = stepQueue(scene, queueZ, queueShown, player, dt);
        const bodies = scene.characters.crowdBodies.v;
        const people: CrowdPerson[] = [
          ...passers.map((p) => ({ ...p, kind: 'passerby' as const })),
          ...npcs.map((n) => ({ ...n, kind: 'npc' as const, clip: 'idle' as const })),
          ...queuePositions(scene, queueZ.zs).map((pos, i) => ({ id: `queue.${i}`, bodyId: bodies[i % bodies.length] as string, pos, heading: 0, kind: 'queue' as const, clip: 'queue' as const })),
        ];
        crowd.update(seq.active() ? people.map((p) => { const r = seq.react(p, player); return r === null ? p : { ...p, pos: r.pos, heading: r.heading }; }) : people, dt);
        playerHandle.object.position.set(player.x, 0, player.z);
        playerHandle.object.rotation.y = facingYaw(heading);
        playerHandle.play(moving ? 'walk' : 'idle', 1);
        playerHandle.tick(dt);
        for (const [id, aim] of out.aims) {
          const n = stage.district().nacelles.get(id) as Object3D | undefined;
          if (n !== undefined && aim !== null) n.rotation.y = Math.atan2(aim.x - n.position.x, aim.z - n.position.z);
        }
        const dist = stage.district();
        dist.setSlit(cues.slit); dist.setWallFace(cues.face);
        armT = easeLinear(armT, cues.barrierUp ? 1 : 0, dt, scene.checkpoint.barrier.liftMs.v);
        dist.setBarrierArm(armT);
        const fade = seq.fade();                                                  // en mouvement réduit, le fondu EST la transition (pas de marche) [GDD §1.8]
        if (fade !== lastFade) { lastFade = fade; ui.setFade(fade); }
        widenNow = easeToward(widenNow, seq.widen(), dt, scene.view.easeRatePerS.v);
        const nextMode: CameraMode = activityInput(moving, player, scene, dialogueOpen).inQueue ? 'observation' : 'walk';
        const want = avoidSolids(cameraPose(nextMode, player, moving, scene.camera), player, solids, scene.walk.bodyRadiusM.v);
        if (nextMode !== mode) { from = pose === null ? null : { pose, ms: 0 }; mode = nextMode; }
        let shownPose = want;
        if (from !== null) {
          from.ms += dt;
          const t = Math.min(1, from.ms / scene.camera.transitionMs.v);
          shownPose = { pos: [0, 1, 2].map((i) => lerp(from!.pose.pos[i]!, want.pos[i]!, t)) as [number, number, number], target: [0, 1, 2].map((i) => lerp(from!.pose.target[i]!, want.target[i]!, t)) as [number, number, number], fovDeg: lerp(from.pose.fovDeg, want.fovDeg, t), letterbox: want.letterbox };
          shownPose = avoidSolids(shownPose, player, solids, scene.walk.bodyRadiusM.v);   // la bascule marche -> observation ne traverse pas un décor plein non plus
          if (t >= 1) from = null;
        }
        if (widenNow > 1 + seq.limits().widenEpsilon) {                           // séquence jouée : la caméra recule de la joueuse pour cadrer aussi ce qui réagit [GDD §1.4]
          const o = shownPose.pos, wp = [player.x, 0, player.z] as const;
          shownPose = avoidSolids({ ...shownPose, pos: [wp[0] + (o[0] - wp[0]) * widenNow, o[1] * (1 + (widenNow - 1) * seq.limits().widenHeightShare), wp[2] + (o[2] - wp[2]) * widenNow] as [number, number, number] }, player, solids, scene.walk.bodyRadiusM.v);
        }
        pose = shownPose;
        const forced = ctl?.pose ?? null;                  // plaque : la caméra est posée, la chaîne est celle de l'observation (bandes 2,39:1)
        const shotPose: CameraPose = forced === null ? shownPose : { pos: [...forced.pos], target: [...forced.target], fovDeg: forced.fovDeg, letterbox: true };
        const focusM = forced === null ? Math.hypot(shownPose.pos[0] - player.x, shownPose.pos[2] - player.z) : forced.focusM;
        stage.render(dt, shotPose, focusM);               // lumière, ciel, caméra, lampadaires, mise au point, rendu
        // les bandes 2,39:1 n'existent qu'en observation : le panneau de choix se plafonne hors d'elles [spec choix simultanés §3.5]
        const band = shotPose.letterbox ? usefulCrop(canvasHost.clientWidth || 1280, canvasHost.clientHeight || 720, LETTERBOX_ASPECT).y : 0;
        if (band !== lastBand) { lastBand = band; ui.setLetterboxBand(band); }
        // la personne QUI PARLE ancre la bulle ; l'interlocuteur du choix ouvert (le PNJ le plus proche) ancre le panneau d'options : deux rectangles, deux ancres [I-3]
        if (speaker !== null && crowd.objectOf(speaker) === null) { speaker = null; ui.clearLine(); }   // la personne est partie : sa réplique aussi
        ui.setSpeakerRect(rectOf(speaker));
        const interlocutor = shown.length > 0 ? [...npcs].sort((x, y) => Math.hypot(x.pos.x - player.x, x.pos.z - player.z) - Math.hypot(y.pos.x - player.x, y.pos.z - player.z))[0]?.id ?? null : null;
        ui.setInterlocutorRect(rectOf(interlocutor));
      };

      if (capMod !== null && ctl !== null) {
        cleanups.push(capMod.installCapture({
          ctl, loop: stepLoop, driver, scene, ctx: sctx, backend, view, camera, district: stage.district, player: () => player, mode: () => mode, neutral: provider.neutral,
          personRect: rectOf,
          peopleFeet: () => { camera.updateMatrixWorld(true); const w = canvasHost.clientWidth || 1280, h = canvasHost.clientHeight || 720; return [...passers, ...npcs].map((p) => { const v = new Vector3(p.pos.x, 0, p.pos.z).project(camera); return { id: p.id, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h }; }); },
        }));
      }
      size();
      { const s0 = driver.state().street; if (welcomeDue(onboarding, s0.day, s0.acts.length)) { welcoming = true; ui.showWelcome({ lines: onboarding.welcome.lines, kit: welcomeKit(onboarding), vibrate: true }, () => { welcoming = false; }); } }   // l'horloge attend la fin de l'accueil
      syncUi();
      rafHandle = deps.frames.request(frame);
      cleanups.push(() => { disposed = true; deps.frames.cancel(rafHandle); });
      // démontage en pleine séquence : l'acte n'est jamais perdu en silence, il est appliqué (état final) ; s'il échoue, l'échec est journalisé
      cleanups.push(() => { if (!seq.active()) return; try { seq.skip(); } catch (e) { console.error('séquence jouée : acte non appliqué au démontage', e); } });

      return { driver, player: () => player, district: stage.district, dispose: disposeAll };
    }
  } catch (e) {
    if (e instanceof BodiesMissingError) {
      const p = host.appendChild(doc.createElement('p'));
      p.dataset['ui'] = 'street-error'; p.setAttribute('role', 'alert');
      p.textContent = i18n.t('street.ui.bodiesMissing', { ids: e.missing.join(', ') });
      return { driver: undefined as never, player: () => ({ x: 0, z: 0 }), district: () => undefined as never, dispose: disposeAll };
    }
    disposeAll();
    throw e;
  }
}

/** Rayon de caméra : distance à un objet touché (ou null) et point d'intersection avec le sol y = 0. */
function rayFrom(camera: PerspectiveCamera, ndcX: number, ndcY: number): { hits(o: Object3D): number | null; ground(): Vec2 | null } {
  camera.updateMatrixWorld();
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(ndcX, ndcY), camera);
  return {
    hits(o) { const h = ray.intersectObject(o, true)[0]; return h === undefined ? null : h.distance; },
    ground() { const at = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3()); return at === null ? null : { x: at.x, z: at.z }; },
  };
}
