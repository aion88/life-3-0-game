import { describe, expect, it } from 'vitest';
import { CARD_IDS, choicesToPresent, rangeTo, resolveClick, type HitInfo } from '../../../src/engine/view/interactions';
import { pendingChoices } from '../../../src/engine/moments/choices';
import { streetActKinds } from '../../../src/engine/moments/verbs';
import { ctx, FAR, homeAt, INTERACT, P, posOf, S, scene, st0, streetAt } from '../../support/street_interactions';

const respKey = (id: string): string => S.clickables.find((c) => c.id === id)!.responseKey;
const near = (id: string) => posOf(id);

/** Les choix de `street.choices` sans zone : le monde vient à la joueuse (l'audition). Depuis le playtest du 2026-11-03, la lettre (banc) et le Registre ont leur zone. */
const UNTRIGGERED = ['audition.j7'];

const UNTRIGGERED_DAY1: readonly string[] = [];

const everyHit: HitInfo[] = [
  ...S.clickables.map((c): HitInfo => ({ kind: c.id === 'passerby' ? 'passerby' : 'clickable', id: c.id, at: near(c.id) })),
  { kind: 'passerby', id: 'p7', at: P }, { kind: 'passerby', id: 'nadia', at: P }, { kind: 'passerby', id: 'berenice', at: P },
  { kind: 'ground', at: { x: 1, z: 2 } }, { kind: 'none' },
];

describe('interaction dans la rue', () => {
  it('test_every_clickable_has_an_interaction_in_range', () => {
    expect(S.clickables).toHaveLength(13);
    for (const c of S.clickables) {
      const at = scene().interactions[c.id]!.at.v;
      const r = resolveClick({ kind: c.id === 'passerby' ? 'passerby' : 'clickable', id: c.id, at }, at, st0, ctx, INTERACT);
      expect(r.type, c.id).not.toBe('none');
    }
  });
  it('test_far_click_walks_first', () => {
    const at = near('stall');
    expect(resolveClick({ kind: 'clickable', id: 'stall', at }, { x: -5, z: 30 }, st0, ctx, INTERACT)).toEqual({ type: 'approach', to: at });
  });
  it('test_range_edge_is_in_range', () => {
    const range = INTERACT.interact.interactRangeM.v, at = near('wall');
    expect(resolveClick({ kind: 'clickable', id: 'wall', at }, { x: at.x, z: at.z + range }, st0, ctx, INTERACT).type).toBe('response');
    expect(resolveClick({ kind: 'clickable', id: 'wall', at }, { x: at.x, z: at.z + range + 0.01 }, st0, ctx, INTERACT).type).toBe('approach');
  });
  it('test_object_click_returns_its_world_response_and_costs_nothing', () => {
    const at = near('wall');
    expect(resolveClick({ kind: 'clickable', id: 'wall', at }, at, st0, ctx, INTERACT)).toEqual({ type: 'response', key: respKey('wall') });
  });
  it('test_passerby_click_returns_the_world_response_and_costs_nothing', () => {
    expect(resolveClick({ kind: 'passerby', id: 'p7', at: P }, P, st0, ctx, INTERACT)).toEqual({ type: 'response', key: respKey('passerby') });
  });
  it('test_card_passerby_returns_the_card', () => {
    expect(resolveClick({ kind: 'passerby', id: 'nadia', at: P }, P, st0, ctx, INTERACT)).toEqual({ type: 'card', cardId: 'nadia' });
    expect(resolveClick({ kind: 'passerby', id: 'dario', at: P }, P, st0, ctx, INTERACT)).toEqual({ type: 'card', cardId: 'dario' });
  });
  it('test_card_reopens_on_a_second_click_while_a_choice_is_shown', () => {   // décision team-lead 2026-11-03 : le prix ferme la fiche en petit, un clic la rouvre
    const at = near('stall'), d1 = streetAt(1, 600);
    expect(choicesToPresent(d1, at, ctx, INTERACT), 'un choix est montré à l\'étal').toContain('m2.nadia');
    const first = resolveClick({ kind: 'clickable', id: 'stall', at }, at, d1, ctx, INTERACT);
    expect(first).toEqual({ type: 'card', cardId: 'nadia' });
    expect(resolveClick({ kind: 'clickable', id: 'stall', at }, at, d1, ctx, INTERACT), 'le même clic rend la même fiche').toEqual(first);
  });
  it('test_card_clickables_return_their_card', () => {
    for (const [id, card] of [['stall', 'nadia'], ['bench', 'theodore']] as const) {
      expect(resolveClick({ kind: 'clickable', id, at: near(id) }, near(id), st0, ctx, INTERACT)).toEqual({ type: 'card', cardId: card });
    }
  });
  it('test_named_npc_present_resolves_to_the_npc_response_and_absent_to_a_passerby', () => {
    const present = streetAt(1, 600);   // Bérénice : 8 h à 19 h le jour 1
    expect(resolveClick({ kind: 'passerby', id: 'berenice', at: P }, P, present, ctx, INTERACT)).toEqual({ type: 'response', key: respKey('npc') });
    const absent = streetAt(1, 420);    // avant son arrivée
    expect(resolveClick({ kind: 'passerby', id: 'berenice', at: P }, P, absent, ctx, INTERACT)).toEqual({ type: 'response', key: respKey('passerby') });
  });
  it('test_unknown_clickable_and_none_resolve_to_nothing', () => {
    expect(resolveClick({ kind: 'clickable', id: 'nope', at: P }, P, st0, ctx, INTERACT)).toEqual({ type: 'none' });
    expect(resolveClick({ kind: 'none' }, P, st0, ctx, INTERACT)).toEqual({ type: 'none' });
  });
  it('test_resolve_click_never_mutates_state', () => {
    const frozen = structuredClone(st0);
    for (const h of everyHit) resolveClick(h, P, st0, ctx, INTERACT);
    choicesToPresent(st0, P, ctx, INTERACT);
    expect(st0).toEqual(frozen);
  });
  it('test_choices_follow_spatial_triggers_not_a_timer', () => {
    const d1 = streetAt(1, 440), cp = { x: 0, z: -12 }, stall = near('stall');
    expect(choicesToPresent(d1, cp, ctx, INTERACT)).toContain('checkpoint.j1');
    expect(choicesToPresent(d1, cp, ctx, INTERACT)).not.toContain('m2.nadia');
    expect(choicesToPresent(d1, stall, ctx, INTERACT)).toContain('m2.nadia');
    expect(choicesToPresent(d1, FAR, ctx, INTERACT)).toEqual(UNTRIGGERED_DAY1);          // hors de toute zone : seuls les choix sans zone du jour
  });
  it('test_stall_is_outside_the_checkpoint_zone', () => {
    const here = choicesToPresent(streetAt(1, 440), near('stall'), ctx, INTERACT);   // l'étal est à 11,66 m du checkpoint, sa zone est de 11,5 m
    expect(here).toContain('m2.nadia');
    expect(here).not.toContain('checkpoint.j1');
  });
  it('test_forced_choices_and_milestones_are_presented_everywhere', () => {
    const noon = homeAt(1, 730);
    expect(pendingChoices(noon, ctx)).toEqual(['door.noon']);
    expect(choicesToPresent(noon, FAR, ctx, INTERACT)).toContain('door.noon');         // R-02a.16 (a) : sans zone
    const j7 = homeAt(7, 1100);
    expect(choicesToPresent(j7, FAR, ctx, INTERACT)).toContain('audition.j7');
    expect(choicesToPresent(j7, FAR, ctx, INTERACT).filter((x) => x === 'audition.j7')).toHaveLength(1);   // pas de doublon
  });
  it('test_door_noon_is_absent_before_noon_even_inside_its_zone', () => {   // R-02a.21 (2) : pendingChoices est la seule source de door.noon
    expect(pendingChoices(st0, ctx)).not.toContain('door.noon');
    expect(choicesToPresent(st0, P, ctx, INTERACT)).not.toContain('door.noon');       // J1 07:00 au logement, joueuse au départ (0, 33), dans la zone r 8
    expect(choicesToPresent(homeAt(1, 719), P, ctx, INTERACT)).not.toContain('door.noon');
    expect(choicesToPresent(homeAt(1, 720), P, ctx, INTERACT).filter((x) => x === 'door.noon')).toHaveLength(1);
  });
  it('test_a_closed_or_off_day_choice_is_not_presented', () => {
    const s = streetAt(1, 440), stall = near('stall');
    expect(choicesToPresent({ ...s, confirmed: { ...s.confirmed, '1.m2.nadia': 'pass' } }, stall, ctx, INTERACT)).not.toContain('m2.nadia');
    expect(choicesToPresent(streetAt(6, 440), stall, ctx, INTERACT)).not.toContain('m2.nadia');   // m2.nadia : jours 1 à 5
  });
  it('test_a_trigger_is_inclusive_at_its_radius', () => {
    const s = streetAt(1, 440), t = INTERACT.triggers['m2.nadia']!;
    expect(choicesToPresent(s, { x: t.at.v.x, z: t.at.v.z + t.radiusM.v }, ctx, INTERACT)).toContain('m2.nadia');
    expect(choicesToPresent(s, { x: t.at.v.x, z: t.at.v.z + t.radiusM.v + 0.01 }, ctx, INTERACT)).not.toContain('m2.nadia');
  });
  it('test_pending_choices_emits_only_forced_choices_and_milestones_on_live_data', () => {
    const forced = new Set(['door.noon', ...S.choices.filter((c) => c.blocksExit).map((c) => c.id), ...S.jalons.map((j) => j.id)]);
    expect(S.choices.filter((c) => c.blocksExit).map((c) => c.id)).toEqual(['j2.component']);
    const emitted = new Set<string>();
    for (const day of [1, 2, 3, 4, 5, 6, 7] as const) for (const minute of [420, 730, 1060, 1150, 1300]) for (const mk of [homeAt, streetAt]) for (const id of pendingChoices(mk(day, minute), ctx)) emitted.add(id);
    for (const id of emitted) expect(forced.has(id), id).toBe(true);
    for (const c of S.choices) if (!forced.has(c.id)) expect(emitted.has(c.id), c.id).toBe(false);   // les 15 autres ne passent que par les zones
  });
  it('test_triggers_name_only_street_choices_and_the_untriggered_are_pinned', () => {
    const ids = S.choices.map((c) => c.id);
    for (const k of Object.keys(INTERACT.triggers)) { expect(ids, k).toContain(k); expect(INTERACT.triggers[k]!.radiusM.v, k).toBeGreaterThan(0); }
    expect(ids.filter((id) => INTERACT.triggers[id] === undefined)).toEqual(UNTRIGGERED);
    expect(ids).toHaveLength(32);
  });
  it('test_no_resolution_does_both_gestures', () => {
    const types = new Set(['card', 'response', 'act', 'approach', 'none']);
    for (const h of everyHit) {
      const r = resolveClick(h, P, st0, ctx, INTERACT);
      expect(types.has(r.type)).toBe(true);
      expect(JSON.stringify(r)).not.toMatch(/confirm|designate/);
    }
  });
  it('test_no_clickable_resolves_to_an_act_today', () => {
    for (const c of S.clickables) {
      for (const kind of ['clickable', 'passerby'] as const) {
        const r = resolveClick({ kind, id: c.id, at: near(c.id) }, near(c.id), st0, ctx, INTERACT);
        expect(r.type, c.id).not.toBe('act');
      }
    }
    for (const h of everyHit) { const r = resolveClick(h, P, st0, ctx, INTERACT); if (r.type === 'act') expect(streetActKinds.has(r.kind)).toBe(true); }   // si un jour un acte sort, son kind est connu
  });
  it('test_every_card_key_of_the_clickables_is_a_known_card', () => {
    const keys = S.clickables.map((c) => c.responseKey).filter((k) => k.startsWith('w10.card.'));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(CARD_IDS.has(k.slice('w10.card.'.length)), k).toBe(true);
  });
  it('test_an_absent_npc_card_is_not_returned', () => {
    const nadiaGone = [streetAt(1, 1060), streetAt(6, 600)];     // après 17 h 30, puis hors de ses jours
    for (const s of nadiaGone) {
      expect(resolveClick({ kind: 'passerby', id: 'nadia', at: P }, P, s, ctx, INTERACT)).toEqual({ type: 'response', key: respKey('passerby') });
      expect(resolveClick({ kind: 'clickable', id: 'stall', at: near('stall') }, near('stall'), s, ctx, INTERACT)).toEqual({ type: 'none' });
    }
    expect(resolveClick({ kind: 'passerby', id: 'nadia', at: P }, P, streetAt(1, 600), ctx, INTERACT)).toEqual({ type: 'card', cardId: 'nadia' });
  });
  it('test_ground_click_walks', () => {
    expect(resolveClick({ kind: 'ground', at: { x: 1, z: 2 } }, P, st0, ctx, INTERACT)).toEqual({ type: 'approach', to: { x: 1, z: 2 } });
  });
  it('test_range_to_is_euclidean_metres', () => {
    expect(rangeTo({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
    expect(rangeTo({ x: 2, z: -1 }, { x: 2, z: -1 })).toBe(0);
  });
});
