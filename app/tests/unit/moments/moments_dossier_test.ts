/**
 * Barre « Dossier » sur l'état de la rue [GDD 2026-11-03 §2 option A, décision Cynthia, playtest 2026-11-03] : la partie en attente
 * avant le coucher est exactement la valeur que `onSleep` consolide (D89), nuit après nuit, sur des journées jouées par `reduceAct`.
 */
import { describe, expect, it } from 'vitest';
import { dossierOf } from '../../../src/engine/moments/dossier';
import { createStreet } from '../../../src/engine/moments/state';
import { TO_J7_EVENING, ctxW10, playDay, sleepEachDay } from '../../support/street';

const ctx = ctxW10();

describe('dossierOf : la consolidation du soir reprend exactement D89', () => {
  it('test_dossier_pending_before_sleep_equals_value_after_sleep_each_night', () => {
    let s = createStreet(ctx);
    let checked = 0;
    for (const a of TO_J7_EVENING) {
      const before = a.kind === 'sleep' ? dossierOf(s, ctx) : null;
      s = playDay(s, [a], ctx).state;
      if (before === null) continue;
      expect(s.survival.value, `nuit ${a.day}`).toBe(before.pending);
      expect(s.readings.at(-1)!.palier, `nuit ${a.day}`).toBe(before.pendingPalier);
      expect(dossierOf(s, ctx).value, `matin ${a.day + 1}`).toBe(before.pending);
      checked++;
    }
    expect(checked).toBe(6);
  });

  it('test_dossier_silent_week_reaches_zero_and_the_night_arrests', () => {
    // muet : aucun mot dit, la nuit coûte ; à zéro, la fin D13 est celle que la nuit écrit déjà (aucun second chemin)
    let s = createStreet(ctx);
    for (const a of sleepEachDay([1, 2, 3, 4, 5, 6])) {
      if (s.ended !== null) break;
      const before = a.kind === 'sleep' ? dossierOf(s, ctx) : null;
      s = playDay(s, [a], ctx).state;
      if (before !== null) expect(s.survival.value).toBe(before.pending);
    }
    expect(s.ended?.endId).toBe('arrested');
    expect(dossierOf(s, ctx).fill).toBe(0);
  });
});
