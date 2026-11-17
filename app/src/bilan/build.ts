/**
 * Assemblage du bilan [GDD 06 §3.1 B-R1 à B-R5, §3.9, §3.11, §8.2 B-V8, B-V10 ; D140 ; plan 03 T11 ; R-03.5, R-03.14, R-03.17, R-03.18].
 * Pur : aucune écriture, aucune horloge, aucun `Dice` consommé (le contexte de rue en porte un propre au rejeu), aucun import de chaînes ni de JSON.
 * Mêmes entrées, même `BilanData` ; la langue n'y entre que par `has`, qui ne change que la présence d'une phrase, jamais un identifiant.
 */
import type { CoreData } from '../data/schema/core';
import type { WorldData } from '../data/schema/world';
import type { BilanCommon, BilanData, BilanInput, BilanRedirect } from '../shared/types/bilan';
import { buildCurve } from './curve';
import { buildDossier } from './dossier';
import { bilanOthers, bilanTraceback } from './others';
import { rightLines, type RightCarriers } from './rights';
import { buildSheet, type HasKey } from './sheet';
import { buildSources } from './sources';
import { streetContextOf } from './streetContext';

/**
 * Contexte du bilan. `lived` : le fichier du monde VÉCU (null si la build ne l'a pas, ou en extinction) ;
 * `computedFile` : le fichier du monde CALCULÉ, chargé seulement s'il existe dans la build [R-03.18] ; `has` : `i18n.has` à l'écran.
 */
export interface BilanContext {
  readonly core: CoreData; readonly common: BilanCommon;
  readonly lived: WorldData | null; readonly computedFile: WorldData | null; readonly has: HasKey;
}

/**
 * B-V10 : les deux années que la version adoucie ne montre jamais (rupture, extinction projetée). La donnée reste entière, `softened` la marque ;
 * ce point de passage unique est la seule lecture que l'écran d'extinction et la ligne de projection ont le droit de faire de ces deux champs.
 */
export function shownYears(data: Pick<BilanData, 'softened' | 'curve'>): { readonly rupture: number | null; readonly projected: number | null } {
  if (data.softened) return { rupture: null, projected: null };
  return { rupture: data.curve.ruptureYear, projected: data.curve.projectedExtinctionYear };
}

/** Le bilan de la partie. Lève si `ctx.lived` n'est pas le monde vécu de la partie. */
export function buildBilan(input: BilanInput, ctx: BilanContext): BilanData {
  const { run } = input;
  const out = run.outcome;
  const softened = run.softened;
  const isExtinction = input.entry === 'extinction' || out.kind === 'extinction';
  const traceback = bilanTraceback(ctx.core, run.answers);
  const others = bilanOthers(ctx.core, run.answers, traceback);
  const sources = buildSources(run, ctx);

  if (isExtinction) {
    const curve = buildCurve(input, { core: ctx.core, lived: null, sigma100: ctx.common.sigma100 });
    return {
      entry: input.entry, softened, sheet: null, curve, others, traceback,
      rights: null, worldBlockId: null, sources, redirect: null, dossier: null,
    };
  }
  if (out.kind !== 'arrival') throw new Error('buildBilan : issue inconnue');
  const lived = ctx.lived;
  if (lived !== null && lived.id !== out.livedWorld) throw new Error(`buildBilan : le fichier ${lived.id} n'est pas le monde vécu ${out.livedWorld}`);
  const curve = buildCurve(input, { core: ctx.core, lived, sigma100: ctx.common.sigma100 });
  const redirect: BilanRedirect | null = out.redirected ? { computed: out.computedWorld, lived: out.livedWorld } : null;
  const street = lived === null ? null : streetContextOf(ctx.core, lived, run);
  const block = lived?.bilan;
  const bw = lived !== null && block !== undefined && 'dossier' in block ? block : null;
  return {
    entry: input.entry, softened,
    sheet: street === null ? null : buildSheet(input, street, ctx.has),
    curve, others, traceback,
    rights: bw !== null && lived !== null ? rightLines(ctx.core.questionnaire, run.answers, bw.rights.carriers as RightCarriers, lived.id) : null,
    worldBlockId: bw !== null ? bw.worldBlockId : null,
    sources, redirect,
    dossier: buildDossier(input, { lived, street }),
  };
}
