/**
 * Réglages de la barre « Dossier » [GDD 2026-11-03 §2 option A, décision Cynthia, playtest 2026-11-03 ; direction C]. Strict : une clé
 * inconnue est un `DataLoadError`. Couleurs par jeton de la palette C seulement (I-1) ; chaque valeur porte sa provenance.
 */
import { z } from 'zod';
import { runParse } from './common';
import { sourced } from './sourced';
import { PALETTE_TOKENS } from './ui';

const token = sourced(z.enum(PALETTE_TOKENS));
const px = sourced(z.number().positive());

export const dossierSchema = z.strictObject({
  /** Couleur de la partie pleine par palier [bible w10 §7.1 : 60, 40, 25, 0]. */
  palierColor: z.strictObject({ courtesy: token, thanks: token, patience: token, appointment: token }),
  /** Segment « en attente » : gris, un trait de fond entre deux segments. */
  ghost: token, ghostOpacity: sourced(z.number().gt(0).lt(1)), segmentGap: token,
  track: token, border: token, mark: token,
  trackHeightPx: px, markWidthPx: px, gapPx: px,
  /** Consolidation du relevé du soir : durée et courbe (supprimée en mouvement réduit, I-9). */
  settleMs: px, settleEasing: sourced(z.enum(['pop', 'sortie', 'rentree'])),
  /** Pulsation du segment en attente pendant une séquence jouée : jeton de couleur, largeur en fraction de la barre, durée d'un battement (arrêtée en mouvement réduit, I-9). */
  pulse: token, pulseWidth: z.strictObject({ low: sourced(z.number().gt(0).lt(1)), medium: sourced(z.number().gt(0).lt(1)), strong: sourced(z.number().gt(0).lt(1)) }), pulseMs: px,
});
export type DossierTokens = z.infer<typeof dossierSchema>;

export const parseDossier = (raw: unknown): DossierTokens => runParse(dossierSchema, raw, 'ui/dossier.json');
