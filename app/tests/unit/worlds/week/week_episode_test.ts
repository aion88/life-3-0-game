// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountWeekEpisode, type WeekEpisodeOptions } from '../../../../src/worlds/week/weekEpisode';
import type { WeekStageDriver } from '../../../../src/worlds/week/weekContracts';
import type { ControlStationDriver } from '../../../../src/worlds/controlStationEpisode';

/** Parties du plan §9.1 : indice de cible ou de ligne (-1 = laisser passer), dans l'ordre des 11 décisions. */
const PARTIES = {
  recrute: { answers: [0, 2, 0, 1, 1, 1, 0, 0, 0, 1, 0], dossier: '79', ending: 'recrute', names: 3 },
  arrete: { answers: [2, 0, 1, 0, 0, 2, 2, 2, 3, 0, 1], dossier: '-10', ending: 'arrete', names: 0 },
  relache: { answers: [0, -1, 0, 1, 1, 1, 2, 0, 3, 1, 1], dossier: '44', ending: 'relache', names: 0 },
  garante: { answers: [2, 0, 0, 0, 0, 2, 2, 2, 3, 0, 1], dossier: '-6', ending: 'arrete', names: 0 },
} as const;

/** Faux décor et fausse vue du contrôle : journalisent, et comptent les contextes vivants. */
function fakes() {
  const log: string[] = [];
  let live = 0;
  let maxLive = 0;
  let controls = 0;
  const born = (name: string): void => { live++; maxLive = Math.max(maxLive, live); log.push(`${name}+`); };
  const createStage = async (): Promise<WeekStageDriver> => {
    born('stage');
    return {
      show: async (place, cast) => { log.push(`show:${place}:${cast.join('+')}`); },
      speak: () => {}, prop: () => {}, act: async (act) => { log.push(`act:${act}`); },
      pause: () => {}, skip: () => {},
      dispose: () => { live--; log.push('stage-'); },
    };
  };
  const createControlView = async (): Promise<ControlStationDriver> => {
    born('control');
    controls++;
    return {
      approach: async () => { log.push('control:approach'); },
      requestGuarantee: async () => { log.push('control:requestGuarantee'); },
      authorize: async () => { log.push('control:authorize'); },
      goHome: async () => { log.push('control:goHome'); },
      pause: () => {}, skip: () => {},
      dispose: () => { live--; log.push('control-'); },
    };
  };
  return { log, createStage, createControlView, stats: () => ({ live, maxLive, controls }) };
}

const disposers: Array<() => void> = [];
afterEach(() => {
  for (const d of disposers.splice(0)) d();
  document.body.replaceChildren();
  vi.useRealTimers();
});

async function mount(extra: Partial<WeekEpisodeOptions> = {}) {
  const f = fakes();
  const root = document.createElement('div');
  document.body.append(root);
  const dispose = await mountWeekEpisode(root, { createStage: f.createStage, createControlView: f.createControlView, wait: () => Promise.resolve(), ...extra });
  disposers.push(dispose);
  const host = root.querySelector<HTMLElement>('main[data-testid=week-episode]')!;
  return { f, root, host, dispose };
}

const q = (host: HTMLElement, selector: string): HTMLElement | null => host.querySelector<HTMLElement>(selector);
const actionable = (host: HTMLElement): HTMLElement | null =>
  host.dataset['ending'] ? q(host, '[data-action=replay]') : q(host, '[data-action=close-ticket]') ?? q(host, '[data-choice]') ?? q(host, '[data-line]') ?? q(host, '[data-action=piece-none]');

/** Touche le papier jusqu'à ce qu'il parte : un premier toucher peut seulement finir l'impression. */
function touchPaper(host: HTMLElement): void {
  const paper = q(host, '[data-action=close-ticket]')!;
  paper.click();
  if (paper.isConnected) paper.click();
}

interface Presses { decisions: number; papers: number }

/** Joue une partie par clics : un appui par décision, un toucher par papier. S'arrête à la fin, ou quand `stopAt` devient vrai. */
async function drive(host: HTMLElement, answers: readonly number[], stopAt: () => boolean = () => false): Promise<Presses> {
  const presses: Presses = { decisions: 0, papers: 0 };
  const queue = [...answers];
  for (;;) {
    await vi.waitFor(() => { if (!actionable(host) && !stopAt()) throw new Error(`rien à toucher (beat=${host.dataset['beat']}, scène=${host.dataset['scene']})`); });
    if (stopAt()) return presses;
    expect(host.querySelectorAll('.we-line').length).toBeLessThanOrEqual(3);
    if (host.dataset['ending']) return presses;
    const ticket = q(host, '[data-action=close-ticket]');
    if (ticket) { ticket.click(); presses.papers++; await vi.waitFor(() => expect(ticket.isConnected).toBe(false)); continue; }
    const choices = host.querySelectorAll<HTMLElement>('[data-choice]');
    const answer = queue.shift();
    if (answer === undefined) throw new Error('plus de réponse prévue');
    let pressed: HTMLElement;
    if (choices.length > 0) pressed = choices[answer]!;
    else if (answer === -1) pressed = q(host, '[data-action=piece-none]')!;
    else pressed = q(host, `[data-line="${answer}"]`)!;
    pressed.click();
    presses.decisions++;
    await vi.waitFor(() => expect(pressed.isConnected).toBe(false));
  }
}

describe('semaine 1984, shell', () => {
  for (const [name, party] of Object.entries(PARTIES)) {
    it(`test_week_episode_${name}_party_reaches_expected_ending_with_11_decisions_and_4_papers`, async () => {
      const { host, f } = await mount();
      const presses = await drive(host, party.answers);
      expect(host.dataset['ending']).toBe(party.ending);
      expect(host.dataset['dossier']).toBe(party.dossier);
      expect(host.dataset['beat']).toBe('ending');
      expect(presses).toEqual({ decisions: 11, papers: 4 });
      expect(host.dataset['names'] ? host.dataset['names'].split(',').length : 0).toBe(party.names);
      expect(f.stats().maxLive).toBe(1);
    });
  }

  it('test_week_episode_guarantor_party_ending_shows_the_mother_line', async () => {
    const { host } = await mount();
    await drive(host, PARTIES.garante.answers);
    expect(q(host, '[data-testid=week-ending]')!.textContent).toContain('Ta mère reçoit un avis');
    const noMother = await mount();
    await drive(noMother.host, PARTIES.arrete.answers);
    expect(q(noMother.host, '[data-testid=week-ending]')!.textContent).not.toContain('Ta mère');
  });

  it('test_week_episode_mother_branch_shows_parents_after_control_is_disposed_with_one_control_view', async () => {
    const { host, f } = await mount();
    await drive(host, PARTIES.recrute.answers);
    const at = (entry: string): number => f.log.indexOf(entry);
    expect(f.stats().controls).toBe(1);
    expect(f.log).toContain('show:parents:maman+papa');
    expect(at('control-')).toBeGreaterThan(-1);
    expect(at('control-')).toBeLessThan(at('show:parents:maman+papa'));
    // Le contexte du contrôle meurt avant que la scène de la semaine renaisse.
    expect(f.log.slice(at('control-'), at('show:parents:maman+papa')).includes('stage+')).toBe(true);
    expect(f.log).toContain('control:requestGuarantee');
    expect(f.log).toContain('control:authorize');
  });

  it('test_week_episode_home_branch_has_no_parents_scene_and_one_control_view', async () => {
    const { host, f } = await mount();
    await drive(host, PARTIES.arrete.answers);
    expect(f.log.some((e) => e.startsWith('show:parents'))).toBe(false);
    expect(f.log).toContain('control:goHome');
    expect(f.stats().controls).toBe(1);
    expect(f.stats().maxLive).toBe(1);
  });

  it('test_week_episode_ticket_left_60s_stays_with_same_paper', async () => {
    vi.useFakeTimers();
    const { host } = await mount({ wait: (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); }) });
    await vi.advanceTimersByTimeAsync(200);
    const paper = q(host, '[data-action=close-ticket]');
    expect(paper).not.toBeNull();
    expect(host.dataset['beat']).toBe('ticket');
    expect(host.dataset['scene']).toBe('P-J1-01');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.dataset['beat']).toBe('ticket');
    expect(host.dataset['scene']).toBe('P-J1-01');
    expect(q(host, '[data-action=close-ticket]')).toBe(paper);
    expect(host.querySelector('[data-action=continue]')).toBeNull();
  });

  it('test_week_episode_ticket_touch_during_printing_finishes_printing_without_closing_then_next_touch_closes', async () => {
    const { host } = await mount({ wait: () => new Promise<void>(() => {}) });
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('ticket'));
    const paper = q(host, '[data-action=close-ticket]')!;
    expect(paper.dataset['printed']).toBe('false');
    expect(paper.querySelectorAll('.we-wait').length).toBeGreaterThan(1);
    expect(q(host, '.we-hint')!.classList.contains('we-wait')).toBe(true);
    paper.click();
    expect(paper.isConnected).toBe(true);
    expect(host.dataset['beat']).toBe('ticket');
    expect(paper.dataset['printed']).toBe('true');
    expect(paper.querySelectorAll('.we-wait').length).toBe(0);
    paper.click();
    await vi.waitFor(() => expect(paper.isConnected).toBe(false));
    await vi.waitFor(() => expect(host.dataset['beat']).not.toBe('ticket'));
  });

  it('test_week_episode_ticket_prints_by_itself_then_shows_the_prompt_and_stays_until_touched', async () => {
    vi.useFakeTimers();
    const { host } = await mount({ wait: (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); }) });
    await vi.advanceTimersByTimeAsync(100);
    const paper = q(host, '[data-action=close-ticket]')!;
    expect(paper.dataset['printed']).toBe('false');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(paper.dataset['printed']).toBe('true');
    expect(q(host, '.we-hint')!.classList.contains('we-wait')).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(paper.isConnected).toBe(true);
    expect(host.dataset['beat']).toBe('ticket');
  });

  it('test_week_episode_target_left_60s_does_not_move', async () => {
    vi.useFakeTimers();
    const { host } = await mount({ wait: (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); }) });
    await vi.advanceTimersByTimeAsync(200);
    touchPaper(host);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(host.dataset['beat']).toBe('gesture');
    const ids = Array.from(host.querySelectorAll('[data-choice]')).map((e) => e.getAttribute('data-choice'));
    expect(ids.length).toBe(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.dataset['beat']).toBe('gesture');
    expect(host.dataset['scene']).toBe('P-J1-02');
    expect(Array.from(host.querySelectorAll('[data-choice]')).map((e) => e.getAttribute('data-choice'))).toEqual(ids);
    expect(host.dataset['words']).toBe('20');
  });

  it('test_week_episode_every_target_shows_a_price_before_the_gesture_and_the_effect_after', async () => {
    const { host } = await mount();
    await vi.waitFor(() => expect(q(host, '[data-action=close-ticket]')).not.toBeNull());
    q(host, '[data-action=close-ticket]')!.click();
    await vi.waitFor(() => expect(host.querySelectorAll('[data-choice]').length).toBe(3));
    const prices = Array.from(host.querySelectorAll('.we-target')).map((t) => t.querySelector('.we-t-price')?.textContent ?? '');
    expect(prices.every((p) => p.length > 0 && !p.includes(' · '))).toBe(true);
    expect(prices).toEqual(['0 mot', '5 mots', '8 mots']);
    host.querySelectorAll<HTMLElement>('[data-choice]')[2]!.click();
    await vi.waitFor(() => expect(host.dataset['words']).toBe('12'));
    expect(host.dataset['dossier']).toBe('56');
    expect(q(host, '.we-delta[data-sign=moins]')).not.toBeNull();
  });

  it('test_week_episode_text_advances_alone_but_a_space_press_accelerates_without_deciding', async () => {
    const { host } = await mount({ wait: () => new Promise<void>(() => {}) });
    await vi.waitFor(() => expect(q(host, '[data-action=close-ticket]')).not.toBeNull());
    touchPaper(host);
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('lines'));
    expect(host.querySelectorAll('.we-line').length).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await vi.waitFor(() => expect(host.querySelectorAll('.we-line').length).toBe(2));
    expect(host.dataset['beat']).toBe('lines');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('gesture'));
    // Une pression d'Espace ne décide jamais.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await Promise.resolve();
    expect(host.dataset['beat']).toBe('gesture');
    expect(host.querySelectorAll('[data-choice]').length).toBe(3);
  });

  it('test_week_episode_space_closes_the_ticket', async () => {
    const { host } = await mount();
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('ticket'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await vi.waitFor(() => expect(host.dataset['beat']).not.toBe('ticket'));
  });

  it('test_week_episode_dragging_the_object_onto_a_target_decides_like_a_tap', async () => {
    const { host, f } = await mount();
    const withObject = (): boolean => q(host, '.we-object') !== null;
    await drive(host, PARTIES.arrete.answers, withObject);
    expect(host.dataset['scene']).toBe('P-J1-04');
    const object = q(host, '.we-object')!;
    const target = host.querySelectorAll<HTMLElement>('[data-choice]')[1]!;
    const previous = document.elementFromPoint;
    document.elementFromPoint = () => target;
    const pointer = (type: string, x: number, y: number): void => {
      object.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }) as unknown as PointerEvent);
    };
    const withId = (type: string, x: number, y: number): void => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      object.dispatchEvent(event);
    };
    void pointer;
    withId('pointerdown', 10, 10);
    withId('pointermove', 60, 80);
    withId('pointerup', 60, 80);
    document.elementFromPoint = previous;
    await vi.waitFor(() => expect(f.log).toContain('control:goHome'));
  });

  it('test_week_episode_replay_restarts_a_fresh_game_with_20_words_dossier_60_day_1', async () => {
    const { host, f } = await mount();
    await drive(host, PARTIES.recrute.answers);
    expect(host.dataset['ending']).toBe('recrute');
    q(host, '[data-action=replay]')!.click();
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('ticket'));
    expect(host.dataset['words']).toBe('20');
    expect(host.dataset['dossier']).toBe('60');
    expect(host.dataset['day']).toBe('1');
    expect(host.dataset['scene']).toBe('P-J1-01');
    expect(host.dataset['ending']).toBeUndefined();
    expect(host.dataset['names']).toBe('');
    expect(f.stats().maxLive).toBe(1);
  });

  it('test_week_episode_stage_failure_shows_error_with_replay_never_a_blank_screen', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempts = 0;
    const { host } = await mount({
      createStage: async () => {
        attempts++;
        if (attempts === 1) throw new Error('pas de WebGL');
        return fakes().createStage();
      },
    });
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('error'));
    expect(q(host, '[data-action=replay]')).not.toBeNull();
    q(host, '[data-action=replay]')!.click();
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('ticket'));
    spy.mockRestore();
  });

  it('test_week_episode_dispose_frees_the_context_and_removes_the_shell', async () => {
    const { host, f, dispose } = await mount();
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('ticket'));
    expect(f.stats().live).toBe(1);
    dispose();
    expect(f.stats().live).toBe(0);
    expect(host.isConnected).toBe(false);
  });

  it('test_week_episode_dispose_during_stage_loading_releases_the_late_stage', async () => {
    let release: (() => void) | undefined;
    let disposed = 0;
    const late = (): Promise<WeekStageDriver> => new Promise((resolve) => {
      release = () => resolve({ show: async () => {}, speak: () => {}, prop: () => {}, act: async () => {}, pause: () => {}, skip: () => {}, dispose: () => { disposed++; } });
    });
    const { host, dispose } = await mount({ createStage: late });
    expect(host.dataset['beat']).toBe('loading');
    dispose();
    release?.();
    await vi.waitFor(() => expect(disposed).toBe(1));
  });

  it('test_week_episode_hierarchy_markup_target_price_and_hud_testids_exist', async () => {
    const { host } = await mount();
    expect(q(host, '[data-testid=week-viewport]')).not.toBeNull();
    expect(q(host, '[data-testid=week-words]')).not.toBeNull();
    expect(q(host, '[data-testid=week-dossier]')).not.toBeNull();
    await vi.waitFor(() => expect(host.dataset['beat']).toBe('ticket'));
    q(host, '[data-action=close-ticket]')!.click();
    await vi.waitFor(() => expect(host.querySelectorAll('.we-target').length).toBe(3));
    expect(q(host, '.we-prompt')!.textContent).toContain('Mme Roux');
    expect(q(host, '.we-t-label')!.textContent).toBe('Te taire');
  });
});
