/**
 * Marques de chaîne [spec rue guidée J1-J2, T3] : pli pur des actes sur les chaînes de `street.guided`.
 * Une marque est le maillon franchi avec la variante choisie, ou `absent` quand son jour est passé sans l'acte.
 * Un maillon `night` est posé par le premier `sleep` du jour `at.day` mais DATÉ du matin suivant, pour paraître au relevé du lendemain.
 */
import type { ActRecord, DayIndex } from '../../shared/types/street';
import type { ChainLink, ChainSpec, GuidedData, LinkVariant } from '../../data/schema/guided';
import type { ClockData } from '../../data/schema/street';
import type { StreetState } from './types';
import { compareActs } from './words';

export interface Mark {
  readonly chainId: string; readonly linkId: string; readonly day: DayIndex; readonly minute: number;
  readonly variant: string; readonly v: LinkVariant;
}

/** L'acte `lane` du poste de contrôle porte l'id du moteur `checkpoint` ; le maillon vise le choix `checkpoint.jN`. */
const CHECKPOINT_LANE = 'checkpoint';
const ABSENT = 'absent';

function actFor(link: ChainLink, acts: readonly ActRecord[]): ActRecord | undefined {
  const at = link.at;
  switch (at.kind) {
    case 'scene': return acts.find((a) => a.kind === 'scene' && a.id === at.id && a.day === link.day && a.option !== null);
    case 'choice': return acts.find((a) => a.kind === 'choice' && a.id === at.id && a.day === link.day && a.option !== null);
    case 'lane': return acts.find((a) => a.kind === 'lane' && a.day === link.day && a.option !== null
      && (a.id === at.id || (a.id === CHECKPOINT_LANE && at.id === `${CHECKPOINT_LANE}.j${a.day}`)));
    case 'night': return acts.find((a) => a.kind === 'sleep' && a.day === at.day);
  }
}

/** Minute d'ancrage de l'étape qui porte l'acte du maillon ; `fallback` quand aucune scène ne le porte. */
function anchorOf(link: ChainLink, guided: GuidedData, fallback: number): number {
  const at = link.at;
  if (at.kind === 'night') return fallback;
  const scene = at.kind === 'scene'
    ? guided.scenes.find((s) => s.id === at.id)
    : guided.scenes.find((s) => s.ask.kind === 'priced' && s.ask.choiceId === at.id);
  return scene?.anchorMinute ?? fallback;
}

function marksOfChain(chain: ChainSpec, acts: readonly ActRecord[], day: DayIndex, guided: GuidedData, dayStart: number): Mark[] {
  const out: Mark[] = [];
  const mark = (link: ChainLink, d: DayIndex, minute: number, variant: string, v: LinkVariant): void => {
    out.push({ chainId: chain.id, linkId: link.id, day: d, minute, variant, v });
  };
  for (const link of chain.links) {
    const hit = actFor(link, acts);
    if (link.at.kind === 'night') {
      if (hit === undefined) {
        if (day > link.day) mark(link, link.day, dayStart, ABSENT, link.absent);
        continue;
      }
      const from = out.find((m) => m.linkId === (link.at as { from: string }).from);
      const variant = from?.variant ?? ABSENT;
      const v = variant === ABSENT ? link.absent : link.variants[variant];
      if (v !== undefined) mark(link, link.day, dayStart, variant, v);
      continue;
    }
    if (hit !== undefined) {
      const v = link.variants[hit.option!];
      if (v !== undefined) mark(link, link.day, hit.minute, hit.option!, v);   // option inconnue : refusée en amont par le moteur
    } else if (day > link.day) {
      mark(link, link.day, anchorOf(link, guided, dayStart), ABSENT, link.absent);
    }
  }
  return out;
}

/**
 * Toutes les marques franchies, dans l'ordre (jour, minute, chaîne). Pur : l'ordre des actes en entrée est sans effet.
 * `clock` = `ctx.street.clock` (minute de réveil du matin pour les marques `night` et les `absent` sans scène).
 */
export function marksOf(acts: readonly ActRecord[], s: Pick<StreetState, 'day'>, guided: GuidedData, clock: Pick<ClockData, 'dayStartMinute'>): readonly Mark[] {
  const sorted = [...acts].sort(compareActs);
  const marks = guided.chains.flatMap((c) => marksOfChain(c, sorted, s.day, guided, clock.dayStartMinute));
  const order = new Map(guided.chains.map((c, i) => [c.id, i]));
  return marks.sort((a, b) => a.day - b.day || a.minute - b.minute || order.get(a.chainId)! - order.get(b.chainId)!);
}

/** Les marques datées du jour `day`. */
export function linksOfDay(day: DayIndex, marks: readonly Mark[]): readonly Mark[] {
  return marks.filter((m) => m.day === day);
}

/** Les chaînes ayant au moins une marque non `absent`, dans l'ordre d'apparition. */
export function openedChains(marks: readonly Mark[]): readonly string[] {
  return [...new Set(marks.filter((m) => m.variant !== ABSENT).map((m) => m.chainId))];
}
