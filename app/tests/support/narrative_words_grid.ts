/**
 * Aide de test : effet des mots dits dans les choix narratifs des scènes guidées sur la jauge Intégrité
 * [spec rue guidée §11.1, amendement B-1 du 2026-11-04 ; bible w10 §7.2 à §7.5].
 * Reconstruit en TS la grille de 93 312 profils de la relecture passe 5 (`w10bis.py`, absent du dépôt) :
 * 16 jeux de noms x 3 modes par nuit (couloir, bavard, muet : 3^6 = 729) x 8 jours de permis. Les mots par mode
 * sont ceux de `tools/plancher/w10.py`, sauf le J3 du muet nommé (voir `modeWords`) ; le moteur joué est le vrai (`closeNight`), pas le modèle Python.
 * Aucune valeur de jauge ni donnée de monde n'est lue ici autrement qu'en lecture.
 */
import { integrityOf, parseWorld, type IntegrityConfig } from '../../src/data/schema/world';
import { cat, w10Raw } from '../fixtures/data/factories';
import { playReadings, type OracleCase } from './survival';

export const CFG: IntegrityConfig = integrityOf(parseWorld(w10Raw, cat));

export type Mode = 'couloir' | 'bavard' | 'muet';
export const MODES: readonly Mode[] = ['couloir', 'bavard', 'muet'];
export const NAME_DAYS = [2, 3, 4, 5] as const;
export const PERMITS: readonly (number | null)[] = [null, 1, 2, 3, 4, 5, 6, 7];

/** Lecture du coût des mots narratifs : `forced` = mots imposés comme les 14 du checkpoint (seul le muet les voit), `additive` = tous les modes les ajoutent. */
export type Reading = 'forced' | 'additive';

/**
 * Mots dits un jour par un mode, hors mots narratifs [tools/plancher/w10.py : couloir, bavard, muet ; bible w10 §7.5].
 * Muet : 14 mots forcés au checkpoint, plus 8 mots le J3, qui sont les banalités du refus du J3 OU la phrase du nom
 * s'il nomme ce jour-là, jamais les deux (la réponse du J3 est l'une ou l'autre). C'est la règle qui redonne les comptes
 * de la bible à l'unité (860, 1 262 = 78 + 1 184, 264, 762, 28 298) ; `muet` de `w10.py` (14 + 8 + 8 au J3 nommé) donne
 * 886, 1 212 = 68 + 1 144, 264, 768, 28 292. Le profil « Muet » de la table (aucun nom) est le même sous les deux règles.
 */
export function modeWords(mode: Mode, n: number, named: boolean): number {
  const base = n === 6 ? 40 : 60;
  if (mode === 'couloir') return base + (named ? 8 : 0);
  if (mode === 'bavard') return base + (named ? 15 : 0) + 10;
  return 14 + (n === 3 && !named ? 8 : 0) + (named ? 8 : 0);
}

export interface GridProfile {
  readonly modes: readonly Mode[];
  readonly names: readonly number[];
  readonly permit: number | null;
}

const subsets = (): number[][] => {
  const out: number[][] = [];
  for (let m = 0; m < 16; m++) out.push(NAME_DAYS.filter((_, i) => (m >> i) & 1));
  return out;
};

const modeSequences = (): Mode[][] => {
  const out: Mode[][] = [];
  for (let c = 0; c < 729; c++) {
    const seq: Mode[] = [];
    let x = c;
    for (let n = 0; n < 6; n++) { seq.push(MODES[x % 3]!); x = Math.floor(x / 3); }
    out.push(seq);
  }
  return out;
};

/** La grille entière, 93 312 profils, dans un ordre fixe. */
export function buildProfiles(): GridProfile[] {
  const out: GridProfile[] = [];
  for (const permit of PERMITS) for (const names of subsets()) for (const modes of modeSequences()) out.push({ modes, names, permit });
  return out;
}

/** Hors domaine = trois refus ou plus (au plus un nom) et pas tout en couloir [bible §7.5 : 29 120 profils]. */
export const isOutOfDomain = (p: GridProfile): boolean => p.names.length <= 1 && p.modes.some((m) => m !== 'couloir');
/** Domaine : au plus un nom, couloir toutes les nuits [40 profils à trois refus ou plus]. */
export const isDomain = (p: GridProfile): boolean => p.names.length <= 1 && p.modes.every((m) => m === 'couloir');

export interface Narrative {
  /** Mots narratifs ajoutés par jour. */
  readonly k: number;
  /** Jours qui les portent. */
  readonly days: readonly number[];
  readonly reading: Reading;
}

export interface Played {
  readonly paliers: readonly string[];
  readonly values: readonly number[];
  readonly end: string;
}

/** Joue un profil avec le vrai moteur ; `narrative` ajoute des mots dépensés selon la lecture. */
export function play(p: GridProfile, narrative: Narrative | null): Played {
  const words = p.modes.map((mode, i) => {
    const n = i + 1;
    const extra = narrative !== null && narrative.days.includes(n) && (narrative.reading === 'additive' || mode === 'muet') ? narrative.k : 0;
    return modeWords(mode, n, p.names.includes(n)) + extra;
  });
  const c: OracleCase = { words, names: p.names, permit: p.permit, found: null, absent: [], nights: [], end: '' };
  const { readings } = playReadings(c, CFG);
  const e = readings.at(-1)!.ending!;
  return {
    paliers: readings.map((r) => r.palier),
    values: readings.map((r) => r.value / 1000),
    end: e.kind === 'arrested' ? `arrested:${e.at}` : e.kind,
  };
}

export const isArrested = (end: string): boolean => end.startsWith('arrested');
/** Palier lu après la nuit `n`, ou `fin` si la partie s'est arrêtée avant. */
export const palierAt = (r: Played, n: number): string => r.paliers[n - 1] ?? 'fin';


const keyOf = (p: GridProfile): string => `${p.permit}|${p.modes.join()}|${p.names.join()}`;

/** Les mesures d'une grille jouée, comparées à la grille de référence (k = 0). */
export interface GridMetrics {
  /** Profils dont la sorte d'issue change (arrêté, libéré, recruté). */
  readonly kindChanged: number;
  /** Profils dont l'issue change, nuit d'arrestation comprise. */
  readonly endChanged: number;
  /** Profils dont le palier change après la nuit 1, puis après la nuit 2. */
  readonly palierN1: number;
  readonly palierN2: number;
  /** Domaine (couloir, au plus un nom, permis compris, 40 profils) : libérés et minimum final. */
  readonly domainReleased: number;
  readonly domainMin: number;
  /** Hors domaine (au plus un nom, au moins une nuit hors couloir, 29 120 profils) : arrêtés. */
  readonly outArrested: number;
  readonly at24: number;
  readonly at25: number;
  readonly at25released: number;
  /** D86 : profils sans nom arrêtés qu'un seul nom libère, et couples (profil, nom). */
  readonly saved: number;
  readonly couples: number;
  /** Lignes de la table de §7.5 : issue du muet et du bavard (aucun nom, aucun permis). */
  readonly muet: string;
  readonly bavard: string;
  /** Valeur finale du bavard puis deux noms (J4 + J5), `null` s'il est arrêté avant la nuit 6 ; il est arrêté dans tous les cas. */
  readonly bavardThenTwoNames: number | null;
}

/** Joue toute la grille, avec ou sans mots narratifs. */
export function playGrid(profiles: readonly GridProfile[], narrative: Narrative | null): Played[] {
  return profiles.map((p) => play(p, narrative));
}

const finalOf = (r: Played): number | null => (r.values.length === 6 ? r.values[5]! : null);
const kindOf = (end: string): string => (isArrested(end) ? 'arrested' : end);

/** Mesures d'une grille `run` contre la référence `base`, sur les mêmes profils dans le même ordre. */
export function metricsOf(profiles: readonly GridProfile[], base: readonly Played[], run: readonly Played[]): GridMetrics {
  const idx = new Map(profiles.map((q, i) => [keyOf(q), i]));
  const find = (permit: number | null, modes: readonly Mode[], names: readonly number[]): Played =>
    run[idx.get(keyOf({ permit, modes, names }))!]!;
  let kindChanged = 0, endChanged = 0, palierN1 = 0, palierN2 = 0, domainReleased = 0, outArrested = 0;
  let domainMin = Infinity, at24 = 0, at25 = 0, at25released = 0, saved = 0, couples = 0;
  profiles.forEach((p, i) => {
    const r = run[i]!, b = base[i]!;
    if (kindOf(r.end) !== kindOf(b.end)) kindChanged++;
    if (r.end !== b.end) endChanged++;
    if (palierAt(r, 1) !== palierAt(b, 1)) palierN1++;
    if (palierAt(r, 2) !== palierAt(b, 2)) palierN2++;
    const f = finalOf(r);
    if (f === 24) at24++;
    if (f === 25) { at25++; if (r.end === 'released') at25released++; }
    if (isDomain(p)) { if (r.end === 'released') domainReleased++; domainMin = Math.min(domainMin, f ?? -1); }
    if (isOutOfDomain(p) && isArrested(r.end)) outArrested++;
    if (p.names.length === 0 && isArrested(r.end)) {
      let any = false;
      for (const j of NAME_DAYS) if (find(p.permit, p.modes, [j]).end === 'released') { any = true; couples++; }
      if (any) saved++;
    }
  });
  const all = (m: Mode): Mode[] => [m, m, m, m, m, m];
  return {
    kindChanged, endChanged, palierN1, palierN2, domainReleased, domainMin, outArrested, at24, at25, at25released, saved, couples,
    muet: find(null, all('muet'), []).end, bavard: find(null, all('bavard'), []).end,
    bavardThenTwoNames: finalOf(find(null, ['bavard', 'bavard', 'bavard', 'couloir', 'couloir', 'couloir'], [4, 5])),
  };
}
