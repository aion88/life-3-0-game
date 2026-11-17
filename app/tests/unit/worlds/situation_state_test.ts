/**
 * Lecteur de situations : machine d'état pure. Dix mondes, quatre situations, un choix binaire chacune, une fin choisie par deux situations nommées.
 * Écrit avant le module : les 16 parcours de chaque monde mènent à une fin, un choix hors phase ne change rien.
 */
import { describe, expect, it } from 'vitest';
import { choose, ending, forbidden, hasInterdits, interdits, previousSuite, situationsData, start, worldIds, type Choice, type PlayState, type SituationWorld } from '../../../src/worlds/situations/situationState';

const CHOICES: readonly Choice[] = ['a', 'b'];
/** Plays a world with the four given picks and returns the final state. */
function play(world: string, picks: readonly Choice[]): PlayState {
  let state = start(world);
  for (const pick of picks) state = choose(state, pick);
  return state;
}
/** The 16 possible paths of a world, as pick lists. */
const paths = (): Choice[][] => CHOICES.flatMap(a => CHOICES.flatMap(b => CHOICES.flatMap(c => CHOICES.map(d => [a, b, c, d]))));

describe('lecteur de situations, machine d’état', () => {
  it('test_data_tenWorlds_fourSituationsEach_withTwoChoicesAndAnEndingPerKeyCombination', () => {
    expect(worldIds()).toEqual(['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w08', 'w09', 'w10', 'w11']);
    for (const id of worldIds()) {
      const world = situationsData[id]!;
      expect(world.situations.length, id).toBe(4);
      for (const s of world.situations) {
        expect(s.a.choix && s.a.contrepartie && s.a.suite && s.b.choix && s.b.contrepartie && s.b.suite, `${s.id} both choices complete`).toBeTruthy();
        expect(['telephone', 'papier', 'ticket', 'carte'], s.id).toContain(s.piece.type);
      }
      expect(world.fin_cles.every(key => world.situations.some(s => s.id === key)), `${id} ending keys name real situations`).toBe(true);
      expect(world.fin.length, `${id} one ending per combination of the two keys`).toBe(4);
      for (const entry of world.fin) expect(entry.lignes.length, `${id} ending lines (three, plus an optional « Il te reste » line)`).toBeGreaterThanOrEqual(3);
      for (const entry of world.fin) expect(entry.lignes.length, id).toBeLessThanOrEqual(4);
    }
  });
  it('test_start_beginsAtTheFirstSituation_inTheChoosePhase', () => {
    const state = start('w10');
    expect(state).toMatchObject({ world: 'w10', step: 0, phase: 'choose', picks: [] });
  });
  it('test_paths_everyOneOfTheSixteen_inEveryWorld_endsOnAnEnding', () => {
    for (const id of worldIds()) {
      const seen = new Set<string>();
      for (const picks of paths()) {
        const end = play(id, picks);
        expect(end.phase, `${id} ${picks.join('')}`).toBe('end');
        const lines = ending(end);
        expect(lines, `${id} ${picks.join('')}`).not.toBeNull();
        expect(lines!.length).toBeGreaterThanOrEqual(3);
        seen.add(lines!.join('|'));
      }
      expect(seen.size, `${id} the four combinations of the two key situations give four endings`).toBe(4);
    }
  });
  it('test_ending_dependsOnlyOnTheTwoKeySituations', () => {
    for (const id of worldIds()) {
      const keys = situationsData[id]!.fin_cles.map(key => situationsData[id]!.situations.findIndex(s => s.id === key));
      for (const picks of paths()) {
        const same = paths().find(other => keys.every(k => other[k] === picks[k]) && other.join('') !== picks.join(''));
        expect(ending(play(id, picks)), `${id} ${picks.join('')} vs ${same?.join('')}`).toEqual(ending(play(id, same!)));
      }
    }
  });
  it('test_choose_recordsThePick_andMovesStraightToTheNextSituation', () => {
    const next = choose(start('w01'), 'b');
    expect(next).toMatchObject({ step: 1, phase: 'choose', picks: ['b'] });
  });
  it('test_choose_walksThroughTheFourSituations_thenEnds_withoutAnyIntermediateScreen', () => {
    let state = start('w05');
    const steps: number[] = [];
    for (const pick of ['a', 'b', 'a', 'b'] as const) { steps.push(state.step); expect(state.phase).toBe('choose'); state = choose(state, pick); }
    expect(steps).toEqual([0, 1, 2, 3]);
    expect(state.phase).toBe('end');
    expect(state.picks).toEqual(['a', 'b', 'a', 'b']);
  });
  it('test_choose_afterTheEnd_changesNothing', () => {
    const end = play('w01', ['a', 'a', 'a', 'a']);
    expect(choose(end, 'b')).toBe(end);
  });
  it('test_previousSuite_isTheConsequenceOfTheLatestPick_nullBeforeTheFirst', () => {
    const world = situationsData['w10']!;
    expect(previousSuite(start('w10'))).toBeNull();
    expect(previousSuite(choose(start('w10'), 'b'))).toBe(world.situations[0]!.b.suite);
    expect(previousSuite(play('w10', ['a', 'b', 'a', 'b']))).toBe(world.situations[3]!.b.suite);
  });
  it('test_forbidden_accumulatesInTheOrderOfThePicks_andIgnoresMissingFields', () => {
    const option = (n: string, interdit?: string) => ({ choix: n, contrepartie: n, suite: n, ...(interdit ? { interdit } : {}) });
    const situation = (id: string, a: ReturnType<typeof option>, b: ReturnType<typeof option>) => ({ id, lieu: 'x', piece: { type: 'ticket' as const, lignes: [] }, situation: id, regle: id, a, b });
    const world: SituationWorld = { titre: 't', regle: 'r', personnages: [], fin_cles: ['s1', 's2'], fin: [], situations: [
      situation('s1', option('a1', 'plus de A1'), option('b1', 'plus de B1')), situation('s2', option('a2'), option('b2', 'plus de B2')),
      situation('s3', option('a3', 'plus de A3'), option('b3')), situation('s4', option('a4', 'plus de A4'), option('b4', 'plus de B4')),
    ] };
    expect(forbidden(world, [])).toEqual([]);
    expect(forbidden(world, ['b'])).toEqual(['plus de B1']);
    expect(forbidden(world, ['a', 'a'])).toEqual(['plus de A1']);
    expect(forbidden(world, ['b', 'b', 'a', 'b'])).toEqual(['plus de B1', 'plus de B2', 'plus de A3', 'plus de B4']);
    expect(hasInterdits(world)).toBe(true);
    expect(hasInterdits({ ...world, situations: world.situations.map(item => ({ ...item, a: option('a'), b: option('b') })) })).toBe(false);
  });
  it('test_interdits_ofTheGameInProgress_followThePicks_inTheShippedData', () => {
    const picks: Choice[] = ['a', 'b', 'a', 'b'];
    for (const id of worldIds()) {
      const world = situationsData[id]!;
      const expected = picks.flatMap((pick, index) => world.situations[index]![pick].interdit ?? []);
      expect(interdits(play(id, picks)), id).toEqual(expected);
      if (hasInterdits(world)) for (const item of world.situations) for (const key of ['a', 'b'] as const) expect(item[key].interdit, `${item.id} ${key} has an interdit`).toBeTruthy();
    }
  });
  it('test_ending_beforeTheEnd_isNull', () => {
    expect(ending(start('w03'))).toBeNull();
    expect(ending(choose(start('w03'), 'a'))).toBeNull();
  });
  it('test_state_isImmutable_aSharedStartIsNeverMutated', () => {
    const first = start('w02'); const frozen = JSON.stringify(first);
    choose(first, 'a');
    expect(JSON.stringify(first)).toBe(frozen);
  });
});
