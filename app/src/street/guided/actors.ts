/**
 * Corps de la rue guidée [spec rue guidée J1-J2 §4.3, plan T14] : la joueuse marche seule d'un lieu nommé à l'autre (aucune touche de marche),
 * la personne de la scène se tient à son poste. Pur : ni DOM ni Three.js. La direction et les solides viennent de `stepWalk` (`walk.ts`), la vitesse
 * de `scene.walk.speedMps` ; aucun nombre en dur.
 *
 * Lieux : `scene.guided.places[place]` est le point où la joueuse se tient (dans le logement, au palier, ou côté rue de l'objet ou de la
 * personne, voir la donnée). Dans la rue, la personne se tient à son lieu d'attente (`npcPlaces`) quand elle en a un, sinon à une demi-portée
 * d'interaction du point de la joueuse, côté façade. Dans un immeuble, dans la même pièce que la joueuse, jamais derrière une cloison.
 * À portée de parole, jamais sur la joueuse.
 */
import type { Vec2 } from '../../engine/moments/types';
import type { SceneData } from '../../engine/view/sceneSchema';
import { solidBlockers, stepWalk, streetBounds, type Blocker } from '../../engine/view/walk';

export interface Actors {
  /** Position de la joueuse. */
  player(): Vec2;
  /** Cap de la joueuse (convention de `stepWalk`). */
  heading(): number;
  /** Vrai pendant une marche qui avance (le clip `walk` joue). */
  moving(): boolean;
  /** Vrai tant qu'une marche n'est pas arrivée. */
  walking(): boolean;
  /** Pose la joueuse au lieu, sans marche (reprise, saut). */
  placeAt(place: string): void;
  /** Pose la joueuse en un point (fin d'une séquence jouée). */
  set(pos: Vec2): void;
  /** Lance la marche vers le lieu. */
  walkTo(place: string): void;
  /** Avance la marche de `dtMs` ; rend `true` à l'arrivée (une fois). Bloquée par un solide sans glissement possible : la pose finale est posée. */
  step(dtMs: number): boolean;
  /** Saut : la pose finale de la marche en cours, tout de suite. */
  finish(): void;
  /**
   * Un pas dans la direction `dir` (séquence jouée), mêmes solides que la marche, sauf le bras de la barrière quand la séquence l'a levé
   * (`armDown` faux, repère `barrier.up`) : sans cela la joueuse restait devant le bras levé à l'image [retour Cynthia 2026-11-08 (a)].
   */
  nudge(dir: Vec2, dtMs: number, armDown?: boolean): void;
}

/** Le point où la joueuse se tient pour la scène du lieu `place`. Un lieu absent des données est une faute nommée. */
export function placeSpot(scene: SceneData, place: string): Vec2 {
  const p = scene.guided.places[place];
  if (p === undefined) throw new Error(`actors : lieu guidé inconnu « ${place} » (scene.guided.places)`);
  return { x: p.v.x, z: p.v.z };
}

/** Vrai pour un point dans les immeubles (au-delà des murs latéraux de la rue, `layout.halfWidthM`) : logements, palier. */
export const insideBuilding = (scene: SceneData, p: Vec2): boolean => Math.abs(p.x) > scene.layout.halfWidthM.v;

/**
 * Où se tient la personne `actorId` d'une scène au lieu `place` (voir l'en-tête du module). Dans un immeuble (palier, logement, escalier), elle
 * vient à la joueuse : même pièce, même hauteur (z), une demi-portée plus loin de la façade (x). Son lieu d'attente de la rue (`npcPlaces`) n'y
 * vaut pas. Elle se tenait de l'autre côté de la cloison (z + demi-portée), ou dehors à son lieu d'attente : on lui parlait à travers un mur
 * [retour Cynthia 2026-11-08 (b) : « Tu parles à Madame Roux à travers un mur »]. Cloisons et façade vont en x (les logements se suivent en z),
 * un décalage en x ne les traverse donc jamais.
 */
export function actorSpot(scene: SceneData, place: string, actorId: string): Vec2 {
  const at = placeSpot(scene, place);
  const gap = scene.interact.interactRangeM.v / 2;
  if (insideBuilding(scene, at)) return { x: at.x + Math.sign(at.x) * gap, z: at.z };
  const own = scene.npcPlaces[actorId];
  if (own !== undefined) return { x: own.at.v.x, z: own.at.v.z };
  return at.x === 0 ? { x: at.x, z: at.z - gap } : { x: at.x + Math.sign(at.x) * gap, z: at.z };
}

/** Milieu du segment joueuse-personne : le foyer du plan `talk`. */
export const midpoint = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });

/**
 * Étapes d'une marche de `from` à `to`. Sortir d'un immeuble ou y entrer passe par la porte, au pied de la façade, à la hauteur (z) du
 * logement : la joueuse ne traverse ni cloisons ni logements voisins en longeant le mur. Dans le même immeuble ou dans la rue : en ligne droite.
 */
export function walkPath(scene: SceneData, from: Vec2, to: Vec2): readonly Vec2[] {
  const edge = scene.layout.halfWidthM.v - scene.walk.bodyRadiusM.v;
  const door = (q: Vec2): Vec2 => ({ x: Math.sign(q.x) * edge, z: q.z });
  const a = insideBuilding(scene, from), b = insideBuilding(scene, to);
  if (a && b && Math.sign(from.x) === Math.sign(to.x)) return [to];
  return [...(a ? [door(from)] : []), ...(b ? [door(to)] : []), to];
}

export function createActors(scene: SceneData, start: Vec2): Actors {
  let pos: Vec2 = start;
  let heading = 0;
  let moving = false;
  let path: Vec2[] = [];
  // les murs latéraux de la rue n'arrêtent pas une marche guidée : elle entre et sort des immeubles par la porte (`walkPath`) ; les bouts et les solides restent
  const bounds = streetBounds(scene).filter((k) => !(k.kind === 'segment' && k.a.x === k.b.x));
  const blockers: readonly Blocker[] = [...bounds, ...solidBlockers(scene)];
  const armUpBlockers: readonly Blocker[] = [...bounds, ...solidBlockers(scene, false)];   // bras levé par une séquence : seul le bras sort des solides
  const stopM = (scene.walk.speedMps.v * scene.walk.maxDtMs.v) / 1000;   // un pas plein : en deçà, l'étape est atteinte
  const arrive = (): true => { const end = path.at(-1); if (end !== undefined) pos = end; path = []; moving = false; return true; };
  return {
    player: () => pos,
    heading: () => heading,
    moving: () => moving,
    walking: () => path.length > 0,
    placeAt(place) { pos = placeSpot(scene, place); path = []; moving = false; },
    set(p) { pos = p; path = []; moving = false; },
    walkTo(place) { path = [...walkPath(scene, pos, placeSpot(scene, place))]; },
    step(dtMs) {
      const next = path[0];
      if (next === undefined) return false;
      const dx = next.x - pos.x, dz = next.z - pos.z;
      if (Math.hypot(dx, dz) <= stopM) { pos = next; path.shift(); if (path.length === 0) { moving = false; return true; } return false; }
      const s = stepWalk(pos, { keys: new Set(), dtMs, dir: { x: dx, z: dz } }, scene.walk, blockers);
      if (!s.moving && dtMs > 0) return arrive();   // un solide sans glissement : pas d'errance, la pose finale (comme « Passer »)
      pos = s.pos; moving = s.moving; if (s.moving) heading = s.heading;
      return false;
    },
    finish() { if (path.length > 0) arrive(); },
    nudge(dir, dtMs, armDown = true) {
      const s = stepWalk(pos, { keys: new Set(), dtMs, dir }, scene.walk, armDown ? blockers : armUpBlockers);
      pos = s.pos; moving = s.moving; if (s.moving) heading = s.heading;
    },
  };
}
