/**
 * Aides des tests de « Les chaînes de ta semaine » [plan rue guidée J3-J7, T7] : la semaine jouée de w10 (aujourd'hui J1-J5, ses chaînes A, B, C, E),
 * l'arrestation dans la nuit 2 rejouée par le metteur en scène jusqu'à `end`, et le montage du bilan sur un w10 dont on règle `guided`.
 */
import type { ActRecord } from '../../src/shared/types/street';
import type { BilanEntry, BilanInput } from '../../src/shared/types/bilan';
import type { GuidedData, GuidedEnding } from '../../src/data/schema/guided';
import type { WorldData } from '../../src/data/schema/world';
import { replay } from '../../src/engine/moments/replay';
import { toBilanInput } from '../../src/engine/moments/bilan';
import { createI18n, type I18n } from '../../src/i18n/i18n';
import { bilanScreen } from '../../src/screens/bilan';
import { ctxW10, loadMeta } from './street';
import { ctxArrestNight, directorRig, playAllDefault } from './guided';
import { FIXTURE_ENDING } from './recap_week';
import { mountScreen } from './screens';
import { bilanCtx, W10 } from './screens_bilan';
import { EN, FR } from './street_ui';

/** Les actes d'une partie jouée par le metteur en scène sur `ctx`, premières options, jusqu'à la fin ou la fin de la démonstration. */
function playedActs(ctx: ReturnType<typeof ctxW10>): readonly ActRecord[] {
  const r = directorRig([], ctx);
  playAllDefault(r);
  return r.drv.state().street.acts;
}

/** Le `guided` de w10 tel que livré (chaînes A, B, C, E). */
export const w10Guided: GuidedData = ctxW10().street.guided!;
/** La semaine de w10 telle qu'elle est jouable : J1-J7 (T13). */
export const G_WEEK: GuidedData = w10Guided;
export const CLK = ctxW10().street.clock;
/** Toute la semaine jouable de w10, premières options : A, B, E s'ouvrent ; C aussi depuis le J4 : C2 est le choix de relecture du 9-C, fait quelle que soit la cantine du J3 (conception §3.1). */
export const ACTS_FULL_WEEK_FIXTURE: readonly ActRecord[] = playedActs(ctxW10());
/** Chemin par défaut de w10 arrêté dans la nuit 2 (`ctxArrestNight(2)`, T4), actes rejoués jusqu'à `end`. */
export const ARREST_N2_ACTS: readonly ActRecord[] = playedActs(ctxArrestNight(2));

/** Ids des étapes qui portent un maillon de w10 : marlene (B), composant et retour de l'agent (E), Mme Roux (A). */
const B_E_STEPS = new Set(['j1.marlene', 'j2.marlene', 'j1.component', 'j2.component', 'j2.agentReturn', 'm3.letter', 'j3.marlene', 'j3.who',
  'j4.neighbour', 'j4.who', 'j4.yusuf', 'relecture.j4',
  'relecture.j5', 'j5.bruno.talk', 'j5.bruno', 'j5.who',
  'j6.marlene', 'j6.guichet', 'permit.j6', 'relecture.j6',
  'audition.j7']);   // J3 : lettre (E4), offre et nom (B3, B3w) ; J4 : voisin (B4), nom (B4w), Yusuf (E5), relecture du 9-C (C2) ; J5 : relecture (E6), Bruno (C3t, C3, C3w) ; J7 : audition (C7)
/** La semaine jouable sans Marlène ni le composant : seule la chaîne A s'ouvre, B, C et E laissent des maillons `absent`. */
export const ACTS_ONE_CHAIN: readonly ActRecord[] = ACTS_FULL_WEEK_FIXTURE.filter((a) => !B_E_STEPS.has(a.id));
/** L'arrestation de la nuit 2 sans aucun acte de maillon : aucune chaîne ouverte. */
export const ARREST_NO_CHAIN_ACTS: readonly ActRecord[] = ARREST_N2_ACTS.filter((a) => !B_E_STEPS.has(a.id) && a.id !== 'j1.roux');

/** Entrée de fin de semaine sur ces actes. */
export const endInput = (acts: readonly ActRecord[]): Pick<BilanInput, 'entry' | 'acts'> => ({ entry: 'weekEnd', acts });

/** Entrée du bilan : `acts` rejoués dans le contexte de l'arrestation de nuit 2, l'entrée forcée à `entry`. */
export function inputOf(acts: readonly ActRecord[], entry: BilanEntry): BilanInput {
  const ctx = ctxArrestNight(2);
  const r = replay(acts, ctx);
  return { ...toBilanInput(r.state, r.week, ctx), entry };
}

/** L'entrée du bilan de l'arrestation de nuit 2, ses actes remplacés par `acts` (le reste de l'entrée est celui de la partie arrêtée). */
export function arrestInputWithActs(acts: readonly ActRecord[], entry: BilanEntry): BilanInput {
  return { ...inputOf(ARREST_N2_ACTS, entry), acts };
}

/** Une fin de fixture dont la ligne d'arrestation porte `{jour}`. */
export const FIX_ENDING: GuidedEnding = { ...FIXTURE_ENDING, arrestedNightKey: 'w10.dw.end.arrestedNight' };
const ARRESTED = { fr: 'Le reste de la semaine n\'a pas eu lieu. Tu as été arrêté dans la nuit de {jour}.', en: 'The rest of the week did not happen. You were arrested on the night of {jour}.' };
/**
 * Vraie langue plus la ligne d'arrestation de la fixture. `{jour}` reçoit une date (« mardi 5 mars ») : sa clé doit déclarer le paramètre
 * numérique `jour` dans `meta.json` (la vraie fin de w10, T13, en aura besoin aussi).
 */
export const chainsI18n = (): I18n => createI18n(
  { fr: { ...FR, [FIX_ENDING.arrestedNightKey]: ARRESTED.fr }, en: { ...EN, [FIX_ENDING.arrestedNightKey]: ARRESTED.en } },
  { ...loadMeta(), 'w10.dw.end': { policy: 'voice', numericParams: ['jour'] } }, 'fr', { mode: 'dev', report: () => undefined });

/** w10 dont `street.guided` est remplacé (ou retiré par `null`). */
export function w10With(guided: GuidedData | null): WorldData {
  return { ...W10, street: { ...W10.street, guided } } as WorldData;
}

/** Monte le bilan sur w10 ; `ending` pose une fin sur son `guided`. */
export async function mountBilan(input: BilanInput, over: { readonly ending?: GuidedEnding | null; readonly world?: WorldData } = {}): Promise<HTMLElement> {
  const world = over.world ?? (over.ending === undefined ? W10 : w10With({ ...W10.street.guided!, ending: over.ending }));
  const { root } = await mountScreen(bilanScreen, bilanCtx(world, { i18n: chainsI18n() }), { input });
  return root;
}

/** Les pages du bilan, dans l'ordre de la navigation (chaque onglet cliqué). */
export function pageOrder(root: HTMLElement): readonly string[] {
  const page = (): HTMLElement => root.querySelector<HTMLElement>('[data-testid="bilan-page"]')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-ui="page-nav"] button')];
  return tabs.map((b) => { b.click(); return page().dataset['page']!; });
}

/** Ouvre la page `id`. */
export function openPage(root: HTMLElement, id: string): void {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-ui="page-nav"] button')];
  for (const b of tabs) { b.click(); if (root.querySelector<HTMLElement>('[data-testid="bilan-page"]')!.dataset['page'] === id) return; }
  throw new Error(`openPage : aucune page ${id}`);
}
