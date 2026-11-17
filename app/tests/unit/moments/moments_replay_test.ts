/**
 * `reduceAct`, fin de nuit, rejeu [plan 02b T10 ; GDD 05 §3.4 ; R-02b.26 à R-02b.30, R-02b.47, R-02b.49, R-02b.52].
 * Un seul chemin d'un acte vers l'état : le direct et le rejeu passent par `reduceAct`.
 */
import { describe, expect, it, vi } from 'vitest';
import { advance } from '../../../src/engine/moments/clock';
import { availableOptions, confirm, designate } from '../../../src/engine/moments/choices';
import { replay } from '../../../src/engine/moments/replay';
import { BONS_PER_WORD, createStreet, ledgerOf as ledgerOfState, reduceAct, toDayState, type ReduceResult } from '../../../src/engine/moments/state';
import { closeNight, startSurvival } from '../../../src/survival/integrity';
import type { IntegrityConfig } from '../../../src/data/schema/world';
import * as week from '../../../src/engine/week';
import { gateStatuses, startWeek, weekCalendar, type CalendarHook } from '../../../src/engine/week';
import { CLOSING_MINUTE, MORNING_MINUTE } from '../../../src/shared/types/street';
import { canonicalJson } from '../../../src/shared/canonical';
import { expectSameTwice } from '../../support/determinism';
import { actsOfProfile } from '../../support/profile_acts';
import {
  act, at, canon, ctxW10, diceStub, endIdOf, homeAt, isRejected, passedAt, reduceAt, reduceOk, SCRIPT_J1_J2, SCRIPT_J1_PREFIX, SEVEN_DAYS_SLEEP_ONLY,
  sleepEachDay, streetAt, TO_J7_EVENING, week0, withKit, withPalier, withStreet,
} from '../../support/street';

// Espion sur `stepWeek` : l'horloge passée à chaque crochet n'est visible que là [R-02b.26].
vi.mock('../../../src/engine/week', async (orig) => {
  const m = await orig<typeof import('../../../src/engine/week')>();
  return { ...m, stepWeek: vi.fn(m.stepWeek) };
});

const ctx = ctxW10();
const S = ctx.street;
const gateClosed = (r: ReturnType<typeof replay>): boolean => gateStatuses(r.week.ws, ctx.world).find((g) => g.id === 'vault-checkpoint')!.closed;
const ok = (r: ReduceResult) => { if (isRejected(r)) throw new Error(r.reason); return r.state; };
const streetNow = () => ({ ...homeAt(1, 420), location: 'street' as const, flags: { left: true } });
/** Gel profond : toute écriture dans une entrée lève (modules ES, mode strict). */
function deepFreeze<T>(x: T): T {
  if (typeof x === 'object' && x !== null && !Object.isFrozen(x)) { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); }
  return x;
}
const choiceOf = (id: string, options: readonly (readonly [string, boolean])[]) =>
  ({ id, kind: 'gesture' as const, day: null, days: [1 as const], blocksExit: false, options: options.map(([o, r]) => ({ id: o, isRefusal: r, priceRef: `w10.price.${id}.${o}`, priceLineKey: null, words: 0, trace: null, neutral: false })) });
const hookName = (h: CalendarHook): string => (h.kind === 'closing' ? 'closing' : `${h.kind}${h.day}`);

describe('reduceAct, fin de nuit et rejeu', () => {
  it('test_replay_twice_same_state', () => { const a = expectSameTwice(() => replay(SCRIPT_J1_J2, ctx)); expect(a.rejected).toEqual([]); });
  it('test_replay_equals_live_reduction', () => {
    let s = createStreet(ctx), w = startWeek(ctx.run, ctx.world, ctx.core);
    for (const a of SCRIPT_J1_J2) { const r = reduceAct(s, w, a, ctx); if ('reason' in r) throw new Error(r.reason); s = r.state; w = r.week; }
    expect(canonicalJson(replay(SCRIPT_J1_J2, ctx).state)).toBe(canonicalJson(s));
  });
  it('test_replay_rejects_without_throwing', () => {
    // L'acte « en arrière » est à 425 : au moins 420 (sinon `invalidAct`) et avant 430, minute du dernier acte du préfixe [R-02b.29].
    const bad = [act(1, 500, 'ghost', 'x'), act(1, 500, 'choice', 'nope', 'a'), act(1, 425, 'enter', 'registre'), act(2, 430, 'exit', 'home')];
    const r = replay([...SCRIPT_J1_PREFIX, ...bad], ctx);
    expect(r.rejected.map((x) => x.reason)).toEqual(['unknownKind', 'unknownChoice', 'outOfOrder', 'dayGap']);
    expect(r.state).toEqual(replay(SCRIPT_J1_PREFIX, ctx).state);
  });
  it('test_reduce_never_mutates_its_input', () => {                                 // état et semaine gelés en profondeur, script entier
    let s = deepFreeze(createStreet(ctx)), w = deepFreeze(startWeek(ctx.run, ctx.world, ctx.core));
    for (const a of SCRIPT_J1_J2) { const r = reduceAct(s, w, a, ctx); if (isRejected(r)) throw new Error(r.reason); s = deepFreeze(r.state); w = deepFreeze(r.week); }
    expect(s.day).toBe(2);
  });
  it('test_hooks_follow_week_calendar', () => {
    const calls: string[] = []; const ctx2 = { ...ctx, onHook: (h: CalendarHook) => { calls.push(hookName(h)); } };
    const r = replay(SEVEN_DAYS_SLEEP_ONLY, ctx2);
    expect(r.rejected).toEqual([]);
    expect(calls).toEqual(weekCalendar().map(hookName));                            // nightEnd1, morning2, nightEnd2, … nightEnd7, closing
  });
  it('test_phone_each_day_closes_the_gate_by_j3', () => {                           // [GDD 03 §5.7, rejoué par le plan 01 T11 : un téléphone par jour ferme la porte au J3]
    expect(gateClosed(replay(sleepEachDay([1, 2], { phone: true }), ctx))).toBe(true);
  });
  const echoAfterJ1 = (phone: number, relecture: boolean) => replay(sleepEachDay([1], { phone, relecture }), ctx).week.lastAppliedEcho;
  it('test_two_phones_close_the_gate_by_j2_alone', () => {
    const r = replay(sleepEachDay([1], { phone: 2 }), ctx); expect(r.rejected).toEqual([]); expect(gateClosed(r)).toBe(true);
  });   // écho 0,4 x 2 = 0,8 ; surveillance 95,3 + 0,8 = 96,1 > 96 ; un seul téléphone ferait 95,7 (95,3 + 0,4), pas assez [GDD 03 l. 200 ; R-02b.29]
  it('test_relecture_adds_its_own_echo_and_one_phone_plus_it_stays_open', () => {
    const solo = echoAfterJ1(1, false), both = echoAfterJ1(1, true);
    expect(both.surveillance! - solo.surveillance!).toBe(ctx.world.engine.routineEcho.table['workTech']!.surveillance);   // +0,3 poussé par le choix
    const r = replay(sleepEachDay([1], { phone: 1, relecture: true }), ctx);
    expect(r.rejected).toEqual([]); expect(gateClosed(r)).toBe(false);              // 95,3 + 0,4 + 0,3 = 96,0, la porte est stricte
  });
  it('test_no_echo_gate_open_at_j3', () => { expect(gateClosed(replay(sleepEachDay([1, 2], {}), ctx))).toBe(false); });   // fermée au J5 sans écho
  it('test_sleep_blocked_on_j7_until_audition', () => {
    expect(replay([...TO_J7_EVENING, act(7, 1100, 'sleep', 'night')], ctx).rejected.map((x) => x.reason)).toEqual(['auditionPending']);
  });
  it('test_to_day_state_has_the_day_state_keys', () => {
    const r = replay(SCRIPT_J1_J2, ctx);
    expect(Object.keys(toDayState(r.state, r.week, ctx)).sort()).toEqual(['clock', 'ended', 'gates', 'kit', 'ledger', 'mode', 'moment', 'readings', 'rightsMet', 'survival', 'ws']);
  });
  it('test_reduce_accepts_the_confirm_act_on_a_designated_state', () => {           // point 5 du plan 02a
    const des = designate(homeAt(1, 420), ctx, 'j1.phone', 'take').state; const a = confirm(des, ctx, at(1, 420)).act!;
    const fromDes = reduceAct(des, week0, a, ctx); const fromIdle = reduceAct(homeAt(1, 420), week0, a, ctx);
    expect(ok(fromDes).confirmed['1.j1.phone']).toBe('take'); expect(ok(fromDes).phase).toBe('idle');
    expect(canon(ok(fromDes))).toBe(canon(ok(fromIdle)));
  });
  it('test_reduce_accepts_the_act_of_a_confirmed_state_and_matches_the_idle_reduction', () => {   // R-02b.65 : confirm ne touche pas l'historique
    const des = designate(homeAt(1, 420), ctx, 'j1.phone', 'take').state; const c = confirm(des, ctx, at(1, 420));
    const r = reduceAct(c.state, week0, c.act!, ctx);
    expect(isRejected(r)).toBe(false);
    expect(canonicalJson(ok(r))).toBe(canonicalJson(ok(reduceAct(homeAt(1, 420), week0, c.act!, ctx))));
  });
  it('test_a_choice_is_open_only_on_its_listed_days', () => {                          // R-02b.64 : `days` fait foi, pas `day`
    expect(reduceAt(2, act(2, 420, 'choice', 'm4.list', 'read'))).toMatchObject({ reason: 'unknownChoice' });
    expect(reduceAt(6, act(6, 420, 'choice', 'm2.nadia', 'buy'))).toMatchObject({ reason: 'unknownChoice' });
    for (const [d, id] of [[1, 'm4.list'], [3, 'm2.nadia']] as const) {
      const r = reduceAt(d, act(d, 420, 'choice', id, S.choices.find((c) => c.id === id)!.options[0]!.id));
      expect(isRejected(r) ? r.reason : 'ok', `${id} J${d}`).toBe('ok');
    }
  });
  describe('guide de Yusuf [R-02b.66]', () => {
    const bypassAt = (s: ReturnType<typeof homeAt>, r: number) => reduceOk(s, act(s.day, 600, 'lane', 'checkpoint', 'bypass'), ctxW10(S, diceStub([r])));
    const exchanged = () => ({ ...reduceOk(homeAt(1, 420), act(1, 420, 'choice', 'm5.yusuf', 'exchange')), location: 'street' as const });
    const nacelles = (s: ReturnType<typeof homeAt>) => s.dayExtra.entries.filter((e) => e.source === 'bypassNacelle');
    it('test_exchange_sets_the_guide_only_when_the_component_changes_hands', () => {
      expect(exchanged().flags.guide).toBe(true);
      expect(reduceOk(homeAt(1, 420), act(1, 420, 'choice', 'm5.yusuf', 'talk')).flags.guide).toBeUndefined();
      expect(reduceOk(withKit(homeAt(1, 420), { component: 'left' }), act(1, 420, 'choice', 'm5.yusuf', 'exchange')).flags.guide).toBeUndefined();
    });
    it('test_guide_makes_the_bypass_free_where_the_normal_draw_gives_a_nacelle', () => {
      expect(nacelles(bypassAt(exchanged(), 0.5))).toHaveLength(0);                   // guide [7,1] : 0.5 est libre
      expect(nacelles(bypassAt(exchanged(), 0.874))).toHaveLength(0);
      expect(nacelles(bypassAt({ ...homeAt(1, 420), location: 'street' }, 0.5))).toHaveLength(1);   // sans échange : [1,2,1], 0.5 est nacelle
    });
    it('test_guide_is_spent_by_the_first_bypass', () => {
      const after = bypassAt(exchanged(), 0.5);
      expect(after.flags.guide).toBeUndefined();
      const next = { ...streetAt(2, 600), flags: { ...streetAt(2, 600).flags, ...after.flags } };
      expect(nacelles(bypassAt(next, 0.5))).toHaveLength(1);                          // tirage ordinaire au second passage
    });
  });
  it('test_acts_after_ended_are_rejected', () => {                                    // Muet arrêté à la nuit 5
    const r = replay(actsOfProfile('Muet', {}), ctx); expect(r.state.ended).not.toBeNull();
    expect(reduceAct(r.state, r.week, act(6, 430, 'exit', 'home'), ctx)).toMatchObject({ reason: 'ended' });
  });
  it('test_reload_loses_the_minutes_waited_after_the_last_act', () => {             // décision team-lead 2026-11-01 ; la sauvegarde ne garde que des actes
    const acts = [act(1, 430, 'exit', 'home'), act(1, 545, 'glance', 'n16')];
    const live = advance(replay(acts, ctx).state, 6000, 'wait', S);                // 6 s réelles d'attente = 30 minutes de jeu à 12 s/h, jamais écrites
    expect(live.clock.minute).toBe(575); expect(replay(acts, ctx).state.clock).toEqual({ day: 1, minute: 545 }); expect(replay(acts, ctx).state.carry).toBe(0);
  });

  // --- ajouts de T10 : règles du brief qu'aucun des treize tests ne tient ----------------------------------------------------
  it('test_nadia_closed_from_j6', () => {                                            // R-02b.19, R-02b.30 : la règle lit `npcs.nadia.days`
    expect(reduceAt(6, act(6, 500, 'buyWords', 'nadia', '5'))).toMatchObject({ reason: 'stallClosed' });
    expect(isRejected(reduceAt(5, act(5, 500, 'buyWords', 'nadia', '5')))).toBe(false);
  });
  it('test_arrest_at_night_d_keeps_the_night_and_drops_the_morning', () => {        // R-02b.28 : nightEnd 5 oui, morning 6 non
    const calls: string[] = []; const r = replay(actsOfProfile('Muet', {}), { ...ctx, onHook: (h) => { calls.push(hookName(h)); } });
    expect(calls.at(-1)).toBe('nightEnd5'); expect(calls).not.toContain('morning6');
    expect([r.state.readings.length, r.week.curve.length, r.week.stepsDone]).toEqual([5, 5, 4]);
    expect(endIdOf(r.state)).toBe('arrested:5'); expect(r.rejected).toEqual([]);
  });
  it('test_audition_sets_the_end_and_plays_night_7', () => {                          // R-02b.27
    const calls: string[] = []; const r = replay(SEVEN_DAYS_SLEEP_ONLY, { ...ctx, onHook: (h) => { calls.push(hookName(h)); } });
    expect(r.state.ended).toMatchObject({ endId: 'released' }); expect(endIdOf(r.state)).toBe('released'); expect(r.state.readings).toHaveLength(7);
    expect(r.state.readings[6]!.value).toBe(r.state.readings[5]!.value);              // la nuit 7 est sans effet sur la jauge
    expect(calls.slice(-2)).toEqual(['nightEnd7', 'closing']); expect(r.week.stepsDone).toBe(7);
  });
  it('test_exit_is_blocked_until_the_j2_door_choice', () => {                        // D138
    const s = homeAt(2, 420);
    expect(reduceAct(s, week0, act(2, 430, 'exit', 'home'), ctx)).toMatchObject({ reason: 'exitBlocked' });
  });
  it('test_registre_closed_on_a_closed_day', () => {                                 // R-02b.47
    const s = { ...homeAt(3, 420), location: 'street' as const, flags: { left: true }, moment: 'rueAller' as const };
    const sPassed = { ...s, acts: [act(3, 500, 'lane', 'checkpoint', 'comply')] };
    expect(reduceAct(sPassed, week0, act(3, 600, 'enter', 'registre'), ctx)).toMatchObject({ reason: 'registreClosed' });
  });
  it('test_unknown_line_and_unknown_lane_option_are_rejected', () => {                // R-02b.49
    expect(reduceAt(1, act(1, 500, 'say', 'no.such.line'))).toMatchObject({ reason: 'unknownLine' });
    const street = { ...homeAt(1, 420), location: 'street' as const, flags: { left: true } };
    expect(reduceAct(street, week0, act(1, 500, 'lane', 'checkpoint', 'teleport'), ctx)).toMatchObject({ reason: 'unknownOption' });
  });
  it('test_door_noon_go_forces_comply_and_writes_absent_once', () => {                // R-02b.52 (2)
    const home = ok(reduceAct(homeAt(1, 720), week0, act(1, 720, 'choice', 'door.noon', 'go'), ctx));
    const s = ok(reduceAct({ ...home, location: 'street', flags: { left: true } }, week0, act(1, 730, 'lane', 'checkpoint', 'bypass'), ctx));
    expect(s.acts.at(-1)).toMatchObject({ kind: 'lane', option: 'comply' });
    expect(s.dayExtra.entries.filter((e) => e.source === 'absentRegistre')).toHaveLength(1);
  });
  it('test_door_noon_refuse_writes_the_absence_and_then_forces_comply_with_one_entry_only', () => {   // porte de midi : le refus ne domine plus
    const home = ok(reduceAct(homeAt(1, 720), week0, act(1, 720, 'choice', 'door.noon', 'refuse'), ctx));
    expect(home.dayExtra.entries.filter((e) => e.source === 'absentRegistre')).toHaveLength(1);       // l'absence est écrite au refus
    const s = ok(reduceAct({ ...home, location: 'street', flags: { left: true } }, week0, act(1, 730, 'lane', 'checkpoint', 'bypass'), ctx));
    expect(s.acts.at(-1)).toMatchObject({ kind: 'lane', option: 'comply' });                           // sortir après un refus force « se plier »
    expect(s.dayExtra.entries.filter((e) => e.source === 'absentRegistre')).toHaveLength(1);          // refuser puis sortir : -4 une seule fois
  });
  it('test_door_noon_three_options_all_write_the_same_absence_so_none_dominates', () => {
    const ledgerOf = (option: string) => ok(reduceAct(homeAt(1, 720), week0, act(1, 720, 'choice', 'door.noon', option), ctx)).dayExtra.entries.map((e) => [e.source, e.delta]);
    const stay = ledgerOf('stay');
    expect(stay.map((e) => e[0])).toEqual(['absentRegistre']);
    expect(ledgerOf('go')).toEqual(stay);
    expect(ledgerOf('refuse')).toEqual(stay);
  });
  it('test_gate_closed_flag_is_written_at_the_morning_hook_only', () => {            // R-02b.45
    expect(replay(sleepEachDay([1, 2], { phone: true }), ctx).state.flags.gateClosed).toBe(true);
    expect(replay(sleepEachDay([1, 2], {}), ctx).state.flags.gateClosed).toBeUndefined();
    expect(replay(sleepEachDay([1], { phone: true }), ctx).state.flags.gateClosed).toBeUndefined();          // le matin du J2 n'est pas assez
  });
  it('test_patrol_draw_costs_two_hours_then_complies_with_14_words', () => {         // bible w10 §7.4 : retour à la file puis « se plier »
    const street = { ...homeAt(1, 420), location: 'street' as const, flags: { left: true }, kit: { ...homeAt(1, 420).kit, component: 'left' as const } };
    const s = ok(reduceAct(street, week0, act(1, 600, 'lane', 'checkpoint', 'bypass'), { ...ctx, dice: diceStub([0.9]) }));
    expect(s.dayExtra.entries.map((e) => e.source)).toEqual(['patrol']);
    expect([s.dayExtra.spent, s.clock.minute]).toEqual([S.checkpoint.forcedWords.comply, 600 + S.checkpoint.minutes.patrol]);
  });
  // N9 [verdict P-7 §P7.3 ; bible w10 l. 534 « retour à la file puis se plier », l. 363 « voix à la file du checkpoint »] : la patrouille fait la file.
  it('test_patrol_draw_counts_one_order', () => {
    const street = { ...homeAt(1, 420), location: 'street' as const, flags: { left: true }, kit: { ...homeAt(1, 420).kit, component: 'left' as const } };
    const on = (option: string, r: number) => ok(reduceAct(street, week0, act(1, 600, 'lane', 'checkpoint', option), { ...ctx, dice: diceStub([r]) }));
    expect(ledgerOfState(on('bypass', 0.9), 1, ctx).orders).toBe(1);   // patrouille
    expect([0.1, 0.5].map((r) => ledgerOfState(on('bypass', r), 1, ctx).orders)).toEqual([0, 0]);   // libre, nacelle : pas de file
  });
  it('test_patrol_night_costs_8_not_10_against_comply', () => {   // bible §7.4 l. 534 : patrouille -8 ; avant N9, -10 (consigne perdue)
    const cfg = ctx.world.survival as unknown as IntegrityConfig;
    const street = { ...homeAt(1, 420), location: 'street' as const, flags: { left: true }, kit: { ...homeAt(1, 420).kit, component: 'left' as const } };
    const night = (option: string) => {
      const s = ok(reduceAct(street, week0, act(1, 600, 'lane', 'checkpoint', option), { ...ctx, dice: diceStub([0.9]) }));
      const r = closeNight(startSurvival(cfg), ledgerOfState(s, 1, ctx), cfg).reading;
      return { value: r.value, orders: r.terms['orders'] };
    };
    const comply = night('comply'), patrol = night('bypass');
    expect(patrol.value - comply.value).toBe(-8000);
    expect([patrol.orders, comply.orders]).toEqual([cfg.orders.perDayCap, cfg.orders.perDayCap]);   // +2 chacun, perDayCap tenu (config en millièmes)
  });
  it('test_choice_closes_after_its_confirmation', () => {
    const s = ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'j1.phone', 'take'), ctx));
    expect(reduceAct(s, week0, act(1, 421, 'choice', 'j1.phone', 'leave'), ctx)).toMatchObject({ reason: 'choiceClosed' });
    expect(reduceAct(homeAt(1, 420), week0, act(1, 421, 'choice', 'j1.phone', 'teleport'), ctx)).toMatchObject({ reason: 'unknownOption' });
  });
  it('test_phone_left_is_not_usable_and_its_entry_reaches_the_ledger', () => {         // kit + entrée d'option à la confirmation (une fois)
    const r = replay([act(1, 420, 'choice', 'j1.phone', 'leave'), act(1, 430, 'use', 'phone'), act(1, 1300, 'sleep', 'night')], ctx);
    expect(r.rejected.map((x) => x.reason)).toEqual(['outOfOrder']);
    expect(r.state.ledgers[0]!.entries.filter((e) => e.source === 'phoneLeft')).toHaveLength(1);
  });
  // --- fix round 1 : les règles des errata sont défendues ---------------------------------------------------------------------------
  it('test_rights_are_said_once_per_moment_along_the_script', () => {                // R-02b.58 : contacts de la donnée, J1 lever, rue, travail ; J2 lever
    const r = replay(SCRIPT_J1_J2, ctx);
    expect(r.state.rightsMet).toEqual(['move', 'speak', 'work', 'privacy']);
    expect(r.state.rightLines).toEqual({ '1.lever': 'move', '1.rueAller': 'speak', '1.travail': 'work', '2.lever': 'privacy' });
  });
  it('test_found7_entry_seizes_the_component_through_the_kit_table', () => {         // R-02b.23 : comply avec le composant sur soi
    const s = ok(reduceAct(streetNow(), week0, act(1, 600, 'lane', 'checkpoint', 'comply'), ctx));
    expect(s.kit['component']).toBe('seized'); expect(s.dayExtra.entries.map((e) => e.source)).toEqual(['found7']);
  });
  it('test_buy_component_hands_the_component_over', () => {                           // R-02b.50 : depuis l'option de l'acte, pas depuis l'entrée `bribe`
    const s = ok(reduceAct(streetNow(), week0, act(1, 600, 'lane', 'checkpoint', 'buy:component'), { ...ctx, dice: diceStub([0.25]) }));
    expect(s.kit['component']).toBe('handedOver');
  });
  it('test_kit_flags_hidden_and_permit_book_halved', () => {                          // KIT_FLAG_BY_EVENT
    expect(ok(reduceAct(homeAt(2, 420), week0, act(2, 420, 'choice', 'j2.component', 'hide'), ctx)).flags.hidden).toBe(true);
    const p = ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'permit.j1', 'request'), ctx));
    expect(p.flags.permitBookHalved).toBe(true);
    expect(ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'j1.phone', 'take'), ctx)).flags.hidden).toBeUndefined();
  });
  it('test_permit_request_arms_the_permit_right_and_a_refusal_arms_nothing', () => {  // R-02b.59 ; une option ne déclenche que ce qu'elle déclare
    const yes = ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'permit.j1', 'request'), ctx));
    expect(yes.flags.permitRequested).toBe(true);
    const no = ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'permit.j1', 'dontAsk'), ctx));
    expect([no.flags.permitRequested, no.flags.permitBookHalved]).toEqual([undefined, undefined]);
  });
  it('test_an_option_without_a_declared_kit_event_fires_none_even_if_id_and_option_look_like_one', () => {
    // Fixture : ce choix n'existe pas dans les données. `letter` + `keep` ressemble à l'événement `letter.keep`, l'option ne le déclare pas.
    const fx = ctxW10(withStreet((d) => { d.choices.push(choiceOf('letter', [['keep', false], ['burn', true]])); }));
    expect(ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'letter', 'keep'), fx)).kit['letter']).toBeUndefined();
  });
  it('test_list_read_arms_the_list_right_unless_skipped', () => {
    expect(ok(reduceAct(homeAt(6, 420), week0, act(6, 420, 'choice', 'm4.list', 'read'), ctx)).flags.listRead).toBe(true);
    expect(ok(reduceAct(homeAt(6, 420), week0, act(6, 420, 'choice', 'm4.list', 'pass'), ctx)).flags.listRead).toBeUndefined();
  });
  it('test_m5_exchange_letter_keep_and_receipt_reach_the_kit', () => {                // kitEvent lu sur l'option
    expect(ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'm5.yusuf', 'exchange'), ctx)).kit['component']).toBe('handedOver');
    expect(ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'm3.letter', 'keep'), ctx)).kit['letter']).toBe('kept');
    expect(ok(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'm3.letter', 'refuse'), ctx)).kit['letter']).toBeUndefined();
    expect(ok(reduceAct(homeAt(2, 420), week0, act(2, 420, 'choice', 'j2.receipt', 'show'), ctx)).kit['machineReceipt']).toBe('declared');
    expect(ok(reduceAct(homeAt(2, 420), week0, act(2, 420, 'choice', 'j2.receipt', 'notShow'), ctx)).kit['machineReceipt']).toBe('kept');
  });
  it('test_work_done_is_set_when_leaving_the_registre_not_when_entering_it', () => {    // R-02b.47
    const inside = ok(reduceAct(passedAt(1, 600), week0, act(1, 610, 'enter', 'registre'), ctx));
    expect([inside.location, inside.flags.workDone]).toEqual(['registre', undefined]);
    const out = ok(reduceAct(inside, week0, act(1, 900, 'exit', 'registre'), ctx));
    expect([out.location, out.flags.workDone]).toEqual(['street', true]);
  });
  it('test_choice_guard_by_moment_and_day', () => {                                    // R-02b.56
    expect(reduceAct(homeAt(1, 660), week0, act(1, 660, 'choice', 'door.noon', 'stay'), ctx)).toMatchObject({ reason: 'unknownChoice' });   // pas encore midi
    expect(reduceAct(homeAt(7, 420), week0, act(7, 1000, 'choice', 'audition.j7', 'silence'), ctx)).toMatchObject({ reason: 'unknownChoice' });   // avant 17 h 30
    expect(reduceAct(homeAt(1, 420), week0, act(1, 420, 'choice', 'j2.component', 'keep'), ctx)).toMatchObject({ reason: 'unknownChoice' });   // un autre jour
  });
  it('test_invalid_act_and_insufficient_bons_are_reachable', () => {
    expect(reduceAct(homeAt(1, 420), week0, act(1, 100, 'say', 'filler.1'), ctx)).toMatchObject({ reason: 'invalidAct' });
    expect(reduceAct(streetNow(), week0, act(1, 600, 'lane', 'checkpoint', 'buy:bons'), ctx)).toMatchObject({ reason: 'bonsInsufficient' });
  });
  it('test_words_bought_from_nadia_credit_one_bon_each_and_open_buy_bons', () => {   // un bon est un mot [bible w10 l.449, l.766]
    const before = streetAt(1, 600);
    expect(availableOptions(before, ctx, 'checkpoint.j1')).not.toContain('buy:bons');
    const after = reduceOk(before, act(1, 600, 'buyWords', 'nadia', '8'), ctx);
    expect(after.bons).toBe(8 * BONS_PER_WORD);
    expect(availableOptions(after, ctx, 'checkpoint.j1')).toContain('buy:bons');
    expect(reduceOk(after, act(1, 605, 'lane', 'checkpoint', 'buy:bons'), ctx).bons).toBe(0);
  });
  it('test_paying_the_buy_bons_lane_spends_the_price_in_words_too', () => {   // F1 : un bon EST un mot acheté non dépensé [bible w10 l.449]
    const price = ctx.street.checkpoint.bonsPrice.normal;
    const bought = reduceOk(streetAt(1, 600), act(1, 600, 'buyWords', 'nadia', String(price + 2)), ctx);
    const paid = reduceOk(bought, act(1, 605, 'lane', 'checkpoint', 'buy:bons'), ctx);
    expect(paid.bons).toBe(bought.bons - price);
    expect(paid.dayExtra.spent).toBe(bought.dayExtra.spent + price);
  });
  it('test_nadia_stock_caps_cumulative_words_bought', () => {   // F2 : stock de 40 [bible w10 l.766]
    const stock = ctx.street.npcs.find((n) => n.id === 'nadia')!.stock;
    expect(stock).toBe(40);
    const a = reduceOk(streetAt(1, 600), act(1, 600, 'buyWords', 'nadia', '25'), ctx);
    expect(reduceAct(a, week0, act(1, 610, 'buyWords', 'nadia', '16'), ctx)).toMatchObject({ reason: 'stallEmpty' });
    const full = reduceOk(a, act(1, 610, 'buyWords', 'nadia', '15'), ctx);
    expect(full.bons).toBe(40 * BONS_PER_WORD);
    expect(reduceAct(full, week0, act(1, 620, 'buyWords', 'nadia', '1'), ctx)).toMatchObject({ reason: 'stallEmpty' });
  });
  it('test_courtesy_lane_is_refused_outside_its_palier', () => {
    expect(reduceAct(withPalier(streetNow(), 'thanks'), week0, act(1, 600, 'lane', 'checkpoint', 'courtesy'), ctx)).toMatchObject({ reason: 'unknownOption' });
    expect(isRejected(reduceAct(streetNow(), week0, act(1, 600, 'lane', 'checkpoint', 'courtesy'), ctx))).toBe(false);
  });
  it('test_refuse_is_a_u_turn_that_closes_the_checkpoint_and_the_registre', () => {   // R-02b.52 (1)
    const s = ok(reduceAct(streetNow(), week0, act(1, 600, 'lane', 'checkpoint', 'refuse'), ctx));
    expect(s.clock.minute).toBe(600); expect(s.dayExtra.entries.map((e) => e.source)).toEqual(['absentRegistre']);
    expect(reduceAct(s, week0, act(1, 610, 'lane', 'checkpoint', 'comply'), ctx)).toMatchObject({ reason: 'choiceClosed' });
    expect(reduceAct(s, week0, act(1, 620, 'enter', 'registre'), ctx)).toMatchObject({ reason: 'outOfOrder' });
  });
  it('test_a_second_lane_act_the_same_day_is_closed', () => {
    const s = ok(reduceAct(streetNow(), week0, act(1, 600, 'lane', 'checkpoint', 'comply'), ctx));
    expect(reduceAct(s, week0, act(1, 700, 'lane', 'checkpoint', 'bypass'), ctx)).toMatchObject({ reason: 'choiceClosed' });
  });
  it('test_day_rollover_clears_the_daily_state', () => {
    const j1 = [act(1, 430, 'exit', 'home'), act(1, 600, 'lane', 'checkpoint', 'comply'), act(1, 670, 'enter', 'registre'), act(1, 700, 'exit', 'registre')];
    const before = replay(j1, ctx).state;                                            // composant sur soi : found7 dans `dayExtra`, drapeaux du jour levés
    expect(before.dayExtra.entries.map((e) => e.source)).toEqual(['found7']); expect([before.flags.left, before.flags.workDone]).toEqual([true, true]);
    const after = replay([...j1, act(1, 1300, 'sleep', 'night')], ctx).state;
    expect(after.day).toBe(2); expect(after.dayExtra).toEqual({ entries: [], spent: 0 });
    expect(after.flags).toEqual({}); expect(after.ledgers[0]!.entries.map((e) => e.source)).toContain('found7');
    expect([after.location, after.moment, after.clock]).toEqual(['home', 'lever', { day: 2, minute: S.clock.dayStartMinute }]);
  });
  it('test_week_hooks_get_the_clocks_of_r_02b_26', () => {
    const spy = vi.mocked(week.stepWeek); spy.mockClear();
    replay(SEVEN_DAYS_SLEEP_ONLY, ctx);
    const got = spy.mock.calls.map((c) => [hookName(c[3]), c[4]]);
    const want = weekCalendar().map((h) => [hookName(h), h.kind === 'morning' ? { day: h.day, minute: MORNING_MINUTE } : h.kind === 'nightEnd' ? { day: h.day, minute: CLOSING_MINUTE } : { day: 7, minute: CLOSING_MINUTE }]);
    expect(got).toEqual(want);
  });
});
