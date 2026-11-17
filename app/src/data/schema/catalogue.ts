/** Catalogue des douze mondes et vecteurs canoniques 2030 [GDD 02 §3.6, GDD 03 §3.1]. */
import { z } from 'zod';
import { runParse, addCrossIssue, vectorSchema, worldIdSchema, EXTINCTION_IDS } from './common';
import { worldNumber, type WorldId, type WorldVector } from '../../shared/types';

/** Une entrée du catalogue : les extinctions n'ont pas de vecteur [GDD 02 §3.5]. */
export interface CatalogueEntry {
  readonly id: WorldId;
  readonly number: number;
  readonly kind: 'arrival' | 'extinction';
  readonly vector: WorldVector | null;
}

/** Les douze entrées et leur index par identifiant [GDD 03 §3.2]. */
export interface Catalogue {
  readonly entries: readonly CatalogueEntry[];
  readonly byId: Readonly<Record<WorldId, CatalogueEntry>>;
}

const entrySchema = z.strictObject({
  id: worldIdSchema,
  number: z.number().int().min(1).max(12),
  kind: z.enum(['arrival', 'extinction']),
  vector: vectorSchema.nullable(),
});

const catalogueSchema = z
  .strictObject({ entries: z.array(entrySchema).length(12) })
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    c.entries.forEach((e, i) => {
      if (seen.has(e.id)) addCrossIssue(ctx, ['entries', i, 'id'], `identifiant en double : ${e.id}`);
      seen.add(e.id);
      if (e.number !== worldNumber(e.id)) addCrossIssue(ctx, ['entries', i, 'number'], `numéro ${e.number} ne correspond pas à ${e.id}`);
      const isExtinction = (EXTINCTION_IDS as readonly string[]).includes(e.id);
      if (isExtinction !== (e.kind === 'extinction')) {
        addCrossIssue(ctx, ['entries', i, 'kind'], `${e.id} doit être ${isExtinction ? 'extinction' : 'arrival'} [GDD 02 §3.5]`);
      }
      if (e.kind === 'arrival' && e.vector === null) addCrossIssue(ctx, ['entries', i, 'vector'], `vecteur canonique manquant pour ${e.id}`);
      if (e.kind === 'extinction' && e.vector !== null) addCrossIssue(ctx, ['entries', i, 'vector'], `une extinction n'a pas de vecteur (${e.id})`);
    });
  });

/** Charge et valide `catalogue.json` ; vecteurs en points vers millièmes [GDD 02 §3.6]. */
export function parseCatalogue(raw: unknown): Catalogue {
  const parsed = runParse(catalogueSchema, raw, 'catalogue.json');
  const entries: readonly CatalogueEntry[] = parsed.entries;
  const byId = Object.fromEntries(entries.map((e) => [e.id, e])) as Record<WorldId, CatalogueEntry>;
  return { entries, byId };
}
