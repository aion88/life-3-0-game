import { expectTypeOf, it } from 'vitest';
import type {
  DayIndex, DayMode, DayState, KitItemState, MomentId, OtherLife, Projection, QuestionKey, AnswerKey,
  RightId, RunResult, TracebackLine, WeekOutput, WorldId, WorldVector, RIGHT_IDS,
} from '../../../src/shared/types';

// Identités et formes du bloc [plan 00 rév. 3]. Vérifié par `npm run typecheck`, pas à l'exécution.
// L'assertion d'exécution sur RIGHT_IDS vit dans shared_types_test.ts.
it('test_street_identity_types', () => {
  expectTypeOf<RightId>().toEqualTypeOf<(typeof RIGHT_IDS)[number]>();
  expectTypeOf<DayIndex>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | 7>();
  expectTypeOf<DayMode>().toEqualTypeOf<'contraint' | 'libre' | 'bascule'>();
  expectTypeOf<MomentId>().toEqualTypeOf<'lever' | 'rueAller' | 'travail' | 'rueMidi' | 'soir' | 'nuit'>();
  expectTypeOf<KitItemState>().toEqualTypeOf<'kept' | 'left' | 'seized' | 'handedOver' | 'declared'>();
});

it('test_day_state_week_output_and_run_shapes', () => {
  expectTypeOf<keyof DayState>().toEqualTypeOf<'clock' | 'mode' | 'moment' | 'ws' | 'readings' | 'gates' | 'ledger' | 'survival' | 'rightsMet' | 'kit' | 'ended'>();
  expectTypeOf<keyof WeekOutput>().toEqualTypeOf<'curve' | 'momentReading' | 'finalWithEcho' | 'finalWithoutEcho' | 'frozenEcho' | 'gates' | 'worldSeed'>();
  expectTypeOf<OtherLife>().toEqualTypeOf<{ readonly question: QuestionKey; readonly answer: AnswerKey; readonly destination: WorldId; readonly displayedRank: number }>();
  expectTypeOf<TracebackLine>().toEqualTypeOf<{ readonly question: QuestionKey; readonly answer: AnswerKey }>();
  expectTypeOf<keyof RunResult>().toEqualTypeOf<'answers' | 'push' | 'seed' | 'trajectory' | 'outcome' | 'headlines' | 'softened'>();
  expectTypeOf<Projection>().toEqualTypeOf<{
    readonly steps: readonly WorldVector[]; readonly switchStep: number | null; readonly toWorld: WorldId | null; readonly extinctionStep: number | null;
  }>();
});
