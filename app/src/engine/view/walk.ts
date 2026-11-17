/**
 * Déplacement à pied dans la rue [plan 02a T8]. Pur et déterministe : ni DOM, ni horloge, ni hasard. Les touches se lisent par
 * `event.code` (position physique), jamais par `event.key`, pour que AZERTY et QWERTY marchent pareil. Les nombres viennent de
 * `SceneData` (vitesse, borne du pas, géométrie de la file) ; le joueur est un point, aucun rayon n'est donné par les données.
 */
import type { QueuePosition } from '../moments/checkpoint';
import type { Vec2 } from '../moments/types';
import type { SceneData } from './sceneSchema';
import { lampPositions } from './layout';

/** Données de marche de la scène : vitesse et borne du pas. */
export type WalkData = SceneData['walk'];
/** Obstacle : un mur (segment) ou un volume de lieu (boîte alignée sur les axes). */
export type Blocker =
  | { readonly kind: 'segment'; readonly a: Vec2; readonly b: Vec2 }
  | { readonly kind: 'box'; readonly min: Vec2; readonly max: Vec2 };
/** Entrée d'un pas : codes des touches tenues et durée réelle écoulée. */
export interface WalkInput {
  readonly keys: ReadonlySet<string>;
  readonly dtMs: number;
  /** Direction unitaire imposée (marche d'une séquence jouée) : elle remplace les touches ; ni diagonale à normaliser ni touche à lire. */
  readonly dir?: Vec2;
}

const FORWARD = ['KeyW', 'ArrowUp'];     // z décroissant : du logement vers le checkpoint
const BACK = ['KeyS', 'ArrowDown'];      // z croissant
const LEFT = ['KeyA', 'ArrowLeft'];      // x décroissant (ouest)
const RIGHT = ['KeyD', 'ArrowRight'];    // x croissant (est)

const held = (keys: ReadonlySet<string>, codes: readonly string[]): boolean => codes.some((c) => keys.has(c));

/** Le segment p0 -> p1 traverse-t-il le mur ? Partir depuis le mur ou glisser le long de lui ne bloque pas. */
function crossesSegment(p0: Vec2, p1: Vec2, a: Vec2, b: Vec2): boolean {
  const ex = b.x - a.x, ez = b.z - a.z;
  const side = (p: Vec2): number => ex * (p.z - a.z) - ez * (p.x - a.x);
  const s0 = side(p0), s1 = side(p1);
  if (s0 === 0 || !(s0 * s1 < 0 || s1 === 0)) return false;
  const t = s0 / (s0 - s1);                       // part du pas où il atteint la droite du mur
  const hx = p0.x + t * (p1.x - p0.x), hz = p0.z + t * (p1.z - p0.z);
  const len2 = ex * ex + ez * ez;
  const u = ((hx - a.x) * ex + (hz - a.z) * ez) / len2;
  return u >= 0 && u <= 1;
}

const inside = (p: Vec2, min: Vec2, max: Vec2): boolean => p.x > min.x && p.x < max.x && p.z > min.z && p.z < max.z;

/** Le pas p0 -> p1 entre-t-il dans l'intérieur de la boîte ? Sortir d'une boîte où l'on se trouve déjà reste permis. */
function entersBox(p0: Vec2, p1: Vec2, min: Vec2, max: Vec2): boolean {
  if (inside(p0, min, max)) return false;
  let t0 = 0, t1 = 1;
  const axes: ReadonlyArray<readonly [number, number, number, number]> = [[p0.x, p1.x - p0.x, min.x, max.x], [p0.z, p1.z - p0.z, min.z, max.z]];
  for (const [o, dv, lo, hi] of axes) {
    if (dv === 0) { if (o <= lo || o >= hi) return false; continue; }
    const ta = (lo - o) / dv, tb = (hi - o) / dv;
    t0 = Math.max(t0, Math.min(ta, tb));
    t1 = Math.min(t1, Math.max(ta, tb));
  }
  return t1 > t0;
}

function blocked(from: Vec2, to: Vec2, blockers: readonly Blocker[]): boolean {
  return blockers.some((k) => (k.kind === 'segment' ? crossesSegment(from, to, k.a, k.b) : entersBox(from, to, k.min, k.max)));
}

/**
 * Un pas de marche. `dtMs` est borné à `d.maxDtMs` (un onglet en arrière-plan ne téléporte pas). Diagonale normalisée. Un pas bloqué glisse
 * le long du mur (axe x puis axe z). `moving` vaut vrai si le joueur a réellement bougé. Le cap vaut 0 face à -z et croît vers l'est ;
 * sans touche utile il vaut 0, l'appelant garde le dernier cap de marche.
 */
export function stepWalk(pos: Vec2, input: WalkInput, d: WalkData, blockers: readonly Blocker[]): { readonly pos: Vec2; readonly heading: number; readonly moving: boolean } {
  const ix = input.dir !== undefined ? input.dir.x : (held(input.keys, RIGHT) ? 1 : 0) - (held(input.keys, LEFT) ? 1 : 0);
  const iz = input.dir !== undefined ? input.dir.z : (held(input.keys, BACK) ? 1 : 0) - (held(input.keys, FORWARD) ? 1 : 0);
  if (ix === 0 && iz === 0) return { pos, heading: 0, moving: false };
  const norm = Math.sqrt(ix * ix + iz * iz);
  const dt = Number.isFinite(input.dtMs) ? Math.min(Math.max(input.dtMs, 0), d.maxDtMs.v) : 0;
  const step = (d.speedMps.v * dt) / 1000;
  const dx = (ix / norm) * step, dz = (iz / norm) * step;
  const heading = Math.atan2(ix, -iz);
  const full: Vec2 = { x: pos.x + dx, z: pos.z + dz };
  let next = pos;
  if (!blocked(pos, full, blockers)) next = full;
  else {
    const slideX: Vec2 = { x: pos.x + dx, z: pos.z };
    const slideZ: Vec2 = { x: pos.x, z: pos.z + dz };
    if (dx !== 0 && !blocked(pos, slideX, blockers)) next = slideX;
    else if (dz !== 0 && !blocked(pos, slideZ, blockers)) next = slideZ;
  }
  return { pos: next, heading, moving: next.x !== pos.x || next.z !== pos.z };
}

/** Options de {@link resumeSpot} : marge de contact, pas de la grille de recherche, rectangle où la joueuse peut être. */
export interface ResumeSpotOptions {
  readonly clearanceM: number;
  readonly cellM: number;
  readonly bounds: { readonly min: Vec2; readonly max: Vec2 };
}

const sq = (x: number, z: number): number => x * x + z * z;

/** Carré de la distance du point à l'obstacle : 0 dedans ou dessus (aucune racine : les carrés se comparent tels quels). */
function distance2To(p: Vec2, k: Blocker): number {
  if (k.kind === 'box') return sq(Math.max(k.min.x - p.x, 0, p.x - k.max.x), Math.max(k.min.z - p.z, 0, p.z - k.max.z));
  const ex = k.b.x - k.a.x, ez = k.b.z - k.a.z, len2 = ex * ex + ez * ez;
  const u = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - k.a.x) * ex + (p.z - k.a.z) * ez) / len2));
  return sq(p.x - (k.a.x + u * ex), p.z - (k.a.z + u * ez));
}

/**
 * Position de reprise de la rue [demande Cynthia 2026-11-03]. Rend `at` s'il est dans `bounds`, à plus de `clearanceM` de tout obstacle, et relié
 * à `entry` par une marche sans traverser d'obstacle (recherche en largeur sur une grille de pas `cellM` partie de `entry`, mêmes règles de
 * passage que {@link stepWalk}). Sinon rend `entry` : une joueuse collée à un mur, enfermée ou hors de la rue repart de l'entrée.
 */
export function resumeSpot(at: Vec2, entry: Vec2, blockers: readonly Blocker[], o: ResumeSpotOptions): Vec2 {
  const { min, max } = o.bounds;
  const within = (p: Vec2): boolean => p.x >= min.x && p.x <= max.x && p.z >= min.z && p.z <= max.z;
  if (!within(at) || blockers.some((k) => distance2To(at, k) <= o.clearanceM * o.clearanceM)) return entry;
  const c = o.cellM, key = (i: number, j: number): string => `${i},${j}`;
  const seen = new Set<string>([key(0, 0)]);
  const queue: Array<readonly [number, number]> = [[0, 0]];
  const pos = (i: number, j: number): Vec2 => ({ x: entry.x + i * c, z: entry.z + j * c });
  for (let n = 0; n < queue.length; n++) {
    const [i, j] = queue[n]!, p = pos(i, j);
    if (sq(p.x - at.x, p.z - at.z) <= c * c && !blocked(p, at, blockers)) return at;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nj = j + dj, q = pos(ni, nj);
      if (seen.has(key(ni, nj)) || !within(q) || blocked(p, q, blockers)) continue;
      seen.add(key(ni, nj)); queue.push([ni, nj]);
    }
  }
  return entry;
}

function wallZ(d: SceneData): number {
  const w = d.interactions['wall'];
  if (w === undefined) throw new Error('scène sans position pour le mur du checkpoint (interactions.wall)');
  return w.at.v.z;                                 // égal à street.checkpoint.z, recoupé par parseScene
}

/**
 * Barrière du checkpoint : un mur sur toute la largeur de la rue à z = checkpoint, fermé tant que `queuePositionOf` rend `null`
 * (aucun acte `lane` du jour), ouvert sinon. `lanesOpen` n'y est pour rien.
 */
export function barrierBlockers(reading: QueuePosition | null, d: SceneData): readonly Blocker[] {
  if (reading !== null) return [];
  const z = wallZ(d), hw = d.layout.halfWidthM.v;
  return [{ kind: 'segment', a: { x: -hw, z }, b: { x: hw, z } }];
}

/**
 * Enceinte de la rue : les deux murs latéraux ET les deux bouts (z = zMin et z = zMax). Sans les bouts, rien n'arrêtait le joueur
 * au-delà de `zMax` (z = 64,8 pour un plafond de 44, mesuré par T13) : `stepWalk` ne borne rien lui-même, il ne connaît que ses obstacles.
 */
export function streetBounds(d: SceneData): readonly Blocker[] {
  const hw = d.layout.halfWidthM.v, z0 = d.layout.zMin.v, z1 = d.layout.zMax.v;
  return [
    { kind: 'segment', a: { x: hw, z: z0 }, b: { x: hw, z: z1 } }, { kind: 'segment', a: { x: -hw, z: z0 }, b: { x: -hw, z: z1 } },
    { kind: 'segment', a: { x: -hw, z: z0 }, b: { x: hw, z: z0 } }, { kind: 'segment', a: { x: -hw, z: z1 }, b: { x: hw, z: z1 } },
  ];
}

/**
 * Décor plein du checkpoint : le mur de télés (face avant à `z + depth / 2`, contre la face ouest de la guérite) et la guérite, d'un seul bloc.
 * Sans lui, rien n'arrêtait le joueur avant le segment de la barrière (z = checkpoint) : il passait à travers les télés, finissait derrière
 * le mur et la caméra n'en montrait que la face avant, plein cadre. La boîte est élargie du rayon du corps (`walk.bodyRadiusM`) : le joueur
 * est un point. Le passage est à l'ouest du mur (x < bord ouest) ou à l'est de la guérite.
 */
export function checkpointSolids(d: SceneData): readonly Blocker[] {
  const c = d.checkpoint, z = d.interactions['wall']!.at.v.z, r = d.walk.bodyRadiusM.v;
  const left = c.boothX.v - c.booth.widthM.v / 2 - c.wall.widthM, right = c.boothX.v + c.booth.widthM.v / 2;
  return [{ kind: 'box', min: { x: left - r, z: z - c.booth.depthM.v / 2 - r }, max: { x: right + r, z: z + c.booth.depthM.v / 2 + r } }];
}

/**
 * Bras de la barrière, baissé (même pose que `render/scene/checkpoint.ts`) : du poteau `barrierPostX` vers l'ouest sur `barrierM`, à `2 x postM` devant
 * la guérite, élargi du rayon du corps. Sans lui le joueur traversait le bras, dans l'axe de la file comme dans le passage est [retour Cynthia,
 * build 35ed56c]. Séparé de `checkpointSolids` pour qu'un bras LEVÉ (séquence « through ») le retire sans toucher au reste : qui lève le bras
 * à l'image ne passe pas `barrierArmSolid` aux obstacles.
 */
export function barrierArmSolid(d: SceneData): Blocker {
  const c = d.checkpoint, z = d.interactions['wall']!.at.v.z, r = d.walk.bodyRadiusM.v;
  const armZ = z + c.booth.depthM.v / 2 + c.barrier.postM.v * 2, t = c.barrier.armThicknessM.v / 2, post = c.barrierPostX.v;
  return { kind: 'box', min: { x: post - c.barrierM.v - r, z: armZ - t - r }, max: { x: post + r, z: armZ + t + r } };
}

/**
 * Décors pleins de la rue : les boîtes de `solids` (données) et les mâts de lampadaire (`lampPositions`, rayon `build.mastRadiusM`, donné par leur
 * carré), chacun élargi du rayon du corps. Les passants et la file ne s'y heurtent pas (test) ; le joueur, lui, ne les traverse plus.
 */
export function propSolids(d: SceneData): readonly Blocker[] {
  const r = d.walk.bodyRadiusM.v;
  const box = (x: number, z: number, hw: number, hd: number): Blocker => ({ kind: 'box', min: { x: x - hw - r, z: z - hd - r }, max: { x: x + hw + r, z: z + hd + r } });
  const out: Blocker[] = Object.values(d.solids).map(({ v }) => {
    const c = v.at !== undefined ? d.interactions[v.at]!.at.v : { x: v.x!, z: v.z! };
    return box(c.x, c.z, v.w / 2, v.d / 2);
  });
  const mastX = d.layout.halfWidthM.v - 0.4, m = d.build.mastRadiusM.v;
  for (const l of lampPositions(d)) out.push(box((l.side === 'east' ? 1 : -1) * mastX, l.z, m, m));
  return out;
}

/** Tout ce qui est plein pour le joueur dans la rue : le mur de télés et la guérite, le bras de la barrière s'il est baissé (`armDown`), puis les autres décors. */
export const solidBlockers = (d: SceneData, armDown = true): readonly Blocker[] => [...checkpointSolids(d), ...(armDown ? [barrierArmSolid(d)] : []), ...propSolids(d)];

/** Le joueur est-il dans le couloir de file ? Côté entrée du mur (z croissant) sur `queue.lengthM`, à `queue.halfWidthM` de l'axe. */
export function inQueueLane(pos: Vec2, scene: SceneData): boolean {
  const z0 = wallZ(scene);
  return Math.abs(pos.x) <= scene.queue.halfWidthM.v && pos.z >= z0 && pos.z <= z0 + scene.queue.lengthM.v;
}

/** Les trois drapeaux que l'horloge attend ; l'ordre de priorité est dans `activityOf` du moteur. */
export function activityInput(moving: boolean, player: Vec2, d: SceneData, dialogueOpen: boolean): { readonly moving: boolean; readonly inQueue: boolean; readonly inDialogue: boolean } {
  return { moving, inQueue: inQueueLane(player, d), inDialogue: dialogueOpen };
}
