/**
 * Barre « Dossier » [GDD 2026-11-03 §2 option A, décision Cynthia, playtest 2026-11-03] : segments fantômes, consolidation D89, paliers.
 * La vue ne calcule rien d'autre que `closeNight` : ces tests le vérifient nuit par nuit sur les profils de l'oracle.
 */
import { describe, expect, it } from 'vitest';
import { integrityOf, parseWorld } from '../../../src/data/schema/world';
import { closeNight, startSurvival, survivalEntry } from '../../../src/survival';
import { dossierView } from '../../../src/survival/dossier';
import type { Milli } from '../../../src/shared/milli';
import type { DayIndex, GameClock, LedgerEntry, SurvivalState } from '../../../src/shared/types/street';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { ledgerOf } from '../../support/survival';

const CFG = integrityOf(parseWorld(w10Raw, cat));
const at = (day: number, minute = 600): GameClock => ({ day: day as DayIndex, minute });
const entry = (source: string, day = 1, minute = 600): LedgerEntry => survivalEntry(source, at(day, minute), CFG);
const stateAt = (points: number): SurvivalState => ({ value: (points * 1000) as Milli, counters: {} });

describe('barre Dossier : départ et repères [bible w10 §7.1, §7.5]', () => {
  it('test_dossier_starts_at_sixty_percent_with_audition_mark_below_twenty_five', () => {
    const v = dossierView(startSurvival(CFG), ledgerOf(1, []), CFG);
    expect(v.fill).toBe(0.6);
    expect(v.palier).toBe('courtesy');
    expect(v.auditionAt).toBe(0.245);   // « sous 25 » écrit à 24,5 [D78, w10 2j]
    expect(v.paliers.map((p) => [p.id, p.at])).toEqual([['courtesy', 0.595], ['thanks', 0.395], ['patience', 0.245], ['appointment', 0]]);
  });
});

describe('barre Dossier : segments fantômes', () => {
  it('test_ghost_without_gesture_is_the_couloir_night_and_ends_on_pending', () => {
    // couloir sans geste : +6 (dormir), +2 (consigne), -3 (regards), -2 (pression du J1) = 63 [bible w10 §7.3]
    const v = dossierView(startSurvival(CFG), ledgerOf(1, []), CFG);
    expect(v.pending).toBe(63_000);
    expect(v.segments.map((s) => s.source)).toEqual(['orders', 'words']);
    expect(v.segments[0]!.from).toBe(0.6);
    expect(v.segments.at(-1)!.to).toBe(0.63);
  });

  it('test_each_gesture_in_the_ghost_direction_adds_one_segment', () => {
    const s0 = startSurvival(CFG);
    const one = dossierView(s0, ledgerOf(1, [entry('patrol')]), CFG);
    const two = dossierView(s0, ledgerOf(1, [entry('patrol'), entry('found7', 1, 700)]), CFG);
    expect(one.pending).toBe(55_000);
    expect(two.pending).toBe(45_000);
    expect(two.segments.length).toBe(one.segments.length + 1);
    expect(two.segments.map((s) => s.source)).toEqual(['dossier', 'glances', 'patrol', 'found7']);
  });

  it('test_segments_are_contiguous_from_value_to_pending', () => {
    const v = dossierView(stateAt(40), ledgerOf(2, [entry('question', 2), entry('bribe', 2, 700), entry('offer.named', 2, 800)]), CFG);
    expect(v.segments.length).toBeGreaterThan(0);
    expect(v.segments[0]!.from).toBe(v.fill);
    for (let i = 1; i < v.segments.length; i++) expect(v.segments[i]!.from).toBeCloseTo(v.segments[i - 1]!.to, 12);
    expect(v.segments.at(-1)!.to).toBe(v.pendingFill);
  });

  it('test_no_ghost_when_nothing_is_pending', () => {
    // nuit 7 et après : le dossier est clos, la nuit ne bouge plus la valeur [bible w10 §7.5]
    const v = dossierView(stateAt(50), ledgerOf(7, [entry('patrol', 7)]), CFG);
    expect(v.pending).toBe(v.value);
    expect(v.segments).toEqual([]);
  });

  it('test_ghost_never_leaves_the_bar', () => {
    const many = ['patrol', 'found7', 'secondBribe', 'informant', 'consignedFlag'].map((s, i) => entry(s, 3, 500 + i));
    const v = dossierView(stateAt(20), ledgerOf(3, many), CFG);
    expect(v.pending).toBe(0);
    expect(Math.min(...v.segments.map((s) => s.to))).toBe(0);
  });
});

describe('barre Dossier : la consolidation reprend exactement D89', () => {
  it('test_pending_is_what_the_night_writes_over_a_week', () => {
    const days: LedgerEntry[][] = [
      [entry('question', 1)], [entry('offer.named', 2)], [entry('patrol', 3), entry('flaggedWord', 3, 700)],
      [], [entry('offer.refused.j5', 5)], [entry('permit', 6)],
    ];
    let s = startSurvival(CFG);
    days.forEach((entries, i) => {
      const ledger = ledgerOf(i + 1, entries);
      const view = dossierView(s, ledger, CFG);
      const night = closeNight(s, ledger, CFG);
      expect(view.pending, `nuit ${i + 1}`).toBe(night.state.value);
      expect(view.pendingPalier, `nuit ${i + 1}`).toBe(night.reading.palier);
      s = night.state;
      expect(dossierView(s, ledgerOf(i + 2, []), CFG).value).toBe(night.state.value);   // au matin, la partie pleine est la valeur consolidée
    });
  });
});

describe('barre Dossier : paliers aux seuils écrits [bible w10 §7.1 : 60, 40, 25, 0]', () => {
  it.each([[100, 'courtesy'], [60, 'courtesy'], [59, 'thanks'], [40, 'thanks'], [39, 'patience'], [25, 'patience'], [24, 'appointment'], [0, 'appointment']])(
    'test_value_%i_reads_palier_%s', (points, palier) => {
      expect(dossierView(stateAt(points), ledgerOf(1, []), CFG).palier).toBe(palier);
    },
  );
});
