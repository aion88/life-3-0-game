/**
 * Mesures de pixels et plafonds de l'art bible, pures et sans DOM : tout travaille sur un `Uint8ClampedArray`
 * RGBA en sRGB [art bible §B.1, §G ; méthode figée de `tools/art/mesure_photo.py`, 8eb631d].
 *
 * Méthode : Y' = 0,2126 R + 0,7152 G + 0,0722 B sur sRGB non linéarisé ; teintes en HSV sur les pixels de
 * saturation strictement supérieure à 0,25 et de valeur strictement supérieure à 0,15 ; bleu [180, 270[,
 * violet [270, 300[, magenta [300, 330[, sodium [20, 50[. Le dénominateur est le crop entier.
 * Les seuils S et V se décident en entiers (4 d > max ; 20 max > 765), les teintes sont arrondies à 1e-9 degré
 * pour que les frontières exactes (180, 300) ne dépendent pas d'un bruit de flottant.
 * Comparaison des comptes : `cap x total` avec une garde de 1e-9, jamais de flottant à la frontière.
 */

export interface Rgba { readonly data: Uint8ClampedArray; readonly width: number; readonly height: number }
export interface Crop { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** Fractions du crop ; `sectors` : pixels colorés ni bleus ni chauds (15 à 50 degrés), par secteur de 30 degrés. */
export interface HueShares { readonly blue: number; readonly violet: number; readonly magenta: number; readonly sodium: number; readonly sectors: readonly number[] }
export interface LuminanceStats { readonly meanY: number; readonly geHighOutsideMask: number; readonly ltBlack003: number; readonly ltBlack006: number; readonly ltBlack008: number }
/** `thirdHueMax` est strict (<) ; `accentMax` vaut pour le sodium ; les autres plafonds sont des maxima tolérés (<=). */
export interface CapProfile { readonly id: 'checkpoint' | 'street' | 'questionnaire'; readonly accentMax: number; readonly emissiveMax: number; readonly thirdHueMax: number; readonly thirdHueSkips: readonly ('violet' | 'magenta')[]; readonly violetMagentaMax: number | null; readonly magentaMax: number | null; readonly dominantOrNeutralMin: number }
export interface CapFinding { readonly code: string; readonly measured: number; readonly cap: number }

/** Profils de plafond [art bible §B.1 ; arbitrage team-lead 2026-11-01 ; sources relevées par AM-3, design/art/2026-11-05-amendement-plafonds-sources.md]. 12 % et 6 % ne valent que pour le questionnaire. */
export const PROFILES: Readonly<Record<CapProfile['id'], CapProfile>> = {
  street: { id: 'street', accentMax: 0.08, emissiveMax: 0.07, thirdHueMax: 0.03, thirdHueSkips: [], violetMagentaMax: null, magentaMax: null, dominantOrNeutralMin: 0.7 },
  checkpoint: { id: 'checkpoint', accentMax: 0.02, emissiveMax: 0.10, thirdHueMax: 0.03, thirdHueSkips: [], violetMagentaMax: null, magentaMax: null, dominantOrNeutralMin: 0.7 },
  questionnaire: { id: 'questionnaire', accentMax: 0.02, emissiveMax: 0.25, thirdHueMax: 0.03, thirdHueSkips: ['violet', 'magenta'], violetMagentaMax: 0.12, magentaMax: 0.06, dominantOrNeutralMin: 0.7 },
};

const GUARD = 1e-9;
const SECTOR_VIOLET = 9;
const SECTOR_MAGENTA = 10;
const HIGH_Y = 0.98;
const EMISSIVE_MASK_Y = 0.5;

/** Y' (Rec. 709 sur sRGB non linéarisé) d'un pixel 0..255, rendu dans [0, 1]. */
export function yPrime(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

interface Counts {
  total: number; blue: number; violet: number; magenta: number; sodium: number;
  neutral: number; sectors: number[];
}

function forEachPixel(img: Rgba, crop: Crop, fn: (r: number, g: number, b: number, x: number, y: number) => void): void {
  for (let y = crop.y; y < crop.y + crop.h; y++) {
    for (let x = crop.x; x < crop.x + crop.w; x++) {
      const i = (y * img.width + x) * 4;
      fn(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0, x, y);
    }
  }
}

/** Teinte en degrés [0, 360[ d'un pixel coloré, arrondie à 1e-9. `d` = max - min > 0. */
function hueDegrees(r: number, g: number, b: number, max: number, d: number): number {
  let h6: number;
  if (max === r) h6 = ((g - b) / d + 6) % 6;
  else if (max === g) h6 = (b - r) / d + 2;
  else h6 = (r - g) / d + 4;
  let h = Math.round(h6 * 60 * 1e9) / 1e9;
  if (h >= 360) h -= 360;
  return h;
}

/**
 * `skin` : masque de peau (blanc = matériau de peau, même taille que `img`). Ces pixels ne comptent ni dans le sodium ni dans les secteurs de
 * troisième teinte : la peau fait partie de la base [art bible §B.1, « comme la peau » et « hors peau et chaud commun »].
 */
function count(img: Rgba, crop: Crop, skin?: Rgba): Counts {
  const c: Counts = { total: crop.w * crop.h, blue: 0, violet: 0, magenta: 0, sodium: 0, neutral: 0, sectors: new Array<number>(12).fill(0) };
  forEachPixel(img, crop, (r, g, b, x, y) => {
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (4 * d <= max || 20 * max <= 765) { c.neutral++; return; }   // S <= 0,25 ou V <= 0,15
    const isSkin = skin !== undefined && yPrime(skin.data[(y * skin.width + x) * 4] ?? 0, skin.data[(y * skin.width + x) * 4 + 1] ?? 0, skin.data[(y * skin.width + x) * 4 + 2] ?? 0) > EMISSIVE_MASK_Y;
    const h = hueDegrees(r, g, b, max, d);
    const blue = h >= 180 && h < 270;
    if (blue) c.blue++;
    else if (h >= 270 && h < 300) c.violet++;
    else if (h >= 300 && h < 330) c.magenta++;
    if (isSkin) return;
    if (h >= 20 && h < 50) c.sodium++;
    if (!blue && !(h >= 15 && h < 50)) c.sectors[Math.floor(h / 30)] = (c.sectors[Math.floor(h / 30)] ?? 0) + 1;
  });
  return c;
}

/** Parts du crop par famille de teinte (pixels de saturation et de valeur strictement au-dessus des seuils). */
export function hueShares(img: Rgba, crop: Crop): HueShares {
  const c = count(img, crop);
  const t = c.total;
  return { blue: c.blue / t, violet: c.violet / t, magenta: c.magenta / t, sodium: c.sodium / t, sectors: c.sectors.map(n => n / t) };
}

function emissiveCount(mask: Rgba, crop: Crop): number {
  let n = 0;
  forEachPixel(mask, crop, (r, g, b) => { if (yPrime(r, g, b) > EMISSIVE_MASK_Y) n++; });
  return n;
}

/** Part du crop couverte par les sources émissives : un pixel du masque est émissif quand son Y' dépasse 0,5. */
export function maskShare(mask: Rgba, crop: Crop): number {
  return emissiveCount(mask, crop) / (crop.w * crop.h);
}

export function luminanceStats(img: Rgba, mask: Rgba, crop: Crop): LuminanceStats {
  const total = crop.w * crop.h;
  let sum = 0, high = 0, b3 = 0, b6 = 0, b8 = 0;
  forEachPixel(img, crop, (r, g, b, x, y) => {
    const Y = yPrime(r, g, b);
    sum += Y;
    if (Y < 0.03) b3++;
    if (Y < 0.06) b6++;
    if (Y < 0.08) b8++;
    if (Y >= HIGH_Y) {
      const i = (y * mask.width + x) * 4;
      if (yPrime(mask.data[i] ?? 0, mask.data[i + 1] ?? 0, mask.data[i + 2] ?? 0) <= EMISSIVE_MASK_Y) high++;
    }
  });
  return { meanY: sum / total, geHighOutsideMask: high / total, ltBlack003: b3 / total, ltBlack006: b6 / total, ltBlack008: b8 / total };
}

/** Image utile sans les bandes noires d'un cadrage d'`aspect` (largeur / hauteur) dans `width` x `height`. */
export function usefulCrop(width: number, height: number, aspect: number): Crop {
  if (aspect >= width / height) {
    const h = Math.floor(width / aspect);
    return { x: 0, y: Math.floor((height - h) / 2), w: width, h };
  }
  const w = Math.floor(height * aspect);
  return { x: Math.floor((width - w) / 2), y: 0, w, h: height };
}

const atMost = (n: number, total: number, cap: number): boolean => n <= cap * total + GUARD;
const below = (n: number, total: number, cap: number): boolean => n < cap * total - GUARD;

export function checkCaps(beauty: Rgba, mask: Rgba, crop: Crop, profile: CapProfile, skin?: Rgba): { readonly ok: boolean; readonly findings: readonly CapFinding[] } {
  const c = count(beauty, crop, skin);
  const t = c.total;
  const findings: CapFinding[] = [];
  const add = (code: string, n: number, cap: number): void => { findings.push({ code, measured: n / t, cap }); };

  if (!atMost(c.sodium, t, profile.accentMax)) add('accent', c.sodium, profile.accentMax);
  const em = emissiveCount(mask, crop);
  if (!atMost(em, t, profile.emissiveMax)) add('emissive', em, profile.emissiveMax);

  const skipped = new Set<number>();
  if (profile.thirdHueSkips.includes('violet')) skipped.add(SECTOR_VIOLET);
  if (profile.thirdHueSkips.includes('magenta')) skipped.add(SECTOR_MAGENTA);
  let worst = 0;
  c.sectors.forEach((n, s) => { if (!skipped.has(s)) worst = Math.max(worst, n); });
  if (!below(worst, t, profile.thirdHueMax)) add('thirdHue', worst, profile.thirdHueMax);

  if (profile.violetMagentaMax !== null && !atMost(c.violet + c.magenta, t, profile.violetMagentaMax)) add('violetMagenta', c.violet + c.magenta, profile.violetMagentaMax);
  if (profile.magentaMax !== null && !atMost(c.magenta, t, profile.magentaMax)) add('magenta', c.magenta, profile.magentaMax);

  const dominant = c.neutral + c.blue;   // « plus de 70 % » : strictement au-dessus
  if (!(dominant > profile.dominantOrNeutralMin * t + GUARD)) findings.push({ code: 'dominant', measured: dominant / t, cap: profile.dominantOrNeutralMin });
  return { ok: findings.length === 0, findings };
}

/** Contrôle C.7bis : Y' moyen de 0,08 à 0,65 ; au plus 5 % à 0,98 hors émissifs ; au plus 60 % sous 0,03. */
export function checkLuminance(stats: LuminanceStats): { readonly ok: boolean; readonly findings: readonly CapFinding[] } {
  const findings: CapFinding[] = [];
  if (stats.meanY < 0.08) findings.push({ code: 'meanY', measured: stats.meanY, cap: 0.08 });
  else if (stats.meanY > 0.65) findings.push({ code: 'meanY', measured: stats.meanY, cap: 0.65 });
  if (stats.geHighOutsideMask > 0.05 + GUARD) findings.push({ code: 'high', measured: stats.geHighOutsideMask, cap: 0.05 });
  if (stats.ltBlack003 > 0.6 + GUARD) findings.push({ code: 'dark', measured: stats.ltBlack003, cap: 0.6 });
  return { ok: findings.length === 0, findings };
}
