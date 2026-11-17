import { describe, expect, it } from 'vitest';
import { parseGuided } from '../../../src/data/schema/guided';
import { parseStreetOf, w10Street as street, w10WithoutGuided, withAnchor, withAsk, withNarrativeOptions, withNarrativeWords, withNext, withNightLink, withSpeechModes } from '../../support/guided';

describe('guided schema', () => {
  it('test_world_without_guided_parses_to_null', () => { expect(parseStreetOf(w10WithoutGuided).guided).toBeNull(); });
  it('test_priced_ask_must_cover_every_engine_option', () => {
    expect(() => parseGuided(withAsk({ kind: 'priced', choiceId: 'j1.phone', next: { take: 'j1.roux' }, ifUnavailable: null }), street)).toThrow(/j1\.phone.*leave/);
  });
  it('test_narrative_ask_has_two_or_three_options', () => {
    expect(() => parseGuided(withNarrativeOptions(1), street)).toThrow(/options/);
    expect(() => parseGuided(withNarrativeOptions(4), street)).toThrow(/options/);
  });
  it('test_next_must_name_a_scene_of_same_day_or_night', () => { expect(() => parseGuided(withNext('j2.wake'), street)).toThrow(/j2\.wake/); });
  it('test_anchor_minutes_within_clock_bounds', () => { expect(() => parseGuided(withAnchor(1321), street)).toThrow(/anchorMinute/); });
  it('test_priced_choice_open_on_scene_day', () => {
    expect(() => parseGuided(withAsk({ kind: 'priced', choiceId: 'j3.marlene', next: { name: 'x', banal: 'x' }, ifUnavailable: null }, { day: 1 }), street)).toThrow(/j3\.marlene/);
  });
  it('test_night_link_day_is_next_day', () => {
    expect(() => parseGuided(withNightLink({ at: { kind: 'night', day: 1, from: 'A1' }, day: 1 }), street)).toThrow(/A2.*day/);
    expect(parseGuided(withNightLink({ at: { kind: 'night', day: 1, from: 'A1' }, day: 2 }), street).chains[0]!.links.at(-1)!.day).toBe(2);
  });
  it('test_narrative_choice_needs_a_zero_word_option', () => {
    expect(() => parseGuided(withNarrativeWords([8, 5]), street)).toThrow(/j1\.roux.*0 mot/);
    expect(parseGuided(withNarrativeWords([8, 5, 0]), street).scenes.find((x) => x.id === 'j1.roux')!.ask).toMatchObject({ kind: 'narrative' });
    expect(() => parseGuided(withNarrativeWords([8, -1, 0]), street)).toThrow(/words/);
  });
  it('test_speech_modes_declared_for_every_day', () => {
    expect(() => parseGuided(withSpeechModes({}), street)).toThrow(/speechModes.*1/);
    expect(() => parseGuided(withSpeechModes({ 1: { muet: 14, couloir: [60, 40], bavard: 70 } }), street)).toThrow(/couloir/);
    expect(parseGuided(withSpeechModes({ 1: { muet: 14, couloir: [40, 60], bavard: 70 } }), street).speechModes[1]).toEqual({ muet: 14, couloir: [40, 60], bavard: 70 });
  });
});
