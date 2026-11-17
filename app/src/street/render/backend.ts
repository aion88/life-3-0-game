/** Création du rendu WebGPU avec repli WebGL 2 [art bible §E ; plan 02a T4, errata R-02a.13]. */
import type { WebGPURenderer } from 'three/webgpu';

export type BackendKind = 'webgpu' | 'webgl2';

export interface BackendDeps {
  readonly make: (opts: { forceWebGL: boolean }) => Promise<{ renderer: unknown; kind: BackendKind }>;
}

export interface RenderBackend { readonly renderer: WebGPURenderer; readonly kind: BackendKind }

/** Aucun backend n'a pu s'initialiser : l'écran affiche `street.ui.noGpu`, la sauvegarde ne bouge pas. */
export class GraphicsUnavailable extends Error {
  constructor(readonly causes: readonly unknown[]) {
    super('street.ui.noGpu');
    this.name = 'GraphicsUnavailable';
  }
}

/**
 * Seul endroit qui lit le drapeau du moteur : `WebGPUBackend` pose `this.isWebGPUBackend = true` dans son
 * constructeur (three r186, `src/renderers/webgpu/WebGPUBackend.js`), le backend WebGL 2 ne le pose pas.
 * [à vérifier: Context7] La documentation r186 de Context7 ne nomme aucun drapeau de backend actif ; le nom
 * vient de la lecture du source installé (0.186.1) et se confirme sur capture (T13).
 */
export function kindOf(renderer: unknown): BackendKind {
  const backend = (renderer as { backend?: { isWebGPUBackend?: boolean } } | null)?.backend;
  return backend?.isWebGPUBackend === true ? 'webgpu' : 'webgl2';
}

/** `?webgl` n'est lu que dans les builds de dev et de capture (`allowed`), jamais en production. */
export function forceWebGLFromSearch(search: string, allowed: boolean): boolean {
  return allowed && new URLSearchParams(search).has('webgl');
}

/** Fabrique réelle : `new WebGPURenderer`, `await init()`, puis le canvas dans l'hôte. */
function realDeps(host: HTMLElement): BackendDeps {
  return {
    make: async ({ forceWebGL }) => {
      const { WebGPURenderer: Renderer } = await import('three/webgpu');
      const renderer = new Renderer({ antialias: true, forceWebGL });
      try {
        await renderer.init();
      } catch (e) {
        renderer.dispose();
        throw e;
      }
      host.appendChild(renderer.domElement);
      return { renderer, kind: forceWebGL ? 'webgl2' : kindOf(renderer) };
    },
  };
}

/**
 * Essaie WebGPU, puis WebGL 2 en repli. WebGPU absent donne un backend `webgl2` sans erreur ;
 * deux échecs lèvent `GraphicsUnavailable` (l'appelant affiche le panneau, jamais un plantage de l'écran).
 */
export async function createBackend(host: HTMLElement, opts: { readonly forceWebGL: boolean }, deps: BackendDeps = realDeps(host)): Promise<RenderBackend> {
  const failures: unknown[] = [];
  const attempts = opts.forceWebGL ? [true] : [false, true];
  for (const forceWebGL of attempts) {
    try {
      const made = await deps.make({ forceWebGL });
      return { renderer: made.renderer as WebGPURenderer, kind: made.kind };
    } catch (e) {
      failures.push(e);
    }
  }
  throw new GraphicsUnavailable(failures);
}
