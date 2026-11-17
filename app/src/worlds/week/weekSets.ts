import { Group, PlaneGeometry, Vector3, type Material } from 'three';
import type { BuildWeekSet, SetMarks, WeekPlace, WeekProp, WeekSet } from './weekContracts';
import { createSetKit, type SetKit } from './weekSetKit';

/**
 * Decors de la semaine 1984 : sept lieux en primitives.
 *
 * PROVISOIRE : primitives, non valide par Cynthia, sous la reference Magnum
 * (`docs/project/conception/REFERENCE-MAGNUM.md`). Chaque lieu a sa dominante et
 * son opposition chaud-froid ; les images `public/illustrated/full-frame/w10-*.jpg`
 * n'ont servi que de reperes de composition.
 *
 * Conventions (celles du decor du controle) :
 * - metres, Y vers le haut, le cote ouvert (camera) est +Z ; un cap `yaw` vaut
 *   `atan2(dx, dz)` : 0 regarde +Z, PI regarde -Z ;
 * - aucune lumiere globale (le stage la pose) : seulement des lampes ponctuelles
 *   locales, liberees par `dispose()` ;
 * - `marks.npcs` suit l'ordre de la distribution de chaque lieu (voir `MARKS`) ;
 *   `at.y` n'est pas nul quand le PNJ se tient sur une marche (escalier) ;
 * - `marks.camera.offset` est relatif a `marks.camera.look`, comme dans le controle.
 *
 * @example
 * const set = buildWeekSet('parents', document);
 * scene.add(set.root);
 * player.position.copy(set.marks.player);
 * set.dispose();
 */

// ---------------------------------------------------------------------------
// Constantes : dimensions
// ---------------------------------------------------------------------------

type V3 = readonly [number, number, number];

/** Epaisseur des murs et du sol. */
const WALL_T = 0.16;
const FLOOR_T = 0.1;
/** Portes. */
const DOOR_W = 0.95;
const DOOR_H = 2.1;
const FRAME_T = 0.07;
const DOOR_LEAF_T = 0.05;
/** Marge de sol devant la piece, cote camera. */
const FRONT_PAD = 1.4;

/** Etalon du controle : lecteur et barriere (coordonnees d'origine, ne pas changer). */
const CONTROL_READER_POS: V3 = [-1.52, 0, 0.4];
const CONTROL_BARRIER_POS: V3 = [1.8, 0, 0];
/** Ouverture maximale du bras de barriere (rad) a t = 1. */
const BARRIER_OPEN_ANGLE = Math.PI * 0.48;
/** Texte initial du lecteur. */
const READER_IDLE_TEXT = 'PRÉSENTER';

/** Chez toi, 9-D. */
const HOME = { w: 5.2, d: 4.6, h: 2.8, doorX: 1.8, windowX: -1.0 } as const;
/** Palier. */
const LANDING = { w: 6.4, d: 3.0, h: 2.7, doorPlayerX: 2.4, doorRouxX: -0.5, doorNeighbourX: -2.4, recess: 1.0, tile: 0.8 } as const;
/** Rue. */
const STREET = { w: 14, d: 10, facadeZ: -5.3, facadeD: 0.6, facadeH: 6, benchX: -2.2, benchZ: -1.2, lampX: 2.2, lampZ: -1.0, stallX: 3.3, stallZ: -3.9 } as const;
/** Escalier. */
const STAIRS = { w: 4.2, d: 6, h: 3.4, steps: 12, rise: 0.17, run: 0.28, x0: -1.9, x1: -0.1, doorZ: 1.4 } as const;
/** Audition. */
const HEARING = { w: 4.8, d: 4.4, h: 2.9, tableW: 1.6, tableD: 0.85, tableH: 0.76, doorZ: 1.2 } as const;
/** Chez les parents. */
const PARENTS = { w: 5.6, d: 4.6, h: 2.8, doorZ: 0.4, tableX: 0.6, tableW: 1.8, tableD: 0.9, tableH: 0.76, windowX: 1.9 } as const;

// ---------------------------------------------------------------------------
// Constantes : couleurs (une dominante, une opposition, quelques accents par lieu)
// ---------------------------------------------------------------------------

/** Chez toi : bleu ardoise froid contre ambre de fenetre ; accents rouille. */
const HOME_COLORS = {
  wall: '#7d93a3', trim: '#d8d0bf', floor: '#8b6a4a', floorGrain: '#3d2a1c', curtain: '#c9952f',
  window: '#f0b45a', windowGlow: '#ffb050', blanket: '#a8553a', rug: '#a8553a', wood: '#5a4030',
  door: '#4b3d33', shade: '#ffd9a0', lamp: '#ffb866', bedFrame: '#3a3430',
} as const;
/** Palier : ocre institutionnel contre portes sarcelle, carrelage noir et creme. */
const LANDING_COLORS = {
  wall: '#c99a4b', trim: '#3b2e24', tileLight: '#d9cdb0', tileDark: '#26262b', doorTeal: '#2f7a7a',
  plaque: '#b99857', warm: '#e8a85a', coldGlass: '#7fc0c4', recessCold: '#16363a', doormat: '#7a3b2e',
  ceilingLamp: '#cfe0c0',
} as const;
/** Rue : facade rose et volets menthe, porte bleue, reverbere chaud. */
const STREET_COLORS = {
  asphalt: '#4a4f5a', paving: '#a69a96', facadePink: '#d98a9d', facadeMint: '#9cc9b4', shutter: '#6fae98',
  window: '#2b3b52', door: '#2c4f8a', bench: '#3f5f93', benchSlat: '#c6a46a', post: '#22282e', lampGlow: '#ffd890',
  lamp: '#ffd08a', awning: '#e8c34a', awningStripe: '#f2ead6', counter: '#7b5638', crate: '#b9824b', sill: '#efe3d2', knob: '#b99857',
} as const;
/** Escalier : menthe pale et vert dado, marches terre cuite, ampoule jaune. */
const STAIRS_COLORS = {
  wall: '#a9c8b8', dado: '#4f6b60', step: '#b55a3c', nosing: '#d8c8a8', rail: '#1c2024', floor: '#9a9a90',
  bulb: '#ffd45a', bulbLight: '#ffd45a', door: '#6d4a3a', cord: '#14181c',
} as const;
/** Audition : bleu-violet profond contre table rose creme et lampe jaune. */
const HEARING_COLORS = {
  wall: '#3c3f66', floor: '#c9c2b4', floorGrain: '#6a6560', table: '#e8c9c0', tableLeg: '#2a2d44', chair: '#6b6f93',
  lamp: '#fff1b0', shade: '#f4e7a8', mirror: '#1c2236', mirrorFrame: '#8d96a8', cabinet: '#7e8a91', door: '#2a2d44',
  clock: '#e9e2d0', trim: '#222640',
} as const;
/** Chez les parents : creme rose et terre cuite chauds, tapis vin, nuit bleue a la fenetre. */
const PARENTS_COLORS = {
  wall: '#e0b28f', stripe: '#d49a72', floor: '#9b6b45', floorGrain: '#4a2e1c', rug: '#7d2f3a', cloth: '#efe0c0',
  runner: '#b8473a', chair: '#7a4a2e', nightGlass: '#2d4a8a', nightGlow: '#4a6cc0', curtain: '#8d3a46', sideboard: '#5b3a28',
  frame: '#3a2a20', shade: '#ffd9a0', lamp: '#ffc77a', plate: '#f4efe6', pot: '#b0402e', bread: '#c9954a', door: '#6a4430',
  trim: '#f0e4d0',
} as const;
/** Controle : couleurs d'origine de `controlStationView.ts` (lignes 17-19, 40-52). */
const CONTROL_COLORS = {
  stone: '#a8aca3', stoneBase: '#a4b1aa', stoneGrain: '#4e7973', wall: '#c7b896', wallBase: '#cabd9e', wallGrain: '#765b4e',
  deep: '#214f50', trim: '#18403f', cream: '#e5d4a5', brass: '#b99857', red: '#803a40', floor: '#b0aaa0',
  floorBase: '#aaa99b', floorGrain: '#42645e', glass: '#477c86', black: '#182d32', paving: '#525e5c',
  lampGlow: '#ffe4ad', lampEmissive: '#ffca78', lampLight: '#ffd8a0', signText: '#ecdfb7', signBg: '#1b4949',
  noticeText: '#e9d6ad', noticeBg: '#294d4c', screenBg: '#142a2b', screenDenied: '#edbd76', screenOk: '#c4e4aa',
  screenGlow: '#c6ddbd',
} as const;

// ---------------------------------------------------------------------------
// Constantes : reperes (marks) par lieu
// ---------------------------------------------------------------------------

interface MarkSpec {
  entry: V3;
  player: V3;
  /** Point que le joueur regarde (le cap en est derive). */
  playerFaces: V3;
  /** Un repere par PNJ, dans l'ordre de la distribution du lieu. */
  npcs: readonly V3[];
  /** Les PNJ regardent le joueur, ou la porte d'entree. */
  npcsFace: 'player' | 'entry';
  camera: { offset: V3; look: V3 };
  props: Partial<Record<WeekProp, V3>>;
}

const STAIR_STAND_Y = STAIRS.rise * 2;
const STAIR_STAND_Z = -STAIRS.run * 1.5;

/**
 * Reperes de chaque lieu. Ordre des PNJ : `rue` = [theodore, nadia],
 * `parents` = [maman, papa], les autres lieux = un seul PNJ (roux, marlene, bruno, agente).
 * `controle` n'a pas de PNJ.
 */
const MARKS: Record<WeekPlace, MarkSpec> = {
  'chez-toi': {
    entry: [HOME.doorX, 0, -HOME.d / 2 - 0.2],
    player: [0.9, 0, 0.6], playerFaces: [-0.7, 0, -0.4],
    npcs: [[-0.7, 0, -0.4]], npcsFace: 'player',
    camera: { offset: [1.6, 0.5, 4.2], look: [0.1, 1.1, 0.1] },
    props: {},
  },
  palier: {
    entry: [LANDING.doorPlayerX, 0, -LANDING.d / 2],
    player: [0.5, 0, -0.1], playerFaces: [LANDING.doorRouxX, 0, -1.35],
    npcs: [[LANDING.doorRouxX, 0, -1.35]], npcsFace: 'player',
    camera: { offset: [1.4, 0.45, 3.6], look: [0, 1.15, -0.6] },
    props: {},
  },
  rue: {
    entry: [0.6, 0, STREET.facadeZ + STREET.facadeD / 2 + 0.1],
    player: [0.7, 0, 0.5], playerFaces: [-0.8, 0, -0.7],
    npcs: [[-0.8, 0, -0.7], [STREET.stallX, 0, STREET.stallZ - 0.6]], npcsFace: 'player',
    camera: { offset: [1.8, 0.4, 5.0], look: [-0.1, 1.2, -0.3] },
    props: { lettre: [-0.05, 1.1, 0] },
  },
  controle: {
    entry: [-0.6, 0, 8.6],
    player: [-0.6, 0, 5.1], playerFaces: [-0.6, 0, -10],
    npcs: [], npcsFace: 'player',
    camera: { offset: [2.2, 1.55, 3.7], look: [-0.48, 0.98, 4.9] },
    props: {},
  },
  escalier: {
    entry: [-STAIRS.w / 2 - 0.2, 0, STAIRS.doorZ],
    player: [-1.0, 0, 0.9], playerFaces: [-1.0, STAIR_STAND_Y, STAIR_STAND_Z],
    npcs: [[-1.0, STAIR_STAND_Y, STAIR_STAND_Z]], npcsFace: 'player',
    camera: { offset: [2.6, 0.3, 3.2], look: [-0.95, 1.2, 0.2] },
    props: { dossier: [-0.9, 1.2, -0.05], stylo: [-0.8, 1.25, 0.15] },
  },
  audition: {
    entry: [-HEARING.w / 2 - 0.2, 0, HEARING.doorZ],
    player: [0, 0, 1.2], playerFaces: [0, 0, -1.0],
    npcs: [[0, 0, -1.0]], npcsFace: 'player',
    camera: { offset: [2.4, 0.5, 3.4], look: [0, 1.15, 0.1] },
    props: { dossier: [-0.4, HEARING.tableH + 0.04, 0.1], carnet: [0.35, HEARING.tableH + 0.04, 0.15] },
  },
  parents: {
    entry: [-PARENTS.w / 2 - 0.1, 0, PARENTS.doorZ],
    player: [-1.3, 0, 0.4], playerFaces: [PARENTS.tableX, 0, 0],
    npcs: [[0.3, 0, -0.95], [1.1, 0, -0.95]], npcsFace: 'entry',
    camera: { offset: [1.8, 0.5, 4.4], look: [-0.2, 1.1, -0.1] },
    props: {},
  },
};

const vec = (v: V3): Vector3 => new Vector3(v[0], v[1], v[2]);
const yawTo = (from: V3, to: V3): number => Math.atan2(to[0] - from[0], to[2] - from[2]);

/** Reperes du lieu : vecteurs neufs a chaque appel, caps derives des points regardes. */
function buildMarks(place: WeekPlace): SetMarks {
  const s = MARKS[place];
  const target = s.npcsFace === 'entry' ? s.entry : s.player;
  const props: Partial<Record<WeekProp, Vector3>> = {};
  for (const [id, at] of Object.entries(s.props) as [WeekProp, V3][]) props[id] = vec(at);
  return {
    entry: vec(s.entry),
    player: vec(s.player),
    playerYaw: yawTo(s.player, s.playerFaces),
    npcs: s.npcs.map((at) => ({ at: vec(at), yaw: yawTo(at, target) })),
    camera: { offset: vec(s.camera.offset), look: vec(s.camera.look) },
    props,
  };
}

// ---------------------------------------------------------------------------
// Aides de construction
// ---------------------------------------------------------------------------

interface Opening { center: number; width: number; height: number }

/** Mur le long de `axis` ('x' : fixe en z ; 'z' : fixe en x), de `lo` a `hi`, perce d'ouvertures. */
function wallRun(kit: SetKit, mat: Material, axis: 'x' | 'z', fixed: number, lo: number, hi: number, height: number, openings: readonly Opening[] = []): void {
  const put = (a0: number, a1: number, y0: number, y1: number): void => {
    if (a1 - a0 < 1e-3 || y1 - y0 < 1e-3) return;
    const len = a1 - a0, mid = (a0 + a1) / 2, h = y1 - y0, y = (y0 + y1) / 2;
    const o = axis === 'x' ? kit.box(len, h, WALL_T, mid, y, fixed, mat) : kit.box(WALL_T, h, len, fixed, y, mid, mat);
    o.name = 'wall';
  };
  let cursor = lo;
  for (const op of [...openings].sort((a, b) => a.center - b.center)) {
    put(cursor, op.center - op.width / 2, 0, height);
    put(op.center - op.width / 2, op.center + op.width / 2, op.height, height);
    cursor = op.center + op.width / 2;
  }
  put(cursor, hi, 0, height);
}

/** Chambranle (deux montants et une traverse) autour d'une ouverture. */
function doorFrame(kit: SetKit, mat: Material, axis: 'x' | 'z', fixed: number, op: Opening): void {
  const depth = WALL_T + 0.04;
  for (const side of [-1, 1]) {
    const c = op.center + side * (op.width / 2 + FRAME_T / 2);
    if (axis === 'x') kit.box(FRAME_T, op.height, depth, c, op.height / 2, fixed, mat);
    else kit.box(depth, op.height, FRAME_T, fixed, op.height / 2, c, mat);
  }
  if (axis === 'x') kit.box(op.width + FRAME_T * 2, FRAME_T, depth, op.center, op.height + FRAME_T / 2, fixed, mat);
  else kit.box(depth, FRAME_T, op.width + FRAME_T * 2, fixed, op.height + FRAME_T / 2, op.center, mat);
}

/** Sol d'une piece centree en x, dont le fond est en -d/2 ; il deborde de FRONT_PAD cote camera. */
function floorSlab(kit: SetKit, w: number, d: number, mat: Material): void {
  const o = kit.box(w, FLOOR_T, d + FRONT_PAD, 0, -FLOOR_T / 2, FRONT_PAD / 2, mat);
  o.name = 'floor';
}

function table(kit: SetKit, x: number, z: number, w: number, d: number, h: number, top: Material, leg: Material): void {
  const t = 0.06, l = 0.06;
  kit.box(w, t, d, x, h - t / 2, z, top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box(l, h - t, l, x + sx * (w / 2 - l), (h - t) / 2, z + sz * (d / 2 - l), leg);
}

/** Chaise : dossier cote -Z local ; `yaw` 0 regarde +Z. Dossier sous 1 m, pour ne rien masquer. */
function chair(kit: SetKit, x: number, z: number, yaw: number, mat: Material): void {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  kit.root.add(g);
  kit.box(0.42, 0.05, 0.42, 0, 0.45, 0, mat, g);
  kit.box(0.42, 0.42, 0.04, 0, 0.7, -0.19, mat, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box(0.04, 0.43, 0.04, sx * 0.18, 0.215, sz * 0.18, mat, g);
}

const finish = (kit: SetKit, place: WeekPlace, extra: Partial<Pick<WeekSet, 'setReader' | 'setBarrier'>> = {}): WeekSet => ({
  root: kit.root,
  marks: buildMarks(place),
  ...extra,
  dispose: () => kit.dispose(),
});

// ---------------------------------------------------------------------------
// Decors
// ---------------------------------------------------------------------------

function buildHome(doc: Document): WeekSet {
  const kit = createSetKit(doc), c = HOME_COLORS;
  const wall = kit.material(c.wall), trim = kit.material(c.trim), wood = kit.material(c.wood), curtain = kit.material(c.curtain);
  floorSlab(kit, HOME.w, HOME.d, kit.textured(c.floor, c.floor, c.floorGrain));
  const backZ = -HOME.d / 2, leftX = -HOME.w / 2, doorOp = { center: HOME.doorX, width: DOOR_W, height: DOOR_H };
  wallRun(kit, wall, 'x', backZ, leftX, HOME.w / 2, HOME.h, [doorOp]);
  wallRun(kit, wall, 'z', leftX, backZ, HOME.d / 2, HOME.h);
  doorFrame(kit, trim, 'x', backZ, doorOp);
  kit.box(DOOR_W, DOOR_H, DOOR_LEAF_T, HOME.doorX, DOOR_H / 2, backZ - WALL_T, kit.material(c.door));
  // Plinthes.
  kit.box(HOME.w, 0.12, 0.03, 0, 0.06, backZ + WALL_T / 2 + 0.015, trim);
  kit.box(0.03, 0.12, HOME.d, leftX + WALL_T / 2 + 0.015, 0.06, 0, trim);
  // Fenetre d'ambre : la seule grande source chaude, contre la dominante froide.
  const winGlow = kit.glow(c.window, c.windowGlow, 0.9);
  kit.box(1.3, 1.2, 0.04, HOME.windowX, 1.6, backZ + WALL_T / 2 + 0.02, winGlow);
  for (const dx of [-0.65, 0.65]) kit.box(0.06, 1.3, 0.07, HOME.windowX + dx, 1.6, backZ + WALL_T / 2 + 0.04, trim);
  for (const dx of [-0.95, 0.95]) kit.box(0.35, 1.5, 0.08, HOME.windowX + dx, 1.55, backZ + WALL_T / 2 + 0.06, curtain);
  // Table et deux chaises, coin arriere gauche.
  table(kit, -1.8, -1.6, 1.1, 0.7, 0.75, wood, wood);
  chair(kit, -1.8, -1.0, Math.PI, wood);
  chair(kit, -1.8, -2.15, 0, wood);
  // Lit le long du mur gauche.
  kit.box(1.0, 0.3, 2.0, -2.0, 0.25, 1.2, kit.material(c.bedFrame));
  kit.box(0.96, 0.14, 1.9, -2.0, 0.46, 1.2, kit.material(c.blanket));
  kit.box(0.7, 0.1, 0.4, -2.0, 0.58, 0.45, trim);
  // Tapis et etagere.
  kit.box(2.6, 0.012, 2.0, 0.1, 0.006, 0.1, kit.material(c.rug)).receiveShadow = true;
  kit.box(1.1, 0.04, 0.22, 0.2, 1.5, backZ + 0.2, wood);
  for (const [x, h] of [[-0.15, 0.22], [0.1, 0.3], [0.32, 0.18], [0.55, 0.26]] as const) kit.box(0.14, h, 0.16, x, 1.52 + h / 2, backZ + 0.2, kit.material(x > 0.2 ? c.curtain : c.trim));
  // Lampadaire.
  kit.cylinder(0.02, 1.6, 0.5, 0.8, -1.95, wood);
  kit.cylinder(0.2, 0.28, 0.5, 1.72, -1.95, kit.glow(c.shade, c.lamp, 0.9));
  kit.lamp(c.lamp, 3.5, 6, 0.5, 1.7, -1.9);
  return finish(kit, 'chez-toi');
}

function buildLanding(doc: Document): WeekSet {
  const kit = createSetKit(doc), c = LANDING_COLORS, L = LANDING;
  const wall = kit.material(c.wall), dark = kit.material(c.tileDark), teal = kit.material(c.doorTeal), trim = kit.material(c.trim);
  floorSlab(kit, L.w, L.d, kit.material(c.tileLight));
  const backZ = -L.d / 2, leftX = -L.w / 2;
  for (let ix = 0; ix < Math.round(L.w / L.tile); ix++) {
    for (let iz = 0; iz < Math.ceil((L.d + FRONT_PAD) / L.tile); iz++) {
      if ((ix + iz) % 2) kit.box(L.tile - 0.01, 0.012, L.tile - 0.01, leftX + L.tile * (ix + 0.5), 0.006, backZ + L.tile * (iz + 0.5), dark).receiveShadow = true;
    }
  }
  const doors: Opening[] = [
    { center: L.doorPlayerX, width: DOOR_W, height: DOOR_H },
    { center: L.doorRouxX, width: DOOR_W, height: DOOR_H },
  ];
  wallRun(kit, wall, 'x', backZ, leftX, L.w / 2, L.h, doors);
  // Bout de couloir a gauche : mur plein, fenetre froide.
  wallRun(kit, wall, 'z', leftX, backZ, L.d / 2 + FRONT_PAD, L.h);
  const cold = kit.glow(c.coldGlass, c.coldGlass, 0.7);
  kit.box(0.04, 1.2, 1.1, leftX + WALL_T / 2 + 0.02, 1.7, 0.2, cold);
  kit.box(0.06, 1.25, 0.05, leftX + WALL_T / 2 + 0.04, 1.7, 0.2, trim);
  // Deux logements ouverts (9-D, 9-C) : alcove, sombre et froide chez toi, chaude chez Mme Roux.
  const recessWarm = kit.glow(c.warm, c.warm, 0.8), recessCold = kit.material(c.recessCold);
  for (const [op, back] of [[doors[0], recessCold], [doors[1], recessWarm]] as const) {
    if (!op) continue;
    doorFrame(kit, trim, 'x', backZ, op);
    kit.box(op.width + 0.1, op.height, 0.05, op.center, op.height / 2, backZ - L.recess, back);
    for (const side of [-1, 1]) kit.box(0.05, op.height, L.recess, op.center + side * (op.width / 2 + 0.02), op.height / 2, backZ - L.recess / 2, wall);
  }
  // Porte fermee du 9-B.
  doorFrame(kit, trim, 'x', backZ, { center: L.doorNeighbourX, width: DOOR_W, height: DOOR_H });
  kit.box(DOOR_W, DOOR_H, DOOR_LEAF_T, L.doorNeighbourX, DOOR_H / 2, backZ + WALL_T / 2 + DOOR_LEAF_T, teal);
  // Plaques de numero.
  for (const [x, text] of [[L.doorPlayerX, '9-D'], [L.doorRouxX, '9-C'], [L.doorNeighbourX, '9-B']] as const) {
    const plate = kit.label(text, 0.3, 0.1, c.tileDark, c.plaque);
    plate.position.set(x + DOOR_W / 2 + 0.3, 1.6, backZ + WALL_T / 2 + 0.02);
  }
  // Paillasson de Mme Roux et plinthe.
  kit.box(0.9, 0.025, 0.6, L.doorRouxX, 0.012, backZ + 0.45, kit.material(c.doormat));
  kit.box(L.w, 0.14, 0.03, 0, 0.07, backZ + WALL_T / 2 + 0.015, trim);
  // Lumieres : tube froid au plafond, lumiere chaude de l'appartement de Mme Roux.
  kit.box(1.6, 0.05, 0.12, 0, L.h - 0.1, 0, kit.glow(c.ceilingLamp, c.ceilingLamp, 0.9));
  kit.lamp(c.ceilingLamp, 3, 7, 0, L.h - 0.3, 0);
  kit.lamp(c.warm, 4, 4, L.doorRouxX, 1.8, backZ - 0.2);
  return finish(kit, 'palier');
}

function buildStreet(doc: Document): WeekSet {
  const kit = createSetKit(doc), c = STREET_COLORS, S = STREET;
  floorSlab(kit, S.w, S.d - FRONT_PAD, kit.material(c.asphalt, 0.95));
  // Trottoir le long des facades.
  kit.box(S.w, 0.02, 1.4, 0, 0.01, S.facadeZ + S.facadeD / 2 + 0.7, kit.material(c.paving)).receiveShadow = true;
  // Deux plans de facade : rose a droite, menthe a gauche, plus pres.
  const pink = kit.material(c.facadePink), mint = kit.material(c.facadeMint), shutter = kit.material(c.shutter), glass = kit.glow(c.window, c.window, 0.15), sill = kit.material(c.sill);
  kit.box(S.w * 0.6, S.facadeH, S.facadeD, S.w * 0.2, S.facadeH / 2, S.facadeZ, pink).name = 'wall';
  kit.box(S.w * 0.4, S.facadeH, S.facadeD, -S.w * 0.3, S.facadeH / 2, S.facadeZ + 0.45, mint).name = 'wall';
  const frontZ = S.facadeZ + S.facadeD / 2;
  for (const row of [2.0, 3.8]) {
    for (const x of [-6, -4.4, -2.8, 3.6, 5.0, 6.4]) {
      const z = x < 0 ? frontZ + 0.45 : frontZ;
      kit.box(0.8, 1.1, 0.04, x, row, z + 0.02, glass);
      kit.box(0.9, 0.06, 0.12, x, row - 0.58, z + 0.06, sill);
      for (const side of [-1, 1]) kit.box(0.34, 1.1, 0.04, x + side * 0.6, row, z + 0.03, shutter);
    }
  }
  // Porte bleue (entree du joueur).
  const doorX = MARKS.rue.entry[0];
  kit.box(1.1, 2.3, 0.08, doorX, 1.15, frontZ + 0.04, kit.material(c.door));
  kit.box(1.4, 0.1, 0.14, doorX, 2.35, frontZ + 0.07, sill);
  kit.cylinder(0.04, 0.05, doorX + 0.38, 1.1, frontZ + 0.1, kit.material(c.knob, 0.4, 0.6)).rotation.x = Math.PI / 2;
  // Banc de Theodore.
  const slat = kit.material(c.benchSlat), frame = kit.material(c.bench);
  for (const dz of [-0.18, 0, 0.18]) kit.box(1.5, 0.04, 0.12, S.benchX, 0.46, S.benchZ + dz, slat);
  kit.box(1.5, 0.3, 0.04, S.benchX, 0.75, S.benchZ - 0.24, slat);
  for (const dx of [-0.65, 0.65]) kit.box(0.06, 0.46, 0.5, S.benchX + dx, 0.23, S.benchZ - 0.04, frame);
  // Reverbere et sa lampe chaude.
  const post = kit.material(c.post, 0.5, 0.4);
  kit.cylinder(0.05, 3.2, S.lampX, 1.6, S.lampZ, post);
  kit.box(0.4, 0.04, 0.04, S.lampX - 0.18, 3.2, S.lampZ, post);
  kit.round(0.26, 0.4, 0.26, 0.04, S.lampX - 0.36, 3.15, S.lampZ, kit.glow(c.lampGlow, c.lamp, 1.0));
  kit.lamp(c.lamp, 6, 8, S.lampX - 0.36, 3.0, S.lampZ);
  // Etal de Nadia, au fond : comptoir, auvent raye, caisses.
  kit.box(1.8, 0.9, 0.6, S.stallX, 0.45, S.stallZ, kit.material(c.counter));
  for (const dx of [-0.85, 0.85]) kit.cylinder(0.03, 2.2, S.stallX + dx, 1.1, S.stallZ + 0.3, post);
  for (let i = 0; i < 6; i++) kit.box(0.3, 0.05, 1.0, S.stallX - 0.75 + i * 0.3, 2.25 - i * 0.0, S.stallZ + 0.1, kit.material(i % 2 ? c.awningStripe : c.awning));
  for (const dx of [-0.5, 0.1, 0.6]) kit.box(0.34, 0.2, 0.3, S.stallX + dx, 0.99, S.stallZ + 0.05, kit.material(c.crate));
  return finish(kit, 'rue');
}

function buildControl(doc: Document): WeekSet {
  const kit = createSetKit(doc), c = CONTROL_COLORS;
  const { box, round, cylinder, material } = kit;
  const stone = kit.textured(c.stone, c.stoneBase, c.stoneGrain);
  const wall = kit.textured(c.wall, c.wallBase, c.wallGrain);
  const deep = material(c.deep), trim = material(c.trim, 0.58, 0.2), cream = material(c.cream), brass = material(c.brass, 0.38, 0.65), red = material(c.red);
  const floor = kit.textured(c.floor, c.floorBase, c.floorGrain);
  const glass = material(c.glass, 0.26, 0.18), black = material(c.black), paving = material(c.paving);
  // Copie de `controlStationView.ts` lignes 25-53, memes coordonnees.
  box(18, 0.16, 36, 0, -0.1, -4, paving);
  box(7.3, 0.09, 24, 0, -0.015, -2, floor);
  for (let z = -12; z < 10; z += 0.9) {
    for (let x = -3.3; x < 3.5; x += 0.9) {
      const darkSlab = (Math.round((z + 12) / 0.9) + Math.round((x + 3.3) / 0.9)) % 5 === 0;
      box(0.884, 0.012, 0.884, x, 0.04, z, darkSlab ? stone : floor);
    }
  }
  for (const x of [-2.8, 2.8]) box(0.035, 0.018, 24, x, 0.055, -2, brass);
  box(0.45, 4.8, 26, -3.8, 2.4, -3, wall);
  box(0.45, 4.8, 26, 3.8, 2.4, -3, stone);
  for (const x of [-3.55, 3.55]) {
    box(0.1, 0.65, 26, x, 0.33, -3, deep);
    box(0.15, 0.07, 26, x, 0.72, -3, brass);
    box(0.25, 0.18, 26, x, 4.1, -3, cream);
    for (let z = -12; z <= 8; z += 3) {
      box(0.28, 4.15, 0.34, x, 2.1, z, deep);
      for (const dz of [-0.1, 0, 0.1]) box(0.045, 3.8, 0.018, x + (x < 0 ? 0.15 : -0.15), 2.1, z + dz, brass);
      const win = box(0.05, 2.45, 2.42, x + (x < 0 ? 0.05 : -0.05), 2.28, z + 1.5, glass);
      for (const y of [1.1, 2.2, 3.48]) box(0.11, 0.045, 2.5, win.position.x, y, z + 1.5, cream);
      for (const dz of [0.65, 1.5, 2.35]) box(0.11, 2.5, 0.035, win.position.x, 2.25, z + dz, trim);
    }
  }
  for (let z = -10; z <= 6; z += 2) {
    box(7.7, 0.22, 0.22, 0, 4.35, z, deep);
    for (let x = -3.2; x <= 3.3; x += 0.75) box(0.1, 0.09, 1.8, x, 4.4, z - 0.85, cream);
  }
  box(7.5, 4.8, 0.4, 0, 2.4, -13.2, red);
  for (const x of [-2.3, 0, 2.3]) {
    box(1.85, 3.3, 0.12, x, 1.85, -12.95, trim);
    box(1.6, 2.85, 0.08, x, 1.9, -12.86, glass);
    for (const dx of [-0.4, 0.4]) box(0.035, 2.9, 0.1, x + dx, 1.9, -12.8, brass);
  }
  kit.label('MÉTRO   /   LIGNE 04', 3.8, 0.55, c.signText, c.signBg).position.set(0, 3.85, -12.87);
  for (const z of [-8, -3, 4]) {
    for (const x of [-3.15, 3.15]) {
      cylinder(0.055, 2.7, x, 1.35, z, trim);
      round(0.22, 0.48, 0.22, 0.035, x, 2.65, z, kit.glow(c.lampGlow, c.lampEmissive, 0.8, 0.4));
      box(0.32, 0.05, 0.32, x, 2.92, z, black);
      box(0.32, 0.05, 0.32, x, 2.39, z, black);
    }
  }
  for (const z of [-8, 4.5]) {
    for (let i = 0; i < 5; i++) box(0.09, 0.07, 1.7, 2.65 + i * 0.11, 0.48, z, red);
    for (const zz of [z - 0.65, z + 0.65]) box(0.45, 0.44, 0.055, 2.85, 0.22, zz, trim);
  }
  round(0.55, 1.5, 0.45, 0.04, -3.05, 0.75, 3.1, deep);
  const notice = kit.label('SERVICE DU REGISTRE', 1.55, 0.28, c.noticeText, c.noticeBg);
  notice.position.set(-2.75, 2.2, 0);
  notice.rotation.y = 0.22;
  // Lecteur de titres.
  const reader = new Group();
  reader.name = 'station.reader';
  kit.root.add(reader);
  reader.position.set(...CONTROL_READER_POS);
  round(0.4, 1.04, 0.36, 0.045, 0, 0.52, 0, trim, reader);
  box(0.5, 0.06, 0.48, 0, 0.03, 0, brass, reader);
  round(0.4, 0.1, 0.37, 0.025, 0, 1.1, 0.02, black, reader).rotation.x = -0.25;
  const screenCv = kit.canvas2d(512, 256);
  const screenTex = kit.texture(screenCv.canvas);
  const screenMat = material('#ffffff', 0.45);
  screenMat.map = screenTex;
  screenMat.emissive.set(c.screenGlow);
  screenMat.emissiveMap = screenTex;
  screenMat.emissiveIntensity = 0.35;
  const screen = kit.mesh(new PlaneGeometry(0.3, 0.15), screenMat, reader);
  screen.position.set(0, 1.16, 0.065);
  screen.rotation.x = -Math.PI / 2 + 0.25;
  const setReader = (text: string, ok: boolean): void => {
    const x = screenCv.ctx;
    if (!x) return; // happy-dom : pas de contexte 2D, rien a dessiner.
    x.fillStyle = c.screenBg;
    x.fillRect(0, 0, 512, 256);
    x.fillStyle = ok ? c.screenOk : c.screenDenied;
    x.font = '500 47px sans-serif';
    x.textAlign = 'center';
    x.fillText(text, 256, 140);
    screenTex.needsUpdate = true;
  };
  setReader(READER_IDLE_TEXT, false);
  // Barriere.
  const gate = new Group();
  gate.name = 'station.barrier';
  kit.root.add(gate);
  gate.position.set(...CONTROL_BARRIER_POS);
  round(0.3, 1.08, 0.34, 0.04, 0, 0.54, 0, trim, gate);
  cylinder(0.09, 0.13, 0, 1.14, 0, brass, gate);
  const arm = new Group();
  arm.name = 'station.barrier.arm';
  arm.position.set(0, 0.96, 0);
  gate.add(arm);
  const axle = cylinder(0.14, 0.39, 0, 0.96, 0, brass, gate);
  axle.rotation.x = Math.PI / 2;
  for (let i = 0; i < 10; i++) round(0.34, 0.105, 0.11, 0.012, -0.17 - i * 0.34, 0, 0, i % 2 ? black : cream, arm);
  for (const x of [-3.5, 2.15]) {
    box(x < 0 ? 1.6 : 1.35, 0.07, 0.06, x < 0 ? -2.7 : 2.8, 0.9, 0, brass);
    for (let dx = -0.5; dx < 0.6; dx += 0.25) cylinder(0.014, 0.9, (x < 0 ? -2.7 : 2.8) + dx, 0.45, 0, trim);
  }
  const setBarrier = (t: number): void => {
    arm.rotation.z = -BARRIER_OPEN_ANGLE * Math.min(1, Math.max(0, t));
  };
  setBarrier(0);
  // Lampes de la ligne (controlStationView.ts ligne 55).
  for (const z of [-7, 2]) kit.lamp(c.lampLight, 5, 7, -3, 2.6, z);
  return finish(kit, 'controle', { setReader, setBarrier });
}

function buildStairs(doc: Document): WeekSet {
  const kit = createSetKit(doc), c = STAIRS_COLORS, S = STAIRS;
  const wall = kit.material(c.wall), dado = kit.material(c.dado), step = kit.material(c.step, 0.9), nosing = kit.material(c.nosing), rail = kit.material(c.rail, 0.4, 0.5);
  floorSlab(kit, S.w, S.d, kit.material(c.floor));
  const backZ = -S.d / 2 + 0.2, leftX = -S.w / 2 + 0.2;
  const doorOp = { center: S.doorZ, width: DOOR_W, height: DOOR_H };
  wallRun(kit, wall, 'x', backZ, leftX, S.w / 2, S.h);
  wallRun(kit, wall, 'z', leftX, backZ, S.d / 2 + FRONT_PAD - 0.4, S.h, [doorOp]);
  doorFrame(kit, kit.material(c.dado), 'z', leftX, doorOp);
  kit.box(DOOR_LEAF_T, DOOR_H, DOOR_W, leftX - WALL_T, DOOR_H / 2, S.doorZ, kit.material(c.door));
  // Soubassement vert sombre.
  kit.box(0.04, 1.0, S.d, leftX + WALL_T / 2 + 0.02, 0.5, 0, dado);
  kit.box(S.w, 1.0, 0.04, 0, 0.5, backZ + WALL_T / 2 + 0.02, dado);
  // Volee de marches contre le mur gauche.
  const width = S.x1 - S.x0, cx = (S.x0 + S.x1) / 2;
  for (let i = 0; i < S.steps; i++) {
    const h = S.rise * (i + 1);
    kit.box(width, h, S.run, cx, h / 2, -S.run / 2 - i * S.run, step);
    kit.box(width, 0.03, 0.05, cx, h + 0.005, -i * S.run - 0.03, nosing);
  }
  // Rampe sur le bord libre.
  const length = Math.hypot(S.steps * S.run, S.steps * S.rise);
  const slope = Math.atan2(S.steps * S.rise, S.steps * S.run);
  const handrail = kit.box(0.05, 0.05, length, S.x1 + 0.05, 0.95 + (S.steps * S.rise) / 2, -(S.steps * S.run) / 2, rail);
  handrail.rotation.x = slope;
  for (let i = 0; i <= S.steps; i += 3) kit.box(0.04, 0.85, 0.04, S.x1 + 0.05, 0.43 + S.rise * i, -i * S.run, rail);
  // Ampoule nue au-dessus du palier de Bruno.
  kit.cylinder(0.008, 0.9, -1.0, 3.0, -0.4, kit.material(c.cord));
  kit.round(0.16, 0.2, 0.16, 0.04, -1.0, 2.5, -0.4, kit.glow(c.bulb, c.bulbLight, 1.2, 0.3));
  kit.lamp(c.bulbLight, 5, 7, -1.0, 2.45, -0.3);
  return finish(kit, 'escalier');
}

function buildHearing(doc: Document): WeekSet {
  const kit = createSetKit(doc), c = HEARING_COLORS, H = HEARING;
  const wall = kit.material(c.wall), trim = kit.material(c.trim);
  floorSlab(kit, H.w, H.d, kit.textured(c.floor, c.floor, c.floorGrain));
  const backZ = -H.d / 2, leftX = -H.w / 2, doorOp = { center: H.doorZ, width: DOOR_W, height: DOOR_H };
  wallRun(kit, wall, 'x', backZ, leftX, H.w / 2, H.h);
  wallRun(kit, wall, 'z', leftX, backZ, H.d / 2, H.h, [doorOp]);
  doorFrame(kit, trim, 'z', leftX, doorOp);
  kit.box(DOOR_LEAF_T, DOOR_H, DOOR_W, leftX - WALL_T, DOOR_H / 2, H.doorZ, kit.material(c.door));
  // Glace sans tain et horloge.
  kit.box(1.6, 1.0, 0.04, -1.4, 1.7, backZ + WALL_T / 2 + 0.02, kit.material(c.mirror, 0.1, 0.6));
  kit.box(1.7, 1.1, 0.03, -1.4, 1.7, backZ + WALL_T / 2 + 0.012, kit.material(c.mirrorFrame, 0.4, 0.5));
  kit.cylinder(0.2, 0.04, 1.2, 2.2, backZ + WALL_T / 2 + 0.03, kit.material(c.clock)).rotation.x = Math.PI / 2;
  // Classeur.
  kit.box(0.5, 1.3, 0.5, 1.7, 0.65, backZ + 0.35, kit.material(c.cabinet, 0.5, 0.5));
  // Table, deux chaises (derriere l'agente et derriere le joueur).
  table(kit, 0, 0.1, H.tableW, H.tableD, H.tableH, kit.material(c.table), kit.material(c.tableLeg));
  const seat = kit.material(c.chair);
  chair(kit, 0, -1.45, 0, seat);
  chair(kit, 0, 1.75, Math.PI, seat);
  // Lampe : cone blanc-jaune dur au-dessus de la table, seul eclat chaud dans la piece froide.
  kit.cylinder(0.008, 1.1, 0, 2.35, 0.1, kit.material(c.trim));
  kit.cylinder(0.28, 0.14, 0, 1.78, 0.1, kit.glow(c.shade, c.lamp, 1.2, 0.3));
  kit.lamp(c.lamp, 6, 7, 0, 1.6, 0.1);
  return finish(kit, 'audition');
}

function buildParents(doc: Document): WeekSet {
  const kit = createSetKit(doc), c = PARENTS_COLORS, P = PARENTS;
  const wall = kit.material(c.wall), trim = kit.material(c.trim), wood = kit.material(c.chair), curtain = kit.material(c.curtain);
  floorSlab(kit, P.w, P.d, kit.textured(c.floor, c.floor, c.floorGrain));
  const backZ = -P.d / 2, leftX = -P.w / 2, doorOp = { center: P.doorZ, width: DOOR_W, height: DOOR_H };
  wallRun(kit, wall, 'x', backZ, leftX, P.w / 2, P.h);
  wallRun(kit, wall, 'z', leftX, backZ, P.d / 2, P.h, [doorOp]);
  doorFrame(kit, trim, 'z', leftX, doorOp);
  // Porte d'entree ouverte, rabattue contre le mur interieur.
  kit.box(0.04, DOOR_H, DOOR_W, leftX + 0.2, DOOR_H / 2, P.doorZ - DOOR_W / 2 - 0.05, kit.material(c.door));
  // Papier peint raye.
  const stripe = kit.material(c.stripe);
  for (let x = leftX + 0.3; x < P.w / 2; x += 0.45) kit.box(0.09, P.h - 0.3, 0.01, x, P.h / 2, backZ + WALL_T / 2 + 0.006, stripe);
  kit.box(P.w, 0.12, 0.03, 0, 0.06, backZ + WALL_T / 2 + 0.015, trim);
  // Fenetre sur la nuit bleue : froid contre la piece chaude.
  kit.box(1.1, 1.3, 0.04, P.windowX, 1.55, backZ + WALL_T / 2 + 0.02, kit.glow(c.nightGlass, c.nightGlow, 0.5, 0.3));
  for (const dx of [-0.6, 0.6]) kit.box(0.32, 1.6, 0.08, P.windowX + dx, 1.55, backZ + WALL_T / 2 + 0.06, curtain);
  // Buffet et cadres.
  kit.box(1.3, 0.85, 0.45, -1.2, 0.425, backZ + 0.3, kit.material(c.sideboard));
  for (const [x, w, h] of [[-1.6, 0.35, 0.45], [-1.15, 0.3, 0.38], [-0.7, 0.4, 0.5]] as const) kit.box(w, h, 0.03, x, 1.75, backZ + WALL_T / 2 + 0.02, kit.material(c.frame));
  // Tapis, table dressee, trois chaises.
  kit.box(3.0, 0.012, 2.2, P.tableX, 0.006, 0, kit.material(c.rug)).receiveShadow = true;
  table(kit, P.tableX, 0, P.tableW, P.tableD, P.tableH, kit.material(c.cloth), wood);
  kit.box(P.tableW - 0.1, 0.012, 0.22, P.tableX, P.tableH + 0.006, 0, kit.material(c.runner));
  const plate = kit.material(c.plate, 0.5);
  for (const [x, z] of [[0.1, -0.28], [1.1, -0.28], [0.6, 0.3]] as const) kit.cylinder(0.12, 0.015, x, P.tableH + 0.01, z, plate);
  kit.cylinder(0.1, 0.12, P.tableX, P.tableH + 0.07, 0, kit.material(c.pot, 0.4));
  kit.box(0.28, 0.07, 0.1, P.tableX + 0.5, P.tableH + 0.04, 0.05, kit.material(c.bread));
  chair(kit, 0.3, -1.5, 0, wood);
  chair(kit, 1.1, -1.5, 0, wood);
  chair(kit, 0.7, 1.0, Math.PI, wood);
  // Lampe chaude au-dessus de la table.
  kit.cylinder(0.008, 0.8, P.tableX, 2.4, 0, kit.material(c.frame));
  kit.cylinder(0.28, 0.16, P.tableX, 1.95, 0, kit.glow(c.shade, c.lamp, 1.1, 0.3));
  kit.lamp(c.lamp, 6, 8, P.tableX, 1.8, 0);
  return finish(kit, 'parents');
}

const BUILDERS: Record<WeekPlace, (doc: Document) => WeekSet> = {
  'chez-toi': buildHome,
  palier: buildLanding,
  rue: buildStreet,
  controle: buildControl,
  escalier: buildStairs,
  audition: buildHearing,
  parents: buildParents,
};

/**
 * Construit le decor provisoire d'un lieu de la semaine.
 *
 * Chaque appel rend un decor neuf : `root` a poser dans la scene, `marks` neufs,
 * `dispose()` pour tout liberer (geometries, materiaux, textures, lampes, `root` vide).
 * `setReader` et `setBarrier` n'existent que pour `controle`.
 *
 * @example
 * const set = buildWeekSet('controle', document);
 * set.setReader?.('-14 MOTS', true);
 * set.setBarrier?.(1);
 * set.dispose();
 */
export const buildWeekSet: BuildWeekSet = (place, doc) => BUILDERS[place](doc);
