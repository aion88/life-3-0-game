/** Aides de test de l'assemblage du bilan [plan 03 T11, R-03.25 (c)] : contexte, entrées, aucune règle de jeu. */
import fr from '../../src/data/strings/fr.json';
import en from '../../src/data/strings/en.json';
import type { BilanContext } from '../../src/bilan/build';
import { loadBilanCommon } from '../../src/data/bilanLoad';
import { replay } from '../../src/engine/moments/replay';
import { toBilanInput } from '../../src/engine/moments/bilan';
import type { BilanEntry, BilanInput } from '../../src/shared/types/bilan';
import type { WorldData } from '../../src/data/schema/world';
import type { RunResult } from '../../src/shared/types/run';
import { actsOfProfile } from './profile_acts';
import { ctxW10 } from './street';
import { core, W10 } from './bilan_curve';

export { core, W10 };
export const common = loadBilanCommon();
const FR = fr as Record<string, string>;
const EN = en as Record<string, string>;

/** Contexte du bilan : w10 vécu, monde calculé absent par défaut, `has` sur les chaînes françaises (ou anglaises). */
export function bctx(over: Partial<BilanContext> = {}, lang: 'fr' | 'en' = 'fr'): BilanContext {
  const t = lang === 'fr' ? FR : EN;
  return { core, common, lived: W10, computedFile: null, has: (k) => k in t, ...over };
}

/** Entrée `weekEnd` : la rue de `profile` rejouée dans w10 ; `run` remplace le run de la partie (redirection, extinction). */
export function weekEndOf(profile = 'Zéro nom', run?: RunResult): BilanInput {
  const street = ctxW10();
  const acts = actsOfProfile(profile);
  const r = replay(acts, street);
  const base = toBilanInput(r.state, r.week, street);
  return run === undefined ? base : { ...base, run };
}

export function withEntry(i: BilanInput, entry: BilanEntry): BilanInput { return { ...i, entry }; }
export function withRun(i: BilanInput, run: RunResult): BilanInput { return { ...i, run }; }
export type { WorldData };
