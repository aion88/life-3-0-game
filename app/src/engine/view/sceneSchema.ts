/**
 * Schéma strict de la scène de la rue : mise en espace et étalonnage, rien d'autre [plan 02a T1].
 * Chaque nombre porte sa provenance (`Sourced`). Un `supposed` sans `owner` lève. La scène ne recopie RIEN de `StreetData` :
 * z des nacelles, z du checkpoint, horaires et durées restent au plan 02b (une seule source par valeur) ; `parseScene` ne fait
 * que vérifier les références croisées. Pur : ni DOM, ni horloge, ni hasard (règle ESLint du moteur).
 */
import { z } from 'zod';
import { WORLD_VARS, type WorldVar } from '../../shared/types/world';
import { DataLoadError, runParse } from '../../data/schema/common';
import { sourced, type Sourced } from '../../data/schema/sourced';
import type { StreetData } from '../../data/schema/street';

/** Nom de fichier cité dans les refus. */
const FILE = 'street/data/w10.scene.json';

export type { Sourced };

const num = sourced(z.number());
const vec = sourced(z.strictObject({ x: z.number(), z: z.number() }));

const lightState = z.enum(['jour', 'heureBleue', 'nuit']);
/** État de lumière : jour, heure bleue, nuit [art bible §D.1]. */
export type LightState = z.infer<typeof lightState>;

const place = z.strictObject({ z: num, zEnd: num.optional() });
const layout = z.strictObject({
  src: z.string().min(1), halfWidthM: num, zMax: num, zMin: num,
  places: z.strictObject({
    logement: place, banc: place, biensAgrees: place, pylone: place, cabine: place,
    etal: place, voitureGrise: place, registre: place, portail: place, facadeCoffre: place,
  }),
});

const nacelle = z.strictObject({
  id: z.string().min(1), side: sourced(z.enum(['east', 'west'])), x: num,
  restAim: sourced(z.strictObject({ x: z.number(), y: z.number(), z: z.number() })),
});

const hex = sourced(z.string().regex(/^#[0-9A-Fa-f]{6}$/));
/** Teinte en HSL (degrés, puis 0 à 1) recalculée depuis les RGB de la bible w10 §10.1. */
const tint = sourced(z.strictObject({ h: z.number(), s: z.number(), l: z.number() }));
const wall = z
  .strictObject({
    src: z.string().min(1), cols: num, rows: num, tvWidthM: num, tvHeightM: num, plinthM: num,
    tvDepthM: num, frameM: num, recessM: num,
    orange: z.strictObject({ row: z.number().int().min(1), col: z.number().int().min(1) }),
    /** La télé qui montre un visage pendant une séquence (elle prend la teinte `orange`, celle de l'écran fixe) [GDD sequences-jouees §0.1]. */
    face: z.strictObject({ row: z.number().int().min(1), col: z.number().int().min(1) }),
    tints: z.strictObject({ cyan: tint, magenta: tint, paleBlue: tint, orange: tint }),
    /** Une chaîne par rangée, une lettre par colonne : c cyan, p bleu pâle, m magenta. L'orange vient de `orange`. */
    grid: sourced(z.array(z.string().regex(/^[cpm]+$/)).min(1)),
    look: z.strictObject({ glow: num, scanlinePitchPx: num, scanlineDepth: num }),
  })
  .superRefine((w, ctx) => {
    if (w.grid.v.length !== w.rows.v) ctx.addIssue({ code: 'custom', path: ['grid'], message: `grid a ${w.grid.v.length} rangées, le mur en a ${w.rows.v}` });
    w.grid.v.forEach((r, i) => {
      if (r.length !== w.cols.v) ctx.addIssue({ code: 'custom', path: ['grid', i], message: `rangée ${i + 1} de ${r.length} colonnes, le mur en a ${w.cols.v}` });
    });
    if (w.orange.row > w.rows.v) ctx.addIssue({ code: 'custom', path: ['orange', 'row'], message: `orange.row ${w.orange.row} hors du mur (${w.rows.v} rangées)` });
    if (w.face.row > w.rows.v || w.face.col > w.cols.v) ctx.addIssue({ code: 'custom', path: ['face'], message: 'face hors du mur' });
    if (w.orange.col > w.cols.v) ctx.addIssue({ code: 'custom', path: ['orange', 'col'], message: `orange.col ${w.orange.col} hors du mur (${w.cols.v} colonnes)` });
  })
  .transform((w) => ({ ...w, widthM: w.cols.v * w.tvWidthM.v, heightM: w.rows.v * w.tvHeightM.v + w.plinthM.v }));

const gradeState = z.strictObject({ grain: num, vignetteIL: num, blackPoint: num, exposure: num, toneMap: sourced(z.enum(['neutral', 'aces'])) });
/** Gain d'un uniforme : `null` = aucun effet (personne ne l'a écrit), sinon un coefficient AVEC provenance par variable du monde ou axe d'arrivée [R-02a.10]. */
const gain = z.partialRecord(z.enum(WORLD_VARS as [WorldVar, ...WorldVar[]]), num).nullable();

const lutState = z.strictObject({ contrast: num, saturation: num, tint: sourced(z.tuple([z.number(), z.number(), z.number()])) });
/** `focalLengthM` : longueur de la rampe de flou APRÈS la zone nette ; `fNumber` et `circleMm` donnent la zone nette (N c s² / f²) [art bible §D.2, §C.2]. */
const dofMode = z.strictObject({ focalLengthM: num, bokehScale: num, fNumber: num, circleMm: num });
/** Rig de lumière d'un état : hémisphère (ciel, sol), fond de scène (`horizon`) et soleil (couleur, intensité, hauteur, azimut depuis +z vers +x) [art bible §D.1]. */
const lightRig = z.strictObject({ sky: hex, horizon: hex, ground: hex, hemiIntensity: num, sunColor: hex, sunIntensity: num, sunElevationDeg: num, sunAzimuthDeg: num, lampLevel: num,
  /** Dôme de ciel : trois arrêts (zénith, +15°, horizon) et halo solaire ; `horizon` = brouillard et repli, égal à `skyHorizon` [ciel-jour-spec §7]. */
  skyZenith: hex, skyMid: hex, skyHorizon: hex, sunHalo: hex, sunHaloRadiusDeg: num });
/** Réglages du post-process sans source dans la bible : tous `supposed`, réglés sur capture [T4, R-02a.18]. */
const postfx = z.strictObject({
  bloom: z.strictObject({ strength: num, radius: num, threshold: num }),
  chromatic: num,
  grainLumaWeight: z.strictObject({ dark: num, bright: num }),
});

/** Construction procédurale de la rue : dimensions et gains que la bible ne donne pas, tous à régler sur capture (T13). */
const build = z.strictObject({
  sidewalkM: num, storeyHeightM: num, windowPitchM: num, windowWidthM: num, windowHeightM: num, windowCenterM: num, facadeDepthM: num,
  mastRadiusM: num, lampArmM: num, lampHeadLengthM: num, lampHeadHeightM: num, lampHeadWidthM: num, nacelleHeightM: num, asphaltRoughness: num,
  litWindowGain: num, lampGain: num, lampLensGain: num, ledGain: num, beaconGain: num, counterPanelHeightM: num, hitWidthM: num, hitHeightM: num,
  palette: z.strictObject({ shadow: hex, mid: hex, haze: hex, sodium: hex, interior: hex, slit: hex, red: hex, led: hex, barrierBlack: hex }),
});

/** Un plan de la caméra haute : distance (m), plongée et azimut (degrés), focale (mm). */
const shotData = z.strictObject({ distM: num, elevDeg: num, azimDeg: num, focalMm: num });

const sceneSchema = z.strictObject({
  /** Budgets de la vue large, vérifiés sur la structure construite sans GPU [T6, R-02a.14 c]. */
  budget: z.strictObject({ drawCalls: num, triangles: num }),
  build,
  layout,
  nacelles: z.array(nacelle),
  lamps: z.strictObject({
    mastM: num, spacingM: num, perSide: num,
    /** Lumière des têtes : source réelle (candelas, portée, décroissance) près de la vue, flaque simulée au sol pour chacune [TV-02a-render]. */
    light: z.strictObject({ intensityCd: num, distanceM: num, decay: num, poolRadiusM: num, poolOpacity: num, realCount: num, angleDeg: num, penumbra: num, tiltDeg: num, glowRadiusM: num, glowOpacity: num }),
  }),
  facades: z.strictObject({ floorsMin: num, floorsMax: num, widthMinM: num, widthMaxM: num, litOneIn: num }),
  checkpoint: z.strictObject({
    booth: z.strictObject({ widthM: num, depthM: num, heightM: num, slitWidthM: num, slitHeightM: num, slitCenterM: num, slitLitGain: num }),
    barrierM: num, boothX: num, barrierPostX: num,
    barrier: z.strictObject({ postM: num, postHeightM: num, armThicknessM: num, lampM: num, postLampM: num, bulbRatio: num, liftDeg: num, liftMs: num }),
    wall,
  }),
  coffre: z.strictObject({
    widthM: num, depthM: num, benchCount: num, benchLengthM: num, chimneyM: num,
    heightM: num, enceinteM: num, rampWidthM: num, portalWidthM: num, portalHeightM: num, projectorEveryM: num,
    chimneyRadiusM: num, benchHeightM: num, benchDepthM: num,
  }),
  crowd: z.strictObject({ movingMin: num, movingMax: num, moving: num, paceMin: num, paceMax: num, queueMin: num, queueMax: num, queue: num, queueSpacingM: num, queueMinGapM: num, queueXM: num, queueHeadZ: num }),
  light: z.strictObject({ src: z.string().min(1), steps: z.array(z.strictObject({ fromMinute: z.number().int(), state: lightState })).min(1), blendMs: num }),
  lightRigs: z.strictObject({ jour: lightRig, heureBleue: lightRig, nuit: lightRig }),
  /** Brouillard accordé à l'horizon du ciel : début et fin, en mètres de la caméra [ciel-jour-spec §4.4]. */
  sky: z.strictObject({ fogNearM: num, fogFarM: num }),
  grade: z.strictObject({
    states: z.strictObject({ jour: gradeState, heureBleue: gradeState, nuit: gradeState }),
    gains: z.strictObject({ accent: gain, veil: gain, grain: gain, curvature: gain }),
    exposure: z.strictObject({ adapt: z.strictObject({ upRatePerS: num, downRatePerS: num }) }),
  }),
  dof: z.strictObject({ walk: dofMode, observation: dofMode }),
  postfx,
  lut: z.strictObject({ jour: lutState, heureBleue: lutState, nuit: lutState }),
  /** Lieu d'attente, nature (une personne ou un véhicule) et corps à afficher (`npc.<id>`) [R-02a.12]. */
  npcPlaces: z.record(z.string(), z.strictObject({ at: vec, kind: z.enum(['person', 'vehicle']), bodyId: z.string().min(1) })),
  characters: z.strictObject({ crowdBodies: sourced(z.array(z.string().min(1)).min(1)), maxBytesPerBody: num, floorGain: num }),
  view: z.strictObject({ easeRatePerS: num }),
  queue: z.strictObject({ halfWidthM: num, lengthM: num }),
  camera: z.strictObject({
    sensorHeightMm: num,
    walk: z.strictObject({ restFocalMm: num, movingFocalMm: num, heightM: num, distanceM: num }),
    observation: z.strictObject({ focalMmMin: num, focalMmMax: num, focalMm: num, heightM: num, distanceM: num, lateralM: num, checkpointFrame: sourced(z.strictObject({ x: z.number(), z: z.number(), distanceM: z.number().positive(), fromZ: z.number(), rampM: z.number().positive() })) }),
    transitionMs: num,
    /** Caméra haute de trois quarts de la rue guidée : un plan par genre de scène, longue focale, amortie [spec rue guidée §4.4]. */
    high: z.strictObject({
      focusHeightM: num, dampMs: num,
      home: shotData, desk: shotData, street: shotData, talk: shotData, queue: shotData,
    }),
  }),
  /** Coupe de l'immeuble 9 vue de la caméra haute : quatre logements du nord au sud (z décroissant), de `logement.z` à `logement.zEnd`, chacun meublé et éclairé par sa lampe de bureau [spec rue guidée §4.5]. */
  cutaway: z.strictObject({
    units: z.array(z.strictObject({
      id: z.string().regex(/^9-[A-D]$/),
      /** Fin (z) du logement ; son début est la fin du précédent, `layout.places.logement.z` pour le premier. */
      zEnd: num,
      /** Une lampe de bureau allumée dans les logements occupés seulement. */
      occupied: z.boolean(),
      furniture: z.array(z.enum(['bed', 'desk', 'table', 'shelf'])).min(1),
    })).length(4),
    /** Hauteur des cloisons entre logements (m) : sous le plateau du bureau (1,0 m), pour voir dedans de la caméra haute ; le mur du fond garde sa hauteur. */
    partitionM: num,
    /** Lampe de bureau : vraie source ponctuelle (`PointLight`), couleur `build.palette.interior`. */
    lamp: z.strictObject({ intensityCd: num, distanceM: num, decay: num, heightM: num }),
  }),
  /** Ancres nommées des scènes guidées (`place` de `street.guided.scenes`), en x, z du monde. */
  guided: z.strictObject({ places: z.record(z.string().min(1), vec) }),
  walk: z.strictObject({ speedMps: num, maxDtMs: num, bodyRadiusM: num }),
  interact: z.strictObject({ interactRangeM: num, viewMinCos: num }),
  /** Décors pleins de la rue, par identifiant : une boîte alignée sur les axes, centrée sur `at` (un cliquable) ou sur `x`, `z`. Un cylindre est donné par son carré. */
  solids: z.record(z.string(), sourced(z.strictObject({ at: z.string().optional(), x: z.number().optional(), z: z.number().optional(), w: z.number().positive(), d: z.number().positive() }))),
  interactions: z.record(z.string(), z.strictObject({ at: vec })),
  /** Zones d'apparition des choix, par identifiant de choix : écrites par T9 avec son test. */
  triggers: z.record(z.string(), z.strictObject({ at: vec, radiusM: num })),
});

/** Scène chargée et validée. */
export type SceneData = z.output<typeof sceneSchema>;
/** Construction procédurale : dimensions, gains, palette. */
export type BuildData = SceneData['build'];
/** Lumière : marches d'horloge et durée du fondu [art bible §H.4]. */
export type LightData = SceneData['light'];
/** Étalonnage : états, gains, adaptation d'exposition. */
export type GradeData = SceneData['grade'];

function refuse(path: string, message: string): never {
  throw new DataLoadError('reference', FILE, path, message);
}

/** Valide `raw` (clé inconnue = refus) puis recoupe avec `street` : nacelles, PNJ et cliquables. Rien de `street` n'est recopié. */
export function parseScene(raw: unknown, street: StreetData): SceneData {
  const s = runParse(sceneSchema, raw, FILE);
  const want = street.gaze.nacelleZ.map((z) => `n${z}`);
  const have = s.nacelles.map((n) => n.id);
  if (want.join() !== have.join()) refuse('nacelles', `ids des nacelles ${have.join(',')} différents de ${want.join(',')} (gaze.nacelleZ)`);
  for (const n of s.nacelles) {
    const dir = n.side.v === 'east' ? 1 : -1;
    if (Math.sign(n.x.v) !== dir) refuse(`nacelles.${n.id}.x`, `x ${n.x.v} incompatible avec le côté ${n.side.v}`);
  }
  for (const n of street.npcs) if (s.npcPlaces[n.id] === undefined) refuse(`npcPlaces.${n.id}`, `aucun lieu d'attente pour le PNJ ${n.id}`);
  for (const id of Object.keys(s.npcPlaces)) if (!street.npcs.some((n) => n.id === id)) refuse(`npcPlaces.${id}`, `lieu d'attente pour un PNJ inconnu : ${id}`);
  for (const c of street.clickables) if (s.interactions[c.id] === undefined) refuse(`interactions.${c.id}`, `aucune position pour le cliquable ${c.id}`);
  for (const id of Object.keys(s.interactions)) if (!street.clickables.some((c) => c.id === id)) refuse(`interactions.${id}`, `position pour un cliquable inconnu : ${id}`);
  if (s.interactions['wall']?.at.v.z !== street.checkpoint.z) refuse('interactions.wall.at.z', `le mur doit être à checkpoint.z (${street.checkpoint.z}), pas à ${s.interactions['wall']?.at.v.z}`);
  for (const [id, sol] of Object.entries(s.solids)) {
    const { at, x, z } = sol.v;
    if (at !== undefined ? s.interactions[at] === undefined : x === undefined || z === undefined) refuse(`solids.${id}`, at !== undefined ? `centre sur le cliquable inconnu ${at}` : 'ni `at` ni `x` et `z`');
  }
  const flat = s.layout.places.logement;
  let from = flat.z.v;
  for (const u of s.cutaway.units) {
    if (!(u.zEnd.v < from)) refuse(`cutaway.units.${u.id}.zEnd`, `fin ${u.zEnd.v} non strictement sous le début ${from}`);
    from = u.zEnd.v;
  }
  if (from !== flat.zEnd!.v) refuse('cutaway.units', `le dernier logement finit à ${from}, le logement de la bible finit à ${flat.zEnd!.v}`);
  if (s.cutaway.units.map((u) => u.id).join() !== '9-A,9-B,9-C,9-D') refuse('cutaway.units', 'les logements doivent être 9-A, 9-B, 9-C, 9-D dans cet ordre');
  const bodies = [...Object.values(s.npcPlaces).map((p) => p.bodyId), ...s.characters.crowdBodies.v, 'player'];
  const dup = bodies.find((b, i) => bodies.indexOf(b) !== i);
  if (dup !== undefined) refuse('npcPlaces', `corps ${dup} utilisé deux fois (joueuse, PNJ et foule ont chacun le leur)`);
  const cr = s.crowd;
  if (cr.moving.v < cr.movingMin.v || cr.moving.v > cr.movingMax.v) refuse('crowd.moving', 'effectif des passants hors de la plage');
  if (cr.paceMin.v > cr.paceMax.v) refuse('crowd.paceMin', 'allure minimale au-dessus de la maximale');
  if (cr.queue.v < cr.queueMin.v || cr.queue.v > cr.queueMax.v) refuse('crowd.queue', 'effectif de la file hors de la plage');
  return s;
}
