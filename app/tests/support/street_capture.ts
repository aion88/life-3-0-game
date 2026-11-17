/**
 * Aides des tests de la rue dans le navigateur [plan 02a T13] : un seul écrivain. Mesures de pixels pures (testées sous Vitest),
 * profil de couleur d'un PNG, décodage PAR LE NAVIGATEUR, ouverture de la page de capture et prise de plaque via `window.__street`.
 * Seuls les tests e2e de la rue (et `street_capture_support_test.ts`) importent ce fichier.
 */
import type { Page } from '@playwright/test';
import { inflateSync } from 'node:zlib';
import { LINES, seedJson, seedSave, type SeedActs, continueIfAsked } from './e2e';
import { PROFILES, usefulCrop, type CapProfile, type Crop, type Rgba } from '../../src/engine/view/caps';

/** Build de capture (`npm run build:capture`, servi sur 4174) et build de production (4173). */
export const CAPTURE_URL = process.env['CAPTURE_URL'] ?? `http://localhost:${process.env['CAPTURE_PORT'] ?? '4174'}/`;
export const PROD_URL = `http://localhost:${process.env['PREVIEW_PORT'] ?? '4173'}/`;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Profil de couleur déclaré par un PNG. Sans morceau de couleur, par convention sRGB ; `sRGB` ou un `iCCP` nommé sRGB, sRGB ;
 * un `iCCP` d'un autre nom rend ce nom ; un `gAMA` sans `sRGB` ni `iCCP` rend `gAMA <valeur>` sauf 0,45455 (la valeur que
 * la spécification PNG associe à sRGB). Lève sur ce qui n'est pas un PNG.
 */
export function pngColorProfile(png: Buffer): string {
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('pas un PNG (signature)');
  let gamma: number | null = null;
  let hasSrgb = false;
  for (let at = 8; at + 8 <= png.length;) {
    const len = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + len);
    if (type === 'iCCP') {
      const name = data.toString('latin1', 0, data.indexOf(0));
      void inflateSync(data.subarray(data.indexOf(0) + 2));   // le profil doit se décompresser : un morceau tronqué n'est pas un profil lisible
      return /^sRGB/i.test(name) ? 'sRGB' : name;
    }
    if (type === 'sRGB') hasSrgb = true;
    if (type === 'gAMA') gamma = data.readUInt32BE(0) / 100000;
    if (type === 'IDAT' || type === 'IEND') break;
    at += 12 + len;
  }
  if (hasSrgb || gamma === null || Math.abs(gamma - 0.45455) < 1e-3) return 'sRGB';
  return `gAMA ${gamma}`;
}

function sameSize(a: Rgba, b: Rgba): void {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`taille différente : ${a.width}x${a.height} contre ${b.width}x${b.height}`);
}

/** Plus grand écart absolu, sur un canal R, G ou B (l'alpha est ignoré), en niveaux 8 bits. */
export function maxAbsDiff(a: Rgba, b: Rgba): number {
  sameSize(a, b);
  let m = 0;
  for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0)));
  return m;
}

/** Différence moyenne absolue sur les canaux R, G, B de tous les pixels, en niveaux 8 bits (l'alpha est ignoré). */
export function meanAbsDiff(a: Rgba, b: Rgba): number {
  sameSize(a, b);
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 3; c++) sum += Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0));
  return sum / (a.width * a.height * 3);
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error('médiane d\'une liste vide');
  const s = [...xs].sort((p, q) => p - q);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Où le bloom a changé l'image : le nombre de pixels qui diffèrent entre `before` et `after`, et la plus grande distance (de
 * Tchebychev, en pixels) d'un pixel changé au pixel le plus proche du masque (Y' du masque au-dessus de 0,5 : un canal moyen suffit,
 * le masque est blanc ou noir). Un pixel est « changé » à partir de `minLevel` niveaux d'écart sur un canal (1 par défaut : tout écart).
 * Aucun pixel changé : `{ changed: 0, farthestPx: 0 }`.
 */
export function farthestChange(before: Rgba, after: Rgba, mask: Rgba, minLevel = 1): { changed: number; farthestPx: number } {
  sameSize(before, after); sameSize(before, mask);
  const w = before.width, h = before.height;
  const isMask = (x: number, y: number): boolean => (mask.data[(y * w + x) * 4] ?? 0) > 127;
  // distance de Tchebychev au masque, par deux passes (avant, arrière) : exacte pour cette norme
  const INF = 1e9;
  const dist = new Float64Array(w * h).fill(INF);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let d = isMask(x, y) ? 0 : INF;
    if (x > 0) d = Math.min(d, dist[y * w + x - 1]! + 1);
    if (y > 0) {
      d = Math.min(d, dist[(y - 1) * w + x]! + 1);
      if (x > 0) d = Math.min(d, dist[(y - 1) * w + x - 1]! + 1);
      if (x < w - 1) d = Math.min(d, dist[(y - 1) * w + x + 1]! + 1);
    }
    dist[y * w + x] = d;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    let d = dist[y * w + x]!;
    if (x < w - 1) d = Math.min(d, dist[y * w + x + 1]! + 1);
    if (y < h - 1) {
      d = Math.min(d, dist[(y + 1) * w + x]! + 1);
      if (x < w - 1) d = Math.min(d, dist[(y + 1) * w + x + 1]! + 1);
      if (x > 0) d = Math.min(d, dist[(y + 1) * w + x - 1]! + 1);
    }
    dist[y * w + x] = d;
  }
  let changed = 0, farthest = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const d = Math.max(Math.abs((before.data[i] ?? 0) - (after.data[i] ?? 0)), Math.abs((before.data[i + 1] ?? 0) - (after.data[i + 1] ?? 0)), Math.abs((before.data[i + 2] ?? 0) - (after.data[i + 2] ?? 0)));
    if (d >= minLevel) { changed++; farthest = Math.max(farthest, dist[y * w + x]!); }
  }
  return { changed, farthestPx: farthest };
}

// ------------------------------------------------------------------ navigateur

/**
 * Les plaques de rue [art bible §F lot 1 ; plan 02a T13] : pose, profil de plafond, masque d'émissifs mesuré, lumière, nom de fichier [art bible §G].
 * Plaque A : « mur de CRT à 6 % au plus » (§F, exemption §B.1), donc le masque des seize écrans ; B, C et le personnage : tous les émissifs [R-02a.14 b].
 */
export interface Plate { readonly pose: string; readonly profile: CapProfile['id']; readonly mask: 'screens' | 'all'; readonly light: 'heureBleue' | 'nuit' | 'jour'; readonly file: string }
export const PLATES: readonly Plate[] = [
  { pose: 'checkpoint-large', profile: 'checkpoint', mask: 'screens', light: 'heureBleue', file: 'env_w10-checkpoint_heure-bleue_large.png' },
  { pose: 'rue-nuit', profile: 'street', mask: 'all', light: 'nuit', file: 'env_w10-rue_nuit_large.png' },
  { pose: 'place-jour', profile: 'street', mask: 'all', light: 'jour', file: 'env_w10-place_jour_large.png' },
  { pose: 'personnage-2m', profile: 'street', mask: 'all', light: 'jour', file: 'env_w10-personnage-2m_jour_large.png' },
];
export const profileFor = (id: Plate['profile']): CapProfile => PROFILES[id];

/** Trois actes du J1 : le logement quitté (dernier acte à 430), la joueuse est dans la rue. */
export const STREET_ACTS: readonly SeedActs[] = [
  { day: 1, minute: 420, kind: 'choice', id: 'j1.phone', option: 'take' },
  { day: 1, minute: 421, kind: 'choice', id: 'j1.component', option: 'leave' },
  { day: 1, minute: 430, kind: 'exit', id: 'home', option: null },
];

/** Requête qui rend la marche libre au build de capture (`routeOf`, `src/street/screen.ts`). */
export const FREE_WALK = 'rue=libre';

export interface OpenOpts {
  /** Query de la page (`bloom=0`, `lut=off`, `webgl`…). `step` est ajouté sauf si `realtime` est vrai. */
  readonly query?: string;
  /** Boucle d'images RÉELLE (requestAnimationFrame), pour mesurer des temps d'image : les hooks `step`/`shoot` ne sont alors pas disponibles. */
  readonly realtime?: boolean;
  readonly acts?: readonly SeedActs[];
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Langue de la sauvegarde : `en` par défaut (les tests T13 lisent du texte anglais) ; les captures de preuve passent `fr` (décision GD, design/ui/2026-11-02-compteur-mur-crt-gd.md). */
  readonly lang?: 'fr' | 'en';
}

/**
 * Ouvre la rue du build de capture, en pas à pas, et attend que `__street` réponde. La sauvegarde est posée avant le premier script.
 * `rue=libre` : w10 est un monde guidé ; ces suites éprouvent la marche libre (`runtime.ts`), que seul le build de capture monte encore [rue guidée T14].
 */
export async function openCapture(page: Page, o: OpenOpts = {}): Promise<void> {
  await page.setViewportSize(o.viewport ?? { width: 1920, height: 1080 });
  await seedSave(page, seedJson({ lang: o.lang ?? 'en', phase: 'street', line: LINES.w10, acts: o.acts ?? STREET_ACTS }));
  const q = ['episode=semaine', FREE_WALK, o.realtime === true ? '' : 'step', o.query ?? ''].filter((x) => x !== '').join('&');
  await page.goto(`${CAPTURE_URL}${q === '' ? '' : `?${q}`}`);
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  await page.waitForFunction(() => '__street' in window);
  if (o.realtime !== true) await st(page, 'step', 0);
}

/**
 * La file en place, et la chaîne de rendu chauffée : 3 s de rue sans rendre, puis des images rendues à intervalles RÉELS. Les pipelines WebGPU
 * se compilent en asynchrone : les premières images après l'ouverture sont fausses (fond bleu pâle, mesuré sur Chrome 156 / Metal), le temps
 * qui passe compte, pas le nombre d'images.
 */
export async function settle(page: Page, ms = 3000): Promise<void> {
  await st(page, 'step', ms, { render: false });
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(400); await st(page, 'step', 0); }
}

export const pngSize = (png: Buffer): { width: number; height: number } => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

/** Un appel de `window.__street.<method>(...args)` dans la page. */
export function st<K extends keyof StreetApi>(page: Page, method: K, ...args: Parameters<StreetApi[K]>): Promise<ReturnType<StreetApi[K]>> {
  return page.evaluate(([m, a]) => ((window as unknown as { __street: Record<string, (...x: unknown[]) => unknown> }).__street[m as string]!)(...(a as unknown[])), [method, args] as const) as Promise<ReturnType<StreetApi[K]>>;
}

/** Forme de `window.__street` vue par les tests (la source est `src/street/capture.ts`). */
export interface StreetApi {
  step(ms: number, o?: { render?: boolean }): void;
  state(): { street: Record<string, unknown>; week: Record<string, unknown>; live: { clock: { day: number; minute: number } }; player: { x: number; z: number }; mode: 'walk' | 'observation'; ended: boolean };
  cameraDir(): { x: number; z: number };
  cameraOccluders(chestM?: number): string[];
  forwardClearance(chestM?: number, maxM?: number): { m: number; name: string } | null;
  playerNdc(chestM?: number): { x: number; y: number; front: boolean };
  replayed(acts: readonly unknown[]): { street: Record<string, unknown>; week: Record<string, unknown> };
  act(a: { day: number; minute: number; kind: string; id: string; option: string | null }): { ok: boolean };
  setLight(s: 'jour' | 'heureBleue' | 'nuit' | null): void;
  pose(name: string | null): void;
  placeAt(x: number, z: number, heading: number): void;
  peopleFeet(): { id: string; x: number; y: number }[];
  personRect(id: string): { x: number; y: number; w: number; h: number } | null;
  setScreens(visible: boolean): void;
  setWindows(visible: boolean): void;
  providerNeutral(): boolean;
  backend(): 'webgpu' | 'webgl2';
  stats(): { drawCalls: number; triangles: number };
  shoot(kind?: 'beauty' | 'mask' | 'screens' | 'skin'): Promise<string>;
}

/** PNG (octets) du canvas : rendu de la pose courante (`beauty`), masque de tous les émissifs (`mask`) ou des seuls écrans (`screens`). */
export async function shootPng(page: Page, kind: 'beauty' | 'mask' | 'screens' | 'skin' = 'beauty'): Promise<Buffer> {
  const url = await st(page, 'shoot', kind);
  return Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64');
}

/**
 * Décode un PNG PAR LE NAVIGATEUR (`createImageBitmap`, `colorSpaceConversion: 'default'`, puis `getImageData` sur un canvas sRGB)
 * pour obtenir de l'sRGB 8 bits [art bible §G]. `crop` rogne les bandes dans la page, avant le transfert.
 */
export async function decodeInBrowser(page: Page, png: Buffer, crop?: Crop): Promise<Rgba> {
  const r = await page.evaluate(async ({ b64, crop: c }) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { colorSpaceConversion: 'default' });
    const rect = c ?? { x: 0, y: 0, w: bmp.width, h: bmp.height };
    const cv = new OffscreenCanvas(rect.w, rect.h);
    const ctx = cv.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })!;
    ctx.drawImage(bmp, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const data = ctx.getImageData(0, 0, rect.w, rect.h).data;
    let out = '';
    for (let i = 0; i < data.length; i += 0x8000) out += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return { b64: btoa(out), width: rect.w, height: rect.h };
  }, { b64: png.toString('base64'), crop });
  return { data: new Uint8ClampedArray(Buffer.from(r.b64, 'base64')), width: r.width, height: r.height };
}

/** PNG -> sRGB 8 bits, sans bandes : le cadrage 2,39:1 des plaques est rogné par `usefulCrop`. */
export async function decodePlate(page: Page, png: Buffer, width: number, height: number, aspect = 2.39): Promise<{ img: Rgba; crop: Crop }> {
  const full = usefulCrop(width, height, aspect);
  return { img: await decodeInBrowser(page, png, full), crop: { x: 0, y: 0, w: full.w, h: full.h } };
}
