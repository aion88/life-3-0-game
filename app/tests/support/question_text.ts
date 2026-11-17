/**
 * Textes de question (scène, libellé, coût) : leurs chiffres et nombres sont des jetons nommés, clé par clé, dans `meta.json` (`allowTokens`,
 * décision du team-lead du 2026-11-03 sur le précédent de `q.Q20.title`) ; le contrôle de chiffre de ces textes est donc celui de leur
 * politique, jamais un « aucun chiffre » global. Le contrôle de lettre d'option ne cherche qu'une marque de liste (« A. », « B) », « C : »)
 * ou une lettre seule : les articles « a » (fr, verbe avoir) et « A » (en) sont du texte [GDD 01 §5.8, U-1, U-7].
 */
import fr from '../../src/data/strings/fr.json';
import en from '../../src/data/strings/en.json';
import metaJson from '../../src/data/strings/meta.json';
import { ruleFor, type StringMeta } from '../../src/i18n/i18n';
import { checkPlayerString } from '../../src/validate/numbers';

type Lang = 'fr' | 'en';
const TABLES: Record<Lang, Record<string, string>> = { fr, en };
const META = metaJson as StringMeta;
export const QUESTION_TEXT_KEY = /^q\.Q\d+\.(?:scene|[A-D]\.label|[A-D]\.cost)$/u;
/** Une lettre d'option écrite comme une marque : seule, ou suivie d'un point, d'une parenthèse ou de deux-points. */
export const OPTION_MARK = /(?:^|[\s(«])[A-Da-d](?:[.)]|\s?:)(?=\s|$)|^[A-Da-d]$/u;

/** Les textes de question d'une langue, valeur vers clé. */
const BY_LANG = new Map<Lang, ReadonlyMap<string, string>>();
export function questionTexts(lang: Lang): ReadonlyMap<string, string> {
  let m = BY_LANG.get(lang);
  if (!m) { m = new Map(Object.entries(TABLES[lang]).filter(([k]) => QUESTION_TEXT_KEY.test(k)).map(([k, v]) => [v, k])); BY_LANG.set(lang, m); }
  return m;
}

/** Problèmes d'un texte de question à l'écran : jetons non nommés de sa politique, marque de lettre d'option. Vide si tout tient. */
export function questionTextProblems(text: string, lang: Lang, key: string): readonly string[] {
  const out = checkPlayerString(text, lang, ruleFor(META, key), []).map((v) => `${key} : ${v.code} « ${v.token} »`);
  if (OPTION_MARK.test(text)) out.push(`${key} : lettre d'option`);
  return out;
}
