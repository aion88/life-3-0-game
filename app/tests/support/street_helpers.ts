/**
 * Aides de test de la scène de la rue [R-02a.2] : un fichier, un écrivain. Rien sous `src/` ne l'importe.
 * T1 écrit `lampZs`, `supposedPaths`, `withSupposedNoOwner` ; les tâches suivantes y ajoutent les leurs une à la fois.
 */
import type { SceneData } from '../../src/engine/view/sceneSchema';

/** z des lampadaires d'un côté : du bout de la rue vers le fond, tous les `spacingM` [bible w10 §5.1 n°1]. */
export function lampZs(scene: SceneData): number[] {
  const { zMax } = scene.layout;
  const { spacingM, perSide } = scene.lamps;
  return Array.from({ length: perSide.v }, (_, i) => zMax.v - i * spacingM.v);
}

/** Une valeur `supposed` : son chemin (`a.b[0].c`) et son propriétaire. */
export interface SupposedPath { readonly path: string; readonly owner: string | undefined }

function isSourced(n: unknown): n is { status: string; owner?: string } {
  return typeof n === 'object' && n !== null && 'v' in n && 'status' in n;
}

/** Toutes les feuilles `supposed` d'une scène, brute ou validée. */
export function supposedPaths(scene: unknown): SupposedPath[] {
  const out: SupposedPath[] = [];
  const walk = (n: unknown, p: string): void => {
    if (isSourced(n)) {
      if (n.status === 'supposed') out.push({ path: p, owner: n.owner });
      return;
    }
    if (Array.isArray(n)) n.forEach((v, i) => walk(v, `${p}[${i}]`));
    else if (typeof n === 'object' && n !== null) for (const [k, v] of Object.entries(n)) walk(v, p === '' ? k : `${p}.${k}`);
  };
  walk(scene, '');
  return out;
}

/** Copie de la scène brute dont la première valeur `supposed` perd son `owner`. */
export function withSupposedNoOwner(raw: unknown): unknown {
  const copy = structuredClone(raw);
  let done = false;
  const walk = (n: unknown): void => {
    if (done) return;
    if (isSourced(n)) {
      if (n.status === 'supposed') { delete n.owner; done = true; }
      return;
    }
    if (typeof n === 'object' && n !== null) Object.values(n).forEach(walk);
  };
  walk(copy);
  return copy;
}
