import { validateContent, type ContentInput } from '../validate/content';

/**
 * Validation du contenu au démarrage en développement : les avertissements passent par `warn`, une erreur
 * lève avec ses codes et chemins. Jamais appelée en production (import dynamique sous `import.meta.env.DEV`)
 * [plan 00 Task 6 étape 4 ; GDD 05 §8.2 ; revue finale, Important 1].
 * @param input Contenu complet à valider.
 * @param warn Réceptacle des avertissements, une ligne par avertissement.
 */
export function devValidate(input: ContentInput, warn: (line: string) => void): void {
  const r = validateContent(input);
  for (const w of r.warnings) warn(`validate ${w.code} ${w.file} ${w.path}`);
  if (r.errors.length > 0) {
    throw new Error(`contenu invalide :\n${r.errors.map((e) => `${e.code} ${e.file} ${e.path}`).join('\n')}`);
  }
}
