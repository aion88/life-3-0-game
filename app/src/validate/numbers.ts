/**
 * Validateur statique des chiffres à l'écran [GDD 05 §3.5 et V8 ; GDD 06 §3.2 et B-V1 ; bible w10 §8.3 ; D141].
 * Pur : pas de DOM, pas de hasard, pas de lecture de fichier.
 */
import type { StringRule } from '../i18n/i18n';
import type { Lang } from '../shared/types/common';

/** Écart de nombre dans une chaîne joueur ; `index` est une position dans le texte normalisé NFC [GDD 05 V8]. */
export interface NumberViolation {
  readonly code: 'digit' | 'numberWord' | 'percent' | 'gaugeWord' | 'inventoryCountExceeded';
  readonly token: string;
  readonly index: number;
}

const FR_WORDS = [
  'zéro', 'un', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'vingt', 'vingts', 'trente', 'quarante', 'cinquante', 'soixante', 'septante', 'octante', 'huitante', 'nonante', 'cent', 'cents', 'mille', 'million', 'millions', 'milliard', 'milliards',
  'quart', 'quarts', 'tiers', 'moitié', 'moitiés', 'demi', 'demie', 'demis', 'demies', 'double', 'doubles', 'triple', 'triples', 'douzaine', 'douzaines', 'centaine', 'centaines',
];
const EN_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'hundreds', 'thousand', 'thousands', 'million', 'millions', 'billion', 'billions',
  'half', 'halves', 'quarter', 'quarters', 'third', 'thirds', 'twice', 'dozen', 'dozens', 'score', 'scores',
];
/** Articles : jamais des quantités, sauf dans un motif de proportion [D141]. */
const ARTICLES: Record<Lang, ReadonlySet<string>> = { fr: new Set(['un', 'une']), en: new Set(['one']) };
/** Mot qui, après un article, fait de lui une quantité (« un sur quatre », « one in four »). */
const PROPORTION_NEXT: Record<Lang, RegExp> = { fr: /^\s+sur\b/u, en: /^\s+(?:in|out\s+of)\b/u };
const WORDS: Record<Lang, ReadonlySet<string>> = { fr: new Set(FR_WORDS), en: new Set(EN_WORDS) };
/** Particules admises dans un nombre composé (« vingt et un », « quatre-vingt-un »). */
const JOINERS = new Set(['et']);

const MONTHS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december';
const WEEKDAYS = 'lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const DAYNUM = String.raw`(\d{1,2})(?:er|st|nd|rd|th)?`;
const CALENDAR_RES: readonly RegExp[] = [
  new RegExp(String.raw`\b(?:${WEEKDAYS})\b,?\s+${DAYNUM}(?![\d\p{L}:])`, 'giud'),
  new RegExp(String.raw`\b(?:${MONTHS})\b\.?\s+${DAYNUM}(?![\d\p{L}:])`, 'giud'),
  new RegExp(String.raw`(?<![\d.,:])${DAYNUM}\s+(?:${MONTHS})\b`, 'giud'),
];
const YEAR_RE = /(?<![\d.,:])(?:19|20)\d{2}(?![\d]|[.,]\d)/gu;
const CLOCK_RES: Record<Lang, RegExp> = {
  fr: /(?<![\d.,:])\d{1,2}\s?h(?:\s?\d{2})?(?![\p{L}\d])/gu,
  en: /(?<![\d.,:])\d{1,2}(?::\d{2}(?:\s?[ap]\.m\.)?|\s?[ap]\.m\.)(?!\d)/giu,
};
const PLACEHOLDER_RE = /\{[A-Za-z0-9_]+\}/gu;
const PERCENT_RE = /%|\bpour\s+cent\b|\bper\s*cent\b|\bpercent\b/giu;
const DIGIT_RE = /\d+(?:[.,]\d+)*/gu;
const WORD_RE = /\p{L}+(?:-\p{L}+)*/gu;
const AGE_AFTER: Record<Lang, RegExp> = { fr: /^\s+ans?(?![\p{L}])/u, en: /^(?:\s+years?\s+old(?![\p{L}])|-years?-old(?![\p{L}]))/u };

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Candidate { readonly token: string; readonly index: number; readonly end: number; readonly kind: 'digit' | 'numberWord' }

/**
 * Cherche, dans une chaîne joueur, ce que la politique de `rule` refuse [GDD 05 V8 ; GDD 06 B-V1 ; D141].
 *
 * Politiques : `sources` ne vérifie rien ; `regimeDocument` admet les chiffres et refuse `%` et mots interdits ;
 * `voice` refuse chiffres, nombres en lettres, `%` et mots interdits, sauf années (19xx, 20xx) et heures d'horloge ;
 * `allowCalendar` admet en plus le quantième accolé à un mois ou un jour ; `bilan` est `voice` avec ces dates ;
 * `inventory` suit `voice` mais admet les âges et au plus un jeton de décompte (le suivant est `inventoryCountExceeded`) ;
 * `allowTokens` lève un jeton nommé pour la clé nommée. Texte et mots interdits sont comparés en NFC, sans casse.
 *
 * Barre « Dossier » (décision Cynthia, playtest 2026-11-03 ; GDD 2026-11-03 §2 A) : seule jauge permise à l'écran, elle n'écrit AUCUN nombre.
 * Ses clés `street.ui.dossier.*` passent sous `voice` ; « dossier », « file », « audition », « hearing » ne sont pas des mots de jauge (seuls les
 * `forbiddenWords` du monde le sont : le nom « Intégrité » reste interdit). Toute autre jauge reste interdite [GDD 05 §3.5].
 *
 * Limites écrites, non décidables par motif et laissées à la relecture du writer :
 * « neuf » (adjectif) et « tiers » (des tiers) passent par `allowTokens` ; « droit » et « interdit » pris comme statut [R-L7] ;
 * « jamais une somme ni un nombre dérivé de la jauge » sous `regimeDocument` ; une année à quatre chiffres utilisée comme quantité.
 */
export function checkPlayerString(text: string, lang: Lang, rule: StringRule, forbiddenWords: readonly string[]): readonly NumberViolation[] {
  if (rule.policy === 'sources') return [];
  const s = text.normalize('NFC');
  const out: NumberViolation[] = [];
  const allowed = new Set((rule.allowTokens ?? []).map(t => t.normalize('NFC').toLowerCase()));
  const masked = new Array<boolean>(s.length).fill(false);
  const mask = (from: number, to: number): void => { for (let i = from; i < to; i++) masked[i] = true; };
  const isMasked = (from: number, to: number): boolean => { for (let i = from; i < to; i++) if (masked[i]) return true; return false; };
  const push = (code: NumberViolation['code'], token: string, index: number): void => {
    if (allowed.has(token.toLowerCase())) return;
    out.push({ code, token, index });
  };

  // Marqueurs de gabarit : ni chiffre ni mot, le nombre vivant entre par numericParams.
  for (const m of s.matchAll(PLACEHOLDER_RE)) mask(m.index, m.index + m[0].length);

  // Mots interdits du monde, mot entier, sans casse.
  for (const w of forbiddenWords) {
    const word = w.normalize('NFC');
    if (word === '') continue;
    const re = new RegExp(String.raw`(?<![\p{L}\p{N}])${escapeRe(word)}(?![\p{L}\p{N}])`, 'giu');
    for (const m of s.matchAll(re)) { push('gaugeWord', m[0], m.index); mask(m.index, m.index + m[0].length); }
  }

  // Pourcentages : refusés partout sauf sous `sources`.
  for (const m of s.matchAll(PERCENT_RE)) {
    if (isMasked(m.index, m.index + m[0].length)) continue;
    push('percent', m[0], m.index); mask(m.index, m.index + m[0].length);
  }

  if (rule.policy === 'regimeDocument') return out.sort((a, b) => a.index - b.index);

  // Années et heures d'horloge : pas des quantités.
  for (const re of [YEAR_RE, CLOCK_RES[lang]]) for (const m of s.matchAll(re)) mask(m.index, m.index + m[0].length);

  // Quantièmes accolés à un nom de mois ou de jour, si déclarés (ou sous bilan).
  if (rule.allowCalendar === true || rule.policy === 'bilan') {
    for (const re of CALENDAR_RES) {
      for (const m of s.matchAll(re)) {
        const [from, to] = m.indices![1]!;
        mask(from, to);
      }
    }
  }

  // Candidats : séries de chiffres et nombres en lettres.
  const cands: Candidate[] = [];
  for (const m of s.matchAll(DIGIT_RE)) {
    if (!isMasked(m.index, m.index + m[0].length)) cands.push({ token: m[0], index: m.index, end: m.index + m[0].length, kind: 'digit' });
  }
  const words = WORDS[lang];
  const isNum = (w: string): boolean => words.has(w) && !ARTICLES[lang].has(w);
  for (const m of s.matchAll(WORD_RE)) {
    const word = m[0]; const lower = word.toLowerCase();
    if (isMasked(m.index, m.index + word.length)) continue;
    const parts = lower.split('-');
    const compound = parts.length > 1 && parts.every(p => words.has(p) || JOINERS.has(p)) && parts.some(isNum);
    if (compound) { cands.push({ token: word, index: m.index, end: m.index + word.length, kind: 'numberWord' }); continue; }
    let at = m.index;
    for (const p of parts) {
      const raw = word.slice(at - m.index, at - m.index + p.length);
      const end = at + p.length;
      const article = ARTICLES[lang].has(p);
      if (isNum(p) || (article && PROPORTION_NEXT[lang].test(s.slice(end)))) cands.push({ token: raw, index: at, end, kind: 'numberWord' });
      at = end + 1;
    }
  }
  cands.sort((a, b) => a.index - b.index);

  if (rule.policy === 'inventory') {
    // Âges et jetons nommés ne comptent pas ; au plus un jeton de décompte, les suivants dépassent.
    let counted = 0;
    for (const c of cands) {
      if (allowed.has(c.token.toLowerCase())) continue;
      if (AGE_AFTER[lang].test(s.slice(c.end))) continue;
      counted += 1;
      if (counted > 1) out.push({ code: 'inventoryCountExceeded', token: c.token, index: c.index });
    }
  } else {
    for (const c of cands) push(c.kind === 'digit' ? 'digit' : 'numberWord', c.token, c.index);
  }
  return out.sort((a, b) => a.index - b.index);
}
