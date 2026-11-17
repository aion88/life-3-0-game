// @vitest-environment happy-dom
/**
 * Socle commun des mondes (lot S2) : la boucle validée tient pour les neuf mondes runtime.
 * Prix avant le geste (« 0 » compris), ressource visible, aucun appui hors décision, aucune minuterie qui décide, fin lisible d'un coup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountJourney } from '../../../src/worlds/runtime';
import { journeys } from '../../../src/worlds/catalogue';
import { blockedReason, decide, elapsed, restoreJourney, serializeJourney, startJourney } from '../../../src/worlds/state';
import type { Journey, JourneyState, JourneyWorldId } from '../../../src/worlds/types';
import type { JourneyView } from '../../../src/worlds/view';
import { fakeCtx } from '../../support/screens';
import { runLine } from '../../support/screens_ff';

const WORLDS = ['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w08', 'w09', 'w11'] as const satisfies readonly JourneyWorldId[];
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  const storage = () => ({ getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });
  vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage()); document.body.replaceChildren();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const view = (): JourneyView => ({ show: vi.fn(), perform: vi.fn(async () => {}), skip: vi.fn(), setEmotion: vi.fn(), setSpeaker: vi.fn(), setConsequence: vi.fn(), dispose: vi.fn() });
const runFor = (id: JourneyWorldId) => {
  const source = runLine('BAABBACBBAD'); if (source.outcome.kind !== 'arrival') throw new Error('arrival fixture required');
  return { ...source, outcome: { ...source.outcome, computedWorld: id } };
};
const keyOf = (id: JourneyWorldId): string => `aftermath.journey.v1.${id}.${runFor(id).seed}`;
/** Mount a world at the end of the given decisions, as a resumed game would. */
async function mountAt(id: JourneyWorldId, choices: JourneyState['choices']) {
  store.set(keyOf(id), JSON.stringify({ v: 1, world: id, choices }));
  const root = document.createElement('div'); document.body.replaceChildren(root);
  const runtime = await mountJourney(fakeCtx(), runFor(id), root, { view: async () => view() });
  return { root, host: root.querySelector<HTMLElement>('.journey')!, runtime };
}
/** Every state reachable by playing the catalogue, deduplicated; the same states a player can meet. */
function reachable(journey: Journey, cap = 600): JourneyState[] {
  const seen = new Map<string, JourneyState>(); const queue = [startJourney(journey)];
  while (queue.length && seen.size < cap) {
    const state = queue.shift()!; const key = `${state.scene}|${[...state.inventory].sort().join(',')}|${state.resource}|${elapsed(journey, state)}`;
    if (seen.has(key)) continue; seen.set(key, state);
    const scene = journey.scenes.find(s => s.id === state.scene)!; if (scene.ending) continue;
    for (const option of scene.options) { const next = decide(journey, state, option.id); if (next !== state) queue.push(next); }
  }
  return [...seen.values()];
}

describe('boucle commune, neuf mondes', () => {
  it('test_screenGrammar_decorIsClear_textBandThenPlateau_inEveryWorld', async () => {
    // Grammaire du prototype validé : décor dégagé ; dessous la bande de texte ; dessous le plateau (rond de ressource, consigne, cibles).
    for (const id of WORLDS) {
      const { host, runtime } = await mountAt(id, []);
      expect(host.classList.contains('proto-scene'), id).toBe(true);
      expect(host.classList.contains('lived-scene') || host.classList.contains('dialogue-mode'), `${id} no old absolute layout`).toBe(false);
      const stage = host.querySelector<HTMLElement>('.proto-stage')!;
      expect(stage.querySelector('.journey-panel,.journey-header,.lived-orientation,.short-bar,.scene-choices,.journey-mission'), `${id} nothing laid over the decor`).toBeNull();
      const plateau = host.querySelector<HTMLElement>('.plateau')!;
      expect(plateau, id).not.toBeNull();
      expect(plateau.querySelector('.short-purse .rond')?.textContent, `${id} resource in its round, live`).toBe(String(journeys[id].resource.initial));
      expect(plateau.querySelector('[data-ui=consigne]')?.textContent?.length ?? 0, `${id} instruction in the plateau`).toBeGreaterThan(5);
      expect(plateau.querySelectorAll('[data-option]').length, `${id} options are the targets of the plateau`).toBeGreaterThan(0);
      expect(host.querySelector('.journey-panel [data-option]'), `${id} no option left in the text band`).toBeNull();
      const order = [...host.querySelectorAll<HTMLElement>('.journey-header,.lived-orientation,.proto-stage,.journey-panel,.plateau')].map(el => el.className.split(' ')[0]);
      // Source order (the grid places them: bar, mission, decor, text band, plateau).
      expect(order, id).toEqual(['proto-stage', 'journey-header', 'lived-orientation', 'journey-panel', 'plateau']);
      runtime.dispose();
    }
  });
  it('test_pieces_w03_everyScene_showsItsPropLeftOfTheTargets_withTheSceneText', async () => {
    // Chaque scène de w03 présente sa pièce (papier, carte) à gauche des cibles : l'émetteur, l'incident de la scène, rien d'inventé.
    const journey = journeys['w03']; let checked = 0;
    for (const scene of journey.scenes.filter(s => !s.ending)) {
      const state = reachable(journey).find(st => st.scene === scene.id); if (!state) continue;
      const mounted = await mountAt('w03', state.choices);
      const plateau = mounted.host.querySelector<HTMLElement>('.plateau')!; const piece = plateau.querySelector<HTMLElement>('.piece')!;
      expect(piece, scene.id).not.toBeNull();
      expect(piece.dataset['prop'], scene.id).toBe(scene.presentation?.prop);
      expect([...plateau.children].map(c => c.className.split(' ')[0]), `${scene.id} bar, piece, targets`).toEqual(['short-bar', 'piece', 'scene-choices']);
      expect(piece.textContent, scene.id).toContain(scene.presentation!.incident.slice(0, 20));
      mounted.runtime.dispose(); checked++;
    }
    expect(checked, 'the five w03 decision scenes').toBe(5);
  });
  it('test_pieces_touchOpensTheReading_touchClosesIt_andDecidesNothing', async () => {
    const { host, runtime } = await mountAt('w03', []); const before = host.dataset['scene'];
    const piece = host.querySelector<HTMLButtonElement>('.piece')!;
    piece.click();
    expect(host.querySelector('.piece-reading'), 'reading opened over the picture').not.toBeNull();
    expect(piece.getAttribute('aria-expanded')).toBe('true');
    host.querySelector<HTMLElement>('.piece-reading')!.click();
    expect(host.querySelector('.piece-reading'), 'touch closes it').toBeNull();
    piece.click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.querySelector('.piece-reading'), 'Escape closes it').toBeNull();
    expect(host.dataset['scene'], 'the piece decides nothing').toBe(before);
    runtime.dispose();
  });
  it('test_pieces_choosingATarget_decidesInOnePress_withoutLayout', async () => {
    const { host, runtime } = await mountAt('w03', []);
    host.querySelector<HTMLButtonElement>('[data-option]:not([disabled])')!.click();
    expect(host.dataset['scene'] !== 'meal' || host.querySelector('[data-travelling]') !== null || store.get(keyOf('w03'))!.includes('choices'), 'the decision is applied at once').toBe(true);
    expect(JSON.parse(store.get(keyOf('w03'))!).choices.length).toBe(1);
    runtime.dispose();
  });
  it('test_ending_printsAsAPaperReceipt_oneLineAfterTheOther', async () => {
    const journey = journeys['w03']; const end = reachable(journey).find(st => journey.scenes.find(s => s.id === st.scene)?.ending)!;
    const { host, runtime } = await mountAt('w03', end.choices);
    const paper = host.querySelector<HTMLElement>('[data-ui=end-ticket]')!;
    expect(paper, 'the ending is a receipt, not a panel').not.toBeNull();
    const lines = [...paper.querySelectorAll<HTMLElement>('.imprime')];
    expect(lines.length, 'title, outcome, lines, resource').toBeGreaterThan(4);
    expect(lines.map(l => l.style.getPropertyValue('--i')), 'printed in order').toEqual(lines.map((_, i) => String(i)));
    expect(paper.querySelector('[data-ui=end-resource]'), 'resource line on the receipt').not.toBeNull();
    expect(host.querySelector('.life-next'), 'next steps stay outside the paper').not.toBeNull();
    expect(paper.querySelector('.life-next'), 'buttons are not printed').toBeNull();
    runtime.dispose();
  });
  it('test_mission_staysInOrientation_afterFirstDecision_inEveryWorld', async () => {
    for (const id of WORLDS) {
      const journey = journeys[id]; const first = journey.scenes.find(s => s.id === journey.start)!;
      const option = first.options.find(o => decide(journey, startJourney(journey), o.id) !== startJourney(journey)); if (!option) continue;
      const { root, host, runtime } = await mountAt(id, [{ scene: first.id, option: option.id }]);
      const strong = root.querySelector<HTMLElement>('.lived-orientation strong');
      expect(host.querySelector('.lived-orientation')?.getAttribute('data-compact'), id).toBe('true');
      expect(strong?.textContent, `${id} mission still written after the first scene`).toBe(journey.mission);
      runtime.dispose();
    }
  });
  it('test_first_gesture_needsNoPriorPress_inEveryWorld', async () => {
    for (const id of WORLDS) {
      const { root, host, runtime } = await mountAt(id, []);
      expect(host.dataset['modal'], id).toBe('none');
      expect(root.querySelector('.journey-modal-backdrop'), id).toBeNull();
      expect(root.querySelector('[data-option]:not(:disabled)'), id).not.toBeNull();
      expect(root.querySelector('[data-ui=journey-intro]')?.textContent?.length ?? 0, `${id} intro told above the first scene`).toBeGreaterThan(20);
      runtime.dispose();
    }
  });

  it('test_intro_disappearsAfterFirstGesture', async () => {
    const { root, runtime } = await mountAt('w03', []);
    root.querySelector<HTMLButtonElement>('[data-option]:not(:disabled)')!.click();
    expect(root.querySelector('[data-ui=journey-intro]')).toBeNull();
    runtime.dispose();
  });

  it('test_everyPlayableOption_showsAPriceBeforeTheGesture_andResourceStaysVisible', async () => {
    let rendered = 0, priced = 0;
    for (const id of WORLDS) {
      const journey = journeys[id];
      const states = reachable(journey);
      for (const state of states) {
        const { root, host, runtime } = await mountAt(id, state.choices);
        const resource = root.querySelector<HTMLElement>('[data-resource]');
        expect(resource, `${id}/${host.dataset['scene']} resource`).not.toBeNull();
        expect(resource!.closest('details'), `${id} resource must not be folded`).toBeNull();
        expect(root.querySelector('[data-urgent]'), `${id} no pulsing alarm`).toBeNull();
        if (host.dataset['ended'] !== 'true') {
          const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-option]')];
          for (const b of buttons.filter(x => !x.disabled)) { rendered++; const price = b.querySelector('.short-price')?.textContent ?? ''; if (/\d/.test(price)) priced++; expect(price, `${id}/${host.dataset['scene']}/${b.dataset['option']}`).toMatch(/\d/); }
          // A scene showing one active button and nothing else would be an empty press: it must have been applied on its own.
          expect(buttons.length === 1 && !buttons[0]!.disabled, `${id}/${host.dataset['scene']} single button`).toBe(false);
          expect(root.querySelector('[data-ending]')).toBeNull();
        }
        runtime.dispose();
      }
    }
    expect(rendered).toBeGreaterThan(100);
    expect(priced).toBe(rendered);
  }, 120000);

  it('test_zeroPrice_isShownAsZero_inTheWorldsOwnResource', async () => {
    for (const id of WORLDS) {
      const { root, runtime } = await mountAt(id, []);
      const prices = [...root.querySelectorAll('[data-option] .short-price')].map(n => n.textContent ?? '');
      expect(prices.length, id).toBeGreaterThan(0);
      expect(prices.every(p => p.startsWith('Prix : ') && /\d/.test(p)), `${id}: ${prices.join(' | ')}`).toBe(true);
      expect(prices.some(p => /^Prix : (\d+ min · )?0 /.test(p)) || prices.some(p => p.includes('−')), id).toBe(true);
      runtime.dispose();
    }
    const { root, runtime } = await mountAt('w01', []);
    expect(root.querySelector('[data-option] .short-price')?.textContent).toMatch(/^Prix : 5 min · 0 crédit$/);
    runtime.dispose();
  });

  it('test_noTimer_everAdvancesADecision', async () => {
    vi.useFakeTimers();
    for (const id of WORLDS) {
      const { host, runtime } = await mountAt(id, []);
      const scene = host.dataset['scene'], saved = store.get(keyOf(id));
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(host.dataset['scene'], id).toBe(scene); expect(store.get(keyOf(id)), id).toBe(saved);
      runtime.dispose();
    }
  });

  it('test_endOfWorld_showsOutcomeObtainedCostResourceAndActions_withoutAnyPress', async () => {
    for (const id of WORLDS) {
      const journey = journeys[id];
      const ends = reachable(journey).filter(s => journey.scenes.find(x => x.id === s.scene)!.ending);
      expect(ends.length, id).toBeGreaterThan(0);
      const seenEndings = new Set<string>();
      for (const state of ends) {
        if (seenEndings.has(state.scene)) continue; seenEndings.add(state.scene);
        const { root, host, runtime } = await mountAt(id, state.choices);
        expect(host.dataset['ending'], id).toBe(state.scene);
        for (const ui of ['end-title', 'end-outcome', 'end-gained', 'end-cost', 'end-resource', 'replay', 'explore']) {
          const node = root.querySelector(`[data-ui=${ui}]`);
          expect(node, `${id}/${state.scene} ${ui}`).not.toBeNull();
          expect(node!.closest('details'), `${id}/${state.scene} ${ui} must not hide in a fold`).toBeNull();
          expect(node!.closest('dialog,[role=dialog]'), `${id} ${ui} no window`).toBeNull();
        }
        expect(root.querySelector('[data-ui=open-atlas]'), `${id}/${state.scene} bouton Atlas`).not.toBeNull();
        expect(root.querySelector('a[data-ui=contact]'), `${id}/${state.scene} contact`).not.toBeNull();
        for (const sel of ['[data-ui=open-atlas]', 'a[data-ui=contact]']) expect(root.querySelector(sel)!.closest('details'), `${id}/${state.scene} ${sel} must not hide in the fold`).toBeNull();
        expect(root.querySelector('[data-ui=end-resource]')?.textContent).toContain(`${journey.resource.initial} → ${state.resource}`);
        // The full sheet stays one optional press away, folded.
        const fold = root.querySelector<HTMLDetailsElement>('[data-ui=end-sheet]'); expect(fold).not.toBeNull(); expect(fold!.open).toBe(false);
        expect(fold!.querySelector('[data-ui=life-sheet]')).not.toBeNull();
        runtime.dispose();
      }
    }
  }, 60000);
});

describe('scènes à option unique', () => {
  /** The state just before `target`, and the option that leads to it. */
  function approach(journey: Journey, target: string): { state: JourneyState; option: string } {
    for (const state of reachable(journey, 2000)) {
      const scene = journey.scenes.find(s => s.id === state.scene)!; if (scene.ending || scene.options.length < 2) continue;
      for (const option of scene.options) { const next = decide(journey, state, option.id); if (next !== state && next.scene === target) return { state, option: option.id }; }
    }
    throw new Error(`no approach to ${target}`);
  }
  for (const [id, target] of [['w01', 'papers'], ['w04', 'trial']] as const) {
    it(`test_${id}_${target}_asksNoPress_andTheSaveStillReplays`, async () => {
      const journey = journeys[id]; const { state, option } = approach(journey, target);
      expect(journey.scenes.find(s => s.id === target)!.options.length).toBe(1);
      const { root, host, runtime } = await mountAt(id, state.choices);
      root.querySelector<HTMLButtonElement>(`[data-option="${option}"]`)!.click();
      await new Promise(resolve => setTimeout(resolve, 0)); // a change of place plays its arrival first
      expect(host.dataset['scene'], 'the single-option scene is applied by itself').not.toBe(target);
      const saved = store.get(keyOf(id))!;
      expect(JSON.parse(saved).choices.some((c: { scene: string }) => c.scene === target), 'decision recorded as before').toBe(true);
      // Same save, replayed from scratch (as an old save would be), lands on the same scene.
      expect(restoreJourney(journey, serializeJourney(journey, restoreJourney(journey, saved))).scene).toBe(host.dataset['scene']);
      if (host.dataset['ended'] !== 'true') expect(root.querySelector('.journey-told')?.textContent?.length ?? 0, 'told as narration, not asked').toBeGreaterThan(10);
      runtime.dispose();
    });
  }

  it('test_aSaveParkedOnASingleOptionScene_isAppliedAtMount', async () => {
    const journey = journeys.w04; const { state, option } = approach(journey, 'trial');
    const parked = decide(journey, state, option); expect(parked.scene).toBe('trial');
    const { host, runtime } = await mountAt('w04', parked.choices);
    expect(host.dataset['scene']).not.toBe('trial');
    runtime.dispose();
  });
});

describe('attributs de recette', () => {
  it('test_host_exposesSceneResourceBusyEnding', async () => {
    const { root, host, runtime } = await mountAt('w02', []);
    expect(host.dataset['scene']).toBeTruthy();
    expect(host.dataset['busy']).toBe('false');
    expect(root.querySelector('[data-ui=short-purse]')?.getAttribute('data-resource')).toBe(String(journeys.w02.resource.initial));
    expect(host.hasAttribute('data-ending')).toBe(false);
    runtime.dispose();
  });
});

describe('texte dit et texte raconté', () => {
  it('test_sceneLine_splitsTheToldFromTheSaid_withoutChangingTheText', async () => {
    const { root, runtime } = await mountAt('w02', []);
    const line = root.querySelector('.journey-line')!;
    const said = [...line.querySelectorAll('[data-ink=said]')].map(n => n.textContent ?? ''), told = [...line.querySelectorAll('[data-ink=told]')].map(n => n.textContent ?? '');
    expect(said.length).toBeGreaterThan(0); expect(told.length).toBeGreaterThan(0);
    expect(said.every(t => t.startsWith('«') && t.endsWith('»'))).toBe(true);
    expect(told.some(t => t.includes('«'))).toBe(false);
    expect((line.textContent ?? '').replace(/\s+/g, ' ')).toBe([...line.children].map(n => n.textContent).join('').replace(/\s+/g, ' '));
    runtime.dispose();
  });
});

describe('w06 repair', () => {
  it('test_w06_repair_whenOnlyOneOptionIsDisplayed_isAppliedByItself_andTheDecisionIsRecorded', async () => {
    const journey = journeys.w06; const scene = journey.scenes.find(x => x.id === 'repair')!; let checked = 0;
    for (const state of reachable(journey, 5000).filter(st => st.scene === 'repair')) {
      const shown = scene.options.filter(o => !(o.hideWhenBlocked && blockedReason(state, o, journey) !== null));
      if (shown.length !== 1 || blockedReason(state, shown[0]!, journey) !== null) continue;
      checked++;
      const { host, runtime } = await mountAt('w06', state.choices);
      expect(host.dataset['scene']).not.toBe('repair');
      const saved = JSON.parse(store.get(keyOf('w06'))!).choices as { scene: string; option: string }[];
      expect(saved.at(state.choices.length)).toEqual({ scene: 'repair', option: shown[0]!.id });
      runtime.dispose();
    }
    expect(checked).toBeGreaterThanOrEqual(1);
  });
});

describe('plancher d’image sur téléphone', () => {
  /** happy-dom has no layout: the picture frame height is simulated per sacrifice level (the grid gives the picture what the text and the plateau leave). */
  function simulate(stageAt: (level: number) => number) {
    const level = (el: Element): number => Number(el.closest<HTMLElement>('.journey')?.dataset['squeeze'] ?? 0);
    const proto = HTMLElement.prototype;
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    Object.defineProperty(proto, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('proto-stage') ? stageAt(level(this)) : this.classList.contains('journey') ? 600 : 0; } });
    Object.defineProperty(proto, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('journey') ? 600 : 0; } });
  }
  afterEach(() => { for (const key of ['clientHeight', 'scrollHeight']) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key]; });

  it('test_fit_sacrificesInOrder_untilThePictureHasItsAimOrTheFloor', async () => {
    simulate(level => 60 + 40 * level); // 60, 100, 140, 180, 220
    const { host, runtime } = await mountAt('w03', []);
    const squeeze = Number(host.dataset['squeeze']);
    expect(60 + 40 * squeeze).toBeGreaterThanOrEqual(150); // the aim
    expect(60 + 40 * (squeeze - 1)).toBeLessThan(150); // the lowest sufficient level, no sacrifice beyond need
    runtime.dispose();
  });

  it('test_fit_whenTheAimIsOutOfReach_keepsTheLowestLevelThatReachesTheFloor', async () => {
    simulate(level => 20 + 35 * level); // 20, 55, 90, 125, 160: the floor (120) at level 3, the aim (150) at level 4
    const { host, runtime } = await mountAt('w03', []);
    expect(host.dataset['squeeze']).toBe('4');
    runtime.dispose();
    simulate(level => 20 + 34 * level); // 20, 54, 88, 122, 156
    const second = await mountAt('w03', []);
    expect(second.host.dataset['squeeze']).toBe('4');
    second.runtime.dispose();
    simulate(level => (level >= 3 ? 125 : 0)); // the floor is reached at level 3 and never beyond
    const third = await mountAt('w03', []);
    expect(third.host.dataset['squeeze']).toBe('3');
    third.runtime.dispose();
  });

  it('test_fit_whenNothingMoreCanGive_stopsAtTheLastLevel', async () => {
    simulate(() => 0);
    const { host, runtime } = await mountAt('w03', []);
    expect(host.dataset['squeeze']).toBe('5');
    runtime.dispose();
  });
});
