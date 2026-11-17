import { describe, expect, it } from 'vitest';
import { integrityOf, parseWorld } from '../../../src/data/schema/world';
import { survivalReport, type NightReading, type SurvivalEnding } from '../../../src/survival';
import type { Milli } from '../../../src/shared/milli';
import type { DayIndex, GameClock } from '../../../src/shared/types/street';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { e2, ledgerOf, withReport } from '../../support/survival';

const CFG = integrityOf(parseWorld(w10Raw, cat));
const CFGR = withReport(CFG, { prices: { found7: 'full', 'offer.refused.j4': 'half' }, comforts: ['offer.named'] });
const reading = (day: number, ending: SurvivalEnding | null): NightReading =>
  ({ day, value: 0 as Milli, terms: {}, palier: 'appointment', ending, mentions: [] }) as unknown as NightReading;

describe('SurvivalReport de w10 [GDD 06 B-R2, option A]', () => {
  it('test_report_arrested_at_night_is_derived_threshold', () => {
    expect(survivalReport([reading(3, null), reading(4, { kind: 'arrested', at: 4 })], [], CFGR)).toMatchObject({ endKind: 'derivedThreshold', endId: 'arrested', endDay: 4 });
  });

  it('test_report_last_three_endings_fall_on_day_7', () => {
    const r = (e: SurvivalEnding) => survivalReport([reading(6, e)], [], CFGR);
    expect(r({ kind: 'arrested', at: 'audition' })).toMatchObject({ endKind: 'derivedThreshold', endId: 'arrestedAudition', endDay: 7 });
    expect(r({ kind: 'recruited' })).toMatchObject({ endKind: 'names', endId: 'recruited', endDay: 7 });
    expect(r({ kind: 'released' })).toMatchObject({ endKind: 'worldBound', endId: 'released', endDay: 7 });
  });

  it('test_report_lists_prices_and_comforts_with_day_sorted', () => {
    const e = (source: string, day: number, minute: number) => ({ source, delta: 0 as Milli, at: { day: day as DayIndex, minute } as GameClock });
    const ledgers = [ledgerOf(4, [e('found7', 4, 900), e('flaggedWord', 4, 600)]), ledgerOf(2, [e('offer.named', 2, 1000), e('offer.refused.j4', 2, 500)])];
    const rep = survivalReport([reading(6, { kind: 'released' })], ledgers, CFGR);
    expect(rep.pricesPaid).toEqual([{ id: 'offer.refused.j4', day: 2, cls: 'half' }, { id: 'found7', day: 4, cls: 'full' }]);
    expect(rep.comfortsTaken).toEqual([{ id: 'offer.named', day: 2 }]);
  });

  it('test_report_carries_no_gauge_value_or_delta', () => {
    const rep = survivalReport([reading(6, { kind: 'released' })], [ledgerOf(4, [e2('found7')])], CFGR);
    expect(Object.keys(rep).sort()).toEqual(['comfortsTaken', 'endDay', 'endId', 'endKind', 'pricesPaid']);
    expect(JSON.stringify(rep)).not.toMatch(/value|delta|threshold":|[0-9]{3,}/);
  });

  it('test_report_empty_when_world_gives_no_report_entries', () => {
    expect(survivalReport([reading(6, { kind: 'released' })], [ledgerOf(4, [e2('found7')])], CFG)).toMatchObject({ pricesPaid: [], comfortsTaken: [] });
  });

  it('test_report_throws_without_ending', () => {
    expect(() => survivalReport([reading(2, null)], [], CFGR)).toThrow();
  });
});
