import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { parseWorld } from '../../../src/data/schema/world';
import { ruleFor } from '../../../src/i18n/i18n';
import { canonicalJson } from '../../../src/shared/canonical';
import { AXES } from '../../../src/engine/moments/types';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { act, canon, ctxW10, diceStub, loadMeta, withStreet, withStreetRaw } from '../../support/street';

const w = () => parseWorld(w10Raw, loadCore().catalogue);
const bad = (patch: Record<string, unknown>) => () => parseWorld(withStreetRaw(w10Raw, patch), cat);

describe('street : schéma strict, types, aides [plan 02b T1]', () => {
  it('test_street_block_parses_and_is_strict', () => {
    expect(w().street.clock).toEqual({ msPerHour: 12_000, dayStartMinute: 420, dayEndMinute: 1320 });
    expect(bad({ clockx: 1 })).toThrow(/street\.clockx/);                                            // clé inconnue : son chemin
    expect(bad({ clock: { msPerHour: 10_000, dayStartMinute: 420, dayEndMinute: 1320, y: 1 } })).toThrow(/street\.clock\.y/);
    expect(bad({ clock: { msPerHour: 0.5, dayStartMinute: 420, dayEndMinute: 1320 } })).toThrow(/street\.clock\.msPerHour/);   // hors grille
  });
  it('test_cone_cos2_is_derived_from_cone_deg', () => { expect(w().street.gaze.cos2Milli).toBe(883); });   // cos² 20° = 0,8830, dérivé au chargement, hors chemin d'état [calculé à la main]
  it('test_cos2_is_not_accepted_from_data', () => {
    const g = { coneDeg: 40, holdMs: 4000, rangeM: 12, rangeWideM: 18, widePaliers: ['patience', 'appointment'], nacelleZ: [36, 16, 4, -2, -20] };
    expect(bad({ gaze: { ...g, cos2Milli: 883 } })).toThrow(/street\.gaze\.cos2Milli/);
    expect(parseWorld(withStreetRaw(w10Raw, { gaze: { ...g, coneDeg: 60 } }), cat).street.gaze.cos2Milli).toBe(750);   // cos² 30° = 0,75
  });
  it('test_gaze_hold_and_nacelle_z_from_bible', () => { expect(w().street.gaze).toMatchObject({ holdMs: 4000, nacelleZ: [36, 16, 4, -2, -20], coneDeg: 40 }); });
  it('test_registre_closed_on_j3_and_j7', () => { expect(w().street.registre).toMatchObject({ closedDays: [3, 7], relectureDays: [1, 2, 4, 5, 6] }); });
  it('test_axes_order_is_the_gdd_order', () => { expect(AXES).toEqual(['vie', 'travail', 'rue', 'liens', 'pouvoir', 'ia']); });   // [GDD 05 §3.6]
  it('test_w10_is_content_since_t14', () => { expect(w().status).toBe('content'); });  // T14 retire l'épingle « skeleton »
  it('test_string_policies_declared_by_prefix', () => {                     // D141 : une politique par clé, déclarée par préfixe sans point final [R-02b.8]
    const m = loadMeta();
    expect(m['w10.price.inv']).toMatchObject({ policy: 'inventory' }); expect(m['w10.price']).toMatchObject({ policy: 'voice' });
    expect(m['w10.right']).toMatchObject({ policy: 'voice' }); expect(m['w10.bracelet']).toMatchObject({ policy: 'inventory', numericParams: ['n'] });
    expect(m['w10.doc']).toMatchObject({ policy: 'regimeDocument' });
    expect(m['w10.day']).toEqual({ policy: 'voice', allowCalendar: true });          // inchangé [R-02b.9] : la date du jour vit sous w10.doc.*
  });
  it('test_string_policies_resolve_by_longest_prefix', () => {                      // ruleFor apparie par segment : un préfixe à point final ne matcherait jamais
    const m = loadMeta();
    expect(ruleFor(m, 'w10.price.inv.bracelet').policy).toBe('inventory');
    expect(ruleFor(m, 'w10.price.bread').policy).toBe('voice');
    expect(ruleFor(m, 'w10.doc.wallCounter')).toMatchObject({ policy: 'regimeDocument', numericParams: ['n'] });
    expect(ruleFor(m, 'w10.doc.date.1')).toEqual({ policy: 'regimeDocument' });
    expect(ruleFor(m, 'w10.card.sector').policy).toBe('inventory');
    for (const p of ['street', 'evening', 'msg', 'npc', 'object', 'line', 'right']) expect(ruleFor(m, `w10.${p}.x`).policy, p).toBe('voice');
    expect(ruleFor(m, 'w10.kit.bracelet')).toEqual({ policy: 'voice' });             // les étiquettes du kit de la coque restent au défaut
  });
  it('test_street_data_shapes_expose_gaze_checkpoint_npcs_wall', () => {            // formes lues par le plan 02a [bible w10 §5.0, §7.4, §8.4, §5.2 c]
    const st = w().street;
    expect(st.gaze).toMatchObject({ coneDeg: 40, holdMs: 4000, rangeM: 12, rangeWideM: 18, nacelleZ: [36, 16, 4, -2, -20] });
    expect(st.checkpoint).toMatchObject({ z: -12, forcedWords: { comply: 14, buy: 3 }, minutes: { comply: 60, buy: 10, closedGate: 120, patrol: 120 }, bonsPrice: { normal: 8, closedGate: 16 } });
    expect(st.wallCounter).toEqual({ start: 3871, perFlag: 1 }); expect(st.npcs.map(n => n.id)).toEqual(expect.arrayContaining(['nadia', 'berenice', 'bruno', 'yusuf', 'greyCar']));
  });
  it('test_checkpoint_draws_match_bible_7_4', () => {                               // 25/50/25 ; guide 7 sur 8 libre ; porte fermée 25/25/50 ; informateur 1 sur 4
    const c = w().street.checkpoint;
    expect([c.drawAnchorHour, c.bypassWeights, c.guideWeights, c.closedGateWeights, c.informant]).toEqual([7, [1, 2, 1], [7, 1], [1, 1, 2], [1, 4]]);
  });
  it('test_npc_schedules_follow_bible_8_4', () => {
    const by = Object.fromEntries(w().street.npcs.map(n => [n.id, n]));
    expect(by['nadia']).toMatchObject({ days: [1, 2, 3, 4, 5], paliers: null });
    expect(by['berenice']!.days).toEqual(w().street.registre.relectureDays);      // le Registre ouvert est la seule source des jours de Berenice
    expect([by['berenice']!.fromMinute, by['berenice']!.toMinute]).toEqual([480, 1140]);   // 8 h à 19 h
    expect([by['greyCar']!.fromMinute, by['greyCar']!.toMinute, by['greyCar']!.paliers]).toEqual([450, 540, ['patience']]);   // 7 h 30 à 9 h, absente à 59,5 ou plus
    expect([by['yusuf']!.fromMinute, by['yusuf']!.toMinute]).toEqual([780, 1320]);  // dès 13 h, plafonné à la fin du jour (sommeil 2 h)
  });
  it('test_empty_blocks_refused_once_status_is_content', () => {                   // les clés vides ne sont tolérées qu'au statut skeleton
    // T12 a rempli le dernier bloc vide de w10 : le test vide donc `echo` lui-même pour épingler le refus (intention inchangée).
    const raw = structuredClone(w10Raw) as { street: Record<string, unknown> };
    raw.street['echo'] = [];
    const asContent = { ...raw, status: 'content' };
    expect(() => parseWorld(asContent, cat)).toThrow(/street\.(lines|choices|jalons|micro|rights|axes|evening|clickables|echo)/);
  });
  it('test_cross_rules_refuse_incoherent_blocks', () => {
    expect(bad({ registre: { closedDays: [3, 7], relectureDays: [1, 2, 3, 4, 5, 6] } })).toThrow(/street\.registre/);       // J3 à la fois fermé et ouvert
    expect(bad({ registre: { closedDays: [3], relectureDays: [1, 2, 4, 5, 6] } })).toThrow(/street\.registre/);              // J7 ni fermé ni ouvert
    expect(bad({ clock: { msPerHour: 10_000, dayStartMinute: 430, dayEndMinute: 1320 } })).toThrow(/street\.clock\.dayStartMinute/);   // 420 est MORNING_MINUTE
    expect(bad({ moments: { noonMinute: 1100, eveningMinute: 1050 } })).toThrow(/street\.moments/);
    const g = { coneDeg: 40, holdMs: 4000, rangeM: 12, rangeWideM: 10, widePaliers: ['patience'], nacelleZ: [36, 16] };
    expect(bad({ gaze: g })).toThrow(/street\.gaze\.rangeWideM/);
  });
  it('test_helpers_have_a_body_that_can_fail', () => {
    expect(act(1, 600, 'speak', 'nadia')).toEqual({ day: 1, minute: 600, kind: 'speak', id: 'nadia', option: null });
    expect(act(2, 700, 'choice', 'j2.component', 'hide').option).toBe('hide');
    const d = diceStub([0.25, 0.75]);
    expect([d.roll('street', 1, 7, 'a'), d.roll('street', 1, 7, 'b'), d.roll('street', 1, 7, 'c')]).toEqual([0.25, 0.75, 0.25]);   // cycle
    expect(() => diceStub([])).toThrow();
    expect(canon({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    const base = ctxW10();
    const changed = withStreet((s) => { s.wallCounter.start = 1; });
    expect(changed.wallCounter.start).toBe(1); expect(base.street.wallCounter.start).toBe(3871);   // l'original n'est pas muté
    expect(ctxW10(changed).street.wallCounter.start).toBe(1);
    expect(base.dice.roll('street', 1, 7, 'x')).toBe(0);                                            // défaut [0]
    expect(base.world.id).toBe('w10'); expect(base.run.outcome.kind).toBe('arrival');
  });
});
