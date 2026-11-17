/**
 * Validateurs de D141 pour le bilan : B-V1, B-V2, B-V3, B-V4 à B-V7, B-V9, plus les points ouverts routés à T14 [GDD 06 §8.2 ; plan 03 T14].
 * Pour chaque règle : un test sur les données réelles (propre, ou exactement les entrées connues de la ligne de base) et un test sur une
 * entrée fabriquée qui doit échouer.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compareToBaseline, validateContent, type BaselineEntry, type ContentInput } from '../../../src/validate/content';
import { checkOthersLines, shareTextKeys, validateBilan } from '../../../src/validate/bilan';
import { checkPlayerString } from '../../../src/validate/numbers';
import { ruleFor } from '../../../src/i18n/i18n';
import { answersOf, questionNumber } from '../../../src/shared/types';
import type { OtherLife } from '../../../src/shared/types/run';
import { otherLives, remontee } from '../../../src/fastforward';
import baselineRaw from '../../fixtures/validator-baseline.json';
import { realInput, w10Raw } from '../../fixtures/data/factories';
import type { Issue } from '../../../src/shared/types/common';

const baseline: readonly BaselineEntry[] = baselineRaw;
const real = realInput();
const codes = (r: { errors: readonly Issue[]; warnings: readonly Issue[] }, c: string): Issue[] => [...r.errors, ...r.warnings].filter((i) => i.code === c);
const withStrings = (fr: Record<string, string>, en: Record<string, string> = {}): ContentInput => ({
  ...real, strings: { fr: { ...real.strings.fr, ...fr }, en: { ...real.strings.en, ...en } },
});
const withWorldBilan = (patch: (b: Record<string, unknown>) => Record<string, unknown>): ContentInput => {
  const w = real.worlds[0]!;
  return { ...real, worlds: [{ ...w, bilan: patch(w.bilan as unknown as Record<string, unknown>) } as unknown as typeof w] };
};
const realReport = validateBilan(real);

describe('B-V1 : aucun chiffre ni ordinal hors dates, années, heures, compteur', () => {
  it('test_b_v1_no_digit_outside_dates_years_hours_counter_and_n', () => {
    expect(validateContent(withStrings({ 'bilan.sheet.title': 'Ta semaine 3' })).errors.some((e) => e.path === 'bilan.sheet.title')).toBe(true);
    // une clé bilan dotée d'une règle plus faible ne contourne pas B-V1
    const weak: ContentInput = { ...withStrings({ 'bilan.sheet.title': 'Ta semaine 3' }), meta: { ...real.meta, 'bilan.sheet': { policy: 'sources' } } };
    expect(codes(validateBilan(weak), 'GDD06-BV1-number').map((i) => i.path)).toContain('bilan.sheet.title');
  });
  it('test_b_v1_never_zero_years', () => {
    expect(codes(validateBilan(withStrings({ 'bilan.curve.mark': 'Dans {n} ans, zéro an ensuite.' })), 'GDD06-BV1-zero-years').length).toBe(1);
    expect(codes(validateBilan(withStrings({ 'bilan.curve.mark': 'Dans {n} ans.' })), 'GDD06-BV1-zero-years').length).toBe(0);
  });
  it('test_b_v1_ordinal_word_is_flagged_fr_and_en', () => {
    const r = validateBilan(withStrings({ 'bilan.sheet.title': 'Troisième page' }, { 'bilan.sheet.title': 'Third page' }));
    expect(codes(r, 'GDD06-BV1-ordinal').map((i) => `${i.file}:${i.path}`)).toEqual(expect.arrayContaining(['strings/fr.json:bilan.sheet.title', 'strings/en.json:bilan.sheet.title']));
  });
  it('test_b_v1_ordinal_covers_eleventh_twentieth_thirtieth_fr', () => {
    for (const w of ['Onzième page', 'Vingtième page', 'Trentième page']) {
      expect(codes(validateBilan(withStrings({ 'bilan.sheet.title': w })), 'GDD06-BV1-ordinal').some((i) => i.path === 'bilan.sheet.title'), w).toBe(true);
    }
  });
  it('test_b_v1_only_the_cited_label_may_carry_a_number_in_the_others_line', () => {
    // Tranché team-lead 2026-11-03 (GDD 01 §9.3) : au bilan, seul `{label}` (la réponse du joueur, ses jetons nommés) porte un chiffre ;
    // libellés concernés : Q04 A (six, 1), Q20 A (trente-deux, thirty-two), Q20 C (cinq, five).
    const rule = ruleFor(real.meta, 'bilan.others.line');
    expect(checkPlayerString(real.strings.fr['bilan.others.line']!, 'fr', rule, [])).toEqual([]);
    expect(checkPlayerString('Si tu avais répondu « {label} » à « {title} », trois fois.', 'fr', rule, []).map((v) => v.token)).toEqual(['trois']);
    expect(checkPlayerString('If you had answered “{label}” to “{title}”, 3 times.', 'en', rule, []).map((v) => v.token)).toEqual(['3']);
    for (const k of ['q.Q04.A.label', 'q.Q20.A.label', 'q.Q20.C.label']) {
      for (const lang of ['fr', 'en'] as const) expect(checkPlayerString(real.strings[lang][k]!, lang, ruleFor(real.meta, k), []), `${lang} ${k}`).toEqual([]);
    }
  });
  it('test_b_v1_real_data_flags_no_ordinal_once_answer_labels_are_written', () => {
    // Les libellés provisoires en ordinaux (« Première réponse ») sont remplacés par le canon le 2026-11-03 : plus aucun ordinal.
    expect(codes(realReport, 'GDD06-BV1-ordinal')).toEqual([]);
    expect(codes(realReport, 'GDD06-BV1-number')).toEqual([]);
    expect(codes(realReport, 'GDD06-BV1-zero-years')).toEqual([]);
  });
});

describe('B-V2 : ni jauge, ni palier, ni seuil, ni équivalent, ni « N prix »', () => {
  it('test_b_v2_no_gauge_palier_threshold_equivalent_or_price_count', () => {
    for (const [text, en] of [['La jauge est basse.', 'The gauge is low.'], ['Un palier franchi.', 'A tier crossed.'], ['Le seuil est passé.', 'The threshold passed.'], ['Un équivalent payé.', 'An equivalent paid.'], ['Trois prix payés.', 'Three prices paid.'], ['L\'intégrité tient.', 'Integrity holds.']] as const) {
      const r = validateBilan(withStrings({ 'bilan.sheet.fate': text }, { 'bilan.sheet.fate': en }));
      expect(codes(r, 'GDD06-BV2-gauge-word').some((i) => i.path === 'bilan.sheet.fate'), text).toBe(true);
    }
  });
  it('test_b_v2_real_data_is_clean_and_sources_are_excluded', () => {
    expect(codes(realReport, 'GDD06-BV2-gauge-word')).toEqual([]);
    // « La jauge cachée » est l'intitulé du point 7 de SOURCES & HONESTY : exclu et nommé [GDD 06 §3.2, dernier alinéa]
    expect(real.strings.fr['sources.point.hiddenGauge.title']).toMatch(/jauge/);
  });
});

describe('B-V3 : chaque ligne de « Les autres » est un remplacement unique rejoué', () => {
  const core = real.core;
  const q = [...core.questionnaire.questions].sort((a, b) => questionNumber(a.key) - questionNumber(b.key));
  const answers = answersOf(Object.fromEntries(q.map((x) => [x.key, x.answers[1]!.key])));
  const lines = otherLives(core, answers, remontee(core, answers));
  it('test_b_v3_real_lines_pass', () => {
    expect(lines.length).toBeGreaterThan(0); // sans cela, la suite passe à vide
    expect(checkOthersLines(core, answers, lines)).toEqual([]);
    expect(codes(realReport, 'GDD06-BV3-others')).toEqual([]);
  });
  it('test_b_v3_invented_line_fails', () => {
    const fake: OtherLife = { ...(lines[0] ?? { question: q[0]!.key, answer: 'A', displayedRank: 1 }), destination: lines[0]?.destination === 'w03' ? 'w04' : 'w03' } as OtherLife;
    expect(checkOthersLines(core, answers, [fake]).map((i) => i.code)).toContain('GDD06-BV3-others');
  });
  it('test_b_v3_more_than_four_lines_or_two_lines_one_world_fails', () => {
    const l = lines[0] ?? ({ question: q[0]!.key, answer: 'A', destination: 'w03', displayedRank: 1 } as OtherLife);
    expect(checkOthersLines(core, answers, [l, l]).length).toBeGreaterThan(0);
    // cinq mondes distincts : seule la règle du nombre peut échouer ici, pas « une ligne par monde »
    const five = (['w01', 'w02', 'w03', 'w04', 'w05'] as const).map((destination, i) => ({ ...l, destination, displayedRank: i + 1 }) as OtherLife);
    const msgs = checkOthersLines(core, answers, five);
    expect(msgs.map((i) => i.path)).toContain('others.count');
    expect(msgs.some((i) => i.message.startsWith('deux lignes vers'))).toBe(false);
  });
});

describe('B-V4 : ni « sauvé », ni « mort », ni « recruté » comme verdict', () => {
  it('test_b_v4_no_verdict_words', () => {
    for (const [fr, en] of [['Tu es sauvé.', 'You are saved.'], ['Elle est morte.', 'She is dead.'], ['Tu es recruté.', 'You were recruited.']] as const) {
      const r = validateBilan(withStrings({ 'bilan.sheet.fate': fr }, { 'bilan.sheet.fate': en }));
      expect(codes(r, 'GDD06-BV4-verdict-word').map((i) => i.file).sort(), fr).toEqual(['strings/en.json', 'strings/fr.json']);
    }
    expect(codes(validateBilan(withStrings({ 'bilan.sheet.fate': 'Tu as été sauvée par la paperasse.' })), 'GDD06-BV4-verdict-word').length).toBe(1);
    expect(codes(validateBilan(withStrings({ 'bilan.sheet.fate': 'On t\'a laissé sortir.' })), 'GDD06-BV4-verdict-word').length).toBe(0);
  });
  it('test_b_v4_real_data', () => {
    expect(codes(realReport, 'GDD06-BV4-verdict-word')).toEqual([]);
  });
});

describe('B-V5 : chaque page porte intitulé et libellé, sans numéro ni lettre', () => {
  it('test_b_v5_every_page_has_title_and_label_without_number_or_letter', () => {
    expect(codes(realReport, 'GDD06-BV5-label')).toEqual([]);
    expect(codes(validateBilan(withStrings({ 'bilan.curve.title': '' })), 'GDD06-BV5-label').some((i) => i.path === 'bilan.curve.title')).toBe(true);
    expect(codes(validateBilan(withStrings({ 'bilan.rights.title': 'Page 5' })), 'GDD06-BV5-label').some((i) => i.path === 'bilan.rights.title')).toBe(true);
    expect(codes(validateBilan(withStrings({ 'q.Q04.B.label': 'B' })), 'GDD06-BV5-label').some((i) => i.path === 'q.Q04.B.label')).toBe(true);
    expect(codes(validateBilan(withStrings({ 'q.Q04.title': 'Question 4' })), 'GDD06-BV5-label').some((i) => i.path === 'q.Q04.title')).toBe(true);
  });
  it('test_b_v5_missing_en_label_fails', () => {
    const en = { ...real.strings.en }; delete en['q.Q04.B.label'];
    expect(codes(validateBilan({ ...real, strings: { fr: real.strings.fr, en } }), 'GDD06-BV5-label').some((i) => i.path === 'q.Q04.B.label')).toBe(true);
  });
});

describe('B-V6 : huit droits, deux moitiés, aucun numéro d\'article', () => {
  it('test_b_v6_eight_rights_with_two_halves_and_no_article_number', () => {
    expect(codes(realReport, 'GDD06-BV6-right')).toEqual([]);
    expect(codes(validateBilan(withStrings({ 'w10.right.move': 'Ici, tu ne sors pas.' })), 'GDD06-BV6-right').some((i) => i.path === 'w10.right.move')).toBe(true);
    expect(codes(validateBilan(withStrings({ 'w10.right.move': 'Ici, tu ne sors pas. En 2026, article 13 : toute personne circule.' })), 'GDD06-BV6-right').some((i) => i.path === 'w10.right.move')).toBe(true);
    const fr = { ...real.strings.fr }; delete fr['w10.right.work'];
    expect(codes(validateBilan({ ...real, strings: { fr, en: real.strings.en } }), 'GDD06-BV6-right').some((i) => i.path === 'w10.right.work')).toBe(true);
  });
  it('test_carrier_variable_must_be_a_world_var', () => {
    const bad = withWorldBilan((b) => ({ ...b, rights: { carriers: { ...(b['rights'] as { carriers: Record<string, unknown> }).carriers, move: { var: 'freedoom', sign: -1 } } } }));
    expect(codes(validateBilan(bad), 'GDD06-carrier-not-worldvar').map((i) => i.path)).toEqual(['bilan.rights.carriers.move.var']);
    expect(codes(realReport, 'GDD06-carrier-not-worldvar')).toEqual([]);
  });
  it('test_right_without_label_possible_is_flagged', () => {
    // un droit dont aucune réponse du questionnaire ne pousse la variable porteuse dans le sens de la perte n'aura jamais d'étiquette
    const bad = withWorldBilan((b) => ({ ...b, rights: { carriers: { ...(b['rights'] as { carriers: Record<string, unknown> }).carriers, work: { var: 'order', sign: 1 } } } }));
    const never: ContentInput = { ...bad, core: { ...bad.core, questionnaire: { ...bad.core.questionnaire, questions: bad.core.questionnaire.questions.map((qq) => ({ ...qq, answers: qq.answers.map((a) => ({ ...a, push: { ...a.push, order: 0 } })) })) } } as unknown as typeof bad.core };
    expect(codes(validateBilan(never), 'GDD06-right-no-label').map((i) => i.path)).toContain('bilan.rights.carriers.work');
  });
});

describe('B-V7 : SOURCES & HONESTY', () => {
  it('test_b_v7_sources_has_rare_line_seven_hypotheses_dudh_note_and_unreopened_canon', () => {
    expect(codes(realReport, 'GDD06-BV7-sources')).toEqual([]);
    const fr = { ...real.strings.fr }; delete fr['sources.rare.line'];
    expect(codes(validateBilan({ ...real, strings: { fr, en: real.strings.en } }), 'GDD06-BV7-sources').some((i) => i.path === 'sources.rare.line')).toBe(true);
    expect(codes(validateBilan(withStrings({ 'sources.note.dudh': 'Une note.' })), 'GDD06-BV7-sources').some((i) => i.path === 'sources.note.dudh')).toBe(true);
    expect(codes(validateBilan(withStrings({ 'sources.note.tegmark': 'Le chapitre est cité.' })), 'GDD06-BV7-sources').some((i) => i.path === 'sources.note.tegmark')).toBe(true);
    expect(codes(validateBilan(withStrings({ 'sources.rare.line': 'Les mondes rares.' })), 'GDD06-BV7-sources').some((i) => i.path === 'sources.rare.line')).toBe(true);
  });
  it('test_b_v7_seven_hypotheses_each_with_title_and_label', () => {
    const hyp = real.core.questionnaire.questions.flatMap((qq) => qq.answers.filter((a) => a.hypothesis).map((a) => [qq.key, a.key]));
    expect(hyp.length).toBe(7);
    const fr = { ...real.strings.fr }; delete fr[`q.${hyp[0]![0]}.${hyp[0]![1]}.label`];
    expect(codes(validateBilan({ ...real, strings: { fr, en: real.strings.en } }), 'GDD06-BV7-sources').length).toBeGreaterThan(0);
  });
});

describe('B-V9 : texte de l\'image partageable', () => {
  it('test_b_v9_share_image_text_keys_have_no_digit_outside_dates', () => {
    expect(codes(realReport, 'GDD06-BV9-share-text')).toEqual([]);
    const keys = shareTextKeys(real);
    expect(keys).toEqual(expect.arrayContaining(['bilan.sheet.title', 'bilan.others.line', 'bilan.others.locked', 'w10.bilan.fate.end.arrested', 'w10.day.1.date']));
    expect(keys.some((k) => k.startsWith('sources.'))).toBe(false);
    const bad = withStrings({ 'bilan.kit.state.kept': 'Gardé 12 fois' });
    expect(codes(validateBilan(bad), 'GDD06-BV9-share-text').some((i) => i.path === 'bilan.kit.state.kept')).toBe(true);
  });
  it('test_b_v9_others_text_keys_are_digit_free', () => {
    const bad = withStrings({ 'bilan.others.locked': 'Aucune des 0 vies.' });
    expect(codes(validateBilan(bad), 'GDD06-BV9-share-text').some((i) => i.path === 'bilan.others.locked')).toBe(true);
  });
});

describe('points ouverts routés à T14', () => {
  it('test_each_lived_day_without_offer_has_a_fact_key_in_fr_and_en', () => {
    const flagged = codes(realReport, 'GDD06-todo-day-fact').map((i) => `${i.file}:${i.path}`).sort();
    // j6 existe dans les deux langues ; j1 n'a aucun jalon en donnée et retombe sur la ligne du soir : constat à écrire
    expect(flagged).toEqual(['strings/en.json:w10.bilan.day.fact.j1', 'strings/fr.json:w10.bilan.day.fact.j1']);
    const fr = { ...real.strings.fr }; delete fr['w10.bilan.day.fact.j6'];
    expect(codes(validateBilan({ ...real, strings: { fr, en: real.strings.en } }), 'GDD06-todo-day-fact').map((i) => i.path)).toContain('w10.bilan.day.fact.j6');
  });
  it('test_fate_ends_cover_every_end_the_oracle_can_produce', () => {
    expect(codes(realReport, 'GDD06-fate-end-missing')).toEqual([]);
    const bad = withWorldBilan((b) => { const f = b['fate'] as { ends: Record<string, string> }; const ends = Object.fromEntries(Object.entries(f.ends).filter(([k]) => k !== 'recruited')); return { ...b, fate: { ...f, ends } }; });
    expect(codes(validateBilan(bad), 'GDD06-fate-end-missing').map((i) => i.path)).toEqual(['bilan.fate.ends.recruited']);
    const noText = withStrings({}, {}); delete (noText.strings.en as Record<string, string>)['w10.bilan.fate.end.released'];
    expect(codes(validateBilan(noText), 'GDD06-fate-end-missing').map((i) => i.path)).toContain('w10.bilan.fate.end.released');
  });
  it('test_cause_keys_with_no_printable_sentence_or_unresolved_marker_fail', () => {
    const r = realReport;
    const unprinted = codes(r, 'GDD06-cause-unprinted').map((i) => `${i.file}:${i.path}`).sort();
    const unresolved = codes(r, 'GDD06-cause-unresolved').map((i) => `${i.file}:${i.path}`).sort();
    expect(unprinted).toEqual([]);
    expect(unresolved).toEqual([]);
    // Real copy is resolved; synthetic broken copy still exercises both validator signals.
    const bad = withStrings({ 'cause.w07.1.Q05B': '{x} montent.' }, { 'cause.w07.1.Q05B': 'Counts rise {n}.' });
    expect(codes(validateBilan(bad), 'GDD06-cause-unprinted').map((i) => i.path)).toContain('cause.w07.1.Q05B');
    expect(codes(validateBilan(withStrings({ 'cause.w07.1.Q05B': 'Rien ne dit encore. Ensuite {n} salles.' })), 'GDD06-cause-unresolved').map((i) => i.path)).toContain('cause.w07.1.Q05B');
    expect(codes(validateBilan(withStrings({ 'cause.w07.1.Q05B': 'Rien ne dit encore. Ensuite {n} salles.' })), 'GDD06-cause-unprinted').map((i) => i.path)).not.toContain('cause.w07.1.Q05B');
  });
  it('test_zero_flagged_key_exists_and_uses_no_numeric_param', () => {
    const key = (w10Raw['bilan'] as { dossier: { noneFlaggedKey: string } }).dossier.noneFlaggedKey;
    for (const lang of ['fr', 'en'] as const) {
      expect(real.strings[lang][key], `${lang}:${key}`).toBeTruthy();
      expect(real.strings[lang][key]).not.toMatch(/\{[A-Za-z0-9_]+\}/);
    }
    expect(codes(validateBilan(withStrings({ [key]: '{n} lignes.' })), 'GDD06-zero-flagged').length).toBe(1);
    const fr = { ...real.strings.fr }; delete fr[key];
    expect(codes(validateBilan({ ...real, strings: { fr, en: real.strings.en } }), 'GDD06-zero-flagged').length).toBe(1);
  });
  it('test_w10_json_only_bilan_key_changed', () => {
    // rue guidée T5 : `street.guided` (journées guidées J1-J2) est un bloc neuf, hors du hachage ; les 32 choix sont épinglés par guided_w10_test.
    const raw = w10Raw as Record<string, unknown>;
    const street = Object.fromEntries(Object.entries(raw['street'] as Record<string, unknown>).filter(([k]) => k !== 'guided'));
    const rest = Object.fromEntries(Object.entries({ ...raw, street }).filter(([k]) => k !== 'bilan'));
    const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon) : v !== null && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
    const hash = createHash('sha256').update(JSON.stringify(canon(rest))).digest('hex');
    // Base 472df3e (b5c7aede…). Depuis, deux décisions GD seulement, vérifiées par diff champ à champ (43 écarts, hors `bilan`) :
    //  - design/ui/2026-11-02-ligne-prix-manquante-gd.md : 39 `priceLineKey` ;
    //  - design/ui/2026-11-02-porte-midi-refus-gd.md : `door.noon.refuse` (entries absentRegistre, priceRef §7.3, neutral false, trace absent) ;
    //  - design/gdd/2026-11-03-playtest-enjeu-onboarding.md §3 A : `street.clock.msPerHour` 10 000 -> 12 000 (borne haute du design §4.4), seul écart.
    //  - décision team-lead 2026-11-03 (bible §7.4 « 1 à 2 h ») : `street.checkpoint.minutes.bypass` 90, champ neuf, seul écart.
    //  - rue guidée T10 (conception §2.4) : `street.lines.relecture.4`, les deux lignes du J4 inversées (neutre pour la jauge, bible §8.2 bis), seul écart ;
    //    vérifié : les deux lignes remises dans l'ordre redonnent 7042f996…
    //  - B1b ruling F2 : `street.npcs[nadia].stock` 40, champ neuf, seul écart (6a8013ba -> 7848b9bd, vérifié par diff).
    //  - ruling game-designer nuit 6 v3 (I-3 de T12, docs/superpowers/plans/reviews/2026-11-07-nuit6-falaise.md) : seul écart haché,
    //    `survival.words.sleep.maxRemaining` 20 -> [20, 20, 20, 20, 20, 26] (7848b9bd -> 90ab2286 ; vérifié N9 fix 1 : maxRemaining remis à 20
    //    redonne 7848b9bd). Les deux autres valeurs du ruling (j6.marlene talk 26 -> 21, speechModes.6.bavard 50 -> 49, puis 50 en N9) sont
    //    sous `street.guided`, exclu du hachage.
    expect(hash).toBe('90ab2286f290031b1ca812467d48fb63b59f8e961dcd21c5ee0c8ee339b334be');
  });
});

describe('ligne de base', () => {
  it('test_baseline_entry_requires_owner_date_reason', () => {
    const mine = baseline.filter((e) => e.code.startsWith('GDD06-'));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((e) => e.owner.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.reason.trim().length > 10)).toBe(true);
  });
  it('test_untracked_warning_is_failure_in_ci', () => {
    const r = validateContent(withStrings({ 'bilan.sheet.title': 'Troisième page' }, { 'bilan.sheet.title': 'Third page' }));
    const { added } = compareToBaseline(r, baseline);
    expect(added.some((i) => i.code === 'GDD06-BV1-ordinal' && i.path === 'bilan.sheet.title')).toBe(true);
  });
  it('test_real_data_signals_are_exactly_the_baseline', () => {
    const r = validateContent(real);
    expect(r.errors).toEqual([]);
    const { added, stale } = compareToBaseline(r, baseline);
    expect(added).toEqual([]); expect(stale).toEqual([]);
  });
});
