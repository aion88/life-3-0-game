/**
 * Schémas des réglages d'interface : thème, appariement du triptyque, temps d'interface [plan 03 T1].
 * Tout est strict : une clé inconnue est un `DataLoadError` avec son chemin. Les durées du fast-forward ne sont PAS ici,
 * elles se lisent de `fastforward/timeline.ts` [R-03.3].
 */
import { z } from 'zod';
import { runParse } from './common';
import type { WorldVar } from '../../shared/types';
import { sourced } from './sourced';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'couleur #RRGGBB attendue');
const posInt = z.number().int().positive();
const unit = z.number().min(0).max(1);
const ms = z.number().positive();
const worldVarName = z.enum(['aiPower', 'order', 'abundance', 'freedom', 'surveillance', 'unrest']);

/** Les treize jetons de la palette C [spec C §1, P-13]. */
export const PALETTE_TOKENS = [
  'encre', 'encreDouce', 'creme', 'blanc', 'lavande', 'lavandeClaire', 'lavandeTrait', 'rose', 'roseFonce', 'ciel', 'soleil', 'menthe', 'grisAcier',
] as const;
export type PaletteToken = (typeof PALETTE_TOKENS)[number];
const paletteToken = z.enum(PALETTE_TOKENS);

export const SHADOW_TOKENS = ['rose', 'ciel', 'soleil', 'menthe', 'encre'] as const;
export type ShadowToken = (typeof SHADOW_TOKENS)[number];

export const TYPE_ROLES = [
  'screenTitle', 'bilanTitle', 'worldName', 'worldClear', 'redirectLine', 'line', 'streetOption', 'questionOption', 'body', 'priceLine',
  'braceletNumber', 'braceletUnit', 'hint', 'narration', 'nameChip', 'card', 'evening', 'dayLabel', 'kitLabel', 'kitState', 'fate', 'message', 'controls', 'cost',
] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];

export const MOTION_IDS = [
  'designate', 'undesignate', 'confirmPress', 'confirmRelease', 'fadeOthers', 'costReveal', 'bubbleIn', 'bubbleOut', 'optionsIn', 'priceReveal',
  'coin', 'shutter', 'braceletSettle', 'confetti', 'message', 'refusalShake', 'pageChange', 'cardIn',
] as const;
export type MotionId = (typeof MOTION_IDS)[number];

export const EASING_IDS = ['pop', 'sortie', 'rentree'] as const;
export type EasingId = (typeof EASING_IDS)[number];

/** Ombre pleine : `#RRGGBB` ou `rgba(r,g,b,a)` [spec C §1]. */
const shadowColor = z.string().regex(/^(#[0-9A-Fa-f]{6}|rgba\(\d+,\s*\d+,\s*\d+,\s*(0|1|0?\.\d+)\))$/, 'ombre #RRGGBB ou rgba() attendue');
const typeSpec = z.strictObject({
  family: z.enum(['display', 'text']),
  weight: z.union([z.literal(400), z.literal(500), z.literal(600)]),
  px: z.number().positive(),
  lineHeight: z.number().positive(),
});
const textPair = z.strictObject({ fg: paletteToken, bg: paletteToken });
const num = sourced(z.number());
const bool = sourced(z.boolean());

/** Jetons de couleur, police et mise en page du mur de CRT [art bible §B.1 et §E ; brouillon du 2026-10-29]. */
export const themeSchema = z.strictObject({
  schema: z.literal(1),
  colors: z.strictObject({
    base: hex, mid: hex, light: hex, sodium: hex, crtCyan: hex, crtMagenta: hex, crtPale: hex,
    panelBg: hex, panelText: hex, band: hex,
  }),
  fontUi: z.string().min(1),
  /** Piles de polices de l'interface C [spec C §2] : titres et chiffres (Montserrat), texte (Inter). */
  fontDisplay: z.string().min(1),
  fontText: z.string().min(1),
  letterboxRatio: z.number().min(1),
  wall: z.strictObject({
    columns: posInt, rows: posInt,
    gapRatio: z.number().min(0).max(0.4),
    snowGrid: z.tuple([posInt, posInt]),
    noiseMs: posInt,
    gainMin: z.number().min(0).max(1),
    /** Noir de l'écran éteint et du fond du mur : plus sombre que `colors.base`, sinon la fiche n'a aucun noir (§G). */
    screenOff: hex,
    screenInset: unit, darkGlintAlpha: unit, glintHeight: unit, snowAlpha: unit,
  }),
  fadedOpacity: unit,
  /** Interface C « Merci ! » [spec C §1] : treize jetons, cinq ombres pleines. */
  palette: z.record(paletteToken, sourced(hex)),
  shadows: z.record(z.enum(SHADOW_TOKENS), sourced(shadowColor)),
  type: z.record(z.enum(TYPE_ROLES), sourced(typeSpec)),
  minTextPx: sourced(z.literal(18)),
  minLineHeight: sourced(z.literal(1.25)),
  /** Paires texte/fond permises (4,5:1 au moins) et interdites [spec C §1, I-2]. */
  textPairs: sourced(z.array(textPair).min(1)),
  forbiddenPairs: sourced(z.array(textPair).min(1)),
  shape: z.strictObject({ cardMain: num, cardSecondary: num, pill: num, bubble: num, border: num, focusRing: num, worldNameMin: num, shadowOffset: num, shadowOffsetCard: num, cardPadX: num, cardPadY: num, maxStaticRotationDeg: num }),
  questionnaire: z.strictObject({
    cardMaxWidthPx: num, eyeDiscPx: num, dateRotationDeg: num, designatedScale: num, designatedRotationDeg: num,
    optionBorderPx: num, optionDotRingPx: num, dotPx: num, dotRingPx: num,
  }),
  street: z.strictObject({
    optionRestWidthPx: num, optionDesignatedWidthPx: num, designatedRotationDeg: num, cardRotationDeg: num, designatedRimPx: num, eyePx: num, smallTargetPx: num, optionPadYPx: num, optionPadStartPx: num, optionPadEndPx: num, optionSmallPadYPx: num, optionSmallPadStartPx: num, optionSmallGapPx: num, panelInkOpacity: num, pupilPx: num, glintPx: num, glintOffsetXPx: num, glintOffsetYPx: num, coinPx: num,
    personMarginPx: num, bustShare: num, bubbleReducedScale: num, headShare: num, referenceWidthPx: num, bubbleMaxWidthPx: num, bubbleMaxWidthShare: num, nameChipPadYPx: num, nameChipPadXPx: num, nameChipGapPx: num, recapMaxHeightPx: num, recapMaxHeightShare: num, arrowKeys: bool,
    hidePricePillFor: sourced(z.array(z.string().min(1))),
    nameChip: sourced(z.literal('whenCardRead')),
    dayDate: sourced(z.enum(['always', 'dawn'])),
  }),
}).superRefine((t, ctx) => {
  for (const f of t.forbiddenPairs.v) {
    if (t.textPairs.v.some((p) => p.fg === f.fg && p.bg === f.bg)) {
      ctx.addIssue({ code: 'custom', path: ['textPairs'], message: `paire à la fois permise et interdite : ${f.fg}/${f.bg}` });
    }
  }
});

/** Appariement des six variables sur trois bandes [GDD 02 §3.7 l. 149] et quantités dessinées par bande [builder]. */
export const triptychSchema = z.strictObject({
  schema: z.literal(1),
  bands: z.strictObject({
    sky: z.tuple([worldVarName, worldVarName]),
    city: z.tuple([worldVarName, worldVarName]),
    ground: z.tuple([worldVarName, worldVarName]),
  }),
  render: z.strictObject({
    stars: posInt, beams: posInt, buildings: posInt, windowsPerBuilding: posInt, paths: posInt, cracks: posInt,
    starAlphaBase: unit, starAlphaSwing: unit, twinkleMs: ms, beamSwayMs: ms, beamSway: unit, beamAlpha: unit, beamConverge: unit,
    buildingMinRel: unit, buildingSpanRel: unit, orderFloor: unit, pathAlpha: unit, crackSpan: z.number().min(0),
    crackAlphaBase: unit, crackAlphaSwing: unit, crackMs: ms,
  }),
}).superRefine((t, ctx) => {
  const all: WorldVar[] = [...t.bands.sky, ...t.bands.city, ...t.bands.ground];
  const seen = new Set<string>();
  all.forEach((v, i) => {
    if (seen.has(v)) ctx.addIssue({ code: 'custom', path: ['bands'], message: `variable en double : ${v} (position ${i})` });
    seen.add(v);
  });
  if (seen.size !== 6) ctx.addIssue({ code: 'custom', path: ['bands'], message: 'les six variables doivent apparaître exactement une fois' });
});

/** Valeurs d'interface sans source moteur [GDD 02 §3.9, §3.10 ; GDD 01 §3.2 étape 4, §8]. */
export const timingSchema = z.strictObject({
  schema: z.literal(1),
  causesEditionsMs: z.tuple([posInt, posInt, posInt]),
  costDelayMs: posInt,
  minReadMs: posInt,
  speeds: z.tuple([z.literal(1), z.literal(2), z.literal(4)]),
  wallExitMs: posInt,
  /** Plafond de l'écart entre deux images (ms) : un onglet resté caché ne fait jamais sauter l'horloge [builder]. */
  maxFrameMs: posInt,
  /** Courbes et mouvements de l'interface C [spec C §4] ; jus et plafonds [spec C §4, I-9]. */
  easings: z.record(z.enum(EASING_IDS), sourced(z.string().regex(/^cubic-bezier\(/, 'cubic-bezier attendu'))),
  motion: z.record(
    z.enum(MOTION_IDS),
    sourced(z.strictObject({
      ms: z.number().positive(), easing: z.enum(EASING_IDS), delayMs: z.number().min(0), staggerMs: z.number().min(0),
      /** Grandeurs du §4 (px, échelles, degrés) lues par `motionFor` ; vide quand l'appelant les porte (thème, exécution). */
      params: z.record(z.string(), z.number()),
    })),
  ),
  juice: z.strictObject({ maxCoins: sourced(z.literal(12)), confettiPieces: sourced(z.literal(40)), reducedMaxMs: sourced(z.literal(120)) }),
  /**
   * Durée d'écran du fast-forward jusqu'en 2030 (pas `choiceStep`), à ×1, en secondes : 8 s, soit 2 s par une (team-lead 2026-11-03,
   * révisable par Cynthia, qui demandait 5 à 6 s : un passage court).
   * Remplace la table du GDD 02 §3.8 (56 s) pour l'écran ; les formules pures gardent la cadence du GDD par défaut (`GDD_PACE`).
   */
  fastForward: z.strictObject({ toChoiceSec: sourced(z.number().min(5).max(8)) }),
});

export type TypeSpec = z.infer<typeof typeSpec>;
export type TextPair = z.infer<typeof textPair>;
export type Theme = z.infer<typeof themeSchema>;
export type TriptychPairing = z.infer<typeof triptychSchema>;
export type Timing = z.infer<typeof timingSchema>;

export const parseTheme = (raw: unknown): Theme => runParse(themeSchema, raw, 'ui/theme.json');
export const parseTriptych = (raw: unknown): TriptychPairing => runParse(triptychSchema, raw, 'ui/triptych.json');
export const parseTiming = (raw: unknown): Timing => runParse(timingSchema, raw, 'ui/timing.json');
