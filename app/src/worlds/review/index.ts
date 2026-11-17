/**
 * Couche de revue par monde : le contenu relu (textes, effets, options à masquer) vit dans `review/wNN.ts`,
 * appliqué en fin de chaîne par `catalogue.ts`. Plan : production/session-state/plan-semaine-1984-3d.md, lot S1 (§5.1).
 * Elle ne peut changer que `title, text, speaker, objective` d'une scène et `label, consequence, hideWhenBlocked`
 * d'une option (le texte d'une fin est le `text` de sa scène). Identifiants, coûts, prérequis et branches ne bougent
 * jamais (rejeu des sauvegardes) : toute autre clé est refusée par une erreur.
 */
import type { Journey, JourneyOption, JourneyScene, JourneyWorldId } from '../types';
import { review as w01 } from './w01';
import { review as w02 } from './w02';
import { review as w03 } from './w03';
import { review as w04 } from './w04';
import { review as w05 } from './w05';
import { review as w06 } from './w06';
import { review as w08 } from './w08';
import { review as w09 } from './w09';
import { review as w11 } from './w11';

/** Ce qu'une revue peut changer sur une option. */
export type OptionReview = Partial<Pick<JourneyOption, 'label' | 'consequence' | 'hideWhenBlocked'>>;
/** Ce qu'une revue peut changer sur une scène. */
export type SceneReview = Partial<Pick<JourneyScene, 'title' | 'text' | 'speaker' | 'objective'>> & { options?: Record<string, OptionReview> };
/** Revue d'un monde : identifiant de scène vers ses changements. */
export type WorldReview = Record<string, SceneReview>;

/** Clés permises, vérifiées à l'exécution (le typage seul ne protège pas un JSON ou un cast). */
export const SCENE_KEYS: readonly string[] = ['title', 'text', 'speaker', 'objective', 'options'];
export const OPTION_KEYS: readonly string[] = ['label', 'consequence', 'hideWhenBlocked'];

/** Les revues des neuf mondes runtime. */
export const reviews: Readonly<Record<JourneyWorldId, WorldReview>> = { w01, w02, w03, w04, w05, w06, w08, w09, w11 };

/**
 * Applique la revue d'un monde. Une revue vide rend le parcours lui-même, sans copie.
 * @param journey Parcours après toutes les autres couches.
 * @param review Revue à appliquer ; celle du monde par défaut.
 * @throws Error si une scène ou une option n'existe pas, ou si une clé interdite est présente.
 */
export function withReview(journey: Journey, review: WorldReview = reviews[journey.id]): Journey {
  const sceneIds = Object.keys(review);
  if (sceneIds.length === 0) return journey;
  for (const id of sceneIds) {
    if (!journey.scenes.some(scene => scene.id === id)) throw new Error(`review ${journey.id}: scène inconnue « ${id} »`);
  }
  const scenes = journey.scenes.map(scene => {
    const change = review[scene.id];
    if (!change) return scene;
    for (const key of Object.keys(change)) {
      if (!SCENE_KEYS.includes(key)) throw new Error(`review ${journey.id}.${scene.id}: clé interdite « ${key} »`);
    }
    const { options: optionChanges, ...sceneChanges } = change;
    const optionIds = Object.keys(optionChanges ?? {});
    for (const id of optionIds) {
      if (!scene.options.some(option => option.id === id)) throw new Error(`review ${journey.id}.${scene.id}: option inconnue « ${id} »`);
    }
    const options = scene.options.map(option => {
      const optionChange = optionChanges?.[option.id];
      if (!optionChange) return option;
      for (const key of Object.keys(optionChange)) {
        if (!OPTION_KEYS.includes(key)) throw new Error(`review ${journey.id}.${scene.id}.${option.id}: clé interdite « ${key} »`);
      }
      return { ...option, ...optionChange };
    });
    return { ...scene, ...sceneChanges, options };
  });
  return { ...journey, scenes };
}
