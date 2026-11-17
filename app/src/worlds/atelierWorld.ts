/**
 * Atelier de monde : `?atelier=monde&monde=wNN[&neuf=1]`. Plan : production/session-state/plan-semaine-1984-3d.md, lot S1.
 * Monte le VRAI runtime du monde (`mountJourney`, ou `mountEpisode` pour w10) avec des réponses de questionnaire
 * figées, sans passer par le questionnaire. Ne touche jamais `aiaftermath.v2.save` (sauvegarde en mémoire) ni les clés
 * de parcours d'un joueur (`sessionStorage` est isolé, voir `isolateSessionStorage`) : la graine `-1` n'est jamais celle d'une vraie partie (les graines réelles sont `fnv1a32`,
 * non signées), donc les clés `aftermath.journey.v1.wNN.-1` et `aftermath.episode.1984.v2.-1` sont à l'atelier seul.
 * `&neuf=1` efface seulement ces clés de l'atelier. Expose `window.__atelierRoutes` (voir `atelierRoutes.ts`).
 * Garde DEV ou localhost : posée par l'appelant (`main.ts`), comme les autres ateliers.
 */
import type { AppContext } from '../app/shell';
import { createProductionWorldLoader, loadCore } from '../data/load';
import { createI18n, type StringMeta } from '../i18n/i18n';
import { runFastForward } from '../fastforward/run';
import { loadFastForwardData } from '../screens/data';
import { createSaveStore, type StorageLike } from '../save/save';
import type { RunResult } from '../shared/types';
import fr from '../data/strings/fr.json';
import en from '../data/strings/en.json';
import stringMetadata from '../data/strings/meta.json';
import { SHORT_WORLDS } from './routing';
import { ATELIER_LINES, atelierAnswers, isAtelierWorld, type AtelierWorldId } from './atelierAnswers';
import { atelierRoutes, type AtelierRoutes } from './atelierRoutes';
import type { JourneyDeps, mountJourney } from './runtime';
import type { mountEpisode } from '../street/episode/runtime';

/** Graine de l'atelier : jamais une graine réelle (`fnv1a32` est non signée). */
export const ATELIER_SEED = -1;
/** Clés de parcours propres à l'atelier pour un monde. */
export function atelierProgressKeys(world: AtelierWorldId): string[] {
  return world === 'w10'
    ? [`aftermath.episode.1984.v2.${ATELIER_SEED}`, `aftermath.episode.1984.v2.${ATELIER_SEED}.dinner`]
    : [`aftermath.journey.v1.${world}.${ATELIER_SEED}`];
}

/** Sources de chargement et vue substituables (tests sans WebGL). */
export interface AtelierDeps {
  view?: JourneyDeps['view'];
  loadJourney?: () => Promise<{ mountJourney: typeof mountJourney }>;
  loadEpisode?: () => Promise<{ mountEpisode: typeof mountEpisode }>;
}

/** Exposition de développement : les chemins de recette calculés depuis le vrai catalogue. */
declare global { interface Window { __atelierRoutes?: AtelierRoutes } }

const memoryStorage = (): StorageLike => {
  const data = new Map<string, string>();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } };
};
/**
 * Isole `sessionStorage` : `exploration.ts` y lit, écrit et efface `aftermath.exploration.v1`, une clé qui appartient à
 * la partie du joueur. Pendant l'atelier, `window.sessionStorage` est une copie en mémoire : la vraie n'est ni lue, ni écrite,
 * ni effacée. Rend la fonction qui remet la vraie.
 */
export function isolateSessionStorage(): () => void {
  const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: memoryStorage() });
  return () => { if (original) Object.defineProperty(window, 'sessionStorage', original); else delete (window as { sessionStorage?: unknown }).sessionStorage; };
}

/**
 * Contexte d'application de l'atelier : vraies données et vraie langue, sauvegarde en mémoire, navigation neutralisée.
 * `navigate` écrit la cible dans `data-atelier-navigation` de `root` et ne quitte pas l'atelier.
 */
export function createAtelierContext(root: HTMLElement): AppContext {
  const core = loadCore();
  return {
    i18n: createI18n({ fr, en }, stringMetadata as StringMeta, 'fr', { mode: 'prod', report: () => undefined }),
    save: createSaveStore(memoryStorage(), core.contentHash, () => true),
    core,
    worlds: createProductionWorldLoader(core.catalogue),
    navigate: (id) => { root.dataset['atelierNavigation'] = String(id); return Promise.resolve(); },
  };
}

/** Run de l'atelier : les réponses figées du monde, graine `-1`. */
export function atelierRun(ctx: AppContext, world: AtelierWorldId): RunResult {
  const run = runFastForward(ctx.core, loadFastForwardData().headlines, atelierAnswers(world), false, SHORT_WORLDS);
  if (run.outcome.kind !== 'arrival' || run.outcome.computedWorld !== world) throw new Error(`atelier: les réponses figées de ${world} ne mènent plus à ce monde`);
  return { ...run, seed: ATELIER_SEED };
}

function showMenu(root: HTMLElement, message: string): () => void {
  const doc = root.ownerDocument;
  const host = doc.createElement('main'); host.dataset['atelier'] = 'monde';
  const title = doc.createElement('p'); title.textContent = message; host.append(title);
  for (const id of Object.keys(ATELIER_LINES)) { const a = doc.createElement('a'); a.href = `?atelier=monde&monde=${id}`; a.textContent = id; a.style.marginRight = '1em'; host.append(a); }
  root.append(host);
  return () => host.remove();
}

/**
 * Monte l'atelier d'un monde.
 * @param root Hôte de l'application.
 * @param search Chaîne de requête (`?atelier=monde&monde=w03&neuf=1`).
 * @param deps Couture de test : vue et chargeurs.
 * @returns La fonction qui démonte l'atelier.
 */
export async function mountAtelierWorld(root: HTMLElement, search: string, deps: AtelierDeps = {}): Promise<() => void> {
  const params = new URLSearchParams(search);
  const world = params.get('monde');
  if (!isAtelierWorld(world)) return showMenu(root, 'Monde inconnu ou absent : choisis un monde.');
  if (params.get('neuf') === '1') for (const key of atelierProgressKeys(world)) { try { localStorage.removeItem(key); } catch { /* Rien à effacer. */ } }
  const ctx = createAtelierContext(root);
  const run = atelierRun(ctx, world);
  const restoreSession = isolateSessionStorage();
  const { journeys } = await import('./catalogue');
  window.__atelierRoutes = atelierRoutes(journeys);
  let mounted: { dispose(): void };
  try {
    if (world === 'w10') {
      const { mountEpisode } = await (deps.loadEpisode ?? (() => import('../street/episode/runtime')))();
      mounted = await mountEpisode(ctx, run, root);
    } else {
      const { mountJourney } = await (deps.loadJourney ?? (() => import('./runtime')))();
      mounted = await mountJourney(ctx, run, root, deps.view ? { view: deps.view } : {});
    }
  } catch (error) { restoreSession(); delete window.__atelierRoutes; throw error; }
  return () => { mounted.dispose(); delete window.__atelierRoutes; restoreSession(); };
}
