/**
 * Fabriques des sept écrans du plan 03 [R-03.10]. `street` (plan 02a) et `error` (coquille) n'y figurent pas :
 * `main.ts` les ajoute après ce registre, qui remplace les écrans provisoires un par un.
 */
import type { ScreenFactory, ScreenId } from '../app/shell';
import { langScreen } from './lang';
import { warningScreen } from './warning';
import { questionnaireScreen } from './questionnaire';
import { fastforwardScreen } from './fastforward';
import { causesScreen } from './causes';
import { bilanScreen } from './bilan';
import { sourcesScreen } from './sources';
import { atlasScreen } from './atlas/entry';

/** Registre partiel : une fabrique par écran du plan 03. */
export const screenFactories: { readonly [K in Exclude<ScreenId, 'street' | 'error'>]: ScreenFactory<K> } = {
  lang: langScreen,
  warning: warningScreen,
  questionnaire: questionnaireScreen,
  fastforward: fastforwardScreen,
  causes: causesScreen,
  bilan: bilanScreen,
  sources: sourcesScreen,
  atlas: atlasScreen,
};
