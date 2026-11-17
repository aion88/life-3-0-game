/** Types communs à tous les écrans et au moteur. */

/** Langue d'affichage. */
export type Lang = 'fr' | 'en';

/** Ligne d'un rapport de validation ; `owner` est le rôle du studio qui corrige. */
export interface Issue {
  readonly code: string;
  readonly file: string;
  readonly path: string;
  readonly message: string;
  readonly owner: string;
}
