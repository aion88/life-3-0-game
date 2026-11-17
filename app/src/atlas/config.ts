/**
 * Configuration de l'affichage de l'Atlas. Les données (`data.json`, ledger) restent entières ; l'écran masque seulement.
 * Mécanisme conservé : liste vide depuis la correction du 14 novembre 2026 (Autodestruction w12 reste affichée).
 * Pour masquer un monde : ajouter son identifiant ici, rien d'autre.
 */
export const HIDDEN_WORLDS: readonly string[] = [];

/**
 * Mondes dont le futur ne passe pas par une loi sur l'IA (décision de Cynthia, 14 novembre 2026) : Autodestruction. Leur carte n'est pas
 * « aucun levier du droit actuel » mais un encart d'une autre nature, et ils sortent du compte des mondes sans levier.
 */
export const OUT_OF_LAW_WORLDS: readonly string[] = ['w12'];

/**
 * Regroupement des mesures du futur hors droit (mise en page, pas un fait) : quatre colonnes en large. Un identifiant absent du registre
 * contrôlé est ignoré ; une mesure non listée tombe dans le groupe `other`. Les titres des groupes sont dans `labels.ts`.
 */
export const OUT_OF_LAW_GROUPS: readonly { readonly key: string; readonly ids: readonly string[] }[] = [
  { key: 'climate', ids: ['w12-01', 'w12-02', 'w12-03', 'w12-04'] },
  { key: 'biodiversity', ids: ['w12-05', 'w12-06', 'w12-07'] },
  { key: 'nuclear', ids: ['w12-08', 'w12-09', 'w12-10'] },
  { key: 'planetary', ids: ['w12-11'] },
];
