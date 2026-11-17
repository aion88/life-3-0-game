/**
 * Foule, file et présence des personnages de la rue [plan 02a T7]. Pur et déterministe : ni DOM, ni horloge, ni hasard non seedé.
 * La position d'un passant est une FONCTION du temps `tMs` (jamais un état intégré) : deux appels au même `tMs` rendent la même foule,
 * et une reprise ne fait pas sauter les passants. Le hasard vient de `mulberry32(seed)` (plan 00), tiré dans un ordre fixe.
 * `reduceAct` reste seul maître de l'horloge : la file affichée rejoint la position du moteur par `easeToward`, jamais l'inverse.
 */
import { mulberry32 } from '../../shared/rng';
import type { StreetData } from '../../data/schema/street';
import type { Palier } from '../../survival/integrity';
import type { DayIndex } from '../../shared/types/street';
import { presentAt } from '../moments/npcs';
import type { Vec2 } from '../moments/types';
import type { SceneData } from './sceneSchema';
import { propSolids, type Blocker } from './walk';

/** Identifiant du corps de la joueuse [R-02a.12]. */
export const PLAYER_BODY_ID = 'player';

/** Une personne à dessiner : identifiant stable, corps, position au sol, cap (0 face à -z, croît vers l'est, comme `stepWalk`). */
export interface PersonView { readonly id: string; readonly bodyId: string; readonly pos: Vec2; readonly heading: number }

/** Les PNJ présents (personnes seulement, jamais un véhicule) : `presentAt` décide qui, `scene.npcPlaces` où. */
export function npcsPresent(street: StreetData, d: SceneData, day: DayIndex, minute: number, palier: Palier): readonly { id: string; bodyId: string; pos: Vec2 }[] {
  const out: { id: string; bodyId: string; pos: Vec2 }[] = [];
  for (const n of street.npcs) {
    const place = d.npcPlaces[n.id];
    if (place === undefined || place.kind !== 'person') continue;
    if (presentAt(n.id, day, minute, palier, street)) out.push({ id: n.id, bodyId: place.bodyId, pos: place.at.v });
  }
  return out;
}

function wallZ(d: SceneData): number {
  const w = d.interactions['wall'];
  if (w === undefined) throw new Error('scène sans position pour le mur du checkpoint (interactions.wall)');
  return w.at.v.z;
}

const mod = (a: number, m: number): number => ((a % m) + m) % m;

/**
 * Les passants. Ils vont et viennent entre le fond de la rue et la fin du couloir de file (côté logement du mur : ils ne traversent
 * ni le mur du checkpoint, ni le couloir), en aller-retour continu (onde triangulaire : aucun saut aux bouts). Ils restent à
 * `2 x queue.halfWidthM` des murs, ce qui les tient à distance des lieux d'attente des PNJ (x = ±6).
 */
export function crowdAt(d: SceneData, tMs: number, seed: number): readonly PersonView[] {
  const rng = mulberry32(seed);
  const n = d.crowd.moving.v;
  const bodies = d.characters.crowdBodies.v;
  const edge = d.layout.halfWidthM.v - 2 * d.queue.halfWidthM.v;
  const zLo = wallZ(d) + d.queue.lengthM.v, zHi = d.layout.zMax.v;
  const span = zHi - zLo;
  const solids = propSolids(d).filter((b) => b.kind === 'box' && b.max.z > zLo && b.min.z < zHi);
  const out: PersonView[] = [];
  for (let i = 0; i < n; i++) {
    let x = (rng() * 2 - 1) * edge;
    for (const b of solids) if (b.kind === 'box' && x > b.min.x && x < b.max.x) x = x - b.min.x < b.max.x - x ? b.min.x : b.max.x;   // la voie du passant contourne les décors pleins (empreinte + rayon du corps)
    const phase = rng() * 2 * span;
    const pace = d.crowd.paceMin.v + rng() * (d.crowd.paceMax.v - d.crowd.paceMin.v);
    const body = bodies[Math.floor(rng() * bodies.length)] as string;
    const u = mod(phase + (pace * d.walk.speedMps.v * tMs) / 1000, 2 * span);
    const towardStreetEnd = u < span;              // première moitié : z croît vers le fond de la rue
    const z = towardStreetEnd ? zLo + u : zHi - (u - span);
    out.push({ id: `passerby.${i}`, bodyId: body, pos: { x, z }, heading: towardStreetEnd ? Math.PI : 0 });
  }
  return out;
}

/** Position (z) de la place `i` de la file à `permille` : un pas de 0,8 m, la tête à `queueHeadZ` à 1000 pour mille (devant le mur de télés). */
function baseZ(d: SceneData, permille: number, i: number): number {
  const n = d.crowd.queue.v, step = d.crowd.queueSpacingM.v;
  const p = Math.min(Math.max(permille, 0), 1000) / 1000;
  return d.crowd.queueHeadZ.v + step * i + (n - 1) * step * (1 - p);
}

/** Les silhouettes de la file sans le joueur : `queue.v` places à `queueSpacingM`, sur x = `queueXM`, devant le checkpoint. `permille` vient de `QueuePosition`. */
export function queueSlots(d: SceneData, permille: number): readonly Vec2[] {
  return Array.from({ length: d.crowd.queue.v }, (_, i) => ({ x: d.crowd.queueXM.v, z: baseZ(d, permille, i) }));
}

/** Écart en z qu'un voisin doit garder au joueur : nul à `queueMinGapM` de l'axe de la file (x = `queueXM`), plein sur l'axe (cercle de rayon `queueMinGapM`). */
function reachZ(d: SceneData, player: Vec2): number {
  const g = d.crowd.queueMinGapM.v, dx = player.x - d.crowd.queueXM.v;
  return Math.abs(dx) >= g ? 0 : Math.sqrt(g * g - dx * dx);
}

/** Écart de chaque voisin à sa place (`offs`) et position montrée (`zs`), rang 0 = tête. */
export interface QueueState { readonly offs: readonly number[]; readonly zs: readonly number[] }

/**
 * Un pas de la file avec le joueur (`prev` vaut `null` au premier pas : la file part de ses places). La file est droite (tous à x = `crowd.queueXM`) ;
 * le joueur n'a pas de place fixe mais une place RÉSERVÉE : à chaque pas,
 *   1. l'écart de chaque voisin à sa place se résorbe au taux `view.easeRatePerS`, sans dépasser la vitesse de marche (`walk.speedMps`) : un voisin
 *      repoussé revient en marchant, jamais par saut. L'avance de la file (`permille`) déplace les places, pas cet écart ;
 *   2. un voisin reste du côté du joueur où il était (devant = côté mur) et ne s'en approche pas à moins de `reachZ` ; ceux de devant se
 *      serrent d'un pas les uns contre les autres, ceux de derrière reculent d'un pas les uns derrière les autres : l'ordre est conservé et
 *      l'écart avec le voisin suivant reste au moins un pas (donc au moins `queueMinGapM`).
 * Un voisin ne traverse le joueur que lorsque le joueur est hors de l'emprise de la file (`|x - queueXM| >= queueMinGapM`, `reachZ` nul) : il passe alors
 * à côté de lui, à plus de `queueMinGapM`. À chaque pas, tous les corps sont donc à `queueMinGapM` au moins du joueur et les uns des autres.
 * Les voisins de devant ne descendent pas sous leur place d'avance complète : `queueBlockers` ferme le passage au joueur avant.
 */
export function stepQueue(d: SceneData, prev: QueueState | null, permille: number, player: Vec2, dtMs: number): QueueState {
  const n = d.crowd.queue.v, step = d.crowd.queueSpacingM.v, rate = d.view.easeRatePerS.v, r = reachZ(d, player);
  const maxMove = (d.walk.speedMps.v * Math.min(Math.max(dtMs, 0), d.walk.maxDtMs.v)) / 1000;
  const base = Array.from({ length: n }, (_, i) => baseZ(d, permille, i));
  const side = prev === null ? base : prev.zs;
  const z = base.map((b, i) => {
    if (prev === null) return b;
    const o = prev.offs[i] ?? 0;
    const back = Math.min(Math.abs(o), Math.abs(easeToward(o, 0, dtMs, rate) - o), maxMove);   // retour vers la place, plafonné à la vitesse de marche
    return b + o - Math.sign(o) * back;
  });
  if (r > 0) {
    const nAhead = side.filter((w) => w < player.z).length;    // le côté de chacun est celui d'AVANT le rappel : il ne le fait pas traverser le joueur
    let lim = player.z - r;                                    // devant le joueur : du plus proche au plus loin, chacun un pas derrière le précédent
    for (let i = nAhead - 1; i >= 0; i--) { z[i] = Math.min(z[i]!, lim); lim = z[i]! - step; }
    lim = player.z + r;                                        // derrière le joueur : du plus proche au plus loin
    for (let i = nAhead; i < n; i++) { z[i] = Math.max(z[i]!, lim); lim = z[i]! + step; }
  }
  return { offs: z.map((v, i) => v - base[i]!), zs: z };
}

/** Les voisins comme positions de la vue (file droite). */
export const queuePositions = (d: SceneData, zs: readonly number[]): readonly Vec2[] => zs.map((z) => ({ x: d.crowd.queueXM.v, z }));

/**
 * Obstacle que la file oppose au joueur : la boîte de l'emprise de la file, du mur jusqu'à `queueMinGapM` derrière le dernier voisin de devant
 * serré contre le mur. Le joueur ne dépasse pas ses voisins en restant dans la file ; il peut les contourner (`|x - queueXM| >= queueMinGapM`).
 */
export function queueBlockers(d: SceneData, zs: readonly number[], player: Vec2): readonly Blocker[] {
  const ahead = zs.filter((z) => z < player.z).length;
  if (ahead === 0) return [];
  const g = d.crowd.queueMinGapM.v, head = d.crowd.queueHeadZ.v;
  return [{ kind: 'box', min: { x: d.crowd.queueXM.v - g, z: head - 1 }, max: { x: d.crowd.queueXM.v + g, z: head + d.crowd.queueSpacingM.v * (ahead - 1) + g } }];
}

/** exp(-x) pour x >= 0 par réduction d'argument et série de Taylor : le moteur n'a pas droit à `Math.exp` [GDD 03 §4]. */
function expNeg(x: number): number {
  let halvings = 0, y = x;
  while (y > 0.5) { y /= 2; halvings++; }
  let term = 1, sum = 1;
  for (let k = 1; k <= 12; k++) { term = (term * -y) / k; sum += term; }
  for (let h = 0; h < halvings; h++) sum *= sum;
  return sum;
}

/** Rapproche `shown` de `target` : `1 - exp(-rate x dt)` de l'écart par pas (`dtMs` en ms, `ratePerS` par seconde). La vue suit le moteur, jamais l'inverse. */
export function easeToward(shown: number, target: number, dtMs: number, ratePerS: number): number {
  const dt = Math.max(dtMs, 0);
  return shown + (target - shown) * (1 - expNeg((ratePerS * dt) / 1000));
}

/** Rotation autour de Y d'un corps glTF (face à +Z local) pour qu'il regarde dans la direction du cap du moteur (0 face à -z, croît vers l'est). */
export function facingYaw(heading: number): number {
  return Math.PI - heading;
}
