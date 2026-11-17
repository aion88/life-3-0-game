/**
 * Écran `street` [plan 02a T12 ; R-02a.20 ; rue guidée T14]. Léger : aucun import de Three.js. À `mount`, lit le monde, choisit la rue
 * (`routeOf`) et charge son chunk par `import()` dynamique : `guidedRuntime.ts` pour un monde guidé, `runtime.ts` (marche libre) sinon.
 * Tout le rendu est un chunk à la demande hors du premier chargement. Un chunk introuvable est une `DataLoadError('fetch')` :
 * la coquille montre l'erreur, la sauvegarde ne bouge pas, `retry` recharge.
 */
import { shortMode } from '../worlds/routing';
import { resetDraft } from '../screens/draft';
import { createContactLink } from '../screens/feedback';
import { WEEK_3D_READY } from '../worlds/week/weekRelease';
import type { Screen, ScreenFactory } from '../app/shell';
import { DataLoadError } from '../data/schema/common';
import type { RuntimeDeps, StreetRuntime } from './runtime';

/** La couture de test de l'écran : celle du runtime, plus les chargeurs des deux chunks. */
export interface StreetScreenDeps extends RuntimeDeps {
  readonly loadRuntime: () => Promise<typeof import('./runtime')>;
  readonly loadGuided: () => Promise<typeof import('./guidedRuntime')>;
  readonly loadJourney: () => Promise<Pick<typeof import('../worlds/runtime'), 'mountJourney'>>;
  readonly loadEpisode: () => Promise<Pick<typeof import('./episode/runtime'), 'mountEpisode'>>;
  /** Les situations : le jeu public des dix mondes. */
  readonly loadSituations: () => Promise<Pick<typeof import('../worlds/situations/situationPlayer'), 'mountSituations'>>;
  /** Semaine 1984 en 3D (fermée tant que `WEEK_3D_READY` est `false`). */
  readonly loadWeek: () => Promise<Pick<typeof import('../worlds/week/weekEpisode'), 'mountWeekEpisode'>>;
  /** Couture de test : remplace `WEEK_3D_READY`. */
  readonly weekReady: boolean;
}

/** Vrai quand le monde `destination` doit monter la semaine 3D plutôt que le parcours court. */
export function usesWeek3d(destination: string, ready: boolean = WEEK_3D_READY): boolean {
  return ready && destination === 'w10';
}

/** Vrai quand l'adresse demande l'ancien parcours des mondes (`?parcours=ancien`), gardé pour comparaison. */
export const legacyJourney = (search: string): boolean => new URLSearchParams(search).get('parcours') === 'ancien';

/** Un écran `street` qui laisse lire le runtime monté (les tests y lisent le pilote). */
export type StreetScreen = Screen & { runtime(): StreetRuntime | null };

/**
 * Quelle rue monter [PHASE V]. Un monde guidé monte la rue guidée ; `?rue=libre` rend la marche libre au seul build de capture
 * (`capture` : même prédicat que `captureEnabled()` de `capture.ts`), où vivent les suites e2e de la marche libre. En production le drapeau est ignoré.
 */
export function routeOf(o: { readonly capture: boolean; readonly search: string; readonly guided: boolean }): 'guided' | 'free' {
  if (!o.guided) return 'free';
  return o.capture && new URLSearchParams(o.search).get('rue') === 'libre' ? 'free' : 'guided';
}

/** Fabrique de l'écran. `deps` : couture optionnelle pour `backend`, `fetch`, `sink` et le reste [R-02a.15 k]. */
export function createStreetScreen(ctx: Parameters<ScreenFactory<'street'>>[0], payload: Parameters<ScreenFactory<'street'>>[1], deps: Partial<StreetScreenDeps> = {}): StreetScreen {
  let rt: StreetRuntime | null = null;
  let unmounted = false;
  let journey: { dispose(): void } | null = null;
  const { loadRuntime, loadGuided, loadJourney, loadEpisode, loadSituations, loadWeek, weekReady, ...over } = deps;
  return {
    async mount(root) {
      if (payload.run.outcome.kind !== 'arrival') {
        throw new DataLoadError('reference', 'street', '', 'Une extinction ne peut pas ouvrir un monde habitable.');
      }
      if (shortMode(typeof location === 'undefined' ? '' : location.search)) {
        const destination = payload.run.outcome.computedWorld;
        if (usesWeek3d(destination, weekReady)) {
          const mountWeek = await (async () => {
            try {
              return (await (loadWeek ?? (() => import('../worlds/week/weekEpisode')))()).mountWeekEpisode;
            } catch (error) {
              throw new DataLoadError('fetch', 'worlds/week/weekEpisode', '', error instanceof Error ? error.message : String(error));
            }
          })();
          if (unmounted) return;
          const disposeWeek = await mountWeek(root);
          if (unmounted) disposeWeek(); else journey = { dispose: disposeWeek };
          return;
        }
        if (!legacyJourney(location.search)) {
          const mountSituations = await (async () => {
            try {
              return (await (loadSituations ?? (() => import('../worlds/situations/situationPlayer')))()).mountSituations;
            } catch (error) {
              throw new DataLoadError('fetch', 'worlds/situations/situationPlayer', '', error instanceof Error ? error.message : String(error));
            }
          })();
          if (unmounted) return;
          const run = payload.run; const doc = root.ownerDocument;
          const disposeSituations = await mountSituations(root, '', {
            world: destination,
            lang: ctx.i18n.lang(),
            saveKey: `aftermath.situations.v1.${run.seed}`,
            endLinks: (played) => {
              const answers = doc.createElement('button'); answers.type = 'button'; answers.className = 'sp-action'; answers.dataset['action'] = 'answers'; answers.textContent = ctx.i18n.lang() === 'en' ? 'Change my 2026 answers' : 'Changer mes réponses de 2026';
              answers.addEventListener('click', () => { try { localStorage.removeItem(`aftermath.situations.v1.${run.seed}`); } catch { /* sans stockage */ } resetDraft(); void ctx.navigate('questionnaire', undefined); });
              const atlas = doc.createElement('button'); atlas.type = 'button'; atlas.className = 'sp-action'; atlas.dataset['ui'] = 'open-atlas'; atlas.textContent = ctx.i18n.t('atlas.open');
              atlas.addEventListener('click', () => { void ctx.navigate('atlas', { arrival: played, back: { id: 'street', run } }); });
              return [answers, atlas, createContactLink(ctx.i18n, 'sp-contact', doc)];
            },
          });
          if (unmounted) disposeSituations(); else journey = { dispose: disposeSituations };
          return;
        }
        const chunk = destination === 'w10' ? 'street/episode/runtime' : 'worlds/runtime';
        // Fetch failures are retriable by the shell; narrative/runtime errors keep their identity.
        const mount = await (async () => {
          try {
            if (destination === 'w10') return (await (loadEpisode ?? (() => import('./episode/runtime')))()).mountEpisode;
            return (await (loadJourney ?? (() => import('../worlds/runtime')))()).mountJourney;
          } catch (error) {
            throw new DataLoadError('fetch', chunk, '', error instanceof Error ? error.message : String(error));
          }
        })();
        if (unmounted) return;
        const mounted = await mount(ctx, payload.run, root, over);
        if (unmounted) mounted.dispose(); else journey = mounted;
        return;
      }
      const world = await ctx.worlds.load(ctx.core.build.streetWorlds[0]!);
      // écrit en ligne (comme `runtime.ts`) : un build de production plie `capture` en `false`
      const capture = import.meta.env.VITE_CAPTURE === '1' || (import.meta.env.DEV && import.meta.env.MODE !== 'test');
      const route = routeOf({ capture, search: typeof location === 'undefined' ? '' : location.search, guided: world.street.guided !== null });
      const chunk = route === 'guided' ? 'street/guidedRuntime' : 'street/runtime';
      const mountFn = await (async () => {
        try {
          if (route === 'guided') { const mod = await (loadGuided ?? (() => import('./guidedRuntime')))(); return mod.mountGuidedStreet; }
          const mod = await (loadRuntime ?? (() => import('./runtime')))(); return mod.mountStreet;
        } catch (e) {
          throw new DataLoadError('fetch', chunk, '', e instanceof Error ? e.message : String(e));
        }
      })();
      const mounted = await mountFn(ctx, payload.run, root, over);
      if (unmounted) { mounted.dispose(); return; }
      rt = mounted;
    },
    unmount() {
      unmounted = true;
      journey?.dispose(); journey = null;
      rt?.dispose();
      rt = null;
    },
    runtime: () => rt,
  };
}
