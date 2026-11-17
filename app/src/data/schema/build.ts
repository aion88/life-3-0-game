/** Configuration de build : quels mondes ont une rue dans cette tranche [design §10 phase 6]. */
import { z } from 'zod';
import { addCrossIssue, runParse, worldIdSchema } from './common';
import type { Catalogue } from './catalogue';
import type { ArrivalWorldId, WorldId } from '../../shared/types';

/** Configuration de la tranche livrée [design §10 phase 6]. */
export interface BuildConfig {
  readonly label: string;
  readonly streetWorlds: readonly ArrivalWorldId[];
}

const buildSchema = z.strictObject({
  schema: z.literal(1),
  label: z.string().min(1),
  streetWorlds: z.array(worldIdSchema).min(1),
});

/**
 * Charge et valide `build.json` : `streetWorlds` non vide, uniques, mondes d'arrivée du catalogue,
 * chacun avec un fichier de monde [plan 00 « Données »].
 */
export function parseBuild(raw: unknown, catalogue: Catalogue, worldFiles: readonly WorldId[]): BuildConfig {
  const schema = buildSchema.superRefine((b, ctx) => {
    const seen = new Set<string>();
    b.streetWorlds.forEach((id, i) => {
      if (seen.has(id)) addCrossIssue(ctx, ['streetWorlds', i], `monde en double : ${id}`);
      seen.add(id);
      if (catalogue.byId[id].kind !== 'arrival') addCrossIssue(ctx, ['streetWorlds', i], `${id} n'est pas un monde d'arrivée`, 'reference');
      else if (!worldFiles.includes(id)) addCrossIssue(ctx, ['streetWorlds', i], `${id} n'a pas de fichier worlds/${id}.json`, 'reference');
    });
  });
  const parsed = runParse(schema, raw, 'build.json');
  return { label: parsed.label, streetWorlds: parsed.streetWorlds as ArrivalWorldId[] };
}
