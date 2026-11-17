/**
 * Moteur des « séquences jouées » [GDD 2026-11-03 sequences-jouees ; demande de Cynthia, playtest 2026-11-03 : « quand je choisis Contourner le poste,
 * il ne se passe rien »]. Un choix confirmé ne se contente plus d'écrire l'état : la joueuse perd la main 3 à 8 s, son personnage marche seul vers une
 * ancre de la scène, une personne réagit, une ligne de narration se dit, le segment en attente de la barre Dossier pulse dans le sens de l'effet.
 * Un clic passe la séquence (l'état final est posé), puis l'acte est appliqué : TOUJOURS séquence d'abord, acte ensuite, une seule fois.
 *
 * Pur et déterministe : ni DOM, ni horloge, ni hasard. Aucun nombre n'est écrit ici : ancres, durées, bornes de durée et réactions viennent de
 * `street/data/w10.sequences.json`, validé par `parseSequences`. La marche elle-même (solides, vitesse) reste celle de `stepWalk` : ce module ne
 * fait que dire dans quelle direction aller.
 *
 * Machine à états (table explicite `SEQ_TRANSITIONS`) : `idle -> playing` (`begin`), `playing -> ended` (durée écoulée ou `skip`), `ended -> idle | playing`.
 * Aucun autre passage n'est atteignable : `begin` pendant `playing` est refusé (une séquence à la fois), `skip` hors `playing` ne fait rien.
 */
import { z } from 'zod';
import { DataLoadError, runParse } from '../../data/schema/common';
import { sourced } from '../../data/schema/sourced';
import type { StreetData } from '../../data/schema/street';
import { laneOutcome } from '../moments/checkpoint';
import { confirm } from '../moments/choices';
import type { GameClock } from '../../shared/types/street';
import type { StreetContext, StreetState, Vec2 } from '../moments/types';
import { solidBlockers, type Blocker } from './walk';
import type { SceneData } from './sceneSchema';

const FILE = 'street/data/w10.sequences.json';

/** Sens de l'effet sur le segment en attente de la barre Dossier : baisse, hausse, ou 0 = aucun effet net, AUCUNE pulsation [GDD sequences-jouees §1.6]. */
export type DossierPulse = -1 | 0 | 1;
/** Poids de l'effet (valeur absolue de l'entrée : faible 1 à 3, moyen 4 à 6, fort 8 et plus) : amplitude de la pulsation [GDD §1.6]. */
export type PulseWeight = 'low' | 'medium' | 'strong';
/** Réaction d'une personne : elle se tourne vers la joueuse, vers la cible de la séquence, ou lui tourne le dos ; elle peut faire un pas vers une ancre. */
export interface NpcReaction {
  /** Un PNJ du monde (`street.npcs`) ou une silhouette de la file (`queue.<n>`). */
  readonly id: string;
  readonly face: 'player' | 'target' | 'away';
  readonly stepTo?: string;
  /** Secondes après le début de la séquence ; absent : dès le début. */
  readonly delayS?: number;
}
/**
 * Ce que l'effet réel du choix change à la séquence : la ligne, le sens de la pulsation, la réaction. Choisie par l'ENTRÉE de relevé que l'acte écrit
 * (`found7`, `informant`, `bypassNacelle`, `patrol`…), jamais par un tirage refait ici : le moteur calcule l'effet, la séquence le montre [GDD §1.1].
 */
export interface SequenceVariant {
  readonly narrationKey: string;
  readonly dossierPulse: DossierPulse;
  readonly pulseWeight?: PulseWeight;
  readonly npcReaction?: NpcReaction;
  /** Remplace la durée quand l'effet réel allonge la scène (la nacelle, la patrouille) ; dans les mêmes bornes. */
  readonly durationS?: number;
  readonly secondPulse?: SecondPulse;
  /** Remplace les repères de la séquence (le composant trouvé allume la fente en rouge, l'informateur garde le visage au mur). */
  readonly cues?: readonly SequenceCue[];
}
/** Un second battement du segment en attente, à `atS` : l'effet réel a une deuxième entrée (l'informateur : -4 de l'achat, puis -6) [GDD §0.2]. */
export interface SecondPulse { readonly atS: number; readonly dossierPulse: -1 | 1; readonly pulseWeight: PulseWeight }
/** Un point de passage : l'ancre, et l'instant avant lequel la joueuse y attend (`holdUntilS`, qu'une réplique du décor, la barrière par exemple, soit prête). */
export interface PathLeg { readonly to: string; readonly holdUntilS?: number }
/** Saut de la cible : à `atS` la joueuse est reposée sur la cible, derrière un fondu au noir de `fadeS` (un lieu que la rue ne laisse pas traverser, la cour). */
export interface SequenceHop { readonly atS: number; readonly fadeS: number }
/**
 * Coupe d'entrée [GDD §1.2 : « au-delà d'environ 8 m, la distance est coupée par un fondu au noir de 0,4 s »] : la joueuse peut confirmer de n'importe où dans la
 * zone du choix, la scène est réglée pour un départ à `anchor`. Si la première ancre est à plus de `maxWalkM`, un fondu de `fadeS` la pose sur `anchor`, puis la marche reprend.
 */
export interface SequenceEntry { readonly anchor: string; readonly maxWalkM: number; readonly fadeS: number }
/** Ce que la séquence change dans le décor, à date fixe : la fente de la guérite, le visage sur le mur d'écrans, le bras de la barrière. */
export const CUES = ['slit.idle', 'slit.lit', 'slit.red', 'wall.face', 'wall.clear', 'barrier.up', 'barrier.down'] as const;
export type CueName = typeof CUES[number];
export interface SequenceCue { readonly atS: number; readonly cue: CueName }
/** L'état du décor que les repères `cues` ont posé à l'instant courant. */
export interface SceneCues { readonly slit: 'idle' | 'lit' | 'red'; readonly face: boolean; readonly barrierUp: boolean }
export const REST_CUES: SceneCues = { slit: 'idle', face: false, barrierUp: false };
/** Une séquence jouée, résolue : `durationS` est un nombre, la provenance reste dans le JSON. */
export interface SequenceSpec {
  /** Nom d'une ancre de la scène : où le personnage finit. */
  readonly target: string;
  /** Ancres à franchir dans l'ordre avant la cible (contournement d'un solide, par exemple). */
  readonly path?: readonly PathLeg[];
  readonly npcReaction?: NpcReaction;
  /** Clé de la ligne de narration (`w10.seq.<choix>.<option>`). */
  readonly narrationKey: string;
  readonly dossierPulse: DossierPulse;
  readonly pulseWeight?: PulseWeight;
  readonly durationS: number;
  readonly hop?: SequenceHop;
  readonly entry?: SequenceEntry;
  readonly secondPulse?: SecondPulse;
  readonly cues?: readonly SequenceCue[];
  /** Facteur d'éloignement de la caméra de marche (1 = inchangée) : elle cadre la joueuse ET ce qui réagit [GDD §1.4]. */
  readonly cameraWiden?: number;
  /** Par nom d'entrée de relevé écrite par l'acte ; la première entrée (dans l'ordre de l'acte) qui a une variante la remplace. */
  readonly variants?: Readonly<Record<string, SequenceVariant>>;
}
/** Les séquences d'un monde : par choix, puis par option ; et les ancres résolues. */
/** Les nombres que le moteur ne décide pas, tous lus du JSON (`limits`). */
export interface SequenceLimits {
  readonly minS: number;
  readonly maxS: number;
  /** Pas d'échantillonnage (m) de la droite testée contre les décors pleins par la coupe d'entrée. */
  readonly crossSampleM: number;
  /** Mouvement réduit : date du fondu (part de la durée), durée du fondu (s) et plafond du fondu (part de la durée). */
  readonly reducedHopShare: number;
  readonly reducedFadeS: number;
  readonly reducedFadeShare: number;
  /** Caméra : en dessous de cet élargissement (1 + seuil) la caméra de marche n'est pas touchée ; part de l'élargissement reportée sur la hauteur. */
  readonly widenEpsilon: number;
  readonly widenHeightShare: number;
  /** Zone où un indice laissé par une séquence (visage au mur, fente allumée) reste posé : au-delà, ou un autre jour, il s'efface. */
  readonly lingerZone: { readonly center: Vec2; readonly radiusM: number };
}
export interface SequenceTable {
  readonly anchors: Readonly<Record<string, Vec2>>;
  readonly sequences: Readonly<Record<string, Readonly<Record<string, SequenceSpec>>>>;
  readonly limits: SequenceLimits;
}

const num = sourced(z.number());
const vec = sourced(z.strictObject({ x: z.number(), z: z.number() }));
const name = z.string().min(1);
const reactionSchema = z.strictObject({ id: name, face: z.enum(['player', 'target', 'away']), stepTo: name.optional(), delayS: z.number().min(0).optional() });
const pulseSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
const weightSchema = z.enum(['low', 'medium', 'strong']);
const cueSchema = z.strictObject({ atS: z.number().min(0), cue: z.enum(CUES) });
const legSchema = z.union([name.transform((to): { to: string; holdUntilS?: number | undefined } => ({ to })), z.strictObject({ to: name, holdUntilS: z.number().min(0).optional() })]);
const secondPulseSchema = z.strictObject({ atS: z.number().min(0), dossierPulse: z.union([z.literal(-1), z.literal(1)]), pulseWeight: weightSchema });
const variantSchema = z.strictObject({ secondPulse: secondPulseSchema.optional(),  narrationKey: name, dossierPulse: pulseSchema, pulseWeight: weightSchema.optional(), npcReaction: reactionSchema.optional(), cues: z.array(cueSchema).optional(), durationS: num.optional() });
const specSchema = z.strictObject({
  target: name, path: z.array(legSchema).optional(), entry: z.strictObject({ anchor: name, maxWalkM: num, fadeS: z.number().positive() }).optional(), hop: z.strictObject({ atS: z.number().min(0), fadeS: z.number().positive() }).optional(), cues: z.array(cueSchema).optional(), cameraWiden: z.number().min(1).max(3).optional(), npcReaction: reactionSchema.optional(), narrationKey: name,
  dossierPulse: pulseSchema, pulseWeight: weightSchema.optional(), variants: z.record(name, variantSchema).optional(),
  durationS: sourced(z.number().positive()),
  /** `provisional` : posée avant le GDD des séquences ; le game-designer la remplace. */
  status: z.enum(['provisional', 'final']),
});
const tableSchema = z.strictObject({
  src: z.string().min(1),
  limits: z.strictObject({ minS: num, maxS: num, crossSampleM: num, reducedHopShare: num, reducedFadeS: num, reducedFadeShare: num, widenEpsilon: num, widenHeightShare: num, lingerZone: sourced(z.strictObject({ x: z.number(), z: z.number(), radiusM: z.number().positive() })) }),
  anchors: z.record(name, vec),
  sequences: z.record(name, z.record(name, specSchema)),
});

const refuse = (path: string, message: string): never => { throw new DataLoadError('reference', FILE, path, message); };
const QUEUE_ID = /^queue\.\d+$/;

/** Le point est-il dans l'emprise d'un décor plein (boîte) ou hors de la rue ? */
export function blockedPoint(p: Vec2, blockers: readonly Blocker[], scene: SceneData): boolean {
  const hw = scene.layout.halfWidthM.v;
  if (Math.abs(p.x) >= hw || p.z <= scene.layout.zMin.v || p.z >= scene.layout.zMax.v) return true;
  return blockers.some((k) => k.kind === 'box' && p.x > k.min.x && p.x < k.max.x && p.z > k.min.z && p.z < k.max.z);
}

/**
 * Valide le JSON (clé inconnue = refus) puis recoupe : choix et options existent dans `street.choices`, chaque ancre nommée est déclarée et
 * se trouve dans la rue hors de tout décor plein (la cible est atteignable par un pas posé, y compris au passage d'un clic), la durée est dans
 * les bornes des données, la personne qui réagit existe, la clé de narration est dite par `hasKey`.
 */
export function parseSequences(raw: unknown, scene: SceneData, street: StreetData, hasKey: (key: string) => boolean): SequenceTable {
  const t = runParse(tableSchema, raw, FILE);
  const anchors: Record<string, Vec2> = {};
  const solids = solidBlockers(scene);
  for (const [id, a] of Object.entries(t.anchors)) {
    anchors[id] = { x: a.v.x, z: a.v.z };
    if (blockedPoint(anchors[id]!, solids, scene)) refuse(`anchors.${id}`, `l'ancre ${id} est hors de la rue ou dans un décor plein`);
  }
  const L = t.limits;
  const limits: SequenceLimits = { minS: L.minS.v, maxS: L.maxS.v, crossSampleM: L.crossSampleM.v, reducedHopShare: L.reducedHopShare.v, reducedFadeS: L.reducedFadeS.v, reducedFadeShare: L.reducedFadeShare.v, widenEpsilon: L.widenEpsilon.v, widenHeightShare: L.widenHeightShare.v, lingerZone: { center: { x: L.lingerZone.v.x, z: L.lingerZone.v.z }, radiusM: L.lingerZone.v.radiusM } };
  const { minS, maxS } = limits;
  if (limits.crossSampleM <= 0) refuse('limits.crossSampleM', 'le pas doit être positif');
  if (minS > maxS) refuse('limits', 'minS au-dessus de maxS');
  const known = (id: string, path: string): void => { if (anchors[id] === undefined) refuse(path, `ancre inconnue : ${id}`); };
  const sequences: Record<string, Record<string, SequenceSpec>> = {};
  for (const [choiceId, byOption] of Object.entries(t.sequences)) {
    const choice = street.choices.find((c) => c.id === choiceId);
    if (choice === undefined) refuse(`sequences.${choiceId}`, `choix inconnu : ${choiceId}`);
    sequences[choiceId] = {};
    for (const [optionId, s] of Object.entries(byOption)) {
      const at = `sequences.${choiceId}.${optionId}`;
      if (!choice!.options.some((o) => o.id === optionId)) refuse(at, `option inconnue : ${optionId}`);
      known(s.target, `${at}.target`);
      s.path?.forEach((p, i) => { known(p.to, `${at}.path.${i}`); if ((p.holdUntilS ?? 0) >= s.durationS.v) refuse(`${at}.path.${i}.holdUntilS`, "l'attente finit après la séquence"); });
      if (s.entry !== undefined) { known(s.entry.anchor, `${at}.entry.anchor`); if (s.entry.fadeS >= s.durationS.v) refuse(`${at}.entry.fadeS`, "la coupe d'entrée finit après la séquence"); }
      if (s.hop !== undefined && s.hop.atS >= s.durationS.v) refuse(`${at}.hop.atS`, 'le saut a lieu après la fin de la séquence');
      for (const [where, cues] of [[`${at}.cues`, s.cues], ...Object.entries(s.variants ?? {}).map(([k, v]) => [`${at}.variants.${k}.cues`, v.cues] as const)] as const) {
        cues?.forEach((c, i) => { if (c.atS >= s.durationS.v) refuse(`${where}.${i}.atS`, 'le repère tombe après la fin de la séquence'); });
      }
      const checkReaction = (r: z.infer<typeof reactionSchema> | undefined, where: string): void => {
        if (r === undefined) return;
        if (!QUEUE_ID.test(r.id) && !street.npcs.some((n) => n.id === r.id)) refuse(`${where}.id`, `personne inconnue : ${r.id}`);
        if (r.stepTo !== undefined) known(r.stepTo, `${where}.stepTo`);
        if ((r.delayS ?? 0) >= s.durationS.v) refuse(`${where}.delayS`, 'la réaction commence après la fin de la séquence');
      };
      checkReaction(s.npcReaction, `${at}.npcReaction`);
      for (const [entry, v] of Object.entries(s.variants ?? {})) {
        checkReaction(v.npcReaction, `${at}.variants.${entry}.npcReaction`);
        if (v.secondPulse !== undefined && v.secondPulse.atS >= (v.durationS?.v ?? s.durationS.v)) refuse(`${at}.variants.${entry}.secondPulse.atS`, 'le second battement tombe après la fin de la séquence');
        if (v.durationS !== undefined && (v.durationS.v < minS || v.durationS.v > maxS)) refuse(`${at}.variants.${entry}.durationS`, `durée ${v.durationS.v} s hors des bornes ${minS} à ${maxS} s`);
        if (!hasKey(v.narrationKey)) refuse(`${at}.variants.${entry}.narrationKey`, `clé de narration absente des chaînes : ${v.narrationKey}`);
      }
      if (s.durationS.v < minS || s.durationS.v > maxS) refuse(`${at}.durationS`, `durée ${s.durationS.v} s hors des bornes ${minS} à ${maxS} s`);
      if (!hasKey(s.narrationKey)) refuse(`${at}.narrationKey`, `clé de narration absente des chaînes : ${s.narrationKey}`);
      const reaction = (r: z.infer<typeof reactionSchema>): NpcReaction => ({ id: r.id, face: r.face, ...(r.stepTo === undefined ? {} : { stepTo: r.stepTo }), ...(r.delayS === undefined ? {} : { delayS: r.delayS }) });
      sequences[choiceId]![optionId] = {
        target: s.target, narrationKey: s.narrationKey, dossierPulse: s.dossierPulse, durationS: s.durationS.v, ...(s.pulseWeight === undefined ? {} : { pulseWeight: s.pulseWeight }),
        ...(s.path === undefined ? {} : { path: s.path.map((p) => ({ to: p.to, ...(p.holdUntilS === undefined ? {} : { holdUntilS: p.holdUntilS }) })) }),
        ...(s.hop === undefined ? {} : { hop: s.hop }), ...(s.entry === undefined ? {} : { entry: { anchor: s.entry.anchor, maxWalkM: s.entry.maxWalkM.v, fadeS: s.entry.fadeS } }), ...(s.cues === undefined ? {} : { cues: s.cues }), ...(s.cameraWiden === undefined ? {} : { cameraWiden: s.cameraWiden }),
        ...(s.npcReaction === undefined ? {} : { npcReaction: reaction(s.npcReaction) }),
        ...(s.variants === undefined ? {} : { variants: Object.fromEntries(Object.entries(s.variants).map(([k, v]) => [k, { narrationKey: v.narrationKey, dossierPulse: v.dossierPulse, ...(v.pulseWeight === undefined ? {} : { pulseWeight: v.pulseWeight }), ...(v.cues === undefined ? {} : { cues: v.cues }), ...(v.durationS === undefined ? {} : { durationS: v.durationS.v }), ...(v.secondPulse === undefined ? {} : { secondPulse: v.secondPulse }), ...(v.npcReaction === undefined ? {} : { npcReaction: reaction(v.npcReaction) }) }])) }),
      };
    }
  }
  return { anchors, sequences, limits };
}

export type SeqPhase = 'idle' | 'playing' | 'ended';
/** Table de transitions : tout passage absent d'ici est inatteignable. */
export const SEQ_TRANSITIONS: Readonly<Record<SeqPhase, readonly SeqPhase[]>> = { idle: ['playing'], playing: ['ended'], ended: ['idle', 'playing'] };

/** Une personne telle que la foule la montre : `pos` et `heading` (0 face à -z, croît vers l'est) sont ce que la réaction peut changer. */
export interface Reactable { readonly id: string; readonly pos: Vec2; readonly heading: number }

export interface Sequencer {
  /**
   * Lance la séquence du choix confirmé. Rend sa spec, ou `null` quand aucune n'est écrite pour ce couple (l'appelant applique alors l'acte tout de
   * suite) ou qu'une séquence joue déjà. `onEnd` est appelé UNE fois, après le passage en `ended` : il reçoit la position finale (la cible) et
   * applique l'acte ; il est posé là où la joueuse est ARRIVÉE (la cible quand elle l'a atteinte ou quand la séquence est passée d'un clic, sinon le point où
   * la marche a buté : jamais de téléportation en fin naturelle). `opts.reduced` (mouvement réduit) : aucune marche, un fondu vers la position finale [GDD §1.8]. `entries` : les entrées de relevé que l'acte écrira (`effectEntries`) ; elles choisissent la variante de la séquence, et la spec
   * rendue est déjà résolue.
   */
  begin(choiceId: string, optionId: string, onEnd: (final: Vec2) => void, entries?: readonly string[], opts?: { readonly reduced?: boolean; readonly day?: number }): SequenceSpec | null;
  /** Vrai tant que l'entrée est verrouillée (phase `playing`). */
  active(): boolean;
  phase(): SeqPhase;
  /** La spec de la dernière séquence lancée, jusqu'à la prochaine ; `null` avant la première. */
  current(): SequenceSpec | null;
  /** Fait avancer de `dtMs`. Rend la direction unitaire de marche (`null` : rien à marcher) et la fin éventuelle ; à la fin, `onEnd` a déjà été appelé. */
  step(dtMs: number, player: Vec2, stopM: number, blockers?: readonly Blocker[]): { readonly dir: Vec2 | null; readonly ended: boolean; /** Saut : la joueuse est reposée ici (une seule fois) ; le fondu est `fade()`. */ readonly teleport: Vec2 | null };
  /** Passe la séquence : état final, puis `onEnd`. Sans effet hors de `playing`. */
  skip(): boolean;
  /** Le corps de `p` tel que la réaction le montre ; `null` quand aucune réaction ne le concerne en ce moment. */
  react(p: Reactable, player: Vec2): { readonly pos: Vec2; readonly heading: number } | null;
  /** Avancement 0 à 1 (durée écoulée sur durée). */
  progress(): number;
  /** Le décor posé par les repères à l'instant courant (la fin les a tous joués) ; `REST_CUES` avant la première séquence. Il reste posé après la fin, jusqu'à la séquence suivante. */
  cueState(): SceneCues;
  /** Opacité du fondu au noir (0 à 1) : un creux triangulaire de `fadeS` centré sur le saut. */
  fade(): number;
  /** Éloignement de caméra demandé en ce moment (1 hors séquence). */
  widen(): number;
  /** Les nombres de `limits` que l'appelant lit (caméra) : jamais écrits en dur ailleurs. */
  limits(): SequenceLimits;
  /** Le second battement du Dossier, rendu UNE fois quand sa date est passée (`null` sinon) ; il n'existe que pour les variantes qui le portent. */
  takeSecondPulse(): { readonly dir: -1 | 1; readonly weight: PulseWeight } | null;
  /**
   * Après la fin : l'indice laissé (visage, fente) s'efface quand la joueuse quitte la zone du poste (`limits.lingerZone`) ou quand le jour change
   * (`day` : celui où la séquence a été lancée, voir `begin`). Sans effet pendant une séquence.
   */
  settle(player: Vec2, day: number): void;
}

const dist = (a: Vec2, b: Vec2): number => { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); };
/** Cap (0 face à -z, croît vers l'est) d'un vecteur ; celui de `stepWalk` : `atan2(x, -z)`. */
export const headingOf = (dx: number, dz: number): number => Math.atan2(dx, -dz);
const HALF_TURN = Math.PI;
/** La droite de `a` à `b` traverse-t-elle une boîte (la file, un décor plein) ? Échantillonnée au pas `limits.crossSampleM` : la coupe d'entrée se déclenche aussi quand la marche directe est barrée. */
function crossesBox(a: Vec2, b: Vec2, blockers: readonly Blocker[], sampleM: number): boolean {
  const n = Math.max(1, Math.ceil(dist(a, b) / sampleM));
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    if (blockers.some((k) => k.kind === 'box' && x > k.min.x && x < k.max.x && z > k.min.z && z < k.max.z)) return true;
  }
  return false;
}

/** La spec jouée : celle du couple, avec la ligne, la pulsation et la réaction de la variante retenue ; elle ne porte plus la table des variantes. */
function resolveSpec(base: SequenceSpec, v: SequenceVariant | undefined): SequenceSpec {
  const reaction = v?.npcReaction ?? base.npcReaction;
  return {
    target: base.target, ...(v?.secondPulse === undefined ? {} : { secondPulse: v.secondPulse }), narrationKey: v?.narrationKey ?? base.narrationKey, dossierPulse: v?.dossierPulse ?? base.dossierPulse, durationS: v?.durationS ?? base.durationS,
    ...((v === undefined ? base.pulseWeight : v.pulseWeight) === undefined ? {} : { pulseWeight: (v === undefined ? base.pulseWeight : v.pulseWeight)! }),
    ...(base.path === undefined ? {} : { path: base.path }), ...(reaction === undefined ? {} : { npcReaction: reaction }),
    ...(base.hop === undefined ? {} : { hop: base.hop }), ...(base.entry === undefined ? {} : { entry: base.entry }), ...(base.cameraWiden === undefined ? {} : { cameraWiden: base.cameraWiden }),
    ...((v?.cues ?? base.cues) === undefined ? {} : { cues: (v?.cues ?? base.cues)! }),
  };
}

export function createSequencer(table: SequenceTable): Sequencer {
  let phase: SeqPhase = 'idle';
  let spec: SequenceSpec | null = null;
  let legs: { pos: Vec2; holdMs: number }[] = [];
  let leg = 0;
  let elapsedMs = 0;
  let hopped = false;
  let reduced = false;
  let entryAtMs: number | null = null, entryChecked = false, entryDone = false;
  let secondDone = false, cleared = false, beganDay: number | null = null;
  let endCb: ((final: Vec2) => void) | null = null;

  const go = (next: SeqPhase): void => {
    if (!SEQ_TRANSITIONS[phase].includes(next)) throw new Error(`séquence : passage ${phase} -> ${next} interdit`);
    phase = next;
  };
  const anchor = (id: string): Vec2 => table.anchors[id]!;
  const finish = (final: Vec2): void => {
    const cb = endCb;
    endCb = null;
    go('ended');
    cb?.(final);
  };
  const cueState = (): SceneCues => {
    if (spec === null || cleared) return REST_CUES;
    let slit: SceneCues['slit'] = 'idle', face = false, barrierUp = false;
    for (const c of [...(spec.cues ?? [])].sort((a, b) => a.atS - b.atS)) {
      if (phase === 'playing' && c.atS * 1000 > elapsedMs) continue;       // à la fin, tous les repères sont joués : l'état final ne dépend pas du passage
      if (c.cue === 'slit.idle') slit = 'idle'; else if (c.cue === 'slit.lit') slit = 'lit'; else if (c.cue === 'slit.red') slit = 'red';
      else if (c.cue === 'wall.face') face = true; else if (c.cue === 'wall.clear') face = false;
      else if (c.cue === 'barrier.up') barrierUp = true; else barrierUp = false;
    }
    return { slit, face, barrierUp };
  };

  return {
    begin(choiceId, optionId, onEnd, entries = [], opts = {}) {
      const base = table.sequences[choiceId]?.[optionId];
      if (base === undefined || phase === 'playing') return null;
      const hit = entries.find((e) => base.variants?.[e] !== undefined);
      const v = hit === undefined ? undefined : base.variants![hit]!;
      const r = resolveSpec(base, v);
      const s: SequenceSpec = opts.reduced === true ? { ...r, hop: { atS: r.durationS * table.limits.reducedHopShare, fadeS: Math.min(table.limits.reducedFadeS, r.durationS * table.limits.reducedFadeShare) } } : r;   // mouvement réduit : le fondu remplace la marche
      go('playing');
      spec = s; legs = [...(s.path ?? []), { to: s.target }].map((l) => ({ pos: anchor(l.to), holdMs: ('holdUntilS' in l && l.holdUntilS !== undefined ? l.holdUntilS : 0) * 1000 }));
      leg = 0; elapsedMs = 0; hopped = false; reduced = opts.reduced === true; endCb = onEnd;
      secondDone = false; cleared = false; beganDay = opts.day ?? null;
      entryAtMs = null; entryChecked = reduced || s.entry === undefined; entryDone = false;
      return s;
    },
    active: () => phase === 'playing',
    phase: () => phase,
    current: () => spec,
    step(dtMs, player, stopM, blockers = []) {
      const none = { dir: null, ended: false, teleport: null } as const;
      if (phase !== 'playing' || spec === null) return none;
      elapsedMs += Number.isFinite(dtMs) ? Math.max(dtMs, 0) : 0;
      if (elapsedMs >= spec.durationS * 1000) { const t = anchor(spec.target); finish(dist(player, t) <= stopM ? t : player); return { dir: null, ended: true, teleport: null }; }
      if (spec.hop !== undefined && !hopped && elapsedMs >= spec.hop.atS * 1000) { hopped = true; leg = legs.length - 1; return { dir: null, ended: false, teleport: anchor(spec.target) }; }
      if (!entryChecked) { entryChecked = true; if (dist(player, legs[0]!.pos) > spec.entry!.maxWalkM || crossesBox(player, legs[0]!.pos, blockers, table.limits.crossSampleM)) entryAtMs = spec.entry!.fadeS * 500; }   // la joueuse est trop loin : coupe d'entrée
      if (entryAtMs !== null && !entryDone) { if (elapsedMs < entryAtMs) return none; entryDone = true; return { dir: null, ended: false, teleport: anchor(spec.entry!.anchor) }; }
      if (reduced) return none;                                                       // mouvement réduit : la joueuse ne marche pas, le saut la pose
      const last = legs.length - 1, locked = spec.hop !== undefined && !hopped;      // avec un saut, la cible n'est pas marchée : on y est posé
      while (leg < last && dist(player, legs[leg]!.pos) <= stopM && elapsedMs >= legs[leg]!.holdMs) leg++;   // ancre atteinte et attente finie : la suivante
      if (locked && leg >= last) return none;
      const l = legs[leg]!, d = dist(player, l.pos);
      if (d <= stopM) return none;                                                    // arrivée (ou attente) : la joueuse attend
      return { dir: { x: (l.pos.x - player.x) / d, z: (l.pos.z - player.z) / d }, ended: false, teleport: null };
    },
    skip() {
      if (phase !== 'playing') return false;
      elapsedMs = spec!.durationS * 1000;
      finish(anchor(spec!.target));
      return true;
    },
    cueState,
    fade() {
      if (spec === null || phase !== 'playing') return 0;
      const dip = (atS: number, fadeS: number): number => { const t = Math.abs(elapsedMs / 1000 - atS) / (fadeS / 2); return t >= 1 ? 0 : 1 - t; };
      return Math.max(spec.hop === undefined ? 0 : dip(spec.hop.atS, spec.hop.fadeS), entryAtMs === null || spec.entry === undefined ? 0 : dip(entryAtMs / 1000, spec.entry.fadeS));
    },
    widen: () => (phase === 'playing' ? spec?.cameraWiden ?? 1 : 1),
    limits: () => table.limits,
    takeSecondPulse() {
      const sp = spec?.secondPulse;
      if (sp === undefined || phase !== 'playing' || secondDone || elapsedMs < sp.atS * 1000) return null;
      secondDone = true;
      return { dir: sp.dossierPulse, weight: sp.pulseWeight };
    },
    settle(player, day) {
      if (phase !== 'ended' || cleared) return;
      const z = table.limits.lingerZone;
      if ((beganDay !== null && day !== beganDay) || dist(player, z.center) > z.radiusM) cleared = true;
    },
    react(p, player) {
      const r = spec?.npcReaction;
      if (r === undefined || phase !== 'playing' || p.id !== r.id) return null;
      const startMs = (r.delayS ?? 0) * 1000;
      if (elapsedMs < startMs) return null;
      let pos = p.pos;
      if (r.stepTo !== undefined) {
        const to = anchor(r.stepTo), span = spec!.durationS * 1000 - startMs, t = span > 0 ? Math.min((elapsedMs - startMs) / span, 1) : 1;
        pos = { x: p.pos.x + (to.x - p.pos.x) * t, z: p.pos.z + (to.z - p.pos.z) * t };
      }
      const toward = r.face === 'target' ? anchor(spec!.target) : player;
      const dx = toward.x - pos.x, dz = toward.z - pos.z;
      if (dx === 0 && dz === 0) return { pos, heading: p.heading };
      const h = headingOf(dx, dz);
      return { pos, heading: r.face === 'away' ? h + HALF_TURN : h };
    },
    progress: () => (spec === null ? 0 : phase === 'idle' ? 0 : Math.min(elapsedMs / (spec.durationS * 1000), 1)),
  };
}

/**
 * Les entrées de relevé que l'acte du choix désigné écrira, lues sur le MÊME calcul que le moteur (`laneOutcome`) : c'est ainsi que la séquence
 * montre l'effet réel (tirage du contournement, composant trouvé, informateur) sans le décider. Vide pour un acte qui n'est pas une voie du
 * checkpoint, ou que le moteur refuse (le refus s'affichera à l'application).
 */
export function effectEntries(s: StreetState, ctx: StreetContext, clock: GameClock): readonly string[] {
  const c = confirm(s, ctx, clock);
  if (c.act === null || c.act.kind !== 'lane') return [];
  try { return laneOutcome(s, ctx, c.act).entries; } catch { return []; }
}
