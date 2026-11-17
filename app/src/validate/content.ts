/**
 * Validateurs de contenu : chiffres à l'écran, canal d'événement, plafond de jalon, parité [GDD 03 §3.3 et §3.4 ; GDD 05 V8 ; D128 ; D141].
 * Pur. `validateContent` tourne en CI (`validate_baseline_test`) et au démarrage en développement seulement ; jamais en production [PHASE V m9].
 */
import { checkParity, ruleFor, type StringMeta, type StringTable } from '../i18n/i18n';
import type { CoreData, WorldData } from '../data/load';
import { integrityOf, hasIntegrity } from '../data/schema/world';
import type { Issue, Lang } from '../shared/types/common';
import { checkPlayerString } from './numbers';
import { validateStreet } from './street';
import { provisionalFlags } from './provisional';
import { validateBilan } from './bilan';
import { validateGuided } from './guided';

/** Tout ce que `validateContent` lit [GDD 05 §8.2]. */
export interface ContentInput {
  readonly core: CoreData;
  readonly worlds: readonly WorldData[];
  readonly strings: Readonly<Record<Lang, StringTable>>;
  readonly meta: StringMeta;
}

/** Erreurs (bloquent au chargement et en CI) et avertissements (passent par la ligne de base) [GDD 05 §8.2 ; GDD 06 §8.2 ; D141 (1)]. */
export interface ValidationReport { readonly errors: readonly Issue[]; readonly warnings: readonly Issue[] }

/** Entrée de `validator-baseline.json` : un avertissement connu, daté, avec propriétaire [D141 (1) b]. */
export interface BaselineEntry {
  readonly code: string; readonly file: string; readonly path: string;
  readonly owner: string; readonly date: string; readonly reason: string;
}

const STRING_FILES: Record<Lang, string> = { fr: 'strings/fr.json', en: 'strings/en.json' };
const WORLD_KEY_RE = /^(w\d{2})\./;

/**
 * Applique tous les contrôles de contenu [GDD 05 V8 ; GDD 03 D128, K3b ; PHASE V M6, m10].
 * Les chaînes qui portent un chiffre interdit sont des erreurs (`GDD05-V8-<code>`) : une chaîne neuve ne passe pas [D141 (1)].
 * Les tests de logique B-V3, B-V8, B-V10, B-V11 et B-V12 du GDD 06 ne passent jamais par la ligne de base (plan 03).
 */
export function validateContent(input: ContentInput): ValidationReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  errors.push(...checkParity(input.strings));

  const forbiddenByWorld = new Map(input.worlds.map(w => [w.id as string, w.forbiddenWords]));
  for (const lang of ['fr', 'en'] as const) {
    const table = input.strings[lang];
    for (const key of Object.keys(table).sort()) {
      const forbidden = forbiddenByWorld.get(WORLD_KEY_RE.exec(key)?.[1] ?? '') ?? [];
      for (const v of checkPlayerString(table[key]!, lang, ruleFor(input.meta, key), forbidden)) {
        errors.push({
          code: `GDD05-V8-${v.code}`, file: STRING_FILES[lang], path: key, owner: 'writer',
          message: `« ${v.token} » (position ${v.index}) interdit par la politique de la clé [GDD 05 V8]`,
        });
      }
    }
  }

  for (const prefix of Object.keys(input.meta).sort()) {
    const r = input.meta[prefix]!;
    if (r.policy === 'voice' && (r.numericParams?.length ?? 0) > 0) {
      errors.push({
        code: 'GDD05-V8-numeric-params-under-voice', file: 'strings/meta.json', path: prefix, owner: 'writer',
        message: `numericParams déclaré sous la politique voice : ${r.numericParams!.join(', ')} [GDD 05 V8]`,
      });
    }
  }

  for (const w of input.worlds) {
    const file = `worlds/${w.id}.json`;
    w.engine.events.forEach((e, i) => {
      if (e.wsEffect === null) return;
      warnings.push({
        code: 'GDD03-D128-event-ws-effect', file, path: `engine.events.${i}.wsEffect`, owner: 'world-builder',
        message: `l'événement ${e.id} porte un wsEffect : le canal d'événement est signalé, non bloquant [GDD 03 §3.4, D128]`,
      });
    });
    if (w.engine.milestoneCapPerVar === null) {
      w.engine.milestones.forEach((m, i) => {
        if (m.wsDelta === null) return;
        errors.push({
          code: 'GDD03-K3b-cap-required', file, path: `engine.milestones.${i}.wsDelta`, owner: 'world-builder',
          message: `le jalon ${m.id} porte un wsDelta sans plafond : D116 interdit un plafond illimité [GDD 03 §3.3]`,
        });
      });
      warnings.push({
        code: 'GDD03-K3b-cap-missing', file, path: 'engine.milestoneCapPerVar', owner: 'world-builder',
        message: 'milestoneCapPerVar est null : plafond de jalon à fixer [GDD 03 Q7, K3b]',
      });
    }
  }

  warnings.push(...survivalFlags(input.worlds));
  const s = validateStreet(input);
  errors.push(...s.errors);
  warnings.push(...s.warnings);
  errors.push(...validateGuided(input).errors);   // preuve des chaînes de la rue guidée : erreurs, jamais avertissements [rue guidée T4]
  const b = validateBilan(input);
  errors.push(...b.errors);
  warnings.push(...b.warnings);
  warnings.push(...provisionalFlags(input));
  return { errors, warnings };
}

/** Un point entier, en millièmes : toutes les valeurs atteignables sont entières, seul n + 0,5 est sans égalité [GDD 04 §3.9]. */
const MILLI_PER_POINT = 1000;

/**
 * Drapeaux GDD 04 §3.9 lisibles dans les données [avertissements, jamais bloquants] : `GDD04-threshold-on-grid`, un seuil de
 * palier, d'arrestation ou d'audition posé sur un entier de point. Le palier le plus bas (`from` au plancher) n'est pas un seuil.
 * Les autres drapeaux demandent le simulateur ou un champ que w10 n'a pas.
 */
function survivalFlags(worlds: readonly WorldData[]): Issue[] {
  const out: Issue[] = [];
  for (const w of worlds.filter(hasIntegrity)) {
    const c = integrityOf(w);
    const seuils: [string, number][] = [
      ...c.paliers.slice(0, -1).map((p, i): [string, number] => [`survival.paliers.${i}.from`, p.from]),
      ['survival.arrest.nightBelow', c.arrest.nightBelow],
      ['survival.arrest.auditionBelow', c.arrest.auditionBelow],
    ];
    for (const [path, milli] of seuils) {
      if (milli % MILLI_PER_POINT !== 0) continue;
      out.push({
        code: 'GDD04-threshold-on-grid', file: `worlds/${w.id}.json`, path, owner: 'game-designer',
        message: `seuil à ${milli / MILLI_PER_POINT} sur un entier de point : une égalité est atteignable, prendre n + 0,5 [GDD 04 §3.9]`,
      });
    }
  }
  return out;
}

const sameKey = (a: { code: string; file: string; path: string }, b: { code: string; file: string; path: string }): boolean =>
  a.code === b.code && a.file === b.file && a.path === b.path;

/**
 * Compare les avertissements à la ligne de base [D141 (1) b ; GDD 05 §8.2]. `added` : avertissements absents de la base (la CI échoue) ;
 * `stale` : entrées de la base sans avertissement (la CI échoue) ; `count` : nombre d'entrées, à afficher à chaque run.
 * Lève sur une entrée sans `owner`.
 */
export function compareToBaseline(report: ValidationReport, baseline: readonly BaselineEntry[]): { readonly added: readonly Issue[]; readonly stale: readonly BaselineEntry[]; readonly count: number } {
  baseline.forEach((e, i) => {
    if (e.owner.trim() === '') throw new Error(`validator-baseline : l'entrée ${i} (${e.code} ${e.file} ${e.path}) n'a pas d'owner [D141 (1) b]`);
  });
  return {
    added: report.warnings.filter(w => !baseline.some(e => sameKey(e, w))),
    stale: baseline.filter(e => !report.warnings.some(w => sameKey(e, w))),
    count: baseline.length,
  };
}
