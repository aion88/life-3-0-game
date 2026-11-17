/**
 * Rapport de survie pour le bilan [GDD 06 §3.12, B-R2 option A] : la fin, les prix payés, les conforts pris.
 * Ne porte aucune valeur de jauge, aucun delta, aucun seuil.
 */
import type { IntegrityConfig } from '../data/schema/world';
import type { SurvivalReport } from '../shared/types/bilan';
import type { DayIndex, LedgerEntry, NightLedger } from '../shared/types/street';
import type { NightReading } from './integrity';

type Ended = Pick<SurvivalReport, 'endKind' | 'endId'> & { readonly late: boolean };

function endOf(r: NightReading): Ended {
  const e = r.ending;
  if (!e) throw new Error('lecture sans fin');
  if (e.kind === 'arrested') return e.at === 'audition'
    ? { endKind: 'derivedThreshold', endId: 'arrestedAudition', late: true }
    : { endKind: 'derivedThreshold', endId: 'arrested', late: false };
  if (e.kind === 'recruited') return { endKind: 'names', endId: 'recruited', late: true };
  return { endKind: 'worldBound', endId: 'released', late: true };
}

interface Hit { readonly e: LedgerEntry; readonly day: DayIndex }

function hitsOf(ledgers: readonly NightLedger[], ids: (source: string) => boolean): Hit[] {
  return ledgers
    .flatMap((l) => l.entries.filter((e) => ids(e.source)).map((e) => ({ e, day: l.day })))
    .sort((a, b) => a.day - b.day || a.e.at.minute - b.e.at.minute);
}

/** Assemble le rapport : la fin se lit sur la dernière lecture qui en porte une, sinon lève. */
export function survivalReport(readings: readonly NightReading[], ledgers: readonly NightLedger[], cfg: IntegrityConfig): SurvivalReport {
  const last = [...readings].reverse().find((r) => r.ending !== null);
  if (!last) throw new Error('survivalReport : aucune lecture ne porte de fin');
  const end = endOf(last);
  const prices = hitsOf(ledgers, (s) => s in cfg.report.prices)
    .map(({ e, day }) => ({ id: e.source, day, cls: cfg.report.prices[e.source]! }));
  const comforts = hitsOf(ledgers, (s) => cfg.report.comforts.includes(s)).map(({ e, day }) => ({ id: e.source, day }));
  return {
    endKind: end.endKind, endId: end.endId, endDay: (end.late ? cfg.lastNight + 1 : last.day) as DayIndex,
    pricesPaid: prices, comfortsTaken: comforts,
  };
}
