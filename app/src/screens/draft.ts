/**
 * Brouillon de partie neuve, en mémoire seulement [plan 03 T3 ; décision 5].
 * En mode « Rejoue », la sauvegarde ne change qu'à la onzième réponse : le choix d'adoucissement
 * attend ici, et le questionnaire le copie dans `save.softened` à ce moment.
 */
export interface NewGameDraft {
  /** Choix d'adoucissement en attente ; `null` tant que l'écran d'avertissement n'a pas été ouvert. */
  softened: boolean | null;
}

const draft: NewGameDraft = { softened: null };

/** Le brouillon courant (un seul, mutable). */
export function getDraft(): NewGameDraft { return draft; }

/** Vide le brouillon ; appelé à chaque entrée sur l'avertissement. */
export function resetDraft(): void { draft.softened = null; }
