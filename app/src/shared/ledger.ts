import type { NightLedger } from './types/street';

/** Allocation du jour : base + crédités + achetés [bible w10 §7.2]. */
export function ledgerAllocation(l: NightLedger): number {
  return l.wordsBase + l.wordsCredited + l.wordsBought;
}

/** Dépassement : max(0, dépensés - allocation) [bible w10 §7.2]. */
export function ledgerOverrun(l: NightLedger): number {
  return Math.max(0, l.wordsSpent - ledgerAllocation(l));
}

/** Reste : max(0, base - dépensés), contre la base seule [bible w10 §7.5]. */
export function ledgerRemaining(l: NightLedger): number {
  return Math.max(0, l.wordsBase - l.wordsSpent);
}
