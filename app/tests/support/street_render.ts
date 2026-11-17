/** Aides de test du rendu de la rue [plan 02a T4, errata R-02a.13]. Un fichier, un écrivain. */
import { parseScene, type SceneData } from '../../src/engine/view/sceneSchema';
import type { LutParams } from '../../src/street/render/lut';
import type { PostOptions } from '../../src/street/render/pipeline';
import type { BackendDeps, BackendKind } from '../../src/street/render/backend';
import w10SceneRaw from '../../src/street/data/w10.scene.json';
import { ctxW10 } from './street';

/** Scène réelle de w10, telle que la donnée l'écrit. */
export function scene(): SceneData {
  return parseScene(w10SceneRaw, ctxW10().street);
}

/** Moteur factice qui porte le drapeau d'un backend WebGPU, tel que `WebGPUBackend` le pose. */
export const FAKE_WEBGPU = { isWebGPUBackend: true } as const;
/** Moteur factice d'un backend WebGL 2 : pas de drapeau WebGPU. */
export const FAKE_WEBGL = { isWebGLBackend: true } as const;

/** Hôte minimal : le test ne touche jamais au DOM, le double de `make` ne monte rien. */
export const host = { appendChild: () => undefined } as unknown as HTMLElement;

/** LUT identité : aucun réglage. */
export const IDENTITY: LutParams = { contrast: 1, saturation: 1, tint: [1, 1, 1] };

/** Double de `make` qui journalise ses appels : `answer` décide, par appel, d'un backend ou d'un rejet. */
export function scriptedMake(answer: (forceWebGL: boolean) => BackendKind | Error): { deps: BackendDeps; calls: boolean[] } {
  const calls: boolean[] = [];
  return {
    calls,
    deps: {
      make: async ({ forceWebGL }) => {
        calls.push(forceWebGL);
        const r = answer(forceWebGL);
        if (r instanceof Error) throw r;
        return { renderer: {}, kind: r };
      },
    },
  };
}

/** Options de chaîne tirées de la scène réelle, état de départ compris (heure bleue, fondu arrêté). */
export function postOptions(over: { aberration?: boolean; letterbox?: boolean } = {}): PostOptions {
  const sc = scene();
  const lutOf = (n: 'jour' | 'heureBleue' | 'nuit') => ({ contrast: sc.lut[n].contrast.v, saturation: sc.lut[n].saturation.v, tint: sc.lut[n].tint.v });
  const g = sc.grade.states.heureBleue;
  return {
    aberration: over.aberration ?? true,
    letterbox: over.letterbox ?? true,
    dof: { focalLengthM: sc.dof.walk.focalLengthM.v, bokehScale: sc.dof.walk.bokehScale.v },
    luts: { jour: lutOf('jour'), heureBleue: lutOf('heureBleue'), nuit: lutOf('nuit') },
    postfx: sc.postfx,
    initial: {
      grade: { grain: g.grain.v, vignetteIL: g.vignetteIL.v, blackPoint: g.blackPoint.v, exposure: g.exposure.v, toneMap: g.toneMap.v, veil: 0, accent: 0, curvature: 0 },
      blend: { from: 'heureBleue', to: 'heureBleue', t: 1 },
      focusM: sc.camera.walk.distanceM.v,
    },
  };
}

interface GraphNode { getChildren(): Iterable<GraphNode>; traverse(cb: (n: GraphNode) => void): void }

/** Vrai si `target` figure dans le sous-graphe de `root`. */
export function graphHas(root: object, target: object): boolean {
  let found = false;
  (root as GraphNode).traverse((n) => { if (n === (target as GraphNode)) found = true; });
  return found;
}

/** Nœuds du graphe de `root` qui ont `child` pour enfant direct. */
export function parentsOf(root: object, child: object): object[] {
  const out: object[] = [];
  (root as GraphNode).traverse((n) => { for (const c of n.getChildren()) if (c === (child as GraphNode)) out.push(n); });
  return out;
}
