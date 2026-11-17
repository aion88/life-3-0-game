import type { Issue, Lang } from '../shared/types/common';

/** Politique d'injection de nombres par préfixe de clé [GDD 05 V8, GDD 06 B-V1, PHASE V M6 ; D141 : card fusionne dans inventory]. */
export type NumberPolicy = 'voice' | 'inventory' | 'regimeDocument' | 'bilan' | 'sources';

/** Règle d'un préfixe de clé [GDD 05 §V8]. À l'exécution, seul `numericParams` admet un nombre injecté, quelle que soit la politique. `allowCalendar` et `allowTokens` ne sont lus que par le validateur statique du contenu (Task 6), qui contrôle années, heures et dates dans le texte des chaînes. */
export interface StringRule {
  readonly policy: NumberPolicy;
  readonly allowCalendar?: boolean;
  readonly allowTokens?: readonly string[];
  readonly numericParams?: readonly string[];
}

/** Table de chaînes d'une langue : clé pointée vers gabarit `{nom}` [GDD 05 §8]. */
export type StringTable = Readonly<Record<string, string>>;

/** Préfixe de clé vers règle ; le plus long préfixe gagne ; défaut voice [GDD 05 §V8]. */
export type StringMeta = Readonly<Record<string, StringRule>>;

/** Anomalie remontée par le module de langues en production [GDD 05 §V8]. */
export interface I18nIssue { readonly code: 'missing-key' | 'missing-param' | 'numeric-param'; readonly key: string }

type Params = Readonly<Record<string, string | number>>;

/** Interface de langues consommée par tous les écrans [GDD 01 §3.2]. */
export interface I18n {
  lang(): Lang; setLang(l: Lang): void; onChange(cb: (l: Lang) => void): () => void; has(key: string): boolean;
  t(key: string, params?: Params): string;
  tPlural(key: string, count: number, params?: Params): string;
}

const KEY_RE = /^[A-Za-z0-9]+(\.[A-Za-z0-9_-]+)*$/;
const PLACEHOLDER_RE = /\{([A-Za-z0-9_]+)\}/g;
const PLURAL_SUFFIX_RE = /\.(zero|one|two|few|many|other)$/;

/** Langue par défaut du navigateur : `fr-*` donne fr, `en-*` donne en, le reste donne en [GDD 01 §3.2 étape 0]. */
export function detectLang(languages: readonly string[] | undefined): Lang {
  for (const raw of languages ?? []) {
    const base = raw.toLowerCase().split('-')[0];
    if (base === 'fr') return 'fr';
    if (base === 'en') return 'en';
  }
  return 'en';
}

/** Règle d'une clé : le plus long préfixe déclaré (frontière de segment) gagne, défaut voice [GDD 05 §V8]. */
export function ruleFor(meta: StringMeta, key: string): StringRule {
  let best: string | undefined;
  for (const prefix of Object.keys(meta)) {
    if ((key === prefix || key.startsWith(`${prefix}.`)) && (best === undefined || prefix.length > best.length)) best = prefix;
  }
  return best === undefined ? { policy: 'voice' } : meta[best]!;
}

function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(PLACEHOLDER_RE)].map(m => m[1]!))].sort();
}

/** Parité FR/EN : clés manquantes, clés invalides, marqueurs divergents. Les catégories de pluriel peuvent différer si `.other` existe des deux côtés [GDD 05 §8.2]. */
export function checkParity(tables: Readonly<Record<Lang, StringTable>>): readonly Issue[] {
  const out: Issue[] = [];
  const files: Record<Lang, string> = { fr: 'strings/fr.json', en: 'strings/en.json' };
  const mk = (code: string, lang: Lang, path: string, message: string): Issue => ({ code, file: files[lang], path, message, owner: 'writer' });
  for (const lang of ['fr', 'en'] as const) {
    for (const key of Object.keys(tables[lang]).sort()) {
      if (!KEY_RE.test(key)) out.push(mk('invalid-key', lang, key, `clé invalide : ${key}`));
    }
  }
  const all = [...new Set([...Object.keys(tables.fr), ...Object.keys(tables.en)])].sort();
  for (const key of all) {
    if (!KEY_RE.test(key)) continue;
    const inFr = key in tables.fr; const inEn = key in tables.en;
    if (inFr && inEn) {
      const a = placeholders(tables.fr[key]!); const b = placeholders(tables.en[key]!);
      if (a.join(',') !== b.join(',')) out.push(mk('placeholder-mismatch', 'fr', key, `marqueurs fr {${a.join(',')}} contre en {${b.join(',')}}`));
      continue;
    }
    const missingIn: Lang = inFr ? 'en' : 'fr';
    const m = PLURAL_SUFFIX_RE.exec(key);
    if (m && m[1] !== 'other' && `${key.slice(0, m.index)}.other` in tables[missingIn]) continue;
    out.push(mk('missing-key', missingIn, key, `clé absente en ${missingIn}`));
  }
  return out;
}

function isNumeric(v: string | number): boolean {
  return typeof v === 'number' || /\d/.test(v);
}

function isZero(v: string | number): boolean {
  return typeof v === 'number' ? v === 0 : !/[1-9]/.test(v);
}

/** Crée le module de langues. Dev lève sur toute anomalie ; prod la rapporte et se replie (autre langue, puis la clé) [GDD 05 §V8 ; lead-programmer]. */
export function createI18n(
  tables: Readonly<Record<Lang, StringTable>>, meta: StringMeta, initial: Lang,
  opts: { mode: 'dev' | 'prod'; report: (i: I18nIssue) => void },
): I18n {
  let current: Lang = initial;
  const listeners = new Set<(l: Lang) => void>();

  const fail = (code: I18nIssue['code'], key: string, detail: string): void => {
    if (opts.mode === 'dev') throw new Error(`i18n ${code} (${key}): ${detail}`);
    opts.report({ code, key });
  };

  const template = (key: string): string => {
    const own = tables[current][key];
    if (own !== undefined) return own;
    fail('missing-key', key, `absent en ${current}`);
    const other: Lang = current === 'fr' ? 'en' : 'fr';
    return tables[other][key] ?? key;
  };

  const fill = (key: string, ruleKey: string, tpl: string, params: Params | undefined): string => {
    const rule = ruleFor(meta, ruleKey);
    const declared = rule.numericParams ?? [];
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        if (!isNumeric(value)) continue;
        if (!declared.includes(name)) fail('numeric-param', key, `numeric param "${name}" not declared under policy ${rule.policy}`);
        else if (rule.policy === 'bilan' && isZero(value)) fail('numeric-param', key, `numeric param "${name}" is zero under policy bilan`);
      }
    }
    return tpl.replace(PLACEHOLDER_RE, (whole, name: string) => {
      const v = params?.[name];
      if (v === undefined) { fail('missing-param', key, `missing param "${name}"`); return whole; }
      return String(v);
    });
  };

  return {
    lang: () => current,
    setLang(l) { if (l === current) return; current = l; for (const cb of [...listeners]) cb(l); },
    onChange(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    has: key => key in tables[current],
    t: (key, params) => fill(key, key, template(key), params),
    tPlural(key, count, params) {
      const cat = new Intl.PluralRules(current).select(count);
      const full = `${key}.${cat}`;
      const resolved = full in tables[current] ? full : `${key}.other`;
      return fill(resolved, key, template(resolved), params);
    },
  };
}
