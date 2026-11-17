/**
 * Validateurs de D141 pour le bilan : B-V1, B-V2, B-V3, B-V4 à B-V7, B-V9 [GDD 06 §8.2 ; plan 03 T14 ; errata R-03.12].
 * Pur : les données arrivent par `ContentInput`, aucun import JSON, aucune horloge, aucun hasard.
 *
 * B-V3 est une ERREUR (jamais dans la ligne de base). Les autres sont des AVERTISSEMENTS comptés dans `validator-baseline.json`
 * [D141 (1) b], sauf deux erreurs de structure de donnée : une variable porteuse qui n'est pas une `WorldVar`, et une fin du simulateur
 * sans entrée dans `fate.ends`. Hors périmètre ici, ailleurs par construction : B-V8 (T11), B-V10 (T5, T6, T11), B-V11 (T7), B-V12 (T9).
 * Exclus de B-V1 et B-V2 et nommés : SOURCES & HONESTY (`sources.*`, `<monde>.sources.*`) et les documents du régime (`w10.doc.*`) [GDD 06 §3.2].
 * Limite écrite : la moitié « mise en page sans trou pour 0 à 4 lignes » de B-V9 est `layoutShare` (T12) ; ici, le texte de l'image.
 */
import { isReplayed } from '../bilan/others';
import { RARE_LINE_KEY } from '../bilan/sources';
import type { CoreData } from '../data/schema/core';
import type { WorldData } from '../data/schema/world';
import { lineHalves } from '../engine/moments/rights';
import { otherLives, remontee, OTHER_LIVES_MAX_LINES } from '../fastforward';
import { ruleFor, type StringRule } from '../i18n/i18n';
import type { Answers, OtherLife, Lang } from '../shared/types';
import type { Issue } from '../shared/types/common';
import { RIGHT_IDS } from '../shared/types/street';
import { WORLD_VARS } from '../shared/types/world';
import type { ContentInput, ValidationReport } from './content';
import { checkPlayerString } from './numbers';

const LANGS: readonly Lang[] = ['fr', 'en'];
const FILE: Record<Lang, string> = { fr: 'strings/fr.json', en: 'strings/en.json' };
const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/gu;
/** Les fins que le simulateur de survie sait produire (`survival/report.ts`, `endOf`) : toutes doivent avoir une clé de texte. */
export const SURVIVAL_END_IDS: readonly string[] = ['arrested', 'arrestedAudition', 'released', 'recruited'];

type Strings = ContentInput['strings'];
type BilanBlock = { readonly dossier: { readonly noneFlaggedKey: string; readonly audition: { readonly choiceId: string } };
  readonly rights: { readonly carriers: Readonly<Record<string, { readonly var: string; readonly sign: 1 | -1 }>> };
  readonly fate: { readonly ends: Readonly<Record<string, string>> } };

/** Les mondes qui portent un bloc `bilan` complet (un monde `skeleton` porte `{}`). */
function bilanWorlds(input: ContentInput): readonly { readonly w: WorldData; readonly b: BilanBlock }[] {
  return input.worlds.flatMap((w) => 'dossier' in w.bilan ? [{ w, b: w.bilan as unknown as BilanBlock }] : []);
}

const inScope = (key: string): boolean => /^(?:w\d{2}\.)?bilan\./u.test(key) || key.startsWith('redirect.');
const stripped = (s: string): string => s.normalize('NFC').replace(PLACEHOLDER, ' ');
const issue = (code: string, lang: Lang, path: string, owner: string, message: string): Issue => ({ code, file: FILE[lang], path, owner, message });

function eachKey(strings: Strings, scope: (k: string) => boolean, fn: (lang: Lang, key: string, text: string) => void): void {
  for (const lang of LANGS) for (const key of Object.keys(strings[lang]).sort()) if (scope(key)) fn(lang, key, strings[lang][key]!);
}

// --- B-V1 ---------------------------------------------------------------------------------------------------------------------------

// Faux positifs connus, assumés (avertissement, sévérité inchangée) : « seconde », « premier » et, en anglais, « first » / « second » en langue
// courante (« une seconde », « le premier venu », « at first ») sont signalés comme des ordinaux de numérotation.
const ORDINAL_RE: Record<Lang, RegExp> = {
  fr: /(?<![\p{L}])(?:premi(?:er|ère|ers|ères)|(?:deux|trois|quatr|cinqu|six|sept|huit|neuv|dix|onz|vingt|trent)i(?:è|e)mes?|second(?:e|s|es)?)(?![\p{L}])/iu,
  en: /(?<![\p{L}])(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?![\p{L}])/iu,
};
const ZERO_YEARS_RE = /(?<![\d\p{L}])(?:0|zéro|zero)\s+(?:ans?|years?)(?![\p{L}])/iu;
const ANSWER_LABEL_RE = /^q\.Q\d+\.[A-D]\.label$/u;

/**
 * B-V1 : l'interdit des chiffres est déjà tenu, en erreur, par la politique de chaque clé (`GDD05-V8`). B-V1 ajoute ce qu'elle ne voit pas :
 * une clé du bilan dotée d'une règle plus faible que `bilan`, « 0 an », et les ordinaux en lettres (GDD 01 U-1 : aucune numérotation à l'écran).
 * Les libellés de réponse `q.*.label` entrent dans le champ des ordinaux : « Les autres » et la remontée les citent dans une phrase du bilan.
 */
function checkB1(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  const labelOrdinals: Record<Lang, number> = { fr: 0, en: 0 };
  eachKey(input.strings, (k) => inScope(k) || ANSWER_LABEL_RE.test(k), (lang, key, text) => {
    const s = stripped(text);
    if (ANSWER_LABEL_RE.test(key)) { if (ORDINAL_RE[lang].test(s)) labelOrdinals[lang]++; return; }
    const rule = ruleFor(input.meta, key);
    if (rule.policy !== 'voice' && rule.policy !== 'bilan') {
      for (const v of checkPlayerString(text, lang, { ...rule, policy: 'bilan' }, [])) {
        out.push(issue('GDD06-BV1-number', lang, key, 'writer', `« ${v.token} » : un chiffre ou un nombre en lettres hors dates, années et heures [GDD 06 B-V1]`));
      }
    }
    if (ZERO_YEARS_RE.test(s)) out.push(issue('GDD06-BV1-zero-years', lang, key, 'writer', 'jamais « 0 an » [GDD 06 B-V1, D129]'));
    const m = ORDINAL_RE[lang].exec(s);
    if (m) out.push(issue('GDD06-BV1-ordinal', lang, key, 'writer', `ordinal « ${m[0]} » : numérotation à l'écran [GDD 01 U-1 ; GDD 06 B-V1]`));
  });
  for (const lang of LANGS) {
    if (labelOrdinals[lang] === 0) continue;
    out.push(issue('GDD06-BV1-ordinal', lang, 'q.*.label', 'writer',
      `${labelOrdinals[lang]} libellés de réponse portent un ordinal (provisoires neutres, R-03.7) : numérotation à l'écran contre GDD 01 U-1, à remplacer [GDD 06 B-V1]`));
  }
  return out;
}

// --- B-V2 ---------------------------------------------------------------------------------------------------------------------------

const GAUGE_WORDS: Record<Lang, readonly string[]> = {
  fr: ['jauge', 'jauges', 'palier', 'paliers', 'seuil', 'seuils', 'équivalent', 'équivalents'],
  en: ['gauge', 'gauges', 'tier', 'tiers', 'threshold', 'thresholds', 'equivalent', 'equivalents'],
};
const COUNT_WORDS = 'un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|one|two|three|four|five|seven|eight|nine|ten';
const PRICE_COUNT_RE = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:\d+|n|${COUNT_WORDS})\s+(?:prix|prices?)(?![\p{L}])`, 'iu');

/** B-V2 : ni jauge, ni palier, ni seuil, ni équivalent, ni « N prix » ; plus les mots interdits de chaque monde, y compris sous les clés `bilan.*` sans préfixe de monde. */
function checkB2(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  const forbidden = [...new Set(input.worlds.flatMap((w) => w.forbiddenWords).map((w) => w.normalize('NFC').toLowerCase()))];
  eachKey(input.strings, inScope, (lang, key, text) => {
    const words = new Set((stripped(text).toLowerCase().match(/[\p{L}\p{N}]+/gu)) ?? []);
    const hit = [...GAUGE_WORDS[lang], ...forbidden].find((w) => words.has(w));
    if (hit !== undefined) { out.push(issue('GDD06-BV2-gauge-word', lang, key, 'writer', `« ${hit} » : le bilan ne nomme ni jauge, ni palier, ni seuil, ni équivalent [GDD 06 B-V2]`)); return; }
    const m = PRICE_COUNT_RE.exec(stripped(text));
    if (m) out.push(issue('GDD06-BV2-gauge-word', lang, key, 'writer', `« ${m[0]} » : un décompte de prix [GDD 06 B-V2]`));
  });
  return out;
}

// --- B-V3 ---------------------------------------------------------------------------------------------------------------------------

/** Contrôle une liste de lignes de « Les autres » : 0 à 4 lignes, un monde par ligne, chacune rejouée comme remplacement unique [GDD 06 B-V3 ; D49, D139]. */
export function checkOthersLines(core: CoreData, answers: Answers, lines: readonly OtherLife[]): Issue[] {
  const out: Issue[] = [];
  const bad = (path: string, message: string): void => { out.push({ code: 'GDD06-BV3-others', file: 'bilan/others', path, owner: 'lead-programmer', message }); };
  if (lines.length > OTHER_LIVES_MAX_LINES) bad('others.count', `${lines.length} lignes, quatre au plus [B-V3]`);
  const worlds = new Set<string>();
  for (const l of lines) {
    const at = `others.${l.question}.${l.answer}`;
    if (worlds.has(l.destination)) bad(at, `deux lignes vers le monde ${l.destination} : une ligne par monde [B-V3]`);
    worlds.add(l.destination);
    if (!isReplayed(core, answers, l)) bad(at, `la ligne n'est pas un remplacement unique rejoué par le simulateur [B-V3]`);
  }
  return out;
}

/** Jeux de réponses de contrôle, sans hasard : quatre uniformes et seize suites d'un congruentiel fixe. */
function sampleAnswers(core: CoreData): readonly Answers[] {
  const qs = core.questionnaire.questions;
  const make = (pick: (i: number, n: number) => number): Answers =>
    Object.fromEntries(qs.map((q, i) => [q.key, q.answers[pick(i, q.answers.length) % q.answers.length]!.key])) as unknown as Answers;
  const uniform = [0, 1, 2, 3].map((k) => make((_i, n) => Math.min(k, n - 1)));
  let s = 12345;
  const next = (): number => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s >>> 16; };
  return [...uniform, ...Array.from({ length: 16 }, () => make((_i, n) => next() % n))];
}

function checkB3(input: ContentInput): Issue[] {
  return sampleAnswers(input.core).flatMap((a) => checkOthersLines(input.core, a, otherLives(input.core, a, remontee(input.core, a))));
}

// --- B-V4 ---------------------------------------------------------------------------------------------------------------------------

const VERDICT_RE: Record<Lang, RegExp> = {
  fr: /(?<![\p{L}])(?:sauv(?:é|e)(?:e|s|es)?|mort(?:e|s|es)?|recrut(?:é|e)(?:e|s|es)?)(?![\p{L}])/iu,
  en: /(?<![\p{L}])(?:saved|dead|recruited)(?![\p{L}])/iu,
};

/** B-V4 : ni « sauvé », ni « mort », ni « recruté » comme verdict [GDD 06 B-R5 ; GDD 05 §3.5]. */
function checkB4(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  eachKey(input.strings, inScope, (lang, key, text) => {
    const m = VERDICT_RE[lang].exec(stripped(text));
    if (m) out.push(issue('GDD06-BV4-verdict-word', lang, key, 'writer', `« ${m[0]} » : la fin se dit par ce qui arrive, jamais par un verdict [GDD 06 B-V4]`));
  });
  return out;
}

// --- B-V5 ---------------------------------------------------------------------------------------------------------------------------

const LONE_LETTER_RE = /(?<![\p{L}\p{N}])[A-D](?![\p{L}\p{N}])/u;
const PAGE_TITLES = ['bilan.sheet.title', 'bilan.curve.title', 'bilan.others.title', 'bilan.traceback.title', 'bilan.rights.title', 'sources.title'];

/** Un intitulé ou un libellé : présent, non vide, ni chiffre (hors dates, années, heures), ni nombre en lettres, ni lettre isolée de A à D. */
function labelProblem(strings: Strings, lang: Lang, key: string, rule: StringRule): string | null {
  const text = strings[lang][key];
  if (text === undefined || text.trim() === '') return 'absent ou vide';
  const v = checkPlayerString(text, lang, { ...rule, policy: 'bilan' }, [])[0];
  if (v) return `« ${v.token} » : un numéro`;
  if (LONE_LETTER_RE.test(stripped(text))) return 'une lettre isolée';
  return null;
}

/**
 * B-V5 : l'étiquette `intitulé · libellé` d'une réponse se compose de `q.<Q>.title` et `q.<Q>.<a>.label` ; chaque page porte un intitulé.
 * Les deux moitiés sont contrôlées chacune, l'étiquette n'a ainsi ni numéro ni lettre [GDD 06 §3.6, B-V5 ; spec ND R1].
 */
function checkB5(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  const keys = [...PAGE_TITLES, ...bilanWorlds(input).map(({ w }) => `${w.id}.bilan.file.title`)];
  for (const q of input.core.questionnaire.questions) keys.push(`q.${q.key}.title`, ...q.answers.map((a) => `q.${q.key}.${a.key}.label`));
  for (const key of keys) {
    for (const lang of LANGS) {
      const p = labelProblem(input.strings, lang, key, ruleFor(input.meta, key));
      if (p !== null) out.push(issue('GDD06-BV5-label', lang, key, 'writer', `${p} : intitulé ou libellé de page ou de réponse [GDD 06 B-V5]`));
    }
  }
  return out;
}

// --- B-V6 ---------------------------------------------------------------------------------------------------------------------------

const ARTICLE_RE = /(?<![\p{L}])(?:articles?|art\.)\s*(?:\d+|premier|first|[ivx]+(?![\p{L}]))/iu;

/** B-V6 : huit lignes de droits à deux moitiés, sans numéro d'article ; variable porteuse = `WorldVar` ; un droit qui ne peut jamais avoir d'étiquette. */
function checkB6(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  for (const { w, b } of bilanWorlds(input)) {
    const file = `worlds/${w.id}.json`;
    for (const id of RIGHT_IDS) {
      const key = `${w.id}.right.${id}`;
      for (const lang of LANGS) {
        const text = input.strings[lang][key];
        if (text === undefined) { out.push(issue('GDD06-BV6-right', lang, key, 'writer', 'ligne de droit absente [GDD 06 B-V6]')); continue; }
        const h = lineHalves(text);
        if (h.first === '' || h.second === '') out.push(issue('GDD06-BV6-right', lang, key, 'writer', 'la ligne n\'a pas ses deux moitiés (« Ici », « 2026 ») [GDD 06 B-V6]'));
        if (ARTICLE_RE.test(text)) out.push(issue('GDD06-BV6-right', lang, key, 'writer', 'numéro d\'article de la DUDH dans la pièce des droits [GDD 06 B-V6]'));
      }
      const c = b.rights.carriers[id];
      const at = `bilan.rights.carriers.${id}`;
      if (c === undefined || !(WORLD_VARS as readonly string[]).includes(c.var)) {
        out.push({ code: 'GDD06-carrier-not-worldvar', file, path: `${at}.var`, owner: 'world-builder', message: `« ${c?.var ?? ''} » n'est pas une variable du monde [GDD 06 §3.7]` });
        continue;
      }
      const reachable = input.core.questionnaire.questions.some((q) => q.answers.some((a) => c.sign * Number((a.push as Readonly<Record<string, number>>)[c.var] ?? 0) > 0));
      if (!reachable) out.push({ code: 'GDD06-right-no-label', file, path: at, owner: 'world-builder', message: `aucune réponse ne pousse ${c.var} dans le sens de la perte : ce droit n'aura jamais d'étiquette [F7]` });
    }
  }
  return out;
}

// --- B-V7 ---------------------------------------------------------------------------------------------------------------------------

const DUDH_RE = /DUDH|UDHR/u;
const UNREOPENED_RE: Record<Lang, RegExp> = { fr: /non\s+revérifi/iu, en: /(?:not|un)\s*(?:re)?(?:checked|verified|opened)|rechecked|reverified/iu };

/** B-V7 : SOURCES & HONESTY a la ligne des mondes rares, les sept hypothèses (intitulé et libellé), la note DUDH et la mention du canon non revérifié. */
function checkB7(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  const bad = (lang: Lang, path: string, message: string): void => { out.push(issue('GDD06-BV7-sources', lang, path, 'writer', `${message} [GDD 06 B-V7]`)); };
  for (const lang of LANGS) {
    const t = input.strings[lang];
    const rare = t[RARE_LINE_KEY];
    if (rare === undefined) bad(lang, RARE_LINE_KEY, 'ligne des mondes rares absente');
    else if (!rare.includes('{gatekeeper}') || !rare.includes('{oneIn}')) bad(lang, RARE_LINE_KEY, 'la ligne des mondes rares n\'a pas ses deux parts {gatekeeper} et {oneIn}');
    const dudh = t['sources.note.dudh'];
    if (dudh === undefined || !DUDH_RE.test(dudh)) bad(lang, 'sources.note.dudh', 'note sur la DUDH absente');
    const teg = t['sources.note.tegmark'];
    if (teg === undefined || !UNREOPENED_RE[lang].test(teg)) bad(lang, 'sources.note.tegmark', 'mention du canon non revérifié absente');
    for (const l of ['sourced', 'unreopened', 'extrapolated', 'gameHypothesis']) {
      for (const k of [`sources.label.${l}`, `sources.legend.${l}`]) if ((t[k] ?? '').trim() === '') bad(lang, k, 'étiquette de source absente');
    }
  }
  const hyp = input.core.questionnaire.questions.flatMap((q) => q.answers.filter((a) => a.hypothesis).map((a) => ({ q: q.key, a: a.key })));
  if (hyp.length !== 7) out.push({ code: 'GDD06-BV7-sources', file: 'questionnaire.json', path: 'questions.hypothesis', owner: 'game-designer', message: `${hyp.length} hypothèses de jeu, sept attendues [GDD 06 B-V7]` });
  for (const h of hyp) for (const lang of LANGS) {
    for (const k of [`q.${h.q}.title`, `q.${h.q}.${h.a}.label`]) if ((input.strings[lang][k] ?? '').trim() === '') bad(lang, k, 'hypothèse de jeu sans intitulé ou libellé');
  }
  return out;
}

// --- B-V9 ---------------------------------------------------------------------------------------------------------------------------

/** Les clés dont le texte peut figurer sur l'image partageable : fiche, jours, kit, fin, noms de monde, phrase de « Les autres » (0 à 4 lignes). */
export function shareTextKeys(input: ContentInput): readonly string[] {
  const keys = new Set<string>();
  const fr = Object.keys(input.strings.fr);
  for (const k of fr) if (/^bilan\.sheet\.|^bilan\.kit\.state\.|^bilan\.others\.(?:line|locked|title)$|^world\./u.test(k)) keys.add(k);
  for (const { w } of bilanWorlds(input)) {
    for (const k of fr) if (k.startsWith(`${w.id}.bilan.day.`) || k.startsWith(`${w.id}.bilan.fate.`)) keys.add(k);
    for (const c of w.calendar) keys.add(c.dateKey);
    for (const item of w.kit) keys.add(item.labelKey);
  }
  return [...keys].sort();
}

/** B-V9 : le texte de l'image passe la politique `bilan` sans chiffre hors dates et heures, pour une phrase de « Les autres » et pour son absence. */
function checkB9(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  for (const key of shareTextKeys(input)) for (const lang of LANGS) {
    const text = input.strings[lang][key];
    if (text === undefined) continue;
    for (const v of checkPlayerString(text, lang, { ...ruleFor(input.meta, key), policy: 'bilan' }, [])) {
      out.push(issue('GDD06-BV9-share-text', lang, key, 'writer', `« ${v.token} » : un chiffre hors dates et heures sur l'image partageable [GDD 06 B-V9]`));
    }
  }
  return out;
}

// --- Points ouverts routés à T14 (open-items.md) ------------------------------------------------------------------------------------

/** Un jour vécu sans offre (et sans l'audition) a sa clé `<monde>.bilan.day.fact.jN` en FR et en EN : sinon la ligne du jour retombe sur la ligne du soir. */
function checkDayFacts(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  for (const { w, b } of bilanWorlds(input)) {
    const audition = w.street.choices.find((c) => c.id === b.dossier.audition.choiceId)?.days ?? [];
    for (const { day } of w.calendar) {
      if (audition.includes(day) || w.street.choices.some((c) => c.kind === 'offer' && c.days.includes(day))) continue;
      const key = `${w.id}.bilan.day.fact.j${day}`;
      for (const lang of LANGS) {
        if ((input.strings[lang][key] ?? '').trim() === '') out.push(issue('GDD06-todo-day-fact', lang, key, 'narrative-director', `jour ${day} vécu sans offre : constat du jalon à écrire, repli sur la ligne du soir [GDD 06 §3.3 (2 bis)]`));
      }
    }
  }
  return out;
}

/** `fate.ends` couvre chaque fin que le simulateur produit, et chaque clé existe dans les deux langues. */
function checkFate(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  for (const { w, b } of bilanWorlds(input)) {
    const file = `worlds/${w.id}.json`;
    for (const id of SURVIVAL_END_IDS) {
      if (!(id in b.fate.ends)) out.push({ code: 'GDD06-fate-end-missing', file, path: `bilan.fate.ends.${id}`, owner: 'world-builder', message: `la fin ${id} n'a pas d'entrée : un joueur qui y arrive n'aurait pas de ligne de fin [GDD 06 §3.3]` });
    }
    for (const key of Object.values(b.fate.ends)) for (const lang of LANGS) {
      if ((input.strings[lang][key] ?? '').trim() === '') out.push(issue('GDD06-fate-end-missing', lang, key, 'writer', 'texte de fin absent'));
    }
  }
  return out;
}

/** Une clé `cause.*` doit avoir au moins une phrase imprimable (sans marqueur `{..}`) ; une phrase à marqueur non résolu est omise à l'écran. */
function checkCauses(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  eachKey(input.strings, (k) => k.startsWith('cause.'), (lang, key, text) => {
    const sentences = text.split(/(?<=[.!?])\s+/u).filter((s) => s.trim() !== '');
    const printable = sentences.filter((s) => !new RegExp(PLACEHOLDER.source, 'u').test(s));
    if (printable.length === 0) out.push(issue('GDD06-cause-unprinted', lang, key, 'writer', 'aucune phrase imprimable : la ligne n\'affiche rien [GDD 02 §3.9]'));
    if (printable.length < sentences.length) out.push(issue('GDD06-cause-unresolved', lang, key, 'writer', `${sentences.length - printable.length} phrase(s) à marqueur {..} sans valeur : omises à l'écran`));
  });
  return out;
}

/** La clé « aucune ligne signalée » existe dans les deux langues et ne porte aucun paramètre numérique. */
function checkZeroFlagged(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  for (const { b } of bilanWorlds(input)) {
    const key = b.dossier.noneFlaggedKey;
    for (const lang of LANGS) {
      const text = input.strings[lang][key];
      if (text === undefined || text.trim() === '') out.push(issue('GDD06-zero-flagged', lang, key, 'writer', 'clé « aucune ligne signalée » absente [D136]'));
      else if (new RegExp(PLACEHOLDER.source, 'u').test(text)) out.push(issue('GDD06-zero-flagged', lang, key, 'writer', 'zéro ligne se dit sans paramètre numérique [D136]'));
    }
  }
  return out;
}

/** Applique B-V1 à B-V9 et les points ouverts de T14. Erreurs : B-V3, variable porteuse, fin manquante. Le reste : avertissements pour la ligne de base. */
export function validateBilan(input: ContentInput): ValidationReport {
  const all: Issue[] = [
    ...checkB1(input), ...checkB2(input), ...checkB3(input), ...checkB4(input), ...checkB5(input), ...checkB6(input), ...checkB7(input),
    ...checkB9(input), ...checkDayFacts(input), ...checkFate(input), ...checkCauses(input), ...checkZeroFlagged(input),
  ];
  const isError = (i: Issue): boolean => i.code === 'GDD06-BV3-others' || i.code === 'GDD06-carrier-not-worldvar'
    || (i.code === 'GDD06-fate-end-missing' && i.file.startsWith('worlds/'));
  return { errors: all.filter(isError), warnings: all.filter((i) => !isError(i)) };
}
