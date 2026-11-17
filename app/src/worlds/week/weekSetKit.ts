import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Kit de primitives des decors de la semaine 1984.
 *
 * PROVISOIRE : primitives, non valide par Cynthia. Copie des aides de
 * `controlStationView.ts` (lignes 15-24), sans changer leur rendu, avec trois
 * differences : tout vit dans un `root` (jamais dans la scene), les ressources
 * GPU sont suivies pour `dispose()`, et l'absence de contexte 2D (happy-dom, ou
 * contexte refuse) est toleree : la texture est alors omise, rien ne plante.
 *
 * Aucune lumiere globale ici : le stage pose soleil et hemisphere. Seules des
 * lampes ponctuelles locales sont permises (`lamp`), retirees par `dispose()`.
 */

/** Cote (px) des textures de grain. */
const SURFACE_SIZE = 256;
/** Nombre de grains tires par texture de surface. */
const SURFACE_GRAINS = 12000;
/** Graine par defaut du grain (la meme que le controle). */
const SURFACE_SEED = 19;
/** Taille (px) des textures d'etiquette. */
const LABEL_WIDTH = 1024;
const LABEL_HEIGHT = 256;
const LABEL_FONT = '500 70px sans-serif';
/** Segments radiaux des cylindres. */
const CYLINDER_SEGMENTS = 24;
/** Segments des angles arrondis. */
const ROUND_SEGMENTS = 3;
/** Rugosite par defaut. */
const DEFAULT_ROUGHNESS = 0.82;
/** Decroissance physique des lampes ponctuelles. */
const LAMP_DECAY = 2;

/** Canvas et son contexte 2D, `ctx` nul quand l'environnement n'en fournit pas. */
export interface Canvas2d {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D | null;
}

/** Boite a outils d'un decor : fabrique de materiaux, de volumes et de lampes, avec liberation groupee. */
export interface SetKit {
  /** Racine unique du decor ; tout ce que le kit fabrique y est accroche par defaut. */
  readonly root: Group;
  /** Materiau standard suivi pour `dispose()`. */
  material(color: string, roughness?: number, metalness?: number): MeshStandardMaterial;
  /** Materiau emissif (abat-jour, fenetre, ecran). */
  glow(color: string, emissive: string, intensity?: number, roughness?: number): MeshStandardMaterial;
  /** Materiau a grain de canvas ; sans contexte 2D, la couleur seule reste. */
  textured(color: string, base: string, grain: string, repeat?: number, seed?: number): MeshStandardMaterial;
  /** Canvas 2D (contexte nul si indisponible). */
  canvas2d(width: number, height: number): Canvas2d;
  /** Texture de canvas suivie pour `dispose()`. */
  texture(canvas: HTMLCanvasElement): CanvasTexture;
  mesh(geometry: BufferGeometry, material: Material, parent?: Object3D): Mesh;
  box(w: number, h: number, d: number, x: number, y: number, z: number, material: Material, parent?: Object3D): Mesh;
  round(
    w: number,
    h: number,
    d: number,
    r: number,
    x: number,
    y: number,
    z: number,
    material: Material,
    parent?: Object3D,
  ): Mesh;
  cylinder(r: number, h: number, x: number, y: number, z: number, material: Material, parent?: Object3D): Mesh;
  /** Plan etiquete (texte sur fond), `width` x `height` en metres. */
  label(text: string, width: number, height: number, color: string, bg: string): Mesh;
  /** Lampe ponctuelle locale, retiree par `dispose()`. */
  lamp(color: string, intensity: number, distance: number, x: number, y: number, z: number): PointLight;
  /** Nombre de meshes actuellement sous `root`. */
  meshCount(): number;
  /** Libere geometries, materiaux, textures, lampes, et vide `root`. Idempotent. */
  dispose(): void;
}

/**
 * Cree un kit rattache a `doc`.
 *
 * @example
 * const kit = createSetKit(document);
 * const wood = kit.material('#8b6a4a');
 * kit.box(2, 0.1, 2, 0, -0.05, 0, wood);
 * scene.add(kit.root);
 * kit.dispose();
 */
export function createSetKit(doc: Document): SetKit {
  const root = new Group();
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const lights: PointLight[] = [];

  const material = (color: string, roughness = DEFAULT_ROUGHNESS, metalness = 0): MeshStandardMaterial => {
    const m = new MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m);
    return m;
  };

  const canvas2d = (width: number, height: number): Canvas2d => {
    const canvas = doc.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    return { canvas, ctx };
  };

  const texture = (canvas: HTMLCanvasElement): CanvasTexture => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    textures.add(t);
    return t;
  };

  const surface = (base: string, grain: string, repeat: number, seed: number): CanvasTexture | null => {
    const { canvas, ctx } = canvas2d(SURFACE_SIZE, SURFACE_SIZE);
    if (!ctx) return null;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, SURFACE_SIZE, SURFACE_SIZE);
    let state = seed;
    const rand = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    ctx.fillStyle = grain;
    for (let i = 0; i < SURFACE_GRAINS; i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.13;
      ctx.fillRect(rand() * SURFACE_SIZE, rand() * SURFACE_SIZE, 1 + rand() * 2, 1);
    }
    ctx.globalAlpha = 1;
    const t = texture(canvas);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(repeat, repeat);
    return t;
  };

  const mesh = (geometry: BufferGeometry, m: Material, parent: Object3D = root): Mesh => {
    geometries.add(geometry);
    const o = new Mesh(geometry, m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };

  const place = (o: Mesh, x: number, y: number, z: number): Mesh => {
    o.position.set(x, y, z);
    return o;
  };

  return {
    root,
    material,
    glow(color, emissive, intensity = 0.8, roughness = 0.4) {
      const m = material(color, roughness);
      m.emissive.set(emissive);
      m.emissiveIntensity = intensity;
      return m;
    },
    textured(color, base, grain, repeat = 2, seed = SURFACE_SEED) {
      const m = material(color);
      const map = surface(base, grain, repeat, seed);
      if (map) m.map = map;
      return m;
    },
    canvas2d,
    texture,
    mesh,
    box: (w, h, d, x, y, z, m, parent) => place(mesh(new BoxGeometry(w, h, d), m, parent), x, y, z),
    round: (w, h, d, r, x, y, z, m, parent) =>
      place(mesh(new RoundedBoxGeometry(w, h, d, ROUND_SEGMENTS, r), m, parent), x, y, z),
    cylinder: (r, h, x, y, z, m, parent) =>
      place(mesh(new CylinderGeometry(r, r, h, CYLINDER_SEGMENTS), m, parent), x, y, z),
    label(text, width, height, color, bg) {
      const { canvas, ctx } = canvas2d(LABEL_WIDTH, LABEL_HEIGHT);
      const m = material('#ffffff');
      if (ctx) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = LABEL_FONT;
        ctx.fillText(text, LABEL_WIDTH / 2, LABEL_HEIGHT / 2 + 2);
        m.map = texture(canvas);
      } else {
        m.color.set(bg);
      }
      return mesh(new PlaneGeometry(width, height), m);
    },
    lamp(color, intensity, distance, x, y, z) {
      const light = new PointLight(color, intensity, distance, LAMP_DECAY);
      light.position.set(x, y, z);
      root.add(light);
      lights.push(light);
      return light;
    },
    meshCount() {
      let n = 0;
      root.traverse((o) => {
        if ((o as Mesh).isMesh) n++;
      });
      return n;
    },
    dispose() {
      for (const light of lights) light.removeFromParent();
      lights.length = 0;
      root.clear();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      geometries.clear();
      materials.clear();
      textures.clear();
    },
  };
}
