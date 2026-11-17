import { describe, expect, it } from 'vitest';
import { assertContent } from '../../../src/data/load';
import { RIGHT_IDS } from '../../../src/shared/types/street';
import type { StreetData } from '../../../src/data/schema/street';
import { checkPlayerString } from '../../../src/validate/numbers';
import { compareToBaseline, validateContent, type BaselineEntry, type ContentInput } from '../../../src/validate/content';
import { validateStreet } from '../../../src/validate/street';
import baselineRaw from '../../fixtures/validator-baseline.json';
import { realInput } from '../../fixtures/data/factories';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const baseline: readonly BaselineEntry[] = baselineRaw;
const W = realInput().worlds[0]!;
const FR = realInput().strings.fr;

/** Entrée réelle dont le bloc `street` est cloné puis modifié par `mut`. */
function inputWith(mut: (s: Mutable<StreetData>) => void): ContentInput {
  const base = realInput();
  const street = structuredClone(base.worlds[0]!.street) as Mutable<StreetData>;
  mut(street);
  return { ...base, worlds: [{ ...base.worlds[0]!, street: street as StreetData }] };
}
const warn = (mut: (s: Mutable<StreetData>) => void): string[] => validateStreet(inputWith(mut)).warnings.map((i) => i.code);
function validateWithFr(over: Record<string, string>): ReturnType<typeof validateStreet> {
  const base = realInput();
  return validateStreet({ ...base, strings: { ...base.strings, fr: { ...base.strings.fr, ...over } } });
}
function validateWithEn(over: Record<string, string>): string[] {
  const base = realInput();
  return validateStreet({ ...base, strings: { ...base.strings, en: { ...base.strings.en, ...over } } }).warnings.map((i) => i.code);
}
function withoutEn(keys: readonly string[]): string[] {
  const base = realInput();
  const en = Object.fromEntries(Object.entries(base.strings.en).filter(([k]) => !keys.includes(k)));
  return validateStreet({ ...base, strings: { ...base.strings, en } }).warnings.map((i) => i.code);
}
const choice = (s: Mutable<StreetData>, id: string) => s.choices.find((c) => c.id === id)!;

describe('moments validate (V1 à V14)', () => {
  it('test_shipped_w10_has_only_baselined_street_warnings', () => {
    const r = validateContent(realInput());
    const c = compareToBaseline(r, baseline);
    expect(c.added.filter((i) => i.code.startsWith('GDD05-'))).toEqual([]);
    expect(c.stale.filter((e) => e.code.startsWith('GDD05-'))).toEqual([]);
    expect(r.errors).toEqual([]);
    console.info(`baseline GDD05 : ${baseline.filter((e) => e.code.startsWith('GDD05-')).length} entrées`);
  });
  it('test_baseline_entries_of_this_plan_are_owned_dated_and_reasoned', () => {
    for (const e of baseline.filter((x) => x.code.startsWith('GDD05-'))) {
      expect(e.owner).not.toBe(''); expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(e.reason.length).toBeGreaterThan(0);
    }
  });
  it('test_v1_missing_cell', () => { expect(warn((s) => { s.axes.pop(); })).toContain('GDD05-V1-axis-cell'); });
  it('test_v1_d_cell_without_owner', () => { expect(warn((s) => { s.axes.find((c) => c.type === 'D')!.owner = ''; })).toContain('GDD05-V1-axis-cell'); });
  it('test_v1_e_cell_needs_the_declared_exception_day', () => {
    expect(warn((s) => { s.axes.find((c) => c.day === 7 && c.axis === 'ia')!.type = 'E'; })).not.toContain('GDD05-V1-axis-cell');
    expect(warn((s) => { s.axes.find((c) => c.day === 7 && c.axis === 'ia')!.type = 'E'; s.exceptionJour = null; })).toContain('GDD05-V1-axis-cell');
  });
  it('test_v2_day_without_choice', () => { expect(warn((s) => { s.choices = s.choices.filter((c) => !c.days.includes(6)); })).toContain('GDD05-V2-day-without-choice'); });
  it('test_v3_no_refusal', () => { expect(warn((s) => { s.choices[0]!.options.forEach((o) => { o.isRefusal = false; }); })).toContain('GDD05-V3-no-refusal'); });
  it('test_v3_refusal_no_price', () => { expect(warn((s) => { choice(s, 'j4.neighbour').options.find((o) => o.isRefusal)!.priceRef = ''; })).toContain('GDD05-V3-refusal-no-price'); });
  it('test_v3b_option_line_missing', () => {
    // une clé non nulle sans texte se voit ; une clé nulle est permise par construction (la spec n'écrit pas toujours la ligne)
    expect(warn((s) => { choice(s, 'j4.neighbour').options[0]!.priceLineKey = 'w10.price.ghost'; })).toContain('GDD05-V3b-option-line-missing');
    expect(warn((s) => { choice(s, 'j4.neighbour').options[0]!.priceLineKey = null; })).not.toContain('GDD05-V3b-option-line-missing');
  });
  it('test_v4_gap_of_3', () => { expect(warn((s) => { s.jalons = s.jalons.filter((j) => j.day !== 3 && j.day !== 4); })).toContain('GDD05-V4-milestone-gap'); });
  it('test_v4_w10_free_day_exception_is_declared', () => {
    expect(warn(() => {})).not.toContain('GDD05-V4-no-free-day');
    expect(warn((s) => { s.exceptionJourLibre = null; })).toContain('GDD05-V4-no-free-day');
  });
  it('test_v4_a_real_free_day_replaces_the_exception', () => {
    // J3 : Registre fermé ; sans jalon ni checkpoint il est libre
    const free = (s: Mutable<StreetData>): void => {
      s.exceptionJourLibre = null; s.jalons = s.jalons.filter((j) => j.day !== 3); s.choices = s.choices.filter((c) => c.id !== 'checkpoint.j3');
    };
    expect(warn(free)).not.toContain('GDD05-V4-no-free-day');
  });
  it('test_v5_below_3_except_declared_j7', () => {
    expect(warn(() => {})).not.toContain('GDD05-V5-axes-below-3');
    expect(warn((s) => { s.axes.find((c) => c.day === 4 && c.type === 'G')!.type = 'V'; })).toContain('GDD05-V5-axes-below-3');
    expect(warn((s) => { s.exceptionJour = null; })).toContain('GDD05-V5-axes-below-3');
  });
  it('test_v6_micro_traces', () => { expect(warn((s) => { s.micro = s.micro.slice(0, 2); })).toContain('GDD05-V6-micro-traces'); });
  it('test_v6_trace_late', () => { expect(warn((s) => { choice(s, 'j4.neighbour').options[0]!.trace = { key: 'w10.trace.late', day: 6 }; })).toContain('GDD05-V6-trace-late'); });
  it('test_v6_trace_missing_on_a_non_neutral_option', () => { expect(warn((s) => { choice(s, 'j5.bruno').options.find((o) => o.id === 'name')!.trace = null; })).toContain('GDD05-V6-trace-missing'); });
  it('test_v7_contact_count', () => { expect(warn((s) => { s.rights.contacts[1]!.moment = 'lever'; s.rights.contacts[1]!.day = 1; })).toContain('GDD05-V7-contact-count'); });
  it('test_v7_one_contact_per_right', () => { expect(warn((s) => { s.rights.contacts.pop(); })).toContain('GDD05-V7-contact-count'); });
  it('test_v7_line_length', () => {
    expect(validateWithFr({ 'w10.right.move': "Ici, court. En 2026, c'est écrit : une phrase bien trop longue pour la première moitié." }).warnings.map((i) => i.code)).toContain('GDD05-V7-line-length');
  });
  it('test_v7_forbidden_word', () => {
    expect(validateWithFr({ 'w10.right.move': "Ici, tu te déplaces. En 2026, c'est écrit : un mot interdit ici, interactif." }).warnings.map((i) => i.code)).toContain('GDD05-V7-forbidden-word');
  });
  it('test_v7_second_half_banned_word', () => {
    expect(validateWithFr({ 'w10.right.move': "Ici, tu ne sors pas du secteur sans permis tamponné. En 2026, c'est écrit : mais libre." }).warnings.map((i) => i.code)).toContain('GDD05-V7-forbidden-word');
  });
  it('test_v9_unknown_price_ref', () => { expect(warn((s) => { s.choices[0]!.options[0]!.priceRef = 'ailleurs §9'; })).toContain('GDD05-V9-price-ref'); });
  it('test_v9_accepts_section_8_references', () => { expect(warn((s) => { s.choices[0]!.options[0]!.priceRef = '§8.2'; })).not.toContain('GDD05-V9-price-ref'); });
  it('test_v10_clickable_without_text', () => { expect(warn((s) => { s.clickables.push({ id: 'ghost', responseKey: 'w10.object.ghost' }); })).toContain('GDD05-V10-clickable-no-response'); });
  it('test_v11_calendar_is_3_1_2_1_0_1_0', () => {
    expect(warn(() => {})).not.toContain('GDD05-V11-contact-calendar');
    expect(warn((s) => { s.rights.contacts[0]!.day = 5; })).toContain('GDD05-V11-contact-calendar');
  });
  it('test_v12_second_offer_on_a_day', () => { expect(warn((s) => { choice(s, 'j3.marlene').days = [2]; choice(s, 'j3.marlene').day = 2; })).toContain('GDD05-V12-offer-cap'); });
  it('test_v12_offer_outside_the_offer_days', () => { expect(warn((s) => { choice(s, 'j5.bruno').days = [6]; choice(s, 'j5.bruno').day = 6; })).toContain('GDD05-V12-offer-cap'); });
  it('test_v13_evening_needs_six_lines', () => { expect(warn((s) => { s.evening.lines.pop(); })).toContain('GDD05-V13-evening-lines'); });
  it('test_v13_evening_line_needs_its_text', () => { expect(warn((s) => { s.evening.lines[0]!.fait = 'w10.evening.ghost'; })).toContain('GDD05-V13-evening-lines'); });
  it('test_v3b_text_missing_in_en_only', () => {
    const key = choice(inputWith(() => {}).worlds[0]!.street as Mutable<StreetData>, 'j4.neighbour').options.find((o) => o.id === 'silent')!.priceLineKey!;
    expect(FR[key]).toBeTruthy();
    expect(withoutEn([key])).toContain('GDD05-V3b-option-line-missing');
  });
  it('test_v10_response_missing_in_en_only', () => {
    expect(FR['w10.object.wall']).toBeTruthy();
    expect(withoutEn(['w10.object.wall'])).toContain('GDD05-V10-clickable-no-response');
  });
  it('test_v13_duplicate_and_missing_axis_are_named', () => {
    const r = validateStreet(inputWith((s) => { s.evening.lines[5]!.axis = 'vie'; }));
    const paths = r.warnings.filter((i) => i.code === 'GDD05-V13-evening-lines').map((i) => i.path);
    expect(paths).toContain('street.evening.axis.vie');
    expect(paths).toContain('street.evening.axis.ia');
  });
  it('test_v14_gesture_axis_key_that_names_no_choice', () => {
    const r = validateStreet(inputWith((s) => { (s.evening.gestureAxis as Record<string, string>)['ghost.choice'] = 'vie'; }));
    expect(r.warnings.filter((i) => i.code === 'GDD05-V14-gesture-axis').map((i) => i.path)).toContain('street.evening.gestureAxis.ghost.choice');
  });
  it('test_v14_choice_without_an_axis', () => {
    const r = validateStreet(inputWith((s) => { delete (s.evening.gestureAxis as Record<string, string>)['j1.phone']; }));
    expect(r.warnings.filter((i) => i.code === 'GDD05-V14-gesture-axis').map((i) => i.path)).toContain('street.evening.gestureAxis.j1.phone');
  });
  it('test_v14_prefix_and_checkpoint_keys_resolve', () => {
    const r = validateStreet(inputWith((s) => { (s.evening.gestureAxis as Record<string, string>)['m3'] = 'vie'; }));
    expect(r.warnings.filter((i) => i.path === 'street.evening.gestureAxis.m3')).toHaveLength(0);   // préfixe d'un choix (m3.letter)
  });
  it('test_v13_line_under_a_non_voice_prefix', () => {
    expect(warn((s) => { s.evening.lines[0]!.fait = 'w10.card.nadia'; })).toContain('GDD05-V13-evening-lines');
  });
  it('test_v4_a_dated_jalon_on_j3_keeps_it_from_being_free', () => {
    expect(warn((s) => { s.exceptionJourLibre = null; s.choices = s.choices.filter((c) => c.id !== 'checkpoint.j3'); })).toContain('GDD05-V4-no-free-day');
  });
  it('test_v4_checkpoint_that_blocks_exit_prevents_a_free_day', () => {
    const f = (block: boolean) => (s: Mutable<StreetData>): void => {
      s.exceptionJourLibre = null; s.jalons = s.jalons.filter((j) => j.day !== 3); choice(s, 'checkpoint.j3').blocksExit = block;
    };
    expect(warn(f(true))).toContain('GDD05-V4-no-free-day');
    expect(warn(f(false))).not.toContain('GDD05-V4-no-free-day');
  });
  it('test_v7_discarded_words_in_en', () => {
    expect(validateWithEn({ 'w10.right.move': 'Here, you do not leave. In 2026, it is written: immersive.' })).toContain('GDD05-V7-forbidden-word');
  });
  it('test_v11_v12_return_nothing_for_a_world_without_spec', () => {
    const base = inputWith((s) => { s.rights.contacts[0]!.day = 5; choice(s, 'j3.marlene').days = [2]; choice(s, 'j3.marlene').day = 2; });
    const r = validateStreet({ ...base, worlds: [{ ...base.worlds[0]!, id: 'w99' as never }] });
    expect(r.warnings.map((i) => i.code)).not.toContain('GDD05-V11-contact-calendar');
    expect(r.warnings.map((i) => i.code)).not.toContain('GDD05-V12-offer-cap');
  });
  it('test_words_count_lint_signals_a_mismatch_in_fr', () => { expect(validateWithFr({ 'w10.line.filler.1': 'un deux trois' }).warnings.map((i) => i.code)).toContain('GDD05-words-count-mismatch'); });
  it('test_every_street_string_key_has_a_declared_prefix', () => {
    expect(validateStreet(realInput()).warnings.map((i) => i.code)).not.toContain('GDD05-V8-street-key-unruled');
    const base = realInput();
    const meta = Object.fromEntries(Object.entries(base.meta).filter(([p]) => p !== 'w10.street'));
    expect(validateStreet({ ...base, meta }).warnings.map((i) => i.code)).toContain('GDD05-V8-street-key-unruled');
  });
  it('test_echo_key_must_exist_in_the_routine_echo_table', () => {
    expect(warn(() => {})).not.toContain('GDD05-echo-key-unknown');
    expect(warn((s) => { s.echo.push({ kind: 'use', idPrefix: 'x', key: 'noSuchKey' }); })).toContain('GDD05-echo-key-unknown');
  });
  it('test_a_skeleton_world_is_not_checked', () => {
    const base = inputWith((s) => { s.axes = []; });
    expect(validateStreet({ ...base, worlds: [{ ...base.worlds[0]!, status: 'skeleton' }] }).warnings).toEqual([]);
  });
  it('test_d141_witnesses_the_lines_pass_without_baseline', () => {
    for (const r of RIGHT_IDS) expect(checkPlayerString(FR[`w10.right.${r}`]!, 'fr', { policy: 'voice' }, W.forbiddenWords)).toEqual([]);
    expect(checkPlayerString("L'agent passe à 10 h. Le composant reste sur la table.", 'fr', { policy: 'voice' }, W.forbiddenWords)).toEqual([]);
    expect(checkPlayerString('vingt mots restants', 'fr', { policy: 'voice' }, []).map((v) => v.token)).toEqual(['vingt']);
  });
  it('test_w10_is_content_and_assert_content_passes', () => { expect(() => assertContent(W, 'worlds/w10.json')).not.toThrow(); expect(W.status).toBe('content'); });
});
