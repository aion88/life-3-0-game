/**
 * Le relevé du soir : une ligne par axe, toujours six, dans l'ordre de `AXES` [GDD 05 §3.5, §3.6 ; V13 ; plan 02b T12].
 * Un axe où le joueur a décidé un geste ce jour-là (un acte `choice` ou `lane`, refus compris) dit sa clé `fait`, sinon sa clé `rien`.
 * L'axe d'un geste est une DONNÉE (`street.evening.gestureAxis`) : aucun axe n'est écrit ici. Fonction pure.
 */
import type { ActRecord, DayIndex } from '../../shared/types/street';
import { AXES } from './types';
import type { Axis, StreetContext } from './types';

/** Une ligne du soir : l'axe et la clé de la chaîne à dire. */
export interface EveningLine { readonly axis: Axis; readonly key: string }

/** Axe d'un acte : id exact, puis préfixe avant le premier point [R-02b.54 (b)] ; `null` si l'acte n'est pas un geste du soir. */
function axisOf(a: ActRecord, map: Readonly<Record<string, Axis>>): Axis | null {
  if (a.kind !== 'choice' && a.kind !== 'lane') return null;
  const exact = map[a.id];
  if (exact !== undefined) return exact;
  const head = a.id.split('.')[0]!;
  return map[head] ?? null;
}

/** Les six lignes du soir du jour `day`, d'après les actes `acts` [GDD 05 §3.5]. */
export function eveningLines(day: DayIndex, acts: readonly ActRecord[], ctx: StreetContext): readonly EveningLine[] {
  const { gestureAxis, lines } = ctx.street.evening;
  const done = new Set<Axis>();
  for (const a of acts) {
    if (a.day !== day) continue;
    const ax = axisOf(a, gestureAxis);
    if (ax !== null) done.add(ax);
  }
  return AXES.map((axis) => {
    const l = lines.find((x) => x.axis === axis);
    if (l === undefined) throw new Error(`relevé du soir : ligne absente pour l'axe ${axis}`);
    return { axis, key: done.has(axis) ? l.fait : l.rien };
  });
}
