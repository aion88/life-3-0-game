/**
 * Réglages des zones d'écran de la rue [design/ui/2026-11-02-zones-ecran-ux.md §1-§3, Z-8]. Strict : une clé inconnue est un `DataLoadError`.
 * Chaque nombre porte sa provenance (`sourced` : la règle UX le donne).
 */
import { z } from 'zod';
import { runParse } from './common';
import { sourced } from './sourced';

const pos = sourced(z.number().positive());
const share = sourced(z.number().gt(0).lt(1));

export const zonesSchema = z.strictObject({
  marginRem: pos, largeMinPx: pos, mediumMinPx: pos,
  leftLargeRem: pos, leftMediumShare: share, leftSmallRem: pos,
  rightMediumShare: share, rightSmallShare: share,
  centreCapRem: pos, cardCapRem: pos,
  mediumHelpMaxGroups: sourced(z.number().int().nonnegative()),
  foldMaxMs: sourced(z.number().nonnegative()),
}).refine((t) => t.mediumMinPx.v < t.largeMinPx.v, { message: 'mediumMinPx doit être sous largeMinPx' });
export type ZoneTokens = z.infer<typeof zonesSchema>;

export const parseZones = (raw: unknown): ZoneTokens => runParse(zonesSchema, raw, 'ui/zones.json');
