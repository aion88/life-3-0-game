/**
 * Prise de vue et mesures de la rue [plan 02a T13] : `window.__street`, le mode pas à pas et les poses de plaque.
 * Chargé par `import()` depuis `runtime.ts` sous la seule condition `VITE_CAPTURE=1` ou build de dev (jamais sous Vitest, jamais en
 * production) : le build de production ne contient ni ce fichier ni la chaîne `__street`, un test e2e le vérifie.
 * Rien ici n'écrit l'état de jeu : `act` passe par le pilote, seul écrivain [plan 02a, Global Constraints].
 */
import { Color, DoubleSide, MeshBasicNodeMaterial, Raycaster, Vector3, type Material, type Side, type Mesh, type Object3D, type PerspectiveCamera, type Scene } from 'three/webgpu';
import { fovFromFocal, type CameraMode } from '../engine/view/camera';
import type { StreetDriver } from '../engine/view/driver';
import { gradeUniforms, type GradeUniforms } from '../engine/view/grade';
import type { LightState, SceneData } from '../engine/view/sceneSchema';
import { replay } from '../engine/moments/replay';
import type { StreetContext, Vec2 } from '../engine/moments/types';
import type { ActRecord } from '../shared/types/street';
import type { FrameLoop } from './runtime';
import type { RenderBackend } from './render/backend';
import type { DistrictHandle } from './render/scene';

/**
 * Vrai pour `VITE_CAPTURE=1` et pour le serveur de dev ; faux en production et sous Vitest (MODE `test`). `runtime.ts` écrit la même
 * expression en ligne dans son `if` : un build de production doit pouvoir la plier en `false` et ne pas émettre ce chunk.
 */
export function captureEnabled(): boolean {
  return import.meta.env.VITE_CAPTURE === '1' || (import.meta.env.DEV && import.meta.env.MODE !== 'test');
}

/** Champ vertical en degrés d'une focale (équivalent plein format, capteur de `sensorMm` de haut) [art bible §D.2]. */
export const plateFov = fovFromFocal;

/**
 * Poses de plaque : position, cible, focale [supposed, owner technical-artist ; art bible §F lot 1, réglées sur la première capture].
 * Valeurs de prise de vue seulement : aucune n'entre dans le jeu. `place` pose la joueuse (personnage à 2 m).
 */
export interface PlatePose {
  readonly pos: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly focalMm: number;
  /** Mise au point en mètres quand elle n'est pas la distance à la cible (le sujet net n'est pas le point visé). */
  readonly focusM?: number;
  /** Focale de l'optique de la zone nette quand elle n'est pas celle du mode (plan d'établissement 35 mm, art bible §D.2). */
  readonly dofFocalMm?: number;
  readonly place?: { readonly x: number; readonly z: number; readonly heading: number };
}
export const PLATE_POSES: Readonly<Record<string, PlatePose>> = {
  'checkpoint-large': { pos: [-3.2, 1.55, 3.5], target: [1.2, 2.0, -11], focalMm: 40 },
  // mise au point sur les passants du premier plan (4 à 8 m) et non sur le mur à 50 m : on doit voir les personnages ; 35 mm f/2,8 à 6 m : zone nette de 3,6 à 8,4 m
  'rue-nuit': { pos: [-3.5, 1.6, 40], target: [0, 2.2, -10], focalMm: 35, focusM: 6, dofFocalMm: 35 },
  // vue presque verticale sur l'axe de la chaussée, entre les deux lampadaires à z = 26 [lampHeadPositions] : sert à mesurer la flaque de lumière
  'flaque-lampadaire': { pos: [0, 18, 27.4], target: [0, 0, 26], focalMm: 24 },
  // trois visées plein ciel depuis 60 m de haut (au-dessus des toits, rien dans le champ) : arrêts du dôme à 1,5°, 15° et 88° d'élévation, au centre du cadre (mesure des cibles de sortie du ciel)
  'ciel-horizon': { pos: [0, 60, 10], target: [0, 62.618, -89.966], focalMm: 85 },
  'ciel-milieu': { pos: [0, 60, 10], target: [0, 85.882, -86.593], focalMm: 85 },
  'ciel-zenith': { pos: [0, 60, 10], target: [0, 159.939, 6.51], focalMm: 85 },
  // le joueur au front de la file devant le mur d'écrans (cadre de la caméra d'observation) : mesure du contraste silhouette/fond [TV-02a-render]
  'joueur-checkpoint': { pos: [3.2, 1.8, -3.5], target: [0.6, 1.75, -11], focalMm: 50, place: { x: 0.75, z: -9.6, heading: 0 } },
  'place-jour': { pos: [4.5, 1.7, 16], target: [-1, 6.0, -8], focalMm: 28 },
  'personnage-2m': { pos: [0.25, 1.62, 10], target: [0, 1.6, 12], focalMm: 85, place: { x: 0, z: 12, heading: 0 } },
};

/** Suffixe du matériau de peau des corps MPFB (`player_body.body`, `crowd_a.body`…), lu dans les GLB livrés : la peau fait partie de la base [art bible §B.1]. */
export const SKIN_MATERIAL_SUFFIX = '.body';

/** Pose de caméra imposée par une plaque (champ vertical déjà calculé, distance de mise au point). */
export interface ForcedPose { readonly pos: readonly [number, number, number]; readonly target: readonly [number, number, number]; readonly fovDeg: number; readonly focusM: number; readonly dofFocalMm?: number }

/** Réglages que la boucle d'images lit à chaque image ; `null` ou valeur par défaut : la rue se comporte comme en production. */
export interface CaptureControl {
  pose: ForcedPose | null;
  /** Lumière imposée (plaques B et C) : le fondu est sauté, l'état courant est celui-ci. */
  light: LightState | null;
  /** Placement unique de la joueuse, consommé par la première image qui le voit. */
  place: { x: number; z: number; heading: number } | null;
  /** Étalonnage d'un état de lumière imposé : posé par `installCapture`, lu par la boucle. */
  forcedGrade: ((light: LightState) => GradeUniforms) | null;
  /** Faux : l'image calcule tout mais ne rend pas (longues marches du parcours). */
  render: boolean;
  /** `?bloom=0|1` : force la force du bloom ; `null` laisse la donnée. */
  bloom: number | null;
  /** `?lut=identity|off` : LUT identité, ou aucune LUT dans la chaîne ; `data` sinon. */
  lut: 'data' | 'identity' | 'off';
}

export function createControl(search: string): CaptureControl {
  const q = new URLSearchParams(search);
  const bloom = q.get('bloom');
  const lut = q.get('lut');
  return {
    pose: null, light: null, place: null, forcedGrade: null, render: true,
    bloom: bloom === null || Number.isNaN(Number(bloom)) ? null : Number(bloom),
    lut: lut === 'identity' || lut === 'off' ? lut : 'data',
  };
}

/** Boucle d'images manuelle : `frames` est ce que le runtime reçoit à la place de `requestAnimationFrame`. */
export interface StepLoop {
  readonly frames: FrameLoop;
  /**
   * Avance l'horloge de rendu de `ms`, par sous-pas d'au plus `maxDtMs` (la borne de la boucle : au-delà elle écrête). Seule la dernière
   * image rend, sauf `render: false`. `step(0)` joue UNE image sans avancer l'horloge.
   */
  step(ms: number, o?: { readonly render?: boolean }): void;
}

export function createStepLoop(ctl: CaptureControl, maxDtMs: number): StepLoop {
  let cb: ((nowMs: number) => void) | null = null;
  let handle = 0;
  let now = 0;
  return {
    frames: {
      request(c) { cb = c; return ++handle; },
      cancel(h) { if (h === handle) cb = null; },
    },
    step(ms, o = {}) {
      const draw = o.render !== false;
      let left = Math.max(0, ms);
      try {
        do {
          const c = cb;
          if (c === null) return;                       // écran détruit (navigation vers le bilan) : plus rien à jouer
          cb = null;
          const dt = Math.min(left, maxDtMs);
          left -= dt;
          now += dt;
          ctl.render = draw && left <= 0;
          c(now);
        } while (left > 0);
      } finally { ctl.render = true; }
    },
  };
}

/** Ce que `installCapture` tient du runtime monté. */
export interface CaptureHost {
  readonly ctl: CaptureControl;
  readonly loop: StepLoop | null;
  readonly driver: StreetDriver;
  readonly scene: SceneData;
  readonly ctx: StreetContext;
  readonly backend: RenderBackend;
  readonly view: Scene;
  readonly camera: PerspectiveCamera;
  readonly district: () => DistrictHandle;
  readonly player: () => Vec2;
  readonly mode: () => CameraMode;
  /** Les personnes affichées : identifiant et position écran (px, pieds), pour cliquer dessus en test [UI-C T8]. */
  /** Rectangle écran (tête et buste) d'une personne par identifiant, pour les tests d'ancrage [UI-C T8]. */
  readonly personRect?: (id: string) => { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null;
  readonly peopleFeet?: () => readonly { readonly id: string; readonly x: number; readonly y: number }[];
  /** Vrai pour la seule doublure de test des corps : une plaque ne se prend jamais avec elle. */
  readonly neutral: boolean;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Pose `window.__street` ; rend la fonction qui le retire. */
export function installCapture(h: CaptureHost): () => void {
  const { ctl } = h;
  const sensor = h.scene.camera.sensorHeightMm.v;
  const ws0 = replay([], h.ctx).week.ws;
  const outcome = h.ctx.run.outcome;
  const offset = outcome.kind === 'arrival' ? outcome.offset : { axes: [] };
  ctl.forcedGrade = (light) => gradeUniforms({ light: { from: light, to: light, t: 1 }, ws: h.driver.state().week.ws, ws0, offset }, h.scene.grade);

  const canvas = (): HTMLCanvasElement => h.backend.renderer.domElement;
  const needLoop = (): StepLoop => { if (h.loop === null) throw new Error('__street : ouvrir la page avec ?step'); return h.loop; };

  /**
   * Rendu du masque d'émissifs : les sources sont blanches, tout le reste est noir (et occlut). `screens` : les seize écrans seuls (le canal
   * de bloom) ; `mask` : les écrans et `otherEmissives` (Coffre, lampes, fenêtres éclairées, fente, balises), la mesure des plaques B et C.
   */
  const maskUrl = (only: 'screens' | 'all' | 'skin'): string => {
    const d = h.district();
    const emissive = new Set<Object3D>();
    if (only === 'skin') {
      // masque de peau : les maillages dont un matériau porte le nom de peau des corps MPFB [art bible §B.1 : la peau fait partie de la base]
      h.view.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh !== true) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (mats.some((x) => x.name.endsWith(SKIN_MATERIAL_SUFFIX))) emissive.add(o);
      });
    } else for (const root of only === 'screens' ? d.wallScreens : [...d.wallScreens, ...d.otherEmissives]) root.traverse((o) => { emissive.add(o); });
    const white = new MeshBasicNodeMaterial({ color: 0xffffff });
    const black = new MeshBasicNodeMaterial({ color: 0x000000 });
    const swapped: [Mesh, Material | Material[]][] = [];
    const background = h.view.background;   // le fond de scène (couleur de l'état de lumière) n'est pas une source émissive : noir dans le masque
    h.view.background = new Color(0x000000);
    const fog = h.view.fog;   // le brouillard teinterait le masque au loin : aucun dans le masque
    h.view.fog = null;
    h.view.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh !== true) return;
      swapped.push([m, m.material]);
      m.material = emissive.has(o) ? white : black;
    });
    try {
      h.backend.renderer.render(h.view, h.camera);
      return canvas().toDataURL('image/png');
    } finally {
      for (const [m, mat] of swapped) m.material = mat;
      h.view.background = background;
      h.view.fog = fog;
      white.dispose(); black.dispose();
    }
  };

  const api = {
    step: (ms: number, o?: { render?: boolean }): void => { needLoop().step(ms, o); },
    peopleFeet: () => h.peopleFeet?.() ?? [],
    personRect: (id: string) => h.personRect?.(id) ?? null,
    state() {
      const s = h.driver.state();
      return clone({ street: s.street, week: s.week, live: s.live, player: h.player(), mode: h.mode(), ended: s.street.ended !== null });
    },
    /** Visée de la caméra rendue : direction normée dans le plan du sol (x, z), pour juger qu'une touche ne fait pas pivoter la vue. */
    cameraDir(): { x: number; z: number } {
      h.camera.updateMatrixWorld(true);
      const e = h.camera.matrixWorld.elements, fx = -(e[8] ?? 0), fz = -(e[10] ?? 0), n = Math.hypot(fx, fz) || 1;
      return { x: fx / n, z: fz / n };
    },
    /** Buste du joueur (à `chestM` du sol) projeté à l'écran, en coordonnées normalisées (-1 à 1 dans le cadre) ; `front` faux s'il est derrière la caméra. */
    playerNdc(chestM = 1.2): { x: number; y: number; front: boolean } {
      h.camera.updateMatrixWorld(true);
      const p = h.player(), v = new Vector3(p.x, chestM, p.z).applyMatrix4(h.camera.matrixWorldInverse);
      const n = new Vector3(p.x, chestM, p.z).project(h.camera);
      return { x: n.x, y: n.y, front: v.z < 0 };
    },
    /**
     * Décor du quartier entre la caméra et le buste du joueur (à `chestM` du sol), faces avant et arrière : noms des maillages touchés avant
     * lui. Vide quand rien ne s'interpose, pour juger qu'on ne « marche pas au milieu d'un mur » [bug 2026-11-03].
     */
    cameraOccluders(chestM = 1.2): string[] {
      h.camera.updateMatrixWorld(true);
      const from = h.camera.position.clone(), p = h.player(), to = new Vector3(p.x, chestM, p.z);
      const dir = to.clone().sub(from), dist = dir.length();
      const ray = new Raycaster(from, dir.normalize(), 0, Math.max(dist - 0.35, 0));
      ray.camera = h.camera;                                  // les sprites du décor en ont besoin pour le lancer de rayon
      const root = h.district().root;
      root.updateMatrixWorld(true);
      // les deux faces : une caméra DANS un volume (dont les faces avant sont tournées vers l'extérieur) en est aussi masquée
      const sides: [Material, Side][] = [];
      root.traverse((o) => { const m = (o as Mesh).material; if ((o as Mesh).isMesh === true) for (const x of Array.isArray(m) ? m : [m]) { sides.push([x, x.side]); x.side = DoubleSide; } });
      try { return ray.intersectObject(root, true).filter((x) => x.object.visible).map((x) => x.object.name || x.object.parent?.name || '?'); }
      finally { for (const [x, side] of sides) x.side = side; }
    },
    /**
     * Dégagement devant le joueur, dans l'axe de la caméra : distance (m) du buste au premier décor du quartier touché, et son nom ; `null` si rien
     * jusqu'à `maxM`. Juge qu'on n'apparaît pas face à un mur [retour Cynthia 2026-11-04].
     */
    forwardClearance(chestM = 1.2, maxM = 50): { m: number; name: string } | null {
      h.camera.updateMatrixWorld(true);
      const e = h.camera.matrixWorld.elements, p = h.player();
      const dir = new Vector3(-(e[8] ?? 0), 0, -(e[10] ?? 0)).normalize();
      const ray = new Raycaster(new Vector3(p.x, chestM, p.z), dir, 0, maxM);
      ray.camera = h.camera;
      const root = h.district().root;
      root.updateMatrixWorld(true);
      const sides: [Material, Side][] = [];
      root.traverse((o) => { const m = (o as Mesh).material; if ((o as Mesh).isMesh === true) for (const x of Array.isArray(m) ? m : [m]) { sides.push([x, x.side]); x.side = DoubleSide; } });
      try { const hit = ray.intersectObject(root, true).find((x) => x.object.visible); return hit === undefined ? null : { m: hit.distance, name: hit.object.name || hit.object.parent?.name || '?' }; }
      finally { for (const [x, side] of sides) x.side = side; }
    },
    replayed(acts: readonly ActRecord[]) {
      const r = replay(acts, h.ctx);
      return clone({ street: r.state, week: r.week });
    },
    act: (a: ActRecord): { ok: boolean } => ({ ok: h.driver.act(a).ok }),
    setLight(s: LightState | null): void { ctl.light = s; },
    /** Pose la joueuse au point donné, le cap donné (0 face à -z, croît vers l'est), sans poser de prise de vue : la vue de jeu continue. */
    placeAt(x: number, z: number, heading: number): void { ctl.place = { x, z, heading }; },
    pose(name: string | null): void {
      if (name === null) { ctl.pose = null; return; }
      const p = PLATE_POSES[name];
      if (p === undefined) throw new Error(`pose inconnue : ${name}`);
      const dx = p.target[0] - p.pos[0], dy = p.target[1] - p.pos[1], dz = p.target[2] - p.pos[2];
      ctl.pose = { pos: p.pos, target: p.target, fovDeg: plateFov(p.focalMm, sensor), focusM: p.focusM ?? Math.sqrt(dx * dx + dy * dy + dz * dz), ...(p.dofFocalMm === undefined ? {} : { dofFocalMm: p.dofFocalMm }) };
      ctl.place = p.place === undefined ? null : { ...p.place };
    },
    setScreens(visible: boolean): void { for (const s of h.district().wallScreens) s.visible = visible; },
    /** Fenêtres allumées visibles ou non : le « chaud commun » (art bible §B.1) ne compte pas comme accent, on mesure le sodium sur un second rendu sans elles. */
    setWindows(visible: boolean): void { const w = h.district().root.getObjectByName('facade.windows.lit'); if (w !== undefined) w.visible = visible; },
    providerNeutral: (): boolean => h.neutral,
    backend: (): 'webgpu' | 'webgl2' => h.backend.kind,
    /** Appels de dessin et triangles d'UNE image complète (toutes les passes de la chaîne), compteurs remis à zéro avant [renderer.info, r186]. */
    stats(): { drawCalls: number; triangles: number } {
      const info = (h.backend.renderer as unknown as { info: { autoReset: boolean; reset(): void; render: { drawCalls?: number; calls?: number; triangles: number } } }).info;
      const was = info.autoReset;
      info.autoReset = false;
      info.reset();
      needLoop().step(0);
      const r = info.render;
      const out = { drawCalls: r.drawCalls ?? r.calls ?? 0, triangles: r.triangles };
      info.autoReset = was;
      return out;
    },
    /**
     * PNG (URL de données) du canvas : `beauty` rend la pose courante, `mask` le masque de tous les émissifs, `screens` celui des écrans seuls.
     * Asynchrone : la chaîne (profondeur, flou) n'est juste qu'à partir de la deuxième image APRÈS un changement de caméra, et une image
     * rendue dans la même tâche que la précédente ne compte pas [mesuré sur Chrome 156 / Metal, plan 02a T13] ; on attend donc deux
     * images réelles, puis on rend et on lit dans la même tâche (le canvas WebGPU n'est lisible que là).
     */
    async shoot(kind: 'beauty' | 'mask' | 'screens' | 'skin' = 'beauty'): Promise<string> {
      const loop = needLoop();
      const nextFrame = (): Promise<void> => new Promise((resolve) => { requestAnimationFrame(() => { resolve(); }); });
      for (let i = 0; i < 2; i++) { loop.step(0); await nextFrame(); }
      loop.step(0);
      return kind === 'beauty' ? canvas().toDataURL('image/png') : maskUrl(kind === 'screens' ? 'screens' : kind === 'skin' ? 'skin' : 'all');
    },
  };
  (window as unknown as { __street?: typeof api }).__street = api;
  return () => { delete (window as unknown as { __street?: typeof api }).__street; };
}
