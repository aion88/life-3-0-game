/**
 * Le chemin à 0 mot de l'e2e de la semaine (`SILENT_PICKS`), rejoué au metteur en scène avec les dés de la partie [plan rue guidée J3-J7,
 * T15 fix 1, revue m-1]. L'e2e (`street_guided_week_test.ts`) l'épingle en une centaine de secondes de WebGL ; ce rejeu dit en quelques
 * millisecondes de quel côté du seuil il tombe si les données ou la graine bougent.
 */
import { describe, expect, it } from 'vitest';
import { createDice } from '../../../src/shared/dice';
import { runSeed } from '../../../src/shared/seed';
import type { Answers } from '../../../src/shared/types';
import { ctxW10 } from '../../support/street';
import { directorRig, nightValue, playPath, rejectedOf } from '../../support/guided';
import { LINES, answersOfLine } from '../../support/e2e';
import { SILENT_PICKS } from '../../support/guided_paths';

/** Les dés de la partie de l'e2e : graine tirée des réponses de la ligne `LINES.w10`, comme la sauvegarde amorcée. */
const ctxGame = () => ctxW10(undefined, createDice(runSeed(answersOfLine(LINES.w10) as Answers)));

describe('chemin à 0 mot de la semaine (T15)', () => {
  it('test_silent_path_with_game_dice_is_arrested_night_4', () => {
    const ctx = ctxGame();
    const r = directorRig([], ctx);
    playPath(r, SILENT_PICKS);
    expect(rejectedOf(r)).toEqual([]);
    expect(r.dir.current()).toEqual({ kind: 'end', early: true, endedDay: 4 });
    expect(r.drv.state().street.ended).toMatchObject({ at: { day: 4 } });
  });

  it('test_silent_path_with_fixed_die_is_arrested_night_5', () => {   // le dé figé des tests (`diceStub([0])`) : à 0,5 point du seuil la nuit 4
    const r = directorRig();
    playPath(r, SILENT_PICKS);
    expect(r.dir.current()).toEqual({ kind: 'end', early: true, endedDay: 5 });
    expect(([1, 2, 3, 4, 5] as const).map((d) => nightValue({ acts: r.sink.saved }, d, ctxW10()))).toEqual([47, 32, 25, 1, 0]);
  });
});
