import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { screenFactories } from '../../../src/screens';
import { langScreen } from '../../../src/screens/lang';
import { warningScreen } from '../../../src/screens/warning';
import { questionnaireScreen } from '../../../src/screens/questionnaire';
import { fastforwardScreen } from '../../../src/screens/fastforward';
import { causesScreen } from '../../../src/screens/causes';
import { bilanScreen } from '../../../src/screens/bilan';
import { sourcesScreen } from '../../../src/screens/sources';
import type { ScreenId } from '../../../src/app/shell';

/** Les sept écrans du plan 03 [R-03.10] : tout identifiant sauf `street` (02a) et `error` (coquille). */
const SEVEN = ['lang', 'warning', 'questionnaire', 'fastforward', 'causes', 'bilan', 'sources'] as const satisfies readonly ScreenId[];

describe('registre des écrans', () => {
  it('test_every_screen_id_has_a_factory_after_wiring', () => {
    const all: readonly ScreenId[] = ['lang', 'warning', 'questionnaire', 'fastforward', 'causes', 'street', 'bilan', 'sources', 'atlas', 'error'];
    const wired = all.filter((id) => id !== 'street' && id !== 'error');
    expect(Object.keys(screenFactories).sort()).toEqual([...wired].sort());
    for (const id of wired) expect(typeof (screenFactories as Record<string, unknown>)[id]).toBe('function');
  });

  it('test_main_registry_replaces_stubs_for_the_seven_ids', () => {
    // `stubScreens()` rend de nouvelles fermetures à chaque appel : comparer à un stub ne peut jamais échouer. On épingle donc l'identité
    // de chaque fabrique exportée par son module d'écran ; une entrée câblée sur un stub (ou sur un autre écran) fait échouer le `toBe`.
    const real = { lang: langScreen, warning: warningScreen, questionnaire: questionnaireScreen, fastforward: fastforwardScreen, causes: causesScreen, bilan: bilanScreen, sources: sourcesScreen };
    for (const id of SEVEN) expect(screenFactories[id], id).toBe(real[id]);
    // la ligne de câblage de main.ts compose bien stubs, écrans du plan 03, rue puis erreur (R-03.10)
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).toMatch(/\.\.\.stubScreens\(\),\s*\.\.\.screenFactories,\s*street: createStreetScreen,\s*error:/);
  });

  it('test_street_stays_provisional_until_02a', () => {
    expect('street' in screenFactories).toBe(false);
    expect('error' in screenFactories).toBe(false);
  });

  it('test_screen_folders_are_one_per_screen', () => {
    for (const id of SEVEN) expect(existsSync(`src/screens/${id}/index.ts`), id).toBe(true);
  });
});
