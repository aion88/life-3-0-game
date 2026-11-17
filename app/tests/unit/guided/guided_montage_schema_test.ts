/** Schéma de la semaine condensée [plan semaine condensée, T1] : jours de montage, maillons rangés, place des faits, `modesOf`. */
import { describe, expect, it } from 'vitest';
import { modesOf, parseGuided } from '../../../src/data/schema/guided';
import {
  w10Street as street, weekMin, weekMontage, withDayKind, withFactShownOn, withJalonLinkAfterAsk, withLinkOnHiddenStep, withMontageAsks,
  withMontageLines, withMontagePick,
} from '../../support/guided';
import { ctxW10 } from '../../support/street';

const loadW10 = () => ctxW10().world;

describe('guided montage schema', () => {
  it('test_w10_parses_unchanged_with_played_defaults', () => {
    const g = loadW10().street.guided!;
    expect(g.days.every((d) => d.kind === 'played' && d.montage === null)).toBe(true);
    expect(g.setAsideLinks).toEqual({});
    expect(g.recapMaxLinks).toBeNull();
    expect(g.chains.every((c) => c.fact.shownOn === null)).toBe(true);
  });
  it('test_week_min_parses_with_defaults', () => {
    const g = parseGuided(weekMin(), street);
    expect(g.days.every((d) => d.kind === 'played' && d.montage === null)).toBe(true);
  });
  it('test_montage_day_requires_montage_spec', () => {
    expect(() => parseGuided(withDayKind(2, 'montage', null), street)).toThrow(/days\.2\.montage/);
  });
  it('test_played_day_refuses_montage_spec', () => {
    expect(() => parseGuided(withDayKind(2, 'played', weekMontage().days[1].montage), street)).toThrow(/days\.2\.montage/);
  });
  it('test_montage_lines_fit_card_count', () => {   // décision 5 : S1 + posture + fait + fin <= 4
    expect(() => parseGuided(withMontageLines(2, 2, { fact: true }), street)).toThrow(/4 lignes/);   // 2 + 1 + 1 + 1 = 5
    expect(parseGuided(withMontageLines(2, 2, { fact: false }), street).days[1]!.montage!.lines).toHaveLength(2);   // 2 + 1 + 1 = 4
  });
  it('test_montage_asks_are_scenes_of_the_day', () => {
    expect(() => parseGuided(withMontageAsks(2, ['j1.roux']), street)).toThrow(/j1\.roux/);
  });
  it('test_montage_picks_are_options_of_the_step', () => {
    expect(() => parseGuided(withMontagePick(2, 'muet', 'j2.b', 'dance'), street)).toThrow(/j2\.b.*dance/);
  });
  it('test_link_on_unasked_montage_step_is_refused', () => {   // un maillon d'étape non présentée doit partir en setAsideLinks
    expect(() => parseGuided(withLinkOnHiddenStep(), street)).toThrow(/guided\.linkHidden|caché/);
  });
  it('test_jalon_link_after_ask_is_allowed', () => {   // B-2 : E3, jalon `j2.agentReturn` (option unique `go`) après la carte `j2.b`
    expect(() => parseGuided(withJalonLinkAfterAsk(), street)).not.toThrow();
  });
  it('test_set_aside_links_parse_but_are_not_chain_links', () => {
    const g = parseGuided(weekMontage(), street);
    expect(g.chains.flatMap((c) => c.links).some((l) => l.id === 'B2')).toBe(false);
    expect(g.setAsideLinks['chain.B']?.[0]?.id).toBe('B2');
  });
  it('test_fact_shown_on_names_an_existing_screen', () => {
    expect(() => parseGuided(withFactShownOn('A', { on: 'card', day: 1 }), street)).toThrow(/shownOn/);   // le J1 est joué : pas de carte
    expect(() => parseGuided(withFactShownOn('A', { on: 'recap', day: 1 }), street)).not.toThrow();   // le J1 est joué : relevé valide
    expect(() => parseGuided(withFactShownOn('A', { on: 'card', day: 2 }), street)).toThrow(/shownOn/);   // le J2 de week-min est joué : pas de carte
  });
  it('test_modes_of_unchanged', () => {
    const m = { muet: 14, couloir: [40, 60] as const, bavard: 70 };
    expect([0, 14, 15, 40, 60, 69, 70].map((w) => modesOf(m, w))).toEqual([['muet'], ['muet'], [], ['couloir'], ['couloir'], [], ['bavard']]);
  });
});
