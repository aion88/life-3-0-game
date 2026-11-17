/**
 * Surface publique du moteur de moments de rue, celle que consomment les plans 02a et 03 [plan 02b].
 * Trois règles : un seul chemin d'un acte vers l'état (`reduceAct`), le rejeu est un pli de `reduceAct` sur les actes (`replay`),
 * l'horloge vient des actes (jamais d'une montre). Que des ré-exports : aucune logique ici.
 */
export { createStreet, reduceAct, toDayState } from './state';                         // T10
export { replay } from './replay';                                                    // T10
export { startDay, advance, momentOf } from './clock';                                // horloge
export { pendingChoices, designate, confirm, canExit, sleepPriceLine } from './choices';   // T4
export { lanesOpen, queuePositionOf } from './checkpoint';                            // T7
export { stepGaze } from './gaze';                                                    // T6
export { rightLineFor, carnet } from './rights';                                      // T9
export { eveningLines } from './evening';                                             // T12
export { toBilanInput, relectureLineOf, wallCounterOf } from './bilan';               // T13
export { presentAt } from './npcs';                                                   // T11
export { knownActKinds } from './verbs';                                              // T3
export { isValidAct } from '../../shared/acts';                                       // plan 01
export type { ReduceResult } from './state';                                          // T10
export type { ReplayResult } from './replay';                                         // T10
export type { StreetState, StreetContext, StreetFlag, Rejected, RejectReason, ChoicePhase, PriceLine, Activity, Location } from './types';   // T1, types.ts
export type { ActRecord as Act, DayState } from '../../shared/types/street';          // plan 00
export { marksOf, linksOfDay, openedChains } from './marks';                          // RG-T3
export type { Mark } from './marks';                                                  // RG-T3
