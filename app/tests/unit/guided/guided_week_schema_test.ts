/** Schéma de la semaine [plan rue guidée J3-J7, T1] : réplique et route selon une marque, `opensBy`, droit du jour, fin. */
import { describe, expect, it } from 'vitest';
import { isLinkedBeat, parseGuided } from '../../../src/data/schema/guided';
import {
  w10Street as street, weekMin, withDayRight, withDuplicateLinkAcrossChains, withEnding, withLinkedBeat, withOpensBy, withRoute,
} from '../../support/guided';
import { ctxW10 } from '../../support/street';

const loadW10 = () => ctxW10().world;

describe('guided week schema', () => {
  it('test_week_min_parses', () => {
    const g = parseGuided(weekMin(), street);
    expect(g.days[1]!.right).toBe('speak');
    expect(g.ending!.outcomes['released']!.narratorKeys['2']).toBe('w10.end.released.n2');
    expect(g.chains[0]!.links[0]!.variants['a']!.nameKey).toBe('w10.name.A1.a');
    expect(g.chains[0]!.links[1]!.variants['a']!.nameKey).toBeNull();
    expect(g.scenes.find((s) => s.id === 'j2.a')!.ask.kind).toBe('route');
    expect(g.scenes.find((s) => s.id === 'j2.b')!.beats.every(isLinkedBeat)).toBe(true);
  });
  it('test_w10_j1j2_parses_unchanged_with_defaults', () => {
    const g = loadW10().street.guided!;
    expect(g.days.every((d) => d.right === (({ 5: 'privacy', 7: 'speak' } as Record<number, string>)[d.day] ?? null))).toBe(true);   // S3 : J5 (T11) et J7 (T13) portent un droit des données
    expect(g.ending).toMatchObject({ arrestedNightKey: 'w10.end.arrestedNight', weekButtonKey: 'w10.end.week' });   // la fin de semaine (T13)
    expect(g.chains.filter((c) => c.id !== 'C').every((c) => c.opensBy === null)).toBe(true);
    expect(g.chains.find((c) => c.id === 'C')!.opensBy).toBe(5);   // chaîne C (J3, T9) : ouverte sur tout chemin au J5, pas au J3
  });
  it('test_route_targets_scenes_of_same_day', () => { expect(() => parseGuided(withRoute({ link: 'A1', next: { a: 'j1.nope' }, otherwise: 'j2.b' }), street)).toThrow(/j1\.nope/); });
  it('test_route_link_must_be_earlier', () => { expect(() => parseGuided(withRoute({ link: 'B2', next: {}, otherwise: 'j2.b' }, { at: 'j2.a' }), street)).toThrow(/B2.*antérieur/); });
  it('test_route_and_beat_keys_are_variants_of_the_link', () => {
    expect(() => parseGuided(withRoute({ link: 'A1', next: { dance: 'j2.b' }, otherwise: 'j2.b' }), street)).toThrow(/A1.*dance/);
    expect(() => parseGuided(withLinkedBeat({ link: 'A1', keys: { dance: 'k' }, otherwise: null }), street)).toThrow(/A1.*dance/);
  });
  it('test_night_link_counts_as_morning_of_its_day', () => {
    expect(parseGuided(withRoute({ link: 'A2', next: { a: 'j2.b' }, otherwise: 'j2.b' }), street).scenes[3]!.ask.kind).toBe('route');
  });
  it('test_unknown_link_is_named', () => { expect(() => parseGuided(withLinkedBeat({ link: 'Z9', keys: {}, otherwise: null }), street)).toThrow(/Z9/); });
  it('test_link_ids_unique_across_chains', () => { expect(() => parseGuided(withDuplicateLinkAcrossChains('A1'), street)).toThrow(/A1.*double/); });
  it('test_opens_by_not_before_first_link', () => {
    expect(() => parseGuided(withOpensBy('B', 1), street)).toThrow(/opensBy/);
    expect(parseGuided(withOpensBy('B', 2), street).chains[1]!.opensBy).toBe(2);
  });
  it('test_day_right_is_a_right_id', () => {
    expect(() => parseGuided(withDayRight(1, 'fly'), street)).toThrow(/right/);
    expect(parseGuided(withDayRight(1, 'privacy'), street).days[0]!.right).toBe('privacy');
  });
  it('test_ending_narrator_keys_are_counts', () => {
    expect(() => parseGuided(withEnding({ released: { regimeKey: 'k', narratorKeys: { three: 'k' } } }), street)).toThrow(/narratorKeys/);
    expect(() => parseGuided(withEnding({ fled: { regimeKey: 'k', narratorKeys: {} } }), street)).toThrow(/fled/);
  });
});
