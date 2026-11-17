/**
 * Choix-destinations [rue guidée T10] : une fine couche sur le panneau de choix. Le panneau garde tout son pipeline (désigner, ligne de prix,
 * confirmer, événements `ui.*`, mouvement, refus, ligne de droit avant le prix) ; ici, seulement la composition : le choix-destination s'ajoute
 * aux choix ordinaires, sans jamais les remplacer ni capter leur prix. Numérotation, touches 1 à 9 et coût en mots sont rendus par le panneau
 * (`ChoiceView.destination`). Le directeur ne désigne jamais : seul le panneau émet les gestes.
 */
import type { ChoicePanel, ChoiceView } from './choicePanel';

export interface Destinations {
  /** Les choix ordinaires ouverts (le choix-destination éventuel reste). */
  showChoices(cs: readonly ChoiceView[]): void;
  /** Le choix-destination (options numérotées, touches 1 à 9 ; le checkpoint en offre jusqu'à 7, aucune n'est coupée) ; `null` le retire. */
  showDestinations(v: ChoiceView | null): void;
}

export function mountDestinations(panel: Pick<ChoicePanel, 'showChoices'>): Destinations {
  let base: readonly ChoiceView[] = []; let dest: ChoiceView | null = null;
  const push = (): void => { panel.showChoices(dest === null ? base : [...base, dest]); };
  return {
    showChoices(cs) { base = cs.filter((c) => c.id !== dest?.id); push(); },
    showDestinations(v) { dest = v === null ? null : { ...v, destination: true, options: v.options }; push(); },
  };
}
