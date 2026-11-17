/** Les cinq cas de la phrase de bascule [GDD 06 §3.4 ; D129]. Pur : compare deux projections reçues, n'en calcule aucune. */
import { basculeYear, shiftYears } from '../engine/projection';
import type { Bascule } from '../shared/types/bilan';
import type { Projection } from '../shared/types/run';

const NONE: Bascule = { case: 'none', yearWith: null, yearWithout: null, shiftYears: null, direction: null };

/**
 * Cas de la table de GDD 06 §3.4. L'année affichée est celle AVEC écho (« vers A »).
 * a : les deux basculent, N non nul ; b : les deux basculent, N nul (jamais « 0 an ») ; c : aucune ne bascule ;
 * d : seule la projection sans écho bascule ; e : seule la projection avec écho bascule.
 * `none` hors table : une des deux projections manque (semaine nulle, extinction) ; le cas c ne dépend jamais d'un texte, c'est à l'écran d'omettre la phrase si la ligne de repli manque.
 * `shiftYears` > 0 : la semaine a avancé la bascule (`forward`), < 0 : reculée (`back`).
 */
export function bascule(withEcho: Projection | null, withoutEcho: Projection | null): Bascule {
  if (withEcho === null || withoutEcho === null) return NONE;
  const sw = withEcho.switchStep, so = withoutEcho.switchStep;
  const yearWith = sw === null ? null : basculeYear(sw);
  const yearWithout = so === null ? null : basculeYear(so);
  if (sw !== null && so !== null) {
    const n = shiftYears(so, sw);
    return { case: n === 0 ? 'b' : 'a', yearWith, yearWithout, shiftYears: n, direction: n === 0 ? null : n > 0 ? 'forward' : 'back' };
  }
  if (sw === null && so === null) return { ...NONE, case: 'c' };
  return { case: so !== null ? 'd' : 'e', yearWith, yearWithout, shiftYears: null, direction: null };
}
