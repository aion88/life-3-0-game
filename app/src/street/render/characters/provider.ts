/**
 * Contrat des personnages affichés [plan 02a T7] : une poignée par personne, un fournisseur par source de corps.
 * Types seulement, plus l'erreur de contrat ; aucun chargement ici.
 */
import type { Object3D } from 'three';
import type { ClipName } from '../../../engine/view/glb';

/** Qui l'on veut afficher : identifiant stable, nature, corps (`char.<bodyId>.glb`), graine de désynchronisation des clips. */
export interface CharacterSpec { readonly id: string; readonly kind: 'player' | 'npc' | 'passerby' | 'queue'; readonly bodyId: string; readonly seed: number }

/**
 * Une personne à l'écran. `object` est posé et orienté par l'appelant (cap compris, voir `facingYaw`) ; le corps y est face à +Z local.
 * `tick` fait avancer les clips (un mixeur a besoin du temps réel écoulé) : extension nécessaire du contrat du brief.
 */
export interface CharacterHandle {
  readonly object: Object3D;
  play(clip: ClipName, speed: number): void;
  tick(dtMs: number): void;
  release(): void;
}

/** Source de corps. `neutral` vaut vrai pour la seule doublure de test (gris uni), jamais pour un vrai fournisseur. */
export interface CharacterProvider { acquire(spec: CharacterSpec): CharacterHandle; readonly neutral: boolean }

/** Un corps livré ne respecte pas le contrat d'export (clip ou os manquant, fichier illisible, corps inconnu). Le message nomme le corps. */
export class CharacterContractError extends Error {
  constructor(message: string, readonly bodyId?: string) { super(message); this.name = 'CharacterContractError'; }
}
