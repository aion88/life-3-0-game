/**
 * Coquille d'application : écrans pilotés par l'état, sans routage par URL (GitHub Pages ne réécrit
 * pas les chemins) [plan 00 « Coquille » ; design §9 ; lead-programmer].
 */
import { DataLoadError, type CoreData, type WorldLoader } from '../data/load';
import type { I18n } from '../i18n/i18n';
import type { SaveStore } from '../save/save';
import type { Answers, BilanInput, RunResult } from '../shared/types';

export { initialScreen } from './initial';

/** Les neuf écrans de l'application [plan 00 « Coquille »]. */
export type ScreenId = 'lang' | 'warning' | 'questionnaire' | 'fastforward' | 'causes' | 'street' | 'bilan' | 'sources' | 'atlas' | 'error';

/** Charge utile de chaque écran [plan 00 « Coquille »]. */
/** Où ramène le bouton « Retour » de l'Atlas : l'accueil, l'écran de fin de la rue, ou le bilan. */
export type AtlasBack = { readonly id: 'lang' } | { readonly id: 'street'; readonly run: RunResult } | { readonly id: 'bilan'; readonly input: BilanInput };

export interface ScreenPayloads {
  lang: undefined; warning: undefined; questionnaire: undefined; fastforward: { readonly answers: Answers };
  causes: { readonly run: RunResult };   // extinction ; « Rejoue » ouvre bilan avec { entry: 'extinction', run, week: null, survival: null, acts: [] }
  street: { readonly run: RunResult }; bilan: { readonly input: BilanInput }; sources: { readonly from: ScreenId; readonly input?: BilanInput };
  atlas: { readonly arrival?: string; readonly back: AtlasBack };   // volet éducatif isolé : hors de `SCREEN_IDS`, ouvert depuis l'accueil et les écrans de fin
  error: { readonly error: DataLoadError; readonly retry: { readonly id: ScreenId; readonly payload: unknown } };
}

/** Ce que reçoit chaque écran [plan 00 « Coquille »]. */
export interface AppContext { readonly i18n: I18n; readonly save: SaveStore; readonly core: CoreData; readonly worlds: WorldLoader; navigate<K extends ScreenId>(id: K, payload: ScreenPayloads[K]): Promise<void> }

/** Un écran : monté dans la racine, démonté avant le suivant [plan 00 « Coquille »]. */
export interface Screen { mount(root: HTMLElement): Promise<void> | void; unmount(): void }

/** Fabrique d'un écran [plan 00 « Coquille »]. */
export type ScreenFactory<K extends ScreenId> = (ctx: AppContext, payload: ScreenPayloads[K]) => Screen;

/** Registre : une fabrique par identifiant ; les plans 02a et 03 y remplacent les écrans provisoires. */
export type ScreenRegistry = { readonly [K in ScreenId]: ScreenFactory<K> };

/** La coquille [plan 00 « Coquille »]. */
export interface Shell { navigate<K extends ScreenId>(id: K, payload: ScreenPayloads[K]): Promise<void>; current(): ScreenId | null }

/** État interne de la coquille, lu par `main.ts` pour les événements du navigateur [PHASE V M8]. */
export interface ShellState extends Shell {
  /** Vrai tant qu'une navigation attend son `mount`. */
  pending(): boolean;
  /** Dernière destination hors écran d'erreur, cible d'un réessai. */
  lastRequest(): { readonly id: ScreenId; readonly payload: unknown } | null;
  /** Remplace l'écran par l'avis « partie ouverte ailleurs » et un bouton de rechargement [PHASE V M8]. */
  markStale(): void;
}

/**
 * Crée la coquille. `navigate` démonte l'écran courant, attend `mount` (qui peut charger un monde) et
 * route toute `DataLoadError` vers l'écran `error` avec la cible à réessayer ; toute autre erreur remonte
 * [plan 00 « Coquille » ; PHASE V M4, M9]. La sauvegarde n'est jamais touchée par ce chemin.
 */
export function createShell(root: HTMLElement, ctx: Omit<AppContext, 'navigate'>, screens: ScreenRegistry): ShellState {
  let screen: Screen | null = null;
  let currentId: ScreenId | null = null;
  let seq = 0;
  let stale = false;
  let inflight = 0;
  let last: { id: ScreenId; payload: unknown } | null = null;

  const full: AppContext = { ...ctx, navigate: (id, payload) => navigate(id, payload) };

  function safeUnmount(s: Screen | null): void {
    if (!s) return;
    try { s.unmount(); } catch { /* un démontage raté ne doit pas bloquer la navigation */ }
  }

  function teardown(): void {
    const s = screen;
    screen = null;
    currentId = null;
    safeUnmount(s);
    root.replaceChildren();
  }

  async function navigate<K extends ScreenId>(id: K, payload: ScreenPayloads[K]): Promise<void> {
    if (stale) return;
    const ticket = ++seq;
    teardown();
    if (id !== 'error') last = { id, payload };
    inflight++;
    // Conteneur propre à cette navigation, attaché tout de suite (la mise en page marche pendant `mount`).
    // Une navigation plus récente le retire de la racine : un montage tardif n'écrit que dans son conteneur retiré.
    const container = document.createElement('div');
    container.style.display = 'contents';
    root.append(container);
    let s: Screen | null = null;
    let failure: DataLoadError | null = null;
    try {
      const factory = screens[id] as ScreenFactory<K>;
      s = factory(full, payload);
      await s.mount(container);
    } catch (e) {
      safeUnmount(s);
      if (!(e instanceof DataLoadError) || id === 'error') throw e;
      failure = e;
    } finally {
      inflight--;
    }
    if (ticket !== seq) { // supplantée pendant `mount` : conteneur déjà retiré de la racine, écran démonté une fois
      if (!failure) safeUnmount(s);
      return;
    }
    if (failure) { await navigate('error', { error: failure, retry: { id, payload } }); return; }
    screen = s;
    currentId = id;
  }

  return {
    navigate,
    current: () => currentId,
    pending: () => inflight > 0,
    lastRequest: () => last,
    markStale() {
      stale = true;
      seq++;
      teardown();
      const box = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = ctx.i18n.t('app.staleTab');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset['testid'] = 'stale-reload';
      b.textContent = ctx.i18n.t('app.reload');
      b.addEventListener('click', () => { location.reload(); });
      box.append(p, b);
      root.append(box);
    },
  };
}
