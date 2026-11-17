/** Fast-forward 2026-2030 : surface publique du dossier [plan 01, bloc « Interfaces produites »]. */
export { simulateFastForward, type FastForwardRun } from './simulate';
export { arrivalOutcome } from './arrival';
export { scheduleHeadlines, fireHeadlines, yearOfStep, type HeadlineShown } from './headlines';
export type { HeadlineSet } from '../data/schema/headlines';
export { timelineSeconds, extinctionSeconds } from './timeline';
export { runFastForward } from './run';
export { remontee, omegaOf, TRACEBACK_MAX_LINES } from './remontee';
export { singleReplacements, otherLives, readingOrder, OTHER_LIVES_MAX_LINES } from './others';
export { litBeats, lineOf, causeEditions, EDITION_COUNT, EDITION_LOTS, type Edition } from './causes';
export { parseCauses, type Beat, type CauseSet, type CauseAnswer } from '../data/schema/causes';
