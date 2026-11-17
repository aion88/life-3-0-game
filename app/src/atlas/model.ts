/**
 * Atlas des futurs : logique pure (filtres, comptes, cellules de la matrice, frise, dates). Ni DOM, ni `Date`, ni hasard :
 * les dates sont des chaînes ISO lues à la main, les jours se comptent par l'algorithme civil.
 */
import { HIDDEN_WORLDS, OUT_OF_LAW_WORLDS } from './config';
import { FR, type Labels, type Lang } from './labels';
import { STADES, type AtlasData, type Chiffre, type Loi, type MondeId, type Stade } from './schema';

/** Ce qu'une cellule de la matrice dessine : rond plein, rond creux, barre, petit point (même levier seulement). */
export type CellKind = 'direct' | 'indirect' | 'frein' | 'dot';

export const CELL_WORD: Readonly<Record<CellKind, string>> = FR.cellWord;

export const STADE_KEY: Readonly<Record<Stade, string>> = {
  'en vigueur': 'vig',
  adoptée: 'ado',
  'en débat': 'deb',
  déposée: 'dep',
  annoncée: 'ann',
  'censurée ou rejetée': 'cen',
  expirée: 'exp',
};

/** Libellé de légende d'un stade (« déposée » couvre aussi « enregistrée »). */
export const STADE_LEGEND: Readonly<Record<Stade, string>> = FR.stadeLegend as Readonly<Record<Stade, string>>;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** « 2026-11-14 » devient « 14 novembre 2026 » ; un mois seul devient « mai 2025 » ; un texte libre perd sa parenthèse. */
export function formatDate(s: string, L: Labels = FR): string {
  const d = ISO.exec(s);
  if (d) return L.dateDay(Number(d[3]), Number(d[2]), d[1] ?? '');
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) return L.dateMonth(Number(m[2]), m[1] ?? '');
  const a = /^avant le (\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (a) return L.dateBefore(Number(a[3]), Number(a[2]), a[1] ?? '');
  return s.split(/\s*\(/)[0] ?? s;
}

/** Numéro de jour (algorithme civil), pour placer une date sur la frise sans `Date`. */
export function dayNumber(iso: string): number {
  const d = ISO.exec(iso);
  if (!d) throw new Error(`date ISO attendue : ${iso}`);
  let y = Number(d[1]);
  const m = Number(d[2]);
  const day = Number(d[3]);
  if (m <= 2) y -= 1;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe;
}

export const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n > 1 ? many : one}`;

/** Clé de cellule : une loi, un monde. */
const key = (loi: string, monde: string): string => `${loi}|${monde}`;

/** Les cellules de la matrice : liens (plein, creux, barre) puis « même levier seulement » là où rien d'autre n'est dit. */
export function buildCells(data: AtlasData): ReadonlyMap<string, readonly CellKind[]> {
  const cells = new Map<string, CellKind[]>();
  for (const l of data.lois) {
    for (const k of l.liens) {
      const kind: CellKind = k.sens === 'frein' ? 'frein' : k.force;
      const list = cells.get(key(l.id, k.monde)) ?? [];
      list.push(kind);
      cells.set(key(l.id, k.monde), list);
    }
  }
  const worldsOfLever = new Map<string, string[]>();
  for (const m of data.mondes) for (const lv of m.leviers) worldsOfLever.set(lv.id, [...(worldsOfLever.get(lv.id) ?? []), m.id]);
  for (const l of data.lois) {
    if (!l.levier) continue;
    for (const w of worldsOfLever.get(l.levier.id) ?? []) if (!cells.has(key(l.id, w))) cells.set(key(l.id, w), ['dot']);
  }
  return cells;
}

export const cellOf = (cells: ReadonlyMap<string, readonly CellKind[]>, loi: string, monde: string): readonly CellKind[] =>
  cells.get(key(loi, monde)) ?? [];

/** Une loi « touche » un monde quand la matrice lui donne un lien ou un frein, pas seulement un point. */
const touches = (l: Loi, w: string): boolean => l.liens.some((k) => k.monde === w);

export interface Counts {
  readonly textes: number;
  readonly touchent10: number;
  readonly freins10: number;
  readonly mondesSansLevier: readonly MondeId[];
  readonly parMonde: Readonly<Record<string, { readonly liens: number; readonly points: number }>>;
  readonly parLevier: Readonly<Record<string, Readonly<Record<Stade, number>>>>;
}

const zeroStades = (): Record<Stade, number> => ({
  'en vigueur': 0, adoptée: 0, 'en débat': 0, déposée: 0, annoncée: 0, 'censurée ou rejetée': 0, expirée: 0,
});

export function counts(data: AtlasData): Counts {
  const cells = buildCells(data);
  const parLevier: Record<string, Record<Stade, number>> = {};
  for (const lv of data.leviers) parLevier[lv.id] = zeroStades();
  for (const l of data.lois) if (l.levier) { const row = parLevier[l.levier.id]; if (row) row[l.stade] += 1; }
  const parMonde: Record<string, { liens: number; points: number }> = {};
  for (const m of data.mondes) {
    let liens = 0;
    let points = 0;
    for (const l of data.lois) {
      const c = cellOf(cells, l.id, m.id);
      if (c.length === 0) continue;
      if (c.every((x) => x === 'dot')) points += 1; else liens += 1;
    }
    parMonde[m.id] = { liens, points };
  }
  const total = (id: string): number => Object.values(parLevier[id] ?? {}).reduce((a, b) => a + b, 0);
  const t10 = data.lois.filter((l) => touches(l, 'w10'));
  return {
    textes: data.lois.length,
    touchent10: t10.length,
    freins10: t10.filter((l) => l.liens.some((k) => k.monde === 'w10' && k.sens === 'frein')).length,
    mondesSansLevier: data.mondes.filter((m) => !m.leviers.some((lv) => total(lv.id) > 0)).map((m) => m.id),
    parMonde,
    parLevier,
  };
}

export type PlateKind = 'direct' | 'indirect' | 'frein' | 'both';

export interface Plate {
  /** Une case par texte contrôlé : d'abord les textes liés au monde (direct, indirect, frein, indirect et frein), puis les cases vides. */
  readonly cases: readonly (PlateKind | null)[];
  readonly nombre: Readonly<Record<PlateKind, number>>;
  /** Textes à la fois liés vers le monde en direct ET freins : la légende « indirect et frein » ne les décrirait pas. */
  readonly directEtFrein: number;
  readonly total: number;
  readonly vides: number;
}

/** La planche du constat : les textes de loi comptés un par un selon leur lien avec le monde 1984 (w10). Tout vient du calcul, rien d'écrit en dur. */
export function plate(data: AtlasData, monde: string = 'w10'): Plate {
  const nombre: Record<PlateKind, number> = { direct: 0, indirect: 0, frein: 0, both: 0 };
  let directEtFrein = 0;
  for (const l of data.lois) {
    const ks = l.liens.filter((k) => k.monde === monde);
    if (ks.length === 0) continue;
    const frein = ks.some((k) => k.sens === 'frein');
    const direct = ks.some((k) => k.sens !== 'frein' && k.force === 'direct');
    const vers = ks.some((k) => k.sens !== 'frein');
    if (frein && direct) directEtFrein += 1;
    const kind: PlateKind = frein ? (vers ? 'both' : 'frein') : direct ? 'direct' : 'indirect';
    nombre[kind] += 1;
  }
  const order: readonly PlateKind[] = ['direct', 'indirect', 'frein', 'both'];
  const lies = order.flatMap((k) => Array<PlateKind>(nombre[k]).fill(k));
  const total = data.lois.length;
  return { cases: [...lies, ...Array<null>(Math.max(0, total - lies.length)).fill(null)], nombre, directEtFrein, total, vides: Math.max(0, total - lies.length) };
}

export interface Filter {
  readonly juridiction?: string;
  readonly stade?: string;
  readonly avecLien?: boolean;
}

/** Les lois gardées par les filtres, dans l'ordre des thèmes. */
export function filterLois(data: AtlasData, f: Filter): readonly Loi[] {
  const cells = buildCells(data);
  const byId = new Map(data.lois.map((l) => [l.id, l]));
  const out: Loi[] = [];
  for (const t of data.themes) {
    for (const id of t.lois) {
      const l = byId.get(id);
      if (!l) continue;
      if (f.juridiction && l.juridiction !== f.juridiction) continue;
      if (f.stade && l.stade !== f.stade) continue;
      if (f.avecLien && !data.mondes.some((m) => cellOf(cells, l.id, m.id).length > 0)) continue;
      out.push(l);
    }
  }
  return out;
}

/** Les lois liées à un monde (lien ou point), dans l'ordre des thèmes ; `none` : celles sans aucune cellule. */
export function loisOfWorld(data: AtlasData, w: MondeId | 'none'): readonly Loi[] {
  const cells = buildCells(data);
  return filterLois(data, {}).filter((l) =>
    w === 'none' ? !data.mondes.some((m) => cellOf(cells, l.id, m.id).length > 0) : cellOf(cells, l.id, w).length > 0);
}

/** Tri par date de stade : les dates au jour près d'abord (croissantes), le reste ensuite. */
export function byDate(a: Loi, b: Loi): number {
  if (a.date_jour && b.date_jour) return a.date_jour < b.date_jour ? -1 : a.date_jour > b.date_jour ? 1 : 0;
  return a.date_jour ? -1 : b.date_jour ? 1 : 0;
}

/** Le monde que la fin du jeu allume : l'identifiant s'il existe, sinon rien. */
export function litWorld(data: AtlasData, arrival: string | undefined): MondeId | null {
  return data.mondes.find((m) => m.id === arrival)?.id ?? null;
}

// ---- frise ------------------------------------------------------------------------------------------------------------------

export interface TimelineMark { readonly id: string; readonly x: number; readonly row: number; readonly jur: Loi['juridiction'] }
export interface Timeline {
  readonly width: number;
  readonly height: number;
  readonly years: readonly { readonly year: number; readonly x: number; readonly label: boolean }[];
  readonly todayX: number;
  readonly lanes: readonly { readonly jur: Loi['juridiction']; readonly y: number; readonly rows: number }[];
  readonly marks: readonly (TimelineMark & { readonly y: number })[];
  readonly dated: readonly Loi[];
  readonly undated: readonly Loi[];
}

export function buildTimeline(data: AtlasData): Timeline {
  const W = 1000, left = 70, right = 20, step = 20, gap = 17;
  const dated = data.lois.filter((l) => l.date_jour !== null).sort(byDate);
  const undated = data.lois.filter((l) => l.date_jour === null);
  const firstYear = Number((dated[0]?.date_jour ?? data.as_of).slice(0, 4));
  const d0 = dayNumber(`${firstYear}-01-01`);
  const d1 = dayNumber(data.as_of);
  const span = d1 - d0 || 1;
  const X = (iso: string): number => left + ((dayNumber(iso) - d0) / span) * (W - left - right);
  const lanesOrder: readonly Loi['juridiction'][] = ['FR', 'UE', 'INT'];
  const placed: Record<string, { row: number; x: number }[]> = { FR: [], UE: [], INT: [] };
  const raw: TimelineMark[] = [];
  for (const l of dated) {
    const x = X(l.date_jour as string);
    const list = placed[l.juridiction] ?? [];
    let row = 0;
    while (list.some((p) => p.row === row && Math.abs(p.x - x) < gap)) row += 1;
    list.push({ row, x });
    raw.push({ id: l.id, x, row, jur: l.juridiction });
  }
  let y = 20;
  const lanes = lanesOrder.map((jur) => {
    const rows = Math.max(1, ...raw.filter((m) => m.jur === jur).map((m) => m.row + 1));
    const lane = { jur, y, rows };
    y += rows * step + 26;
    return lane;
  });
  const years: { year: number; x: number; label: boolean }[] = [];
  const lastYear = Number(data.as_of.slice(0, 4));
  const todayX = X(data.as_of);
  for (let yr = firstYear; yr <= lastYear; yr += 1) {
    const x = X(`${yr}-01-01`);
    years.push({ year: yr, x, label: todayX - x > 150 });
  }
  const laneY = new Map(lanes.map((l) => [l.jur, l.y]));
  return {
    width: W,
    height: y + 28,
    years,
    todayX,
    lanes,
    marks: raw.map((m) => ({ ...m, y: (laneY.get(m.jur) ?? 0) + m.row * step + 4 })),
    dated,
    undated,
  };
}

// ---- chiffres ---------------------------------------------------------------------------------------------------------------

/** La valeur en grand : entiers groupés par espaces insécables fines (virgules en anglais), décimale à la virgule (point en anglais), « % » si l'unité commence par %. */
export function bigValue(c: Chiffre, L: Labels = FR): { readonly big: string; readonly rest: string } {
  let big: string;
  if (typeof c.valeur === 'number') {
    big = L.lang === 'en' ? L.num(c.valeur) : Number.isInteger(c.valeur) ? String(c.valeur).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') : String(c.valeur).replace('.', ',');
  } else big = c.valeur;
  let rest = c.unite;
  if (rest.startsWith('%')) {
    big = L.lang === 'en' ? `${big}%` : `${big} %`;
    rest = rest.slice(1).replace(/^\s+/, '');
  }
  return { big, rest };
}

export { STADES };

// ---- affichage --------------------------------------------------------------------------------------------------------------

/** Les données telles que l'écran les montre : les mondes masqués par `HIDDEN_WORLDS` en moins. Tous les comptes en découlent. */
export function displayed(data: AtlasData, hidden: readonly string[] = HIDDEN_WORLDS): AtlasData {
  return { ...data, mondes: data.mondes.filter((m) => !hidden.includes(m.id)) };
}

/** Un nombre de 0 à 12 en lettres (aucun chiffre en dur dans les phrases qui comptent des mondes). */
export const nombreEnLettres = (n: number, L: Labels = FR): string => L.nombre(n);

/** Forme de `data.en.json` : les traductions anglaises, par identifiant, jamais mêlées au registre. */
export interface EnglishData {
  readonly lois: Readonly<Record<string, Record<string, unknown>>>;
  readonly chiffres: Readonly<Record<string, Record<string, unknown>>>;
  readonly horsdroit: Readonly<Record<string, Record<string, unknown>>>;
  readonly mondes: Readonly<Record<string, Record<string, unknown>>>;
  readonly leviers: Readonly<Record<string, Record<string, unknown>>>;
  readonly themes: Readonly<Record<string, Record<string, unknown>>>;
  readonly reperes: Readonly<Record<string, Record<string, unknown>>>;
}

/** Pose les traductions anglaises (fichier à part) dans le champ `en` de chaque entrée ; une entrée sans traduction reste telle quelle. */
export function withEnglish(data: AtlasData, en: EnglishData): AtlasData {
  const plain = (o: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
    if (!o) return undefined;
    return Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'liens'));
  };
  const put = <T extends { id: string }>(rows: readonly T[], tr: Readonly<Record<string, Record<string, unknown>>>): T[] =>
    rows.map((r) => (tr[r.id] ? ({ ...r, en: plain(tr[r.id]) } as T) : r));
  return {
    ...data,
    leviers: put(data.leviers, en.leviers),
    themes: put(data.themes, en.themes),
    mondes: put(data.mondes, en.mondes),
    reperes: put(data.reperes, en.reperes),
    chiffres: put(data.chiffres, en.chiffres),
    horsdroit: put(data.horsdroit, en.horsdroit),
    lois: data.lois.map((l) => {
      const t = en.lois[l.id];
      if (!t) return l;
      const liens = (t['liens'] ?? {}) as Record<string, Record<string, unknown>>;
      return { ...l, en: plain(t), liens: l.liens.map((k) => { const x = liens[`${k.monde}:${k.sens}`] ?? liens[k.monde]; return x ? { ...k, en: x } : k; }) } as Loi;
    }),
  } as AtlasData;
}

/** Les données validées, avec la traduction anglaise quand elle est fournie (fichier à part, jamais dans les registres). */
export function buildAtlas(full: AtlasData, en?: EnglishData): AtlasData {
  return en ? withEnglish(full, en) : full;
}

/**
 * Les données dans la langue demandée : chaque champ qui a une traduction `en` la prend, les autres restent en français.
 * Les citations, les dates ISO, les URL, les empreintes et les identifiants ne sont jamais remplacés.
 */
export function localize(data: AtlasData, lang: Lang): AtlasData {
  if (lang === 'fr') return data;
  const over = <T extends { en?: object | undefined }>(o: T): T => {
    const en = o.en as Record<string, unknown> | undefined;
    if (!en) return o;
    const out = { ...o } as Record<string, unknown>;
    for (const [k, v] of Object.entries(en)) if (typeof v === 'string' && v.length > 0) out[k] = v;
    return out as T;
  };
  const chiffre = (c: Chiffre): Chiffre => {
    const o = over(c);
    const j = c.en?.jauge;
    if (!c.jauge || !j) return o;
    const seuils = c.jauge.seuils.map((s, i) => ({ ...s, libelle: j.seuils?.[i] ?? s.libelle }));
    return { ...o, jauge: { ...c.jauge, unite: j.unite ?? c.jauge.unite, seuils, ...(j.note ? { note: j.note } : {}) } };
  };
  return {
    ...data,
    leviers: data.leviers.map(over),
    themes: data.themes.map(over),
    reperes: data.reperes.map(over),
    mondes: data.mondes.map((m) => {
      const o = over(m);
      const lim = m.en?.futur_limite;
      const glose = m.en?.futur_glose;
      return lim || glose ? { ...o, futur: { ...o.futur, ...(lim ? { limite: lim } : {}), ...(glose ? { glose } : {}) } } : o;
    }),
    lois: data.lois.map((l) => {
      const o = over(l);
      const mots = l.en?.levier_mots;
      return { ...o, liens: l.liens.map(over), levier: o.levier && mots ? { ...o.levier, mots } : o.levier };
    }),
    chiffres: data.chiffres.map(chiffre),
    horsdroit: data.horsdroit.map(chiffre),
  };
}

/** Langue probable d'un extrait cité (« fr » ou « en »), pour l'indiquer sous la citation : des mots-outils, pas une détection fine. */
export function quoteLang(text: string): Lang {
  const words = text.toLowerCase().match(/[a-zàâçéèêëîïôùûœ']+/g) ?? [];
  const fr = new Set(['le', 'la', 'les', 'des', 'du', 'de', 'et', 'un', 'une', 'que', 'qui', 'dans', 'pour', 'par', 'sur', 'au', 'aux', 'est', 'sont', 'en']);
  const en = new Set(['the', 'of', 'and', 'to', 'in', 'is', 'are', 'for', 'by', 'on', 'that', 'with', 'be', 'shall', 'or', 'a']);
  let f = 0;
  let e = 0;
  for (const w of words) {
    if (fr.has(w)) f += 1;
    if (en.has(w)) e += 1;
  }
  return e > f ? 'en' : 'fr';
}

/**
 * Les mondes que le droit de l'IA ne peut pas atteindre, séparés de ceux qui n'ont « aucun levier du droit actuel » :
 * `sansLevier` ne compte plus les mondes hors droit, `horsDroit` les compte à part. Les deux listes ne se recouvrent jamais.
 */
export function lawReach(data: AtlasData, outOfLaw: readonly string[] = OUT_OF_LAW_WORLDS): { readonly sansLevier: readonly string[]; readonly horsDroit: readonly string[]; readonly atteignables: number } {
  const ids = new Set(data.mondes.map((m) => m.id as string));
  const horsDroit = outOfLaw.filter((id) => ids.has(id));
  const sansLevier = counts(data).mondesSansLevier.filter((id) => !horsDroit.includes(id));
  return { sansLevier, horsDroit, atteignables: data.mondes.length - horsDroit.length };
}

/** Auteur en peu de mots pour une tuile : le nom de l'organisme, sans titre de rapport, sans liste de personnes, sans parenthèse. */
export function auteurCourt(a: string): string {
  const avant = a.split('«')[0]?.trim().replace(/,$/, '') ?? a;
  const par = /\(([^()]*)\)\s*$/.exec(avant);
  const sansPar = avant.replace(/\s*\([^()]*\)/g, '').trim();
  if (par && (avant.slice(0, par.index).match(/,/g) ?? []).length >= 3) return (par[1] ?? sansPar).trim();
  const premier = sansPar.split(',')[0]?.trim() ?? sansPar;
  return (premier.split(/ (?:pour|for) /)[0] ?? premier).trim();
}

/** Un nombre à la française : entiers groupés (espace insécable fine), virgule décimale. */
export const nombreFr = (n: number): string => (Number.isInteger(n) ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(n).replace('.', ','));

/** Premier mot de l'unité d'une jauge (« °C », « ogives »), pour nommer un trait de seuil par sa valeur. */
const uniteCourte = (u: string): string => u.split(/\s+/)[0] ?? u;

/** Libellé d'un trait de seuil : sa valeur et l'unité courte (« 1,5 °C », « 9 745 ogives »), jamais un numéro. */
export const seuilLabel = (valeur: number, unite: string, L: Labels = FR): string => `${L.num(valeur)} ${uniteCourte(unite)}`;

/**
 * Valeur lisible d'un coup d'œil pour une mesure à jauge : « 1,09 °C », « 49 505 sur 175 909 », « 73 % ». Rend null quand l'unité ne s'y prête pas
 * (le chiffre garde alors sa valeur du registre).
 */
/** La valeur lisible d'une tuile : « 48 % / 51 % » pour une liste de nombres (chacun avec son « % »), sinon le texte du registre. */
export function valeurAffichee(c: Chiffre, L: Labels = FR): string | null {
  const v = c.valeur_affichee;
  if (v === undefined) return null;
  return typeof v === 'string' ? v : v.map((p) => L.pct(L.num(p.valeur))).join(' / ');
}

/** Les mots qui accompagnent une liste de nombres (« favorables / opposés »), dans la langue de l'écran ; null pour un texte simple. */
export function motsAffiches(c: Chiffre): string | null {
  const v = c.valeur_affichee;
  if (v === undefined || typeof v === 'string') return null;
  const en = c.en?.libelles_affichees;
  return v.map((p, i) => en?.[i] ?? p.libelle).join(' / ');
}

export function jaugeLisible(c: Chiffre, L: Labels = FR): string | null {
  const j = c.jauge;
  if (!j) return null;
  if (/(?<!\p{L})(?:sur|out of)(?!\p{L})/u.test(j.unite)) return L.outOf(L.num(j.valeur), L.num(j.max));
  if (j.unite.startsWith('%')) return L.pct(L.num(j.valeur));
  if (uniteCourte(j.unite) === '°C') return `${L.num(j.valeur)} °C`;
  return null;
}

/** Première année (quatre chiffres) d'une date de publication, ou la date telle quelle. */
export function anneeDe(date: string): string {
  return /(?<!\d)(?:19|20)\d{2}(?!\d)/.exec(date)?.[0] ?? date;
}
