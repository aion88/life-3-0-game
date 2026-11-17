/**
 * Vue de la foule : lit des positions, n'en écrit aucune [plan 02a T7]. La file et les passants viennent de `crowdAt` / `queueSlots`
 * (moteur de vue pur) ; ici on ne fait que tenir une poignée par personne, la poser et la faire marcher.
 */
import type { Object3D } from 'three';
import { facingYaw, type PersonView } from '../../../engine/view/crowd';
import type { ClipName } from '../../../engine/view/glb';
import { fnv1a32 } from '../../../shared/rng';
import type { CharacterHandle, CharacterProvider, CharacterSpec } from './provider';

/** Une personne à afficher : `clip` vaut `walk` par défaut (la file passe `queue`), `kind` vaut `passerby`. */
export interface CrowdPerson extends PersonView { readonly clip?: ClipName; readonly kind?: CharacterSpec['kind'] }

export interface CrowdView {
  /** Pose chaque personne, acquiert celles qui arrivent, relâche celles qui partent, avance les clips de `dtMs`. */
  update(people: readonly CrowdPerson[], dtMs: number): void;
  /** L'objet 3D d'une personne affichée, `null` si elle ne l'est pas (sert à projeter son rectangle écran [UI-C T8]). */
  objectOf(id: string): Object3D | null;
  /** Relâche toutes les poignées. */
  dispose(): void;
}

export function createCrowdView(provider: CharacterProvider, parent: Object3D): CrowdView {
  const live = new Map<string, { handle: CharacterHandle; clip: ClipName | null }>();
  return {
    update(people, dtMs) {
      const seen = new Set<string>();
      for (const p of people) {
        seen.add(p.id);
        let entry = live.get(p.id);
        if (entry === undefined) {
          const handle = provider.acquire({ id: p.id, kind: p.kind ?? 'passerby', bodyId: p.bodyId, seed: fnv1a32(p.id) });
          parent.add(handle.object);
          entry = { handle, clip: null };
          live.set(p.id, entry);
        }
        entry.handle.object.position.set(p.pos.x, 0, p.pos.z);
        entry.handle.object.rotation.y = facingYaw(p.heading);
        const clip = p.clip ?? 'walk';
        if (entry.clip !== clip) { entry.handle.play(clip, 1); entry.clip = clip; }
        entry.handle.tick(dtMs);
      }
      for (const [id, entry] of live) {
        if (seen.has(id)) continue;
        entry.handle.release();
        live.delete(id);
      }
    },
    objectOf(id) { return live.get(id)?.handle.object ?? null; },
    dispose() {
      for (const entry of live.values()) entry.handle.release();
      live.clear();
    },
  };
}
