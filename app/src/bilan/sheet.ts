/**
 * Fiche de vie : sept jours, kit, ce qui a tenu ou tué [GDD 06 §3.3 ; plan 03 T8 ; R-03.13, R-03.19]. Pur : aucune horloge, aucun hasard, aucun DOM.
 * Aucun texte ici, que des clés ; les dates se lisent de `calendar[].dateKey`. Les actes sont rejoués par le moteur 02b (`replay`),
 * jamais réinterprétés : un acte écarté par le rejeu ne compte pas, le kit est celui du rejeu.
 * Choix d'une ligne par jour, de la plus forte à la plus faible : offre de nom, choix-jalon, constat-jalon, geste payé, autre choix, relevé du soir.
 * [priorité de lead-programmer, à confirmer: narrative-director]
 */
import type { ChoiceData } from '../data/schema/street';
import { eveningLines } from '../engine/moments/evening';
import { replay } from '../engine/moments/replay';
import { AXES } from '../engine/moments/types';
import type { StreetContext } from '../engine/moments/types';
import type { BilanInput, BilanSheet, DayLine, DayLineOrigin, FateLine, KitRow, SurvivalReport } from '../shared/types/bilan';
import type { ActRecord, DayIndex } from '../shared/types/street';

/** Existence d'une clé de chaîne (`i18n.has` à l'écran) : le constat d'un jour n'a pas de donnée, sa clé fait foi. */
export type HasKey = (key: string) => boolean;

/** Rang d'une origine : plus petit l'emporte. */
const RANK: Readonly<Record<DayLineOrigin, number>> = { name: 0, milestone: 1, milestoneFact: 2, paidGesture: 3, otherChoice: 4, evening: 5 };

/** Clé de la ligne d'un choix : `<monde>.bilan.day.<choix>.<option>`, le `:` de l'option devient `_` [inventaire T2]. */
function choiceKey(ctx: StreetContext, choiceId: string, option: string): string {
  return `${ctx.world.id}.bilan.day.${choiceId}.${option.replace(':', '_')}`;
}

/** Identifiants des offres de nom et du choix d'audition, lus du bloc `bilan` du monde (vide si le monde n'en a pas). */
function bilanChoices(ctx: StreetContext): { readonly names: ReadonlySet<string>; readonly audition: string | null } {
  const b = ctx.world.bilan;
  if (!('dossier' in b)) return { names: new Set(), audition: null };
  return { names: new Set(b.dossier.names.map((n) => n.choiceId)), audition: b.dossier.audition.choiceId };
}

interface Candidate { readonly origin: DayLineOrigin; readonly minute: number; readonly id: string; readonly textKey: string }

function byOrder(a: Candidate, b: Candidate): number {
  return RANK[a.origin] - RANK[b.origin] || a.minute - b.minute || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Vrai si le prix `cls` de la fin a été payé ce jour-là par cette option [`entries` de l'option, `pricesPaid` du rapport]. */
function isPaid(day: DayIndex, choice: ChoiceData, option: string, survival: SurvivalReport | null): boolean {
  const entries = choice.options.find((o) => o.id === option)?.entries ?? [];
  return survival !== null && survival.pricesPaid.some((p) => p.day === day && entries.includes(p.id));
}

/** La première ligne `rien` du relevé du soir, dans l'ordre de `AXES` ; à défaut, la première ligne [GDD 06 §3.3 (5)]. */
function eveningKey(acts: readonly ActRecord[], day: DayIndex, ctx: StreetContext): string {
  const lines = eveningLines(day, acts, ctx);
  const rien = new Set(ctx.street.evening.lines.map((l) => l.rien));
  const hit = AXES.map((a) => lines.find((l) => l.axis === a)).find((l) => l !== undefined && rien.has(l.key));
  const first = hit ?? lines[0];   // `eveningLines` rend toujours une ligne par axe (test_evening_always_gives_six_lines) : le garde dit la panne
  if (first === undefined) throw new Error(`fiche : relevé du soir vide au jour ${day}`);
  return first.key;
}

/** La ligne du jour `day` d'après les actes (déjà acceptés par le rejeu) et le rapport de survie. */
export function dayLine(acts: readonly ActRecord[], day: DayIndex, survival: SurvivalReport | null, ctx: StreetContext, has: HasKey): DayLine {
  const dateKey = ctx.world.calendar.find((c) => c.day === day)!.dateKey;
  const { names, audition } = bilanChoices(ctx);
  const choices = new Map(ctx.street.choices.map((c) => [c.id, c]));
  const today = acts.filter((a) => a.day === day);
  const cands: Candidate[] = [];
  for (const a of today) {
    if (a.kind !== 'choice' || a.option === null) continue;
    const choice = choices.get(a.id);
    const origin: DayLineOrigin = names.has(a.id) ? 'name'
      : a.id === audition || choice?.kind === 'offer' ? 'milestone'
        : choice !== undefined && isPaid(day, choice, a.option, survival) ? 'paidGesture' : 'otherChoice';
    cands.push({ origin, minute: a.minute, id: a.id, textKey: choiceKey(ctx, a.id, a.option) });
  }
  // Constat du jalon d'un jour vécu qui n'offre aucun choix : sa clé fait foi, aucune donnée ne le nomme [GDD 06 §3.3 (2 bis)].
  const factKey = `${ctx.world.id}.bilan.day.fact.j${day}`;
  const offersToday = ctx.street.choices.some((c) => c.kind === 'offer' && c.days.includes(day));
  if (today.length > 0 && !offersToday && has(factKey)) cands.push({ origin: 'milestoneFact', minute: 0, id: factKey, textKey: factKey });
  const best = [...cands].sort(byOrder)[0];
  if (best !== undefined) return { day, dateKey, textKey: best.textKey, origin: best.origin };
  return { day, dateKey, textKey: eveningKey(acts, day, ctx), origin: 'evening' };
}

/** Les jours faits : tous ceux du calendrier pour une semaine finie, jusqu'au dernier jour joué pour une fin anticipée [GDD 06 §3.3]. */
function daysDone(input: BilanInput, acts: readonly ActRecord[], ctx: StreetContext): readonly DayIndex[] {
  const all = ctx.world.calendar.map((c) => c.day);
  if (input.entry === 'weekEnd') return all;
  const last = acts.reduce((m, a) => Math.max(m, a.day), 0);
  return all.filter((d) => d <= last);
}

/** Une ligne par jour fait, dans l'ordre des jours. */
export function dayLines(input: BilanInput, ctx: StreetContext, has: HasKey): readonly DayLine[] {
  return linesOf(input, replay(input.acts, ctx).state.acts, ctx, has);
}
function linesOf(input: BilanInput, acts: readonly ActRecord[], ctx: StreetContext, has: HasKey): readonly DayLine[] {
  return daysDone(input, acts, ctx).slice(0, ctx.world.calendar.length).map((d) => dayLine(acts, d, input.survival, ctx, has));
}

/** Les objets du monde dans l'ordre du monde, avec leur état au rejeu ; un objet absent du kit n'a pas de ligne. */
export function kitRows(acts: readonly ActRecord[], ctx: StreetContext): readonly KitRow[] {
  return rowsOf(replay(acts, ctx).state.kit, ctx);
}
function rowsOf(kit: Readonly<Record<string, KitRow['state']>>, ctx: StreetContext): readonly KitRow[] {
  return ctx.world.kit.flatMap((item) => {
    const state = kit[item.id];
    return state === undefined ? [] : [{ itemId: item.id, labelKey: item.labelKey, state, stateKey: `bilan.kit.state.${state}` }];
  });
}

/** Ordre à jour égal : le prix puis le confort puis la fin, qui tombe la nuit. */
const KIND_ORDER: Readonly<Record<FateLine['kind'], number>> = { price: 0, comfort: 1, end: 2 };

/** Fin, prix payés et conforts pris, triés par jour. Un id sans clé dans le bloc `bilan` du monde ne donne pas de ligne (donnée réelle vide : R-03.19). */
function fateLines(survival: SurvivalReport | null, ctx: StreetContext): readonly FateLine[] {
  const b = ctx.world.bilan;
  if (survival === null) return [];
  if (!('fate' in b)) throw new Error('fiche : le monde n\'a pas de bloc fate pour dire la fin');
  const out: FateLine[] = [];
  for (const p of survival.pricesPaid) { const k = b.fate.prices[p.id]; if (k !== undefined) out.push({ kind: 'price', textKey: k, day: p.day }); }
  for (const c of survival.comfortsTaken) { const k = b.fate.comforts[c.id]; if (k !== undefined) out.push({ kind: 'comfort', textKey: k, day: c.day }); }
  const end = b.fate.ends[survival.endId];
  if (end === undefined) throw new Error(`fiche : aucune ligne de fin pour « ${survival.endId} » dans bilan.fate.ends`);   // la fin est la ligne obligatoire
  out.push({ kind: 'end', textKey: end, day: survival.endDay });
  return out.map((l, i) => ({ l, i })).sort((x, y) => x.l.day - y.l.day || KIND_ORDER[x.l.kind] - KIND_ORDER[y.l.kind] || x.i - y.i).map((x) => x.l);
}

/** La fiche de vie. Lève pour une extinction : pas de rue, pas de fiche [GDD 06 §3.1]. */
export function buildSheet(input: BilanInput, ctx: StreetContext, has: HasKey): BilanSheet {
  const o = input.run.outcome;
  if (input.entry === 'extinction' || o.kind !== 'arrival') throw new Error('buildSheet : une extinction n\'a pas de fiche de vie');
  const { state } = replay(input.acts, ctx);
  return {
    computedWorld: o.computedWorld, livedWorld: o.livedWorld, redirected: o.redirected,
    days: linesOf(input, state.acts, ctx, has), kit: rowsOf(state.kit, ctx), fate: fateLines(input.survival, ctx),
    lastMessage: state.readings.at(-1)?.palier ?? null,   // le relevé de la dernière nuit close, lu au rejeu [décision 7 du plan 03]
  };
}
