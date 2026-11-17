/**
 * Point d'entrée de l'application : construit le contexte, monte l'écran de reprise, pose `data-ready`
 * [plan 00 « Coquille » ; design §9].
 */
import { DataLoadError, createProductionWorldLoader, loadCore } from './data/load';
import { createI18n, detectLang, type StringMeta } from './i18n/i18n';
import { SAVE_KEY, createSaveStore, type SaveStore, type StorageLike } from './save/save';
import { createErrorFactory } from './app/errorScreen';
import { createShell, type ShellState } from './app/shell';
import { consumeNewGameParam } from './save/newGame';
import { stubScreens } from './app/stubs';
import { createStreetScreen } from './street/screen';
import { screenFactories } from './screens';
import { isValidAct, knownActKinds } from './engine/moments';
import fr from './data/strings/fr.json';
import en from './data/strings/en.json';
import stringMetadata from './data/strings/meta.json';

interface Live { readonly shell: ShellState; readonly save: SaveStore }
let live: Live | null = null;

/** `localStorage` protégé : l'accès lui-même peut lever en mode privé ou stockage bloqué [PHASE V M7]. */
function safeStorage(): StorageLike | null {
  try { return window.localStorage; } catch { return null; }
}

/**
 * Monte l'application dans `root` puis pose `data-ready="1"` sur `<html>`.
 * Le registre part des stubs de la coquille ; `street` est l'écran réel (02a), le plan 03 remplace les sept autres (`screenFactories`).
 * @param root Élément hôte de l'application.
 */
export async function boot(root: HTMLElement): Promise<void> {
  // Le serveur de dev sert aussi l'atelier sur le wifi local, pour un essai sur téléphone ; jamais dans un build.
  if ((import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(location.hostname)) && new URLSearchParams(location.search).get('atelier') === 'controle') {
    const { mountControlStationEpisode } = await import('./worlds/controlStationEpisode');
    const dispose = await mountControlStationEpisode(root);
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
    document.documentElement.lang = 'fr';
    document.title = 'Life 3.0 · 1984 — Le contrôle';
    document.documentElement.dataset['ready'] = '1';
    return;
  }
  if (['localhost', '127.0.0.1'].includes(location.hostname) && ['preuves', 'dimanche'].includes(new URLSearchParams(location.search).get('atelier') ?? '')) {
    const { mountSundayJourney } = await import('./worlds/sundayJourney');
    const dispose = mountSundayJourney(root);
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
    document.documentElement.lang = 'fr';
    document.title = 'Life 3.0 · 1984 — Un dimanche ordinaire';
    document.documentElement.dataset['ready'] = '1';
    return;
  }

  if (['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('atelier') === 'dilemmes') {
    const {mountMoralStudio}=await import('./worlds/moralStudio');const dispose=await mountMoralStudio(root);
    window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});document.documentElement.lang='fr';document.title='Life 3.0 · Les choix de chaque monde';document.documentElement.dataset['ready']='1';return;
  }
  if (['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('atelier') === 'cafe-action') {
    const { mountCafeAction } = await import('./worlds/cafeAction');
    const dispose = await mountCafeAction(root);
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
    document.documentElement.lang = 'fr';
    document.title = 'Life 3.0 · Essai au Café du Pont';
    document.documentElement.dataset['ready'] = '1';
    return;
  }
  if ((import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(location.hostname)) && new URLSearchParams(location.search).get('atelier') === 'cafe-illustre') {
    const { mountIllustratedCafe } = await import('./worlds/illustratedCafe');
    const dispose = await mountIllustratedCafe(root);
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
    document.documentElement.lang = 'fr';
    document.title = 'Life 3.0 · Le Café du Pont';
    document.documentElement.dataset['ready'] = '1';
    return;
  }
  if ((import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(location.hostname)) && ['soraya', 'mondes'].includes(new URLSearchParams(location.search).get('atelier') ?? '')) {
    const { mountSorayaStudio } = await import('./worlds/studio');
    const dispose = await mountSorayaStudio(root);
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
    document.documentElement.lang = 'fr';
    document.documentElement.dataset['ready'] = '1';
    return;
  }
  if ((import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(location.hostname)) && new URLSearchParams(location.search).get('atelier') === 'monde') {
    const { mountAtelierWorld } = await import('./worlds/atelierWorld');
    const dispose = await mountAtelierWorld(root, location.search);
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
    document.documentElement.lang = 'fr';
    document.title = 'Life 3.0 · Atelier de monde';
    document.documentElement.dataset['ready'] = '1';
    return;
  }
  if ((import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(location.hostname)) && new URLSearchParams(location.search).get('atelier') === 'situations') {
    const { mountSituations } = await import('./worlds/situations/situationPlayer');
    const dispose = await mountSituations(root, location.search, { lang: new URLSearchParams(location.search).get('lang') ?? 'fr' });
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
    document.documentElement.lang = 'fr';
    document.title = 'Life 3.0 · Situations';
    document.documentElement.dataset['ready'] = '1';
    return;
  }
  if ((import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(location.hostname)) && new URLSearchParams(location.search).get('atelier') === 'semaine') {
    const { mountWeekEpisode } = await import('./worlds/week/weekEpisode');
    const dispose = await mountWeekEpisode(root);
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
    document.documentElement.lang = 'fr';
    document.title = 'Life 3.0 · 1984, la semaine';
    document.documentElement.dataset['ready'] = '1';
    return;
  }
  const core = loadCore();
  const questions = core.questionnaire.questions;
  const storage = safeStorage();
  const cleaned = consumeNewGameParam(location.href, storage);   // `?nouvelle` : partie effacée avant la lecture [demande Cynthia 2026-11-03]
  if (cleaned !== null) history.replaceState(history.state, '', cleaned);
  const save = createSaveStore(
    storage, core.contentHash,
    (q, a) => questions.some((x) => x.key === q && x.answers.some((r) => r.key === a)),
    { isValidAct, known: knownActKinds() },
  );
  const { data } = save.load();
  const i18n = createI18n({ fr, en }, stringMetadata as StringMeta, data.lang ?? detectLang(navigator.languages), {
    mode: import.meta.env.DEV ? 'dev' : 'prod',
    report: (issue) => { console.warn('i18n', issue.code, issue.key); },
  });
  document.documentElement.lang = i18n.lang();
  document.title = i18n.t('app.title');
  i18n.onChange((l) => { document.documentElement.lang = l; });

  if (import.meta.env.DEV) {
    const loader = createProductionWorldLoader(core.catalogue);
    const [{ devValidate }, worlds] = await Promise.all([
      import('./app/devValidate'),
      Promise.all(loader.available().map((id) => loader.load(id))),
    ]);
    devValidate({ core, worlds, strings: { fr, en }, meta: stringMetadata as StringMeta }, (l) => { console.warn(l); });
  }

  const shell = createShell(root, { i18n, save, core, worlds: createProductionWorldLoader(core.catalogue) },
    { ...stubScreens(), ...screenFactories, street: createStreetScreen, error: createErrorFactory() });
  live = { shell, save };
  // Premier écran toujours : partie neuve, les langues ; partie en cours, « Continuer » (qui rouvre l'écran de `initialScreen`) ou
  // « Nouvelle partie » [demande Cynthia 2026-11-03]. Une reprise ne se fait plus sans geste.
  await shell.navigate('lang', undefined);
  document.documentElement.dataset['ready'] = '1';
}

/**
 * Écouteur de l'événement `storage` : une valeur plus récente (`rev` supérieur), illisible ou supprimée sur la
 * clé de sauvegarde vient d'un autre onglet ; la coquille affiche l'avis et le bouton de rechargement [PHASE V M8].
 * Comparaison en lecture seule, aucun appel au magasin.
 */
export function handleStorageEvent(e: StorageEvent): void {
  if (!live || (e.key !== null && e.key !== SAVE_KEY)) return;
  let rev: number | null = null;
  if (e.newValue !== null) {
    try {
      const x: unknown = JSON.parse(e.newValue);
      if (typeof x === 'object' && x !== null && 'rev' in x && typeof x.rev === 'number') rev = x.rev;
    } catch { /* illisible : traité comme périmé */ }
  }
  if (rev === null || rev > live.save.load().data.rev) live.shell.markStale();
}

/**
 * Écouteur de `vite:preloadError` : un chunk introuvable hors navigation (la navigation route ses propres
 * erreurs) ouvre l'écran d'erreur sur la dernière cible [PHASE V M4].
 */
export function handlePreloadError(e: Event): void {
  if (!live || live.shell.pending()) return;
  e.preventDefault();
  const target = live.shell.lastRequest() ?? { id: 'lang' as const, payload: undefined };
  const reason = (e as Event & { payload?: unknown }).payload;
  const error = new DataLoadError('fetch', 'chunk', '', reason instanceof Error ? reason.message : 'preload');
  void live.shell.navigate('error', { error, retry: target });
}
