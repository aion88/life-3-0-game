/**
 * Rejeu : l'état de la rue se recalcule en rejouant les actes dans l'ordre, rien de plus n'est sauvé [plan 00, Sauvegarde ; plan 02b T10].
 * Pur et sans état : deux rejeux des mêmes actes rendent le même résultat. Un acte refusé est noté et écarté, jamais levé.
 * Au rechargement la minute attendue depuis le dernier acte est perdue : l'horloge est celle du dernier acte, `carry` à 0.
 */
import type { ActRecord } from '../../shared/types/street';
import { startWeek, type WeekState } from '../week';
import { createStreet, reduceAct } from './state';
import type { Rejected, StreetContext, StreetState } from './types';

export interface ReplayResult { readonly state: StreetState; readonly week: WeekState; readonly rejected: readonly Rejected[] }

/** Rejoue `acts` depuis le J1 : l'état, la semaine et les actes écartés avec leur raison. */
export function replay(acts: readonly ActRecord[], ctx: StreetContext): ReplayResult {
  let state = createStreet(ctx);
  let week = startWeek(ctx.run, ctx.world, ctx.core);
  const rejected: Rejected[] = [];
  for (const a of acts) {
    const r = reduceAct(state, week, a, ctx);
    if ('reason' in r) rejected.push(r);
    else { state = r.state; week = r.week; }
  }
  return { state, week, rejected };
}
