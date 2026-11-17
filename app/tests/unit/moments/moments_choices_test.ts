/**
 * Choix à prix, porte de midi, porte du J2, le monde vient [plan 02b T4 ; GDD 05 §3.4 ; bible w10 §5.0, §7.3, §8.1 ; R-C3, R-C4, R-C5, D138].
 * Les prix sont des clés `w10.price.*` : chaque clé de la donnée existe en FR et en EN (le texte final est au writer).
 */
import { describe, expect, it } from 'vitest';
import { canExit, confirm, designate, pendingChoices, sleepPriceLine } from '../../../src/engine/moments/choices';
import type { StreetContext } from '../../../src/engine/moments/types';
import { closeNight, sleepMaxRemaining, startSurvival, type IntegrityConfig } from '../../../src/survival';
import { buildLedger } from '../../../src/engine/moments/words';
import enJson from '../../../src/data/strings/en.json';
import frJson from '../../../src/data/strings/fr.json';
import {
  at, atJ1Checkpoint, confirmJ2, ctxW10, homeAt, J1, passedAt, reduceOk, streetAt, withSpent, withStreet,
} from '../../support/street';

const ctx = ctxW10();
const S = ctx.street;
const fr = frJson as Record<string, string>;
const en = enJson as Record<string, string>;

describe('choix à prix, portes, le monde vient', () => {
  it('test_designate_shows_price_line_and_writes_nothing', () => {
    const { state, price } = designate(atJ1Checkpoint(), ctx, 'checkpoint.j1', 'comply');
    expect(price).toMatchObject({ choiceId: 'checkpoint.j1', optionId: 'comply', isRefusal: false });
    expect(state.phase).toBe('designated');
    expect(state.acts).toHaveLength(0);
    expect(state.confirmed).toEqual({});
    expect(state.designated).toEqual({ choiceId: 'checkpoint.j1', optionId: 'comply' });
  });

  it('test_confirm_without_designation_is_a_noop', () => {
    const r = confirm(atJ1Checkpoint(), ctx, at(1, 600));
    expect(r.act).toBeNull();
    expect(r.state).toEqual(atJ1Checkpoint());
  });

  it('test_confirm_writes_one_act_and_no_way_back', () => {
    const s1 = designate(designate(atJ1Checkpoint(), ctx, 'checkpoint.j1', 'buy:bons').state, ctx, 'checkpoint.j1', 'comply').state;   // changer d'avis avant de confirmer : libre
    const r = confirm(s1, ctx, at(1, 600));
    expect(r.act).toEqual({ day: 1, minute: 600, kind: 'lane', id: 'checkpoint', option: 'comply' });   // le checkpoint est un acte `lane`, jamais `choice`
    expect(r.state.acts).toEqual([]);                                                  // confirm ne pose ni l'acte ni la fermeture : seul `reduceAct` le fait [R-02b.65]
    expect(r.state.confirmed).toEqual({});
    expect(r.state.designated).toBeNull();
    const after = reduceOk(s1, r.act!, ctx);
    expect(after.acts).toEqual([r.act]);
    expect(after.confirmed).toEqual({ '1.checkpoint.j1': 'comply' });
    expect(() => designate(after, ctx, 'checkpoint.j1', 'buy:bons')).toThrow(/closed/);
  });

  it('test_confirm_writes_a_choice_act_for_a_non_checkpoint_choice', () => {
    const r = confirm(designate(homeAt(1, 420), ctx, 'j1.phone', 'take').state, ctx, at(1, 420));
    expect(r.act).toEqual({ day: 1, minute: 420, kind: 'choice', id: 'j1.phone', option: 'take' });
  });

  it('test_every_choice_has_a_priced_refusal_option', () => {
    expect(S.choices.length).toBeGreaterThan(0);
    for (const c of S.choices) {
      const r = c.options.filter((o) => o.isRefusal);
      expect(r.length, c.id).toBeGreaterThan(0);
      for (const o of r) expect(o.priceRef, `${c.id}/${o.id}`).not.toBe('');
    }
  });

  it('test_every_price_ref_has_a_fr_and_en_text', () => {
    for (const c of S.choices) for (const o of c.options) {
      if (o.priceLineKey === null) continue;                                          // R-02b.54 : priceRef est la référence bible, la clé du texte est priceLineKey
      expect(fr[o.priceLineKey], `fr ${o.priceLineKey}`).toBeTruthy();
      expect(en[o.priceLineKey], `en ${o.priceLineKey}`).toBeTruthy();
    }
    expect(fr['w10.price.sleep.keepWords']).toBeTruthy();
    expect(en['w10.price.sleep.keepWords']).toBeTruthy();
  });

  it('test_designate_reads_the_data_not_the_caller', () => {
    const p = designate(homeAt(1, 420), ctx, 'j1.phone', 'leave').price;
    const opt = S.choices.find((c) => c.id === 'j1.phone')!.options.find((o) => o.id === 'leave')!;
    expect(p).toEqual({ choiceId: 'j1.phone', optionId: 'leave', textKey: opt.priceLineKey ?? '', isRefusal: opt.isRefusal, inventoryParams: {} });
    expect(() => designate(homeAt(1, 420), ctx, 'j1.phone', 'nope')).toThrow(/unknown option/);
    expect(() => designate(homeAt(1, 420), ctx, 'nope', 'take')).toThrow(/unknown choice/);
    expect(() => designate(homeAt(2, 420), ctx, 'j1.phone', 'take')).toThrow(/day/);   // un choix du J1 n'est pas ouvert le J2
  });

  it('test_rc5_door_at_noon_only_when_checkpoint_not_passed', () => {
    expect(pendingChoices(homeAt(1, 720), ctx)).toContain('door.noon');
    expect(pendingChoices(homeAt(1, 719), ctx)).not.toContain('door.noon');
    expect(pendingChoices(homeAt(3, 720), ctx)).not.toContain('door.noon');   // J3 chômé : le Registre est fermé [bible w10 §5.0]
    expect(pendingChoices(homeAt(7, 720), ctx)).not.toContain('door.noon');
    expect(pendingChoices(passedAt(1, 720), ctx)).not.toContain('door.noon');   // checkpoint passé
    expect(pendingChoices(streetAt(1, 720), ctx)).not.toContain('door.noon');   // pas au logement
  });

  it('test_rc5_noon_door_closes_once_confirmed_and_all_three_options_cost_the_absence', () => {
    const s = reduceOk(homeAt(1, 720), confirm(designate(homeAt(1, 720), ctx, 'door.noon', 'go').state, ctx, at(1, 720)).act!, ctx);
    expect(pendingChoices(s, ctx)).not.toContain('door.noon');
    const door = S.choices.find((c) => c.id === 'door.noon')!;
    for (const id of ['stay', 'go', 'refuse']) expect(door.options.find((o) => o.id === id)!.entries).toEqual(['absentRegistre']);   // -4 [bible w10 l. 510] : le refus ne peut pas effacer l'absence
    expect(door.options.find((o) => o.isRefusal)).toMatchObject({ id: 'refuse', neutral: false, priceRef: '§7.3', trace: { key: 'w10.street.trace.absent', day: 2 } });
  });

  it('test_rc5_noon_is_read_from_the_data', () => {
    const later = ctxW10(withStreet((s) => { s.moments.noonMinute = 800; }));
    expect(pendingChoices(homeAt(1, 720), later)).not.toContain('door.noon');
    expect(pendingChoices(homeAt(1, 800), later)).toContain('door.noon');
  });

  it('test_d138_j2_cannot_exit_without_choice', () => {
    expect(canExit(homeAt(2, 420), ctx)).toEqual({ ok: false, blockedBy: 'j2.component' });
    for (const o of ['hide', 'keep', 'declare', 'leaveVisible']) expect(canExit(confirmJ2(o), ctx).ok).toBe(true);
    expect(S.choices.find((c) => c.id === 'j2.component')!.options.map((o) => o.id).sort()).toEqual(['declare', 'hide', 'keep', 'leaveVisible']);
    expect(canExit(homeAt(1, 420), ctx)).toEqual({ ok: true });   // le J1, rien ne retient à la porte
    expect(pendingChoices(homeAt(2, 420), ctx)).toContain('j2.component');
  });

  it('test_sleep_price_line_only_when_more_than_20_words_remain', () => {      // restant mesuré contre la base [bible w10 §7.2]
    expect(sleepPriceLine(withSpent(J1(), 14), ctx)).toMatchObject({ textKey: 'w10.price.sleep.keepWords' });   // 46 restent
    expect(sleepPriceLine(withSpent(J1(), 39), ctx)).not.toBeNull();
    expect(sleepPriceLine(withSpent(J1(), 40), ctx)).toBeNull();   // 21 restent, puis 20
  });

  it('test_sleep_threshold_is_read_per_day_or_as_a_plain_number', () => {   // ruling N6 v3 : `maxRemaining` comme `base`, un nombre OU une valeur par nuit
    const cfgWith = (m: number | number[]) => ({ words: { sleep: { maxRemaining: m } } }) as unknown as Parameters<typeof sleepMaxRemaining>[0];
    expect([1, 2, 3, 4, 5, 6, 7].map((d) => sleepMaxRemaining(cfgWith([20, 21, 22, 23, 24, 26]), d))).toEqual([20, 21, 22, 23, 24, 26, 26]);   // le J7 prend la dernière
    expect([1, 6, 7].map((d) => sleepMaxRemaining(cfgWith(20), d))).toEqual([20, 20, 20]);
    const survival = structuredClone(ctx.world.survival) as unknown as { words: { sleep: { maxRemaining: number | number[] } } };
    survival.words.sleep.maxRemaining = [50, 0, 0, 0, 0, 0];
    const perDay = { ...ctx, world: { ...ctx.world, survival } } as unknown as StreetContext;
    expect(sleepPriceLine(withSpent(J1(), 14), perDay)).toBeNull();   // J1 : 46 restent, seuil du J1 = 50
    expect(sleepPriceLine(withSpent(J1(), 9), perDay)).not.toBeNull();   // 51 restent
  });

  it('test_sleep_price_line_and_night_value_agree_every_day', () => {   // ruling N6 v3 : un seul lecteur (`sleepMaxRemaining`) pour la nuit et la ligne « dormir »
    const cfg = ctx.world.survival as unknown as IntegrityConfig;
    const noSleep = { ...cfg, words: { ...cfg.words, sleep: { ...cfg.words.sleep, value: 0 } } } as IntegrityConfig;
    for (const day of [1, 2, 3, 4, 5, 6] as const) {
      const base = cfg.words.base[day - 1]!;
      for (let rem = 0; rem <= base; rem++) {
        const st = withSpent(homeAt(day, 440), base - rem);
        const ledger = buildLedger(day, st.acts, ctx);
        const granted = closeNight(startSurvival(cfg), ledger, cfg).reading.terms['words']! - closeNight(startSurvival(cfg), ledger, noSleep).reading.terms['words']! > 0;
        expect(sleepPriceLine(st, ctx) === null, `J${day}, ${rem} restants`).toBe(granted);
      }
    }
    expect(sleepPriceLine(withSpent(homeAt(6, 440), 14), ctx)).toBeNull();   // J6, 26 restants : la rampe paie encore le sommeil
    expect(sleepPriceLine(withSpent(homeAt(6, 440), 13), ctx)).not.toBeNull();   // 27 restants
    expect(sleepPriceLine(withSpent(homeAt(5, 440), 19), ctx)).not.toBeNull();   // J5, 21 restants : seuil 20 inchangé
  });

  it('test_sleep_price_line_is_silent_on_day_seven_real_w10', () => {   // M-3 (revue N6) : config w10 réelle ; le dossier est clos à `lastNight`, la nuit 7 ne lit aucun mot
    const cfg = ctx.world.survival as unknown as IntegrityConfig;
    expect(cfg.lastNight).toBe(6);
    expect(sleepMaxRemaining(cfg, 7)).toBe(26);   // le J7 prend la dernière valeur du tableau [20,20,20,20,20,26]
    const base = cfg.words.base[cfg.words.base.length - 1]!;   // base du J7 : la dernière, comme `baseOf`
    for (let rem = 0; rem <= base; rem++) {
      const st = withSpent(homeAt(7, 440), base - rem);
      expect(closeNight(startSurvival(cfg), buildLedger(7, st.acts, ctx), cfg).reading.terms, `J7, ${rem} restants`).toEqual({});   // aucun terme : rien à garder
      expect(sleepPriceLine(st, ctx), `J7, ${rem} restants`).toBeNull();   // donc aucune ligne « il te reste des mots », ni de 21 à 26 ni au-dessus
    }
  });

  it('test_sleep_threshold_is_read_from_the_survival_data', () => {
    const survival = structuredClone(ctx.world.survival) as unknown as { words: { sleep: { maxRemaining: number } } };
    survival.words.sleep.maxRemaining = 50;
    const wide = { ...ctx, world: { ...ctx.world, survival } } as unknown as StreetContext;
    expect(sleepPriceLine(withSpent(J1(), 14), wide)).toBeNull();   // 46 restent, seuil 50
    expect(sleepPriceLine(withSpent(J1(), 9), wide)).not.toBeNull();   // 51 restent
  });

  it('test_rc4_the_world_comes', () => {
    expect(pendingChoices(streetAt(2, 1019), ctx)).not.toContain('j2.agentReturn');
    expect(pendingChoices(streetAt(2, 1020), ctx)).toContain('j2.agentReturn');   // 17 h [bible w10 §8.1]
    expect(pendingChoices(streetAt(3, 1139), ctx)).not.toContain('j3.marlene.late');
    expect(pendingChoices(streetAt(3, 1140), ctx)).toContain('j3.marlene.late');   // 19 h
    expect(pendingChoices(streetAt(7, 1049), ctx)).not.toContain('audition.j7');
    expect(pendingChoices(streetAt(7, 1050), ctx)).toContain('audition.j7');   // 17 h 30
  });

  it('test_rc4_j2_agent_returns_only_for_the_player_who_was_absent', () => {
    // Déclarer ou cacher : l'agent est venu à 10 h, il ne revient pas [bible w10 §8.1, J2, « absent à 10 h seulement s'il a choisi… »].
    for (const [option, back] of [['keep', true], ['leaveVisible', true], ['declare', false], ['hide', false]] as const) {
      const out = { ...streetAt(2, 1020), confirmed: { '2.j2.component': option } };
      expect(pendingChoices(out, ctx).includes('j2.agentReturn'), option).toBe(back);
    }
  });

  it('test_rc4_j4_waits_for_the_building_door_and_j5_waits_at_the_door', () => {
    expect(pendingChoices(homeAt(4, 460), ctx)).not.toContain('j4.door');
    expect(pendingChoices(streetAt(4, 460), ctx)).toContain('j4.door');          // franchit la porte de l'immeuble [bible w10 §8.1]
    expect(pendingChoices(streetAt(5, 1110), ctx)).not.toContain('j5.bruno.door');   // dehors : Bruno attend
    expect(pendingChoices(homeAt(5, 1109), ctx)).not.toContain('j5.bruno.door');
    expect(pendingChoices(homeAt(5, 1110), ctx)).toContain('j5.bruno.door');          // 18 h 30, à la porte
    expect(pendingChoices(homeAt(5, 1300), ctx)).toContain('j5.bruno.door');          // il attend encore
  });

  it('test_rc4_a_closed_jalon_is_no_longer_pending', () => {
    const s = { ...streetAt(3, 1200), confirmed: { '3.j3.marlene.late': 'seen' } };
    expect(pendingChoices(s, ctx)).not.toContain('j3.marlene.late');
  });
});
