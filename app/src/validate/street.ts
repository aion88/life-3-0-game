/**
 * Validateurs de contenu de la rue : V1 à V7 et V9 à V14, lint du décompte de mots, couverture de V8 [GDD 05 §8.2 ; D141 (1) ; plan 02b T14].
 * Pur : les données arrivent par `ContentInput`, aucun import JSON, aucune horloge, aucun hasard. Un contrôle par fonction.
 * Tous sortent en AVERTISSEMENTS (ils ne bloquent jamais le chargement) ; la CI échoue sur un avertissement absent de la ligne de base.
 * Un monde au statut `skeleton` n'est pas contrôlé : ses blocs de rue sont vides par permission du schéma.
 */
import { countWords } from '../engine/moments/words';
import type { StringMeta, StringTable } from '../i18n/i18n';
import type { ChoiceData, ChoiceOptionData, StreetData } from '../data/schema/street';
import type { WorldData } from '../data/load';
import type { Issue } from '../shared/types/common';
import { RIGHT_IDS, type DayIndex } from '../shared/types/street';
import type { ContentInput, ValidationReport } from './content';

type Strings = ContentInput['strings'];
type Check = (s: StreetData, ctx: Ctx) => Issue[];
interface Ctx { readonly world: WorldData; readonly file: string; readonly strings: Strings; readonly meta: StringMeta }

const DAYS: readonly DayIndex[] = [1, 2, 3, 4, 5, 6, 7];
const AXES = ['vie', 'travail', 'rue', 'liens', 'pouvoir', 'ia'] as const;
/** Écart maximal entre deux jours à jalon [GDD 05 V4, F5]. */
const MAX_JALON_GAP = 2;
/** Axes à case G au moins par jour, sauf `exceptionJour` [GDD 05 V5, F3]. */
const MIN_G_AXES = 3;
/** Micro-situations qui portent une trace du lendemain, au moins [GDD 05 V6, D133] ; il y en a cinq. */
const MIN_TRACED_MICRO = 3;
/** Dernier jour dont une option de jalon doit porter une trace : la trace se voit le jour suivant [GDD 05 V6, F4]. */
const LAST_TRACE_DAY: DayIndex = 6;
/** Une trace se voit au plus tard le lendemain du premier jour du choix [GDD 05 F4]. */
const TRACE_MAX_DELAY = 1;
/** Mots écartés des lignes de droit, FR et EN [me.md Q90 « interactif », Q83 « immersif » ; GDD 05 V7]. */
const DISCARDED_WORDS: readonly string[] = ['interactif', 'immersif', 'interactive', 'immersive'];
/** Mots que la seconde moitié d'une ligne de droit ne contient pas, FR [GDD 05 R-L2]. */
const SECOND_HALF_BANNED: readonly string[] = ['mais', 'déjà', 'encore', 'perdu', 'avant'];
/** Spécification par monde : calendrier des contacts de droits [GDD 05 V11, F6] ; jours d'offre et plafond par jour [GDD 04 §3.4, bible w10 §7, V12]. */
const WORLD_SPEC: Readonly<Record<string, { readonly contactCalendar: readonly number[]; readonly offerDays: readonly DayIndex[]; readonly offerCap: number }>> = {
  w10: { contactCalendar: [3, 1, 2, 1, 0, 1, 0], offerDays: [2, 3, 4, 5], offerCap: 1 },
};
/** `WORLD_SPEC` : V11 et V12 ne retournent RIEN pour un monde qui n'y figure pas (pas d'avertissement : aucune spec n'existe à contrôler). */
/** Un seul contact de droit par moment [GDD 05 R-L3]. */
const MAX_CONTACTS_PER_MOMENT = 1;
/** Référence de bible d'un prix : §7 (prix) ou §8 (micro-situations), ou `neutre` [GDD 05 V9, R-C6 ; contrôleur 2026-11-02]. */
const PRICE_REF_RE = /^§[78]\.\d+$|^neutre$/;

const issue = (ctx: Ctx, code: string, path: string, owner: string, message: string): Issue => ({ code, file: ctx.file, path: `street.${path}`, owner, message });
const hasText = (t: StringTable, key: string): boolean => (t[key] ?? '') !== '';
const textInBoth = (ctx: Ctx, key: string): boolean => hasText(ctx.strings.fr, key) && hasText(ctx.strings.en, key);
const minDay = (c: ChoiceData): DayIndex => Math.min(...c.days) as DayIndex;
const optionsOf = (s: StreetData): readonly (readonly [ChoiceData, ChoiceOptionData])[] => s.choices.flatMap((c) => c.options.map((o) => [c, o] as const));

/** V1 : 42 cases, aucune manquante, une case D porte un propriétaire, une case E répond à `exceptionJour` [GDD 05 V1]. */
export const checkAxisGrid: Check = (s, ctx) => {
  const out: Issue[] = [];
  for (const day of DAYS) for (const axis of AXES) {
    const cell = s.axes.find((c) => c.day === day && c.axis === axis);
    if (cell === undefined) out.push(issue(ctx, 'GDD05-V1-axis-cell', `axes.${day}.${axis}`, 'world-builder', `case J${day} ${axis} absente de la grille`));
    else if (cell.type === 'D' && cell.owner.trim() === '') out.push(issue(ctx, 'GDD05-V1-axis-cell', `axes.${day}.${axis}`, 'world-builder', `case D de J${day} ${axis} sans propriétaire`));
    else if (cell.type === 'E' && s.exceptionJour?.day !== day) out.push(issue(ctx, 'GDD05-V1-axis-cell', `axes.${day}.${axis}`, 'world-builder', `case E de J${day} ${axis} sans exceptionJour pour ce jour`));
  }
  return out;
};

/** V2 : un choix offert par jour [GDD 05 V2, R-C1]. */
export const checkDayHasChoice: Check = (s, ctx) =>
  DAYS.filter((d) => !s.choices.some((c) => c.days.includes(d)))
    .map((d) => issue(ctx, 'GDD05-V2-day-without-choice', `choices.day${d}`, 'world-builder', `J${d} n'offre aucun choix`));

/** V3 : un refus par choix, avec un prix [GDD 05 V3, R-C3]. */
export const checkRefusals: Check = (s, ctx) => s.choices.flatMap((c) => {
  const refusals = c.options.filter((o) => o.isRefusal);
  if (refusals.length === 0) return [issue(ctx, 'GDD05-V3-no-refusal', `choices.${c.id}`, 'game-designer', `le choix ${c.id} n'a aucune option de refus`)];
  return refusals.filter((o) => o.priceRef.trim() === '')
    .map((o) => issue(ctx, 'GDD05-V3-refusal-no-price', `choices.${c.id}.${o.id}`, 'game-designer', `le refus ${c.id}/${o.id} n'a aucun prix`));
});

/** V3b : une clé de ligne de prix non nulle doit avoir son texte FR et EN ; `null` est permis, la spec n'écrit pas toujours la ligne [GDD 05 R-C2 ; R-02b.54 (c)]. */
export const checkPriceLines: Check = (s, ctx) => optionsOf(s)
  .filter(([, o]) => o.priceLineKey !== null && !textInBoth(ctx, o.priceLineKey))
  .map(([c, o]) => issue(ctx, 'GDD05-V3b-option-line-missing', `choices.${c.id}.${o.id}`, 'writer', `la ligne de prix ${o.priceLineKey} de ${c.id}/${o.id} manque en FR ou en EN`));

/** Un jour libre : aucun jalon daté, Registre fermé, aucun checkpoint exigé (`blocksExit`, le libellé du GDD) [GDD 05 §3.2, D137 ; à confirmer: game-designer]. */
const isFreeDay = (s: StreetData, d: DayIndex): boolean =>
  !s.jalons.some((j) => j.day === d) && s.registre.closedDays.includes(d) && !s.choices.some((c) => c.id.startsWith('checkpoint.') && c.blocksExit && c.days.includes(d));

/** V4 : écart de jalon au plus 2 ; un jour libre ou `exceptionJourLibre` [GDD 05 V4, F5, D137]. */
export const checkJalonRhythm: Check = (s, ctx) => {
  const days = [...new Set(s.jalons.map((j) => j.day))].sort((a, b) => a - b);
  const out = days.flatMap((d, i) => {
    const prev = days[i - 1];
    return prev !== undefined && d - prev > MAX_JALON_GAP
      ? [issue(ctx, 'GDD05-V4-milestone-gap', `jalons.gap.${prev}-${d}`, 'game-designer', `écart de ${d - prev} jours entre les jalons J${prev} et J${d}`)] : [];
  });
  if (!DAYS.some((d) => isFreeDay(s, d)) && s.exceptionJourLibre === null) out.push(issue(ctx, 'GDD05-V4-no-free-day', 'exceptionJourLibre', 'game-designer', 'aucun jour libre et aucune exceptionJourLibre déclarée'));
  return out;
};

/** V5 : au moins 3 axes G par jour, ou le jour de `exceptionJour` [GDD 05 V5, F3, E-J7]. */
export const checkGAxes: Check = (s, ctx) => DAYS
  .filter((d) => s.exceptionJour?.day !== d && s.axes.filter((c) => c.day === d && c.type === 'G').length < MIN_G_AXES)
  .map((d) => issue(ctx, 'GDD05-V5-axes-below-3', `axes.day${d}`, 'world-builder', `J${d} a moins de ${MIN_G_AXES} axes à case G et aucune exceptionJour`));

/** V6 : une trace pour chaque option non neutre d'une offre de jalon des J1 à J6, au plus tard le lendemain ; 3 micro-situations sur 5 [GDD 05 V6, F4, D133]. */
export const checkTraces: Check = (s, ctx) => {
  const missing = optionsOf(s).filter(([c, o]) => c.kind === 'offer' && minDay(c) <= LAST_TRACE_DAY && !o.neutral && o.trace === null)
    .map(([c, o]) => issue(ctx, 'GDD05-V6-trace-missing', `choices.${c.id}.${o.id}`, 'world-builder', `l'option ${c.id}/${o.id} n'a aucune trace du lendemain`));
  const late = optionsOf(s).filter(([c, o]) => o.trace !== null && o.trace.day > minDay(c) + TRACE_MAX_DELAY)
    .map(([c, o]) => issue(ctx, 'GDD05-V6-trace-late', `choices.${c.id}.${o.id}`, 'world-builder', `la trace de ${c.id}/${o.id} tombe au J${o.trace!.day}, après le lendemain de J${minDay(c)}`));
  return [...missing, ...late, ...microTraces(s, ctx)];
};

function microTraces(s: StreetData, ctx: Ctx): Issue[] {
  const ids = [...new Set(s.micro.map((m) => m.id))];
  const traced = ids.filter((id) => s.micro.some((m) => m.id === id && m.traceKey !== null)).length;
  if (traced >= MIN_TRACED_MICRO) return [];
  return [issue(ctx, 'GDD05-V6-micro-traces', 'micro', 'world-builder', `${traced} micro-situation(s) sur ${ids.length} portent une trace, ${MIN_TRACED_MICRO} attendues`)];
}

/** Les deux moitiés d'une ligne de droit : coupées à la première fin de phrase [GDD 05 R-L2]. */
function halves(line: string): readonly [string, string] | null {
  const cut = line.search(/[.!?]\s/u);
  return cut < 0 ? null : [line.slice(0, cut + 1), line.slice(cut + 1)];
}

/** V7 (calendrier) : un contact par droit, au plus un par moment [GDD 05 V7, R-L3]. */
export const checkContactCount: Check = (s, ctx) => {
  const out: Issue[] = [];
  for (const r of RIGHT_IDS) {
    const n = s.rights.contacts.filter((c) => c.right === r).length;
    if (n !== 1) out.push(issue(ctx, 'GDD05-V7-contact-count', `rights.${r}`, 'game-designer', `le droit ${r} a ${n} contacts, un seul attendu`));
  }
  for (const c of s.rights.contacts) {
    const same = s.rights.contacts.filter((x) => x.moment !== null && x.moment === c.moment && x.day === c.day);
    if (c.moment !== null && same.length > MAX_CONTACTS_PER_MOMENT && same[0] === c) {
      out.push(issue(ctx, 'GDD05-V7-contact-count', `rights.J${c.day}.${c.moment}`, 'game-designer', `${same.length} contacts au J${c.day} dans le moment ${c.moment} : ${same.map((x) => x.right).join(', ')}`));
    }
  }
  return out;
};

/** V7 (texte) : seconde moitié plus courte ou égale, mots écartés ; FR et EN pour les mots écartés, FR pour la longueur [GDD 05 V7, R-L2]. */
export const checkRightLines: Check = (s, ctx) => RIGHT_IDS.flatMap((r) => {
  const key = `${ctx.world.id}.right.${r}`;
  const out: Issue[] = [];
  const fr = ctx.strings.fr[key];
  const parts = fr === undefined ? null : halves(fr);
  if (fr !== undefined && (parts === null || countWords(parts[1]) > countWords(parts[0]))) {
    out.push(issue(ctx, 'GDD05-V7-line-length', `rights.${r}`, 'writer', parts === null ? `la ligne ${key} n'a pas deux moitiés` : `la seconde moitié de ${key} est plus longue que la première`));
  }
  for (const lang of ['fr', 'en'] as const) out.push(...discardedIn(ctx, key, r, lang, parts?.[1]));
  return out;
});

function discardedIn(ctx: Ctx, key: string, right: string, lang: 'fr' | 'en', secondHalf: string | undefined): Issue[] {
  const text = ctx.strings[lang][key] ?? '';
  const words = (t: string): string[] => t.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  const bad = [...words(text).filter((w) => DISCARDED_WORDS.includes(w)), ...(lang === 'fr' && secondHalf !== undefined ? words(secondHalf).filter((w) => SECOND_HALF_BANNED.includes(w)) : [])];
  return bad.map((w) => issue(ctx, 'GDD05-V7-forbidden-word', `rights.${right}.${lang}.${w}`, 'writer', `« ${w} » écarté de la ligne ${key} (${lang})`));
}

/** V9 : chaque option renvoie à une bible §7 (ou §8 pour les micro-situations) ou à `neutre` [GDD 05 V9, R-C6]. */
export const checkPriceRefs: Check = (s, ctx) => optionsOf(s).filter(([, o]) => !PRICE_REF_RE.test(o.priceRef))
  .map(([c, o]) => issue(ctx, 'GDD05-V9-price-ref', `choices.${c.id}.${o.id}`, 'game-designer', `priceRef « ${o.priceRef} » de ${c.id}/${o.id} : une bible §7, §8 ou « neutre » attendue`));

/** V10 : chaque objet cliquable a une réponse écrite en FR et en EN [GDD 05 V10, R-L1]. */
export const checkClickables: Check = (s, ctx) => s.clickables.filter((c) => !textInBoth(ctx, c.responseKey))
  .map((c) => issue(ctx, 'GDD05-V10-clickable-no-response', `clickables.${c.id}`, 'writer', `l'objet ${c.id} n'a pas de réponse ${c.responseKey} en FR et EN`));

/** V11 : le calendrier des contacts de droits du monde [GDD 05 V11, F6]. */
export const checkContactCalendar: Check = (s, ctx) => {
  const want = WORLD_SPEC[ctx.world.id]?.contactCalendar;
  if (want === undefined) return [];
  const got = DAYS.map((d) => s.rights.contacts.filter((c) => c.day === d).length);
  return got.join() === want.join() ? [] : [issue(ctx, 'GDD05-V11-contact-calendar', 'rights', 'game-designer', `contacts par jour [${got.join(', ')}], [${want.join(', ')}] attendus`)];
};

/** V12 : une offre par jour au plus, et seulement les jours d'offre du monde [GDD 05 V12, GDD 04 §3.4, R-C7]. */
export const checkOfferCap: Check = (s, ctx) => {
  const spec = WORLD_SPEC[ctx.world.id];
  if (spec === undefined) return [];
  const offers = s.choices.filter((c) => c.kind === 'offer');
  return DAYS.flatMap((d) => {
    const today = offers.filter((c) => c.days.includes(d)).map((c) => c.id);
    const over = today.length > spec.offerCap || (today.length > 0 && !spec.offerDays.includes(d));
    return over ? [issue(ctx, 'GDD05-V12-offer-cap', `choices.day${d}`, 'game-designer', `J${d} offre ${today.length} offre(s) (${today.join(', ')}), plafond ${spec.offerCap} les jours ${spec.offerDays.join(', ')}`)] : [];
  });
};

/** V13 : six lignes du soir, une par axe, textes FR et EN, politique `voice` [GDD 05 V13, 3.5]. */
export const checkEveningLines: Check = (s, ctx) => {
  const out: Issue[] = [];
  const bad = (path: string, msg: string): void => { out.push(issue(ctx, 'GDD05-V13-evening-lines', `evening.${path}`, 'writer', msg)); };
  if (s.evening.lines.length !== AXES.length) bad('lines', `${s.evening.lines.length} lignes du soir, ${AXES.length} attendues`);
  for (const axis of AXES) {
    const n = s.evening.lines.filter((l) => l.axis === axis).length;
    if (n !== 1) bad(`axis.${axis}`, `l'axe ${axis} a ${n} ligne(s) du soir, une seule attendue`);
  }
  for (const l of s.evening.lines) for (const k of [l.fait, l.rien]) {
    if (!textInBoth(ctx, k)) bad(`${l.axis}.${k}`, `la ligne du soir ${k} manque en FR ou en EN`);
    else if (!hasVoicePolicy(ctx.meta, k)) bad(`${l.axis}.${k}`, `la ligne du soir ${k} n'est pas sous la politique voice`);
  }
  return out;
};

/** V14 : les clés de `gestureAxis` désignent un choix, un préfixe de choix (avant le premier point) ou `checkpoint` ; chaque choix a un axe, id exact puis préfixe [GDD 05 §3.5, R-02b.54 (b)]. */
export const checkGestureAxes: Check = (s, ctx) => {
  const out: Issue[] = [];
  const map = s.evening.gestureAxis;
  const ids = [...s.choices.map((c) => c.id), ...s.jalons.map((j) => j.id)];
  const known = new Set<string>(['checkpoint', ...ids, ...ids.map((id) => id.split('.')[0]!)]);
  for (const k of Object.keys(map)) {
    if (!known.has(k)) out.push(issue(ctx, 'GDD05-V14-gesture-axis', `evening.gestureAxis.${k}`, 'world-builder', `la clé ${k} de gestureAxis n'est ni un choix, ni un préfixe de choix, ni checkpoint`));
  }
  for (const id of ids) {
    if (map[id] === undefined && map[id.split('.')[0]!] === undefined) {
      out.push(issue(ctx, 'GDD05-V14-gesture-axis', `evening.gestureAxis.${id}`, 'world-builder', `le choix ${id} n'a aucun axe dans gestureAxis (id exact ni préfixe)`));
    }
  }
  return out;
};

function ruledPrefix(meta: StringMeta, key: string): string | undefined {
  return Object.keys(meta).filter((p) => key === p || key.startsWith(`${p}.`)).sort((a, b) => b.length - a.length)[0];
}
const hasVoicePolicy = (meta: StringMeta, key: string): boolean => {
  const p = ruledPrefix(meta, key);
  return p !== undefined && meta[p]!.policy === 'voice';
};

/** Lint : le décompte FR d'une réplique du joueur égale sa donnée `words` [lead-programmer ; plan 02b T5]. */
export const checkSayWordCounts: Check = (s, ctx) => Object.entries(s.lines.say).flatMap(([id, l]) => {
  const fr = ctx.strings.fr[l.key];
  if (fr === undefined) return [issue(ctx, 'GDD05-words-count-mismatch', `lines.say.${id}`, 'writer', `la réplique ${id} n'a pas de texte FR ${l.key}`)];
  const n = countWords(fr);
  return n === l.words ? [] : [issue(ctx, 'GDD05-words-count-mismatch', `lines.say.${id}`, 'writer', `la réplique ${id} compte ${n} mot(s) en FR, la donnée dit ${l.words}`)];
});

/** Toutes les clés de chaîne que le bloc `street` désigne, et les clés de droit [R-02b.13]. */
function streetKeys(s: StreetData, world: string): readonly string[] {
  return [
    ...optionsOf(s).flatMap(([, o]) => [o.priceLineKey, o.trace?.key ?? null]),
    ...s.micro.map((m) => m.traceKey), ...s.clickables.map((c) => c.responseKey),
    ...Object.values(s.lines.say).map((l) => l.key),
    ...Object.values(s.lines.relecture).flatMap((p) => p.map((l) => l.key)),
    ...s.evening.lines.flatMap((l) => [l.fait, l.rien]), ...s.npcs.flatMap((n) => n.lineKeys),
    ...RIGHT_IDS.map((r) => `${world}.right.${r}`),
  ].filter((k): k is string => k !== null);
}

/** V8 (couverture) : toute clé de chaîne de la rue a un préfixe déclaré dans `meta.json` [GDD 05 V8, D141]. */
export const checkKeyRules: Check = (s, ctx) => [...new Set(streetKeys(s, ctx.world.id))].sort()
  .filter((k) => ruledPrefix(ctx.meta, k) === undefined)
  .map((k) => issue(ctx, 'GDD05-V8-street-key-unruled', `keys.${k}`, 'writer', `la clé ${k} n'a aucun préfixe déclaré dans strings/meta.json`));

/** Écho : chaque clé d'écho existe dans `routineEcho.table` du moteur du monde [R-02b.41]. */
export const checkEchoKeys: Check = (s, ctx) => s.echo.filter((e) => !(e.key in ctx.world.engine.routineEcho.table))
  .map((e) => issue(ctx, 'GDD05-echo-key-unknown', `echo.${e.kind}.${e.idPrefix}`, 'world-builder', `la clé d'écho ${e.key} n'est pas dans routineEcho.table`));

const CHECKS: readonly Check[] = [
  checkAxisGrid, checkDayHasChoice, checkRefusals, checkPriceLines, checkJalonRhythm, checkGAxes, checkTraces, checkContactCount,
  checkRightLines, checkPriceRefs, checkClickables, checkContactCalendar, checkOfferCap, checkEveningLines, checkGestureAxes, checkSayWordCounts, checkKeyRules, checkEchoKeys,
];

/**
 * Agrège les contrôles de contenu de la rue sur chaque monde au statut `content`. Aucune erreur : ce sont des signaux [GDD 05 §8.2, D141 (1)].
 */
export function validateStreet(input: ContentInput): ValidationReport {
  const warnings: Issue[] = [];
  for (const world of input.worlds.filter((w) => w.status !== 'skeleton')) {
    const ctx: Ctx = { world, file: `worlds/${world.id}.json`, strings: input.strings, meta: input.meta };
    for (const check of CHECKS) warnings.push(...check(world.street, ctx));
  }
  return { errors: [], warnings };
}
