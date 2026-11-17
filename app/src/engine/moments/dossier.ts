/**
 * Barre « Dossier » vue depuis l'état de la rue [GDD 2026-11-03 §2 option A, décision Cynthia, playtest 2026-11-03].
 * Même relevé que `onSleep` et `eveningPalier` (`ledgerOf` sur le jour courant) : la partie en attente est la nuit qui vient, à l'identique.
 */
import type { IntegrityConfig } from '../../data/schema/world';
import { dossierView, type DossierView } from '../../survival/dossier';
import { ledgerOf } from './state';
import type { StreetContext, StreetState } from './types';

export type { DossierView, DossierSegment } from '../../survival/dossier';

/** La barre pour l'état courant : valeur consolidée par la dernière nuit, et la nuit du jour en attente. */
export function dossierOf(s: StreetState, ctx: StreetContext): DossierView {
  return dossierView(s.survival, ledgerOf(s, s.day, ctx), ctx.world.survival as unknown as IntegrityConfig);
}
