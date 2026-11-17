/** Loop of the short 1984 episode (plan-semaine-1984-3d.md, lot S3): price before, effect after, one press, no wait. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { choose, ending, freshEpisode, optionsFor, restoreEpisode, story, type EpisodeState } from '../../../src/street/episode/story';
import { allOptions, autoSteps, balance, changesBetween, endingKey, fitFrame, priceOf, priceParts } from '../../../src/street/episode/report';

const read = (file: string): string => readFileSync(new URL(`../../../src/street/episode/${file}`, import.meta.url), 'utf8');

/** Every state reachable by manual choices only, depth-first, deduplicated. */
function reachable(): EpisodeState[] {
  const seen = new Set<string>(); const out: EpisodeState[] = [];
  const visit = (state: EpisodeState): void => {
    const key = JSON.stringify(state); if (seen.has(key)) return; seen.add(key); out.push(state);
    if (state.scene === 'end') return;
    for (const option of optionsFor(state)) visit(choose(state, option.id));
  };
  visit(freshEpisode()); return out;
}

describe('price before the gesture', () => {
  it('every option of every scene shows a non-empty price, a free one says 0', () => {
    for (const option of allOptions()) expect(priceOf(option).length, option.id).toBeGreaterThan(0);
    expect(priceOf({})).toBe('Prix : 0');
    expect(priceOf({ exposure: 1 })).toBe('Prix : exposition +1');
    expect(priceOf({ trust: 1 })).toBe('Gain : confiance +1');
    expect(priceOf({ trust: 1, exposure: 1 })).toBe('Prix : exposition +1 · Gain : confiance +1');
    expect(priceOf({ trust: -3 })).toBe('Prix : confiance -3');
  });
  it('options added by the route (exit check, shared appointment) are priced too', () => {
    for (const state of reachable()) for (const option of optionsFor(state)) expect(priceOf(option).length, `${state.scene}/${option.id}`).toBeGreaterThan(0);
  });
  it('the price words match the deltas the reducer applies', () => {
    for (const state of reachable()) for (const option of optionsFor(state)) {
      const after = choose(state, option.id);
      const moved = changesBetween(state, after).join(' · ');
      const { cost, gain } = priceParts(option);
      expect([...cost, ...gain].sort().join(' · ')).toBe(moved.split(' · ').filter(Boolean).sort().join(' · '));
    }
  });
});

describe('one press per decision, no useless press', () => {
  it('scenes showing one option are applied alone, through the same reducer', () => {
    const atStall = ['help', 'accept', 'stall'].reduce(choose, freshEpisode());
    expect(atStall.scene).toBe('stall');
    const settled = autoSteps(atStall);
    expect(settled.steps.map(s => s.option)).toEqual(['remember']);
    expect(settled.state).toEqual(choose(atStall, 'remember'));
    const confession = ['help', 'accept', 'dinner', 'stay'].reduce(choose, freshEpisode());
    expect(autoSteps(confession).steps.map(s => s.option)).toEqual(['hear']);
    expect(autoSteps(confession).state.scene).toBe('request');
    const departure = ['help', 'accept', 'dinner', 'leave'].reduce(choose, freshEpisode());
    expect(autoSteps(departure).state.scene).toBe('request');
  });
  it('the hub is a choice while two errands remain, and applies itself when one is left', () => {
    const hub = ['help', 'accept'].reduce(choose, freshEpisode());
    expect(autoSteps(hub).steps).toEqual([]);
    const oneLeft = ['help', 'accept', 'stall', 'remember', 'clinic', 'share'].reduce(choose, freshEpisode());
    expect(oneLeft.scene).toBe('hub');
    expect(optionsFor(oneLeft).map(o => o.id)).toEqual(['dinner']);
    expect(autoSteps(oneLeft).state.scene).toBe('dinner');
  });
  it('a real decision is never applied alone, and the end is a stop', () => {
    for (const state of reachable()) {
      if (state.scene === 'end') { expect(autoSteps(state).steps).toEqual([]); continue; }
      const alone = autoSteps(state);
      if (optionsFor(state).length > 1) expect(alone.steps, state.scene).toEqual([]);
      else expect(optionsFor(alone.state).length === 1 && alone.state.scene !== 'end').toBe(false);
    }
  });
  it('a save made before this pass replays to the same point, stall included', () => {
    const picks = ['help', 'accept', 'stall', 'remember', 'dinner', 'stay', 'hear', 'together'];
    const restored = restoreEpisode(JSON.stringify(picks));
    expect(restored.picks).toEqual(picks);
    expect(restored.state).toEqual(picks.reduce(choose, freshEpisode()));
    // the loop, replayed from the start with presses only on decisions, lands on the same state
    let state = freshEpisode(); const walked: string[] = [];
    for (const id of ['help', 'accept', 'stall', 'dinner', 'stay', 'together']) {
      state = choose(state, id); walked.push(id);
      const auto = autoSteps(state); for (const step of auto.steps) walked.push(step.option); state = auto.state;
    }
    expect(walked).toEqual(picks); expect(state).toEqual(restored.state);
  });
  it('picks of the new loop restore like any other', () => {
    const picks = ['help', 'accept', 'clinic', 'limit', 'stall', 'remember', 'dinner', 'leave', 'hear'];
    expect(restoreEpisode(JSON.stringify(picks)).picks).toEqual(picks);
  });
});

describe('no timer decides, no long dash', () => {
  it('the episode runtime never schedules a decision', () => {
    const source = read('runtime.ts');
    expect(source).not.toMatch(/setTimeout|setInterval/);
    expect(source).not.toMatch(/episode-welcome-start|showModal/);
  });
  it('visible text carries no long dash', () => {
    for (const file of ['runtime.ts', 'story.ts', 'report.ts']) expect(read(file), file).not.toContain('—');
  });
});

describe('the ending fits one screen of facts', () => {
  const finals = (): EpisodeState[] => reachable().filter(s => s.scene === 'end');
  it('each ending names the issue, what was obtained, what it cost and the resources', () => {
    expect(finals().length).toBeGreaterThan(4);
    for (const state of finals()) {
      const b = balance(state);
      for (const part of [b.outcome, b.gained, b.cost, b.resource]) expect(part.length).toBeGreaterThan(0);
      expect(b.resource).toBe(`confiance 0 → ${state.trust} · exposition 0 → ${state.exposure}`);
      expect(endingKey(state)).toMatch(/^(suspendu|maintenu)/);
    }
  });
  it('the balance follows the family choices', () => {
    const signed = ['help', 'accept', 'dinner', 'stay', 'hear', 'together', 'appeal', 'enter', 'inspect', 'witness_voice', 'honest'].reduce(choose, freshEpisode());
    const b = balance(signed);
    expect(b.gained).toContain('transfert suspendu'); expect(b.gained).toContain('voix rapportée');
    expect(b.cost).toContain('sortie personnelle retenue');
    const betrayed = ['help', 'accept', 'dinner', 'stay', 'hear', 'alone', 'report', 'inspect', 'witness', 'honest'].reduce(choose, freshEpisode());
    expect(balance(betrayed).cost).toContain('Marlène dénoncée');
    const nothing = ['help', 'accept', 'dinner', 'leave', 'hear', 'refuse', 'home'].reduce(choose, freshEpisode());
    expect(balance(nothing).gained).toBe('rien pour ton frère');
    expect(ending(nothing).length).toBeGreaterThan(0);
  });
  it('every scene id used by the atelier routes still exists', () => {
    for (const id of ['arrival', 'plant', 'hub', 'clinic', 'stall', 'dinner', 'confession', 'departure', 'request', 'checkpoint', 'appeal', 'message', 'evidence', 'distance', 'return', 'end', 'exit_check']) expect(story[id], id).toBeDefined();
  });
});

describe('phone picture window', () => {
  const base = { hostWidth: 390, hostHeight: 844, top: 90, lowerTop: 560, visibleBottom: 528, observing: false };
  it('the frame is as tall as the window left above the lower block, never a blank band', () => {
    const { windowHeight } = fitFrame(base);
    expect(windowHeight).toBe(470);
    expect(Math.max(base.hostWidth, windowHeight * 16 / 9) * 9 / 16).toBeGreaterThanOrEqual(windowHeight);
  });
  it('observing the scene, the picture runs to the bottom of the screen, whatever the lower block measured', () => {
    const observed = fitFrame({ ...base, observing: true });
    expect(observed).toEqual({ windowHeight: 844 - 90, shift: 0 });
    expect(fitFrame({ ...base, observing: true, lowerTop: 300 }).windowHeight).toBe(754);
  });
  it('a short window slides the frame up so the figures stay visible, never past its own overflow', () => {
    const tight = fitFrame({ ...base, hostWidth: 375, hostHeight: 600, lowerTop: 250, visibleBottom: 220 });
    expect(tight.shift).toBeGreaterThan(0);
    expect(tight.shift).toBeLessThanOrEqual(375 * 9 / 16 - tight.windowHeight);
  });
  it('the stylesheet hides the whole lower block while observing, and the runtime refits on that flag', () => {
    expect(read('style.css')).toMatch(/\[data-observing=true\]\s+\.episode-lower\s*\{\s*display:none;/);
    expect(read('runtime.ts')).toMatch(/attributeFilter:\s*\['data-observing'\]/);
  });
});
