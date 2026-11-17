/**
 * Horaire des étapes guidées [spec rue guidée J1-J2, T4] : SEULE source des minutes d'entrée et de sortie d'une étape, des transits
 * à poser et de la séquence de nuit, pour la preuve (`pathsOf`, `validate/guided.ts`) et le metteur en scène (T7) [ruling].
 * Pur : aucun état du moteur lu, seulement les données (`GuidedData`, `StreetData`) et ce que l'appelant passe.
 */
import { NIGHT, isLinkedBeat, type GuidedData, type SceneBeat, type SceneSpec, type TransitAct } from '../../data/schema/guided';
import type { StreetData } from '../../data/schema/street';
import type { ActRecord, DayIndex } from '../../shared/types/street';
import { WEEK_STEPS } from '../week';
import type { Mark } from './marks';

/** Lieu du joueur pour les transits : le logement, la rue ou le Registre (`StreetState.location`). */
export type StepLocation = 'home' | 'street' | 'registre';

/** Id de l'acte `sleep` accepté par le moteur (`state.ts`, `SLEEP_ID`). */
export const SLEEP_ACT_ID = 'night';
/** Id de l'acte `lane` du poste de contrôle (`state.ts`, `CHECKPOINT_LANE`) ; le choix guidé porte `checkpoint.jN`. */
export const CHECKPOINT_LANE = 'checkpoint';
/** Option unique d'un jalon, jouée par `driver.choose(id, 'go')`. */
export const JALON_OPTION = 'go';

function sceneOf(g: GuidedData, sceneId: string): SceneSpec {
  const s = g.scenes.find((x) => x.id === sceneId);
  if (s === undefined) throw new Error(`schedule : scène inconnue « ${sceneId} »`);
  return s;
}

/** Branche d'une route sans variante connue : la suite `otherwise`. */
export const ROUTE_OTHERWISE = '*';

/** Variante du maillon `link` dans `marks` : sa variante, `'absent'`, ou `null` si le maillon n'a pas encore de marque (même jour, pas encore joué). */
export function variantOf(marks: readonly Mark[], link: string): string | null {
  return marks.find((m) => m.linkId === link)?.variant ?? null;
}

/** Clé de la réplique : `keys[variante]` si la variante y est (null compris), sinon `otherwise` ; une `BeatLine` rend sa clé. */
export function resolveBeat(b: SceneBeat, marks: readonly Mark[]): string | null {
  if (!isLinkedBeat(b)) return b.key;
  const v = variantOf(marks, b.byLink.link);
  return v !== null && Object.hasOwn(b.byLink.keys, v) ? b.byLink.keys[v] ?? null : b.byLink.otherwise;
}

/** Suite d'une route : `next[variante]` si la variante y est, sinon `otherwise`. Aussi la clé de branche posée dans `pathsOf` (`~<variante>` ou `~*`). */
export function routeNext(s: SceneSpec, marks: readonly Mark[]): { readonly next: string; readonly branch: string } {
  const a = s.ask;
  if (a.kind !== 'route') throw new Error(`schedule : la scène ${s.id} n'est pas une route`);
  const v = variantOf(marks, a.link);
  return v !== null && Object.hasOwn(a.next, v) ? { next: a.next[v]!, branch: v } : { next: a.otherwise, branch: ROUTE_OTHERWISE };
}

/** Entrée dans une étape : minute = max(minute de séance, `anchorMinute`) ; si `late` et minute > `late.afterMinute`, l'entrée bascule sur `late.next` avec `late.lineKey`. */
export function enterStep(g: GuidedData, sceneId: string, sessionMinute: number): { readonly sceneId: string; readonly minute: number; readonly lateLineKey: string | null } {
  const s = sceneOf(g, sceneId);
  const minute = Math.max(sessionMinute, s.anchorMinute);
  if (s.late === null || minute <= s.late.afterMinute) return { sceneId, minute, lateLineKey: null };
  return lateEntry(g, s, minute);
}

/** L'entrée par la branche `late` d'une étape, à la minute `minute` (au moins l'ancre de l'étape de retard). Sert aussi au sur-ensemble de la preuve. */
export function lateEntry(g: GuidedData, s: SceneSpec, minute: number): { readonly sceneId: string; readonly minute: number; readonly lateLineKey: string } {
  if (s.late === null) throw new Error(`schedule : la scène ${s.id} n'a pas de branche late`);
  const late = sceneOf(g, s.late.next);
  return { sceneId: late.id, minute: Math.max(minute, late.anchorMinute), lateLineKey: s.late.lineKey };
}

/** Sortie d'une étape une fois son acte posé (`optionId`, ou `null` si indisponible) : suite (`next`, `ifUnavailable` ou `NIGHT`) et minute = max(minute après l'acte, `anchorMinute + costMin`). */
export function leaveStep(g: GuidedData, sceneId: string, optionId: string | null, minuteAfterAct: number): { readonly next: string; readonly minute: number } {
  const s = sceneOf(g, sceneId);
  const minute = Math.max(minuteAfterAct, s.anchorMinute + s.costMin);
  const a = s.ask;
  if (a.kind === 'none') return { next: a.next, minute };
  if (a.kind === 'route') {   // `optionId` est la branche : une variante de `next`, ou `'*'` pour `otherwise`
    const next = optionId === ROUTE_OTHERWISE ? a.otherwise : optionId !== null && Object.hasOwn(a.next, optionId) ? a.next[optionId] : undefined;
    if (next === undefined) throw new Error(`schedule : scène ${sceneId}, branche inconnue « ${String(optionId)} »`);
    return { next, minute };
  }
  if (optionId === null) return { next: a.kind === 'priced' ? a.ifUnavailable ?? NIGHT : NIGHT, minute };
  const next = a.kind === 'narrative' ? a.options.find((o) => o.id === optionId)?.next : a.next[optionId];
  if (next === undefined) throw new Error(`schedule : scène ${sceneId}, option inconnue « ${optionId} »`);
  return { next, minute };
}

function transitDone(t: TransitAct, at: StepLocation): boolean {
  if (t.kind === 'enter') return at === t.id;
  return at !== t.id;   // sortir d'un lieu où l'on n'est pas : déjà vrai
}

/** Transits de l'étape à poser depuis `location`, ceux déjà vrais sautés, et le lieu d'arrivée. */
export function pendingTransits(s: SceneSpec, location: StepLocation): { readonly transits: readonly TransitAct[]; readonly location: StepLocation } {
  const out: TransitAct[] = [];
  let at = location;
  for (const t of s.transit) {
    if (transitDone(t, at)) continue;
    out.push(t);
    at = t.kind === 'enter' ? t.id : 'street';
  }
  return { transits: out, location: at };
}

/**
 * Minutes d'une voie du poste de contrôle hors tirage : `comply` et `courtesy` prennent `closedGate` quand la porte est fermée (`gateClosed`,
 * posé au crochet du matin), `comply` sinon. SEULE règle de ces minutes : lue par le moteur (`checkpoint.ts`, `complyMinutes`) et par la
 * preuve, qui porte les deux bornes faute de connaître la jauge [N7, revue T13 I-1]. La patrouille d'un `bypass` vient du dé et n'y est pas.
 */
export function nominalLaneMinutes(street: Pick<StreetData, 'checkpoint'>, option: string, gateClosed = false): number {
  const m = street.checkpoint.minutes;
  if (option === 'comply' || option === 'courtesy') return gateClosed ? m.closedGate : m.comply;
  if (option.startsWith('buy')) return m.buy;
  if (option === 'bypass') return m.bypass;
  return 0;
}

/**
 * Actes de la nuit à la minute `minute` du jour `day` depuis `location` : `exit registre` si le joueur y est, `enter home` s'il est dans
 * la rue (le moteur refuse `enter home` depuis le Registre), puis `sleep` à max(minute, soir). Toutes bornées à la fin du jour. Aucune au J7 (`day >= WEEK_STEPS`).
 */
export function nightActs(street: Pick<StreetData, 'moments' | 'clock'>, day: DayIndex, minute: number, location: StepLocation): readonly ActRecord[] {
  if (day >= WEEK_STEPS) return [];   // le J7 se clôt par l'audition, pas par une nuit
  const out: ActRecord[] = [];
  const end = street.clock.dayEndMinute;
  const at0 = Math.min(minute, end);
  let at = location;
  if (at === 'registre') { out.push({ day, minute: at0, kind: 'exit', id: 'registre', option: null }); at = 'street'; }
  if (at === 'street') out.push({ day, minute: at0, kind: 'enter', id: 'home', option: null });
  const sleepAt = Math.min(Math.max(at0, street.moments.eveningMinute), end);
  out.push({ day, minute: sleepAt, kind: 'sleep', id: SLEEP_ACT_ID, option: null });
  return out;
}
