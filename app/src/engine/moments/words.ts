/**
 * Mots, bracelet et relevé du jour [bible w10 §4.4, §7.2, §7.3, §7.4 ; GDD 05 §3.5 ; plan 02b T5].
 * Pur : aucun JSON, aucune horloge. Le COÛT d'une réplique est sa donnée `words`, jamais le décompte de la chaîne ;
 * `countWords` ne sert qu'au lint FR et aux plafonds de réplique.
 */
import type { ActRecord, DayIndex, LedgerEntry, NightLedger } from '../../shared/types/street';
import { ledgerAllocation } from '../../shared/ledger';
import { survivalEntry, type IntegrityConfig } from '../../survival';
import type { StreetContext } from './types';

/** Une question coûte le double de mots [bible w10 §7.3]. */
export const QUESTION_FACTOR = 2;
/** Un mot signalé coûte 3 mots au lieu de 1 [bible w10 §7.3, lecture lead-programmer, à confirmer: game-designer]. */
export const FLAGGED_WORD_COST = 3;
/** Au-delà de 10 mots achetés dans la journée, une entrée de plus, une seule fois [bible w10 §7.3]. */
export const BOUGHT_WORDS_OVER_THRESHOLD = 10;
/** Option d'un choix qui donne un nom : crédite `perName`, ajoute `offer.named` [bible w10 §7.2]. Son coût est la donnée `words` de l'option. */
export const NAME_OPTION = 'name';

/**
 * Nombre de mots d'un texte : ce qui est séparé par une espace ; un trait d'union fait un seul mot ; une marque sans lettre
 * ni chiffre (« ? », « : ») ne compte pas ; « 14 h 02 » compte trois [bible w10 §4.4].
 */
export function countWords(text: string): number {
  return text.split(/\s+/u).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/** Forme lue dans `street.choices` (rempli par T4/T11) : seul le coût en mots d'une option nous intéresse. */
interface ChoiceWords { readonly id: string; readonly options: readonly { readonly id: string; readonly words?: number }[] }

function optionWords(ctx: StreetContext, choiceId: string, optionId: string): number {
  const choices = ctx.street.choices as unknown;
  if (!Array.isArray(choices)) return 0;
  const c = (choices as readonly ChoiceWords[]).find((x) => x.id === choiceId);
  return c?.options.find((o) => o.id === optionId)?.words ?? 0;
}

/** Mots d'une option narrative d'une scène guidée ; 0 si le monde n'a pas de `guided`, ou si la scène ou l'option est inconnue (refusé en amont). */
export function sceneOptionWords(ctx: StreetContext, sceneId: string, optionId: string): number {
  const ask = ctx.street.guided?.scenes.find((s) => s.id === sceneId)?.ask;
  if (ask === undefined || ask.kind !== 'narrative') return 0;
  return ask.options.find((o) => o.id === optionId)?.words ?? 0;
}

/**
 * Mots que le checkpoint retire pour une option : `comply` et `courtesy` (la file courte est une forme de « se plier », mêmes mots, `laneOutcome`) lisent
 * `forcedWords.comply`, `buy*` lit `forcedWords.buy` [bible w10 §7.4] ; contourner et refuser sont nuls.
 * Source unique : le relevé et la pièce de prix de la rue lisent cette fonction (décision GD 2026-11-02, une seule vérité par prix).
 */
export function checkpointWords(forced: { readonly comply: number; readonly buy: number }, option: string | null): number {
  if (option === 'comply' || option === 'courtesy') return forced.comply;
  return option !== null && option.startsWith('buy') ? forced.buy : 0;
}

/** Base de mots du jour, lue dans la donnée ; le J7 prend la dernière base, sans effet [bible w10 §7.2]. */
function baseOf(day: DayIndex, cfg: IntegrityConfig): number {
  const base = cfg.words.base;
  return base[Math.min(day, base.length) - 1] ?? 0;
}

export function compareActs(a: ActRecord, b: ActRecord): number {
  return a.minute - b.minute || cmp(a.kind, b.kind) || cmp(a.id, b.id) || cmp(a.option ?? '', b.option ?? '');
}
function cmp(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

/**
 * Relevé du jour : somme les actes de `day`. Les actes sont triés (minute, kind, id, option) puis les entrées par
 * (jour, minute, source) : l'ordre d'arrivée des actes ne change rien au résultat [R-02b.17, D89].
 */
export function buildLedger(day: DayIndex, acts: readonly ActRecord[], ctx: StreetContext): NightLedger {
  const cfg = ctx.world.survival as unknown as IntegrityConfig;
  const forced = ctx.street.checkpoint.forcedWords;
  const entries: LedgerEntry[] = [];
  let credited = 0, bought = 0, spent = 0, glances = 0, orders = 0, overAdded = false;

  for (const a of acts.filter((x) => x.day === day).sort(compareActs)) {
    const at = { day, minute: a.minute };
    switch (a.kind) {
      case 'say': {
        const line = ctx.street.lines.say[a.id];
        if (!line) break;                                   // réplique inconnue : refusée en amont (T10), coût nul ici
        const plain = line.words - line.flaggedWords;
        const cost = plain + line.flaggedWords * FLAGGED_WORD_COST;
        spent += line.question ? cost * QUESTION_FACTOR : cost;
        if (line.question) entries.push(survivalEntry('question', at, cfg));
        for (let i = 0; i < line.flaggedWords; i++) entries.push(survivalEntry('flaggedWord', at, cfg));
        break;
      }
      case 'lane':
        if (a.id === 'checkpoint') {
          spent += checkpointWords(forced, a.option);
          // La voix de la file donne la consigne du jour : « Consignes (source du +2 d'obéissance) : voix à la file du checkpoint »
          // [bible w10 §5.0 l. 363, §7.3]. Aucun émetteur `obey` n'existe dans la rue ; buy, bypass et refuse ne font pas la file.
          if (a.option === 'comply' || a.option === 'courtesy') orders += 1;
        }
        break;
      case 'choice':
        if (a.option !== null) spent += optionWords(ctx, a.id, a.option);   // le coût d'une option est sa donnée `words`, nom ou refus payé en mots [R-02b.48]
        if (a.option === NAME_OPTION) {
          credited += cfg.words.perName;
          entries.push(survivalEntry('offer.named', at, cfg));
        }
        break;
      case 'buyWords': {
        const n = Number(a.option);
        if (Number.isInteger(n) && n > 0) bought += n;
        if (!overAdded && bought > BOUGHT_WORDS_OVER_THRESHOLD) {
          overAdded = true;
          entries.push(survivalEntry('wordsBoughtOver10', at, cfg));
        }
        break;
      }
      case 'scene':
        if (a.option !== null) spent += sceneOptionWords(ctx, a.id, a.option);   // un choix narratif ne coûte que ses mots, aucune entrée de survie
        break;
      case 'glance': glances += 1; break;
      case 'obey': orders += 1; break;
      default: break;
    }
  }

  entries.sort((x, y) => x.at.day - y.at.day || x.at.minute - y.at.minute || cmp(x.source, y.source));
  return { day, wordsBase: baseOf(day, cfg), wordsCredited: credited, wordsBought: bought, wordsSpent: spent, glances, orders, entries };
}

/** Le seul nombre vivant du bracelet : max(0, allocation - dépensés) [GDD 05 §3.5]. */
export function braceletCount(l: NightLedger): number {
  return Math.max(0, ledgerAllocation(l) - l.wordsSpent);
}
