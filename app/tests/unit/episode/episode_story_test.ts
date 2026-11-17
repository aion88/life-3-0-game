import { describe, expect, it } from 'vitest';
import { choose, ending, freshEpisode, optionsFor, restoreEpisode, story } from '../../../src/street/episode/story';
describe('short episode', () => {
  it('all paths terminate without repeated errands and retain distinct endings', () => {
    const endings = new Set<string>();
    const visit = (state = freshEpisode(), depth = 0): void => {
      expect(depth).toBeLessThan(20);
      expect(story[state.scene]).toBeDefined();
      if (state.scene === 'end') { endings.add(ending(state)); return; }
      expect(optionsFor(state).length).toBeGreaterThan(0);
      for (const option of optionsFor(state)) visit(choose(state, option.id), depth + 1);
    };
    visit(); expect(endings.size).toBeGreaterThanOrEqual(4);
  });
  it('replays choices and rejects corrupt saves without writing to the week', () => {
    const picks = ['help', 'accept', 'dinner', 'stay'];
    expect(restoreEpisode(JSON.stringify(picks)).state).toEqual(picks.reduce(choose, freshEpisode()));
    expect(restoreEpisode('["help","invalid"]').state).toEqual(freshEpisode());
    expect(restoreEpisode('broken').state).toEqual(freshEpisode());
  });
  it('does not apply unavailable choices', () => {
    const state = freshEpisode(); expect(choose(state, 'report')).toBe(state);
  });
});

import { objectives, report } from '../../../src/street/episode/report';
it('dinner and message use actual interiors and objective follows actual success', () => {
  expect(story.dinner!.place).toBe('unit.9-B'); expect(story.message!.place).toBe('room.audition');
  const good = ['help','accept','dinner','stay','hear','together','appeal','enter','inspect','witness','honest'].reduce(choose, freshEpisode());
  expect(objectives(good)[2]!.status).toBe('Réussi');
  const betrayal = ['help','accept','dinner','stay','hear','together','report','keep','honest'].reduce(choose, freshEpisode());
  expect(objectives(betrayal)[2]!.status).toContain('Non atteint');
  expect(report(betrayal)[1]!.text).toContain('signalement');
});

it('suspending the transfer has an explicit personal cost and survives reload', () => {
 const picks=['help','accept','dinner','stay','hear','together','appeal','enter','inspect','witness','honest'];
 const state=picks.reduce(choose,freshEpisode());
 expect(state.scene).toBe('end');
 expect(ending(state)).toContain('transfert de ton frère est suspendu');
 expect(ending(state)).toContain('autorisation de sortie est retenue');
 expect(objectives(state)[2]!.status).toContain('Réussi');
 expect(restoreEpisode(JSON.stringify(picks)).state).toEqual(state);
 const refusal=[...picks.slice(0,-2),'close_file','honest'].reduce(choose,freshEpisode());
 expect(ending(refusal)).not.toContain('transfert de ton frère est suspendu');
});

it('migrates only identifiable legacy dinner edges without losing choices', () => {
  for (const gesture of ['stay', 'leave']) {
    const old = ['help','accept','dinner',gesture,'alone','appeal','enter','inspect','witness','honest'];
    const restored = restoreEpisode(JSON.stringify(old));
    expect(restored.picks).toEqual([...old.slice(0,4),'hear',...old.slice(4)]);
    expect(restored.state.scene).toBe('end');
    expect(restoreEpisode(JSON.stringify(restored.picks))).toEqual(restored);
    const partial = old.slice(0,4);
    expect(restoreEpisode(JSON.stringify(partial)).picks).toEqual(partial);
    expect(restoreEpisode(JSON.stringify(partial)).state.scene).toBe(gesture === 'stay' ? 'confession' : 'departure');
  }
});
it('keeps both dinner reactions and the request in the room until explicit departure', () => {
  const dinner = ['help','accept','dinner'].reduce(choose,freshEpisode());
  for (const gesture of ['stay','leave']) {
    const reaction = choose(dinner,gesture);
    expect(story[reaction.scene]!.place).toBe('unit.9-B');
    const request = choose(reaction,'hear');
    expect(request.scene).toBe('request');
    expect(story[request.scene]!.place).toBe('unit.9-B');
    expect(choose(request,'alone').scene).toBe('checkpoint');
    expect(choose(request,'refuse').scene).toBe('distance');
  }
});
it('a saved voice is secondary and betrayal prevents full success', () => {
  const voice = ['help','accept','dinner','stay','hear','alone','appeal','enter','keep','honest'].reduce(choose,freshEpisode());
  expect(objectives(voice)[2]!.status).toBe('Non atteint');
  expect(objectives(voice)[3]!.status).toBe('Réussi');
  const betrayed = ['help','accept','dinner','stay','hear','alone','report','inspect','witness','honest'].reduce(choose,freshEpisode());
  expect(objectives(betrayed)[2]!.status).toContain('mère dénoncée');
  expect(ending(betrayed)).toContain('est suspendu');
});

it('can suspend the transfer and bring back the voice, with both consequences surviving reload', () => {
 const picks=['help','accept','dinner','stay','hear','alone','appeal','enter','inspect','witness_voice','honest'];
 const state=picks.reduce(choose,freshEpisode());
 expect(state.scene).toBe('end');
 expect(objectives(state)[2]!.status).toBe('Réussi');
 expect(objectives(state)[3]!.status).toBe('Réussi');
 expect(report(state)[2]!.text).toContain('transmis la voix');
 expect(restoreEpisode(JSON.stringify(picks)).state).toEqual(state);
});

import {episodeText} from '../../../src/street/episode/story';
it('an unaccompanied appeal does not place the mother at the gate',()=>{
 const alone=['help','accept','dinner','stay','hear','alone','appeal'].reduce(choose,freshEpisode());
 expect(episodeText(alone)).toContain('restée chez elle');
 const together=['help','accept','dinner','stay','hear','together','appeal'].reduce(choose,freshEpisode());
 expect(episodeText(together)).toContain('attendre dehors');
});
it('the return acknowledges betrayal and distinguishes a suspension from release',()=>{
 const start=['help','accept','dinner','stay','hear','alone','report','inspect'];
 const signed=[...start,'witness'].reduce(choose,freshEpisode());
 expect(episodeText(signed)).toContain('signalement');
 expect(episodeText(signed)).toContain('48 heures');
 expect(episodeText(signed)).toContain('rentrer chez toi');
 const refused=[...start,'close_file'].reduce(choose,freshEpisode());
 expect(episodeText(refused)).toContain('demain matin');
 expect(episodeText(refused)).not.toContain('48 heures');
});

it('checking a valid exit permit does not invent a departure',()=>{
 const before={...freshEpisode(),scene:'return',exposure:0};
 const after=choose(before,'check_exit');
 expect(after.scene).toBe('end');
 expect(after.memories).toContain('Ton autorisation de sortie est valide ; tu n’as pas quitté le secteur.');
 expect(optionsFor(before).find(o=>o.id==='check_exit')?.label).toBe('Vérifier mon autorisation de sortie');
});
