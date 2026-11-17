/**
 * Valeur avec provenance, partagée par la scène de rue et les réglages d'interface [plan UI-C T1].
 * `sourced` : la valeur vient d'une source citée dans `src`. `supposed` : personne ne l'a écrite, un propriétaire (`owner`) la porte.
 */
import { z } from 'zod';

/** Valeur avec provenance : `supposed` exige un propriétaire (personne n'a écrit ce nombre). */
export interface Sourced<T> { readonly v: T; readonly src: string; readonly status: 'sourced' | 'supposed'; readonly owner?: string | undefined }

/** Enveloppe `{ v, src, status, owner? }` autour d'un schéma ; un `supposed` sans `owner` est refusé. */
export function sourced<V extends z.ZodType>(v: V) {
  return z
    .strictObject({ v, src: z.string().min(1), status: z.enum(['sourced', 'supposed']), owner: z.string().min(1).optional() })
    .superRefine((o, ctx) => {
      if (o.status === 'supposed' && o.owner === undefined) ctx.addIssue({ code: 'custom', path: ['owner'], message: 'valeur supposed sans owner' });
    });
}
