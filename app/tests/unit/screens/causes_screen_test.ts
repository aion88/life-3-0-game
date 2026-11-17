// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import causesRaw from '../../../src/data/causes.json';
import frStrings from '../../../src/data/strings/fr.json';
import { parseCauses } from '../../../src/data/schema/causes';
import { causeEditions } from '../../../src/fastforward/causes';
import { createCausesScreen } from '../../../src/screens/causes';
import { loadFastForwardData } from '../../../src/screens/data';
import type { RunResult } from '../../../src/shared/types/run';
import { createScreenClock } from '../../../src/ui/clock';
import { loadUi } from '../../../src/data/ui/load';
import { fakeCtx, mountScreen } from '../../support/screens';
import { manualFrames } from '../../support/screens_causes';
import { replaceOne } from '../../../src/questionnaire';
import { ans, key } from '../../support/answers';
import { runOf } from '../../support/run';

beforeEach(()=>history.replaceState(null, '', '/?episode=semaine'));
const ctx0 = fakeCtx();
const Q = ctx0.core.questionnaire;
const { headlines, causes } = loadFastForwardData();
const W07 = 'CBCCBDBACCD';
const EDITION_MS = loadUi().timing.causesEditionsMs;
const TOTAL_MS = EDITION_MS.reduce((a, b) => a + b, 0);
const fr = frStrings as Record<string, string>;

async function open(run: RunResult = runOf(W07)) {
  const ctx = fakeCtx();
  const frames = manualFrames();
  const clock = createScreenClock();
  const mounted = await mountScreen(createCausesScreen({ frames, clock }), ctx, { run });
  frames.advance(50); // amorce : la première image n'avance pas l'horloge
  return { ...mounted, ctx, frames, run };
}
const edition = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-testid="causes-edition"]');
const replayBtn = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-testid="causes-replay"]');

describe('écran des causes [plan 03 T6]', () => {
  it('test_three_editions_shown_in_order_for_w07_run', async () => {
    const { root, frames, run } = await open();
    const expected = causeEditions(run, headlines, causes, Q);
    expect(expected).toHaveLength(3);
    const seen: string[] = [];
    seen.push(edition(root)!.dataset['index']!);
    frames.advance(EDITION_MS[0]! + 100);
    seen.push(edition(root)!.dataset['index']!);
    frames.advance(EDITION_MS[1]!);
    seen.push(edition(root)!.dataset['index']!);
    expect(seen).toEqual(['1', '2', '3']);
    expect(edition(root)!.textContent).toContain('2031');
  });

  it('test_last_edition_is_marked_last', async () => {
    const { root, frames } = await open();
    expect(edition(root)!.dataset['last']).toBe('false');
    expect(edition(root)!.textContent).toContain(fr['causes.ui.edition']);
    frames.advance(EDITION_MS[0]! + EDITION_MS[1]! + 100);
    expect(edition(root)!.dataset['last']).toBe('true');
    expect(edition(root)!.textContent).toContain(fr['causes.ui.final']);
  });

  it('test_lit_beats_only_are_rendered_lit', async () => {
    const { root, frames, run } = await open();
    const expected = causeEditions(run, headlines, causes, Q);
    for (const e of expected) {
      const beats = [...edition(root)!.querySelectorAll<HTMLElement>('[data-beat]')];
      expect(beats.map((b) => b.dataset['beat'])).toEqual(e.beats.filter((b) => b.lit).map((b) => b.beatId));
      expect(beats.every((b) => b.dataset['lit'] === 'true')).toBe(true);
      for (const b of beats) expect(fr[e.beats.find((x) => x.beatId === b.dataset['beat'])!.lineKey!]).toContain(b.textContent!.split('.')[0]);
      frames.advance(EDITION_MS[e.index - 1]!);
    }
  });

  it('test_replay_button_appears_after_40_seconds_of_causes', async () => {
    expect(TOTAL_MS).toBe(40000);
    const { root, frames } = await open();
    frames.advance(39900);
    expect(replayBtn(root)).toBeNull();
    frames.advance(100);
    expect(replayBtn(root)).not.toBeNull();
    expect(replayBtn(root)!.textContent).toBe(fr['causes.ui.replay']);
  });

  it('test_speed_does_not_exist_on_causes', async () => {
    const { root, frames } = await open();
    frames.advance(TOTAL_MS);
    expect(root.querySelector('[data-ui="speed"], [data-testid*="speed"], [aria-label*="vitesse" i]')).toBeNull();
    expect(root.textContent).not.toContain(fr['ff.ui.speed.label']);
  });

  it('test_causes_replay_opens_bilan_as_extinction', async () => {
    const { root, frames, ctx, run } = await open();
    frames.advance(TOTAL_MS);
    replayBtn(root)!.click();
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).toHaveBeenCalledWith('bilan', { input: { entry: 'extinction', run, week: null, survival: null, acts: [] } });
  });

  it('test_causes_has_a_single_exit_button', async () => {
    const { root, frames } = await open();
    expect(root.querySelectorAll('button')).toHaveLength(0);
    frames.advance(TOTAL_MS);
    expect(root.querySelectorAll('button')).toHaveLength(1);
  });

  it('test_softened_hides_rupture_year_and_swaps_beat_8', async () => {
    const run = { ...runOf(W07), softened: true };
    const { root, frames } = await open(run);
    frames.advance(EDITION_MS[0]! + EDITION_MS[1]! + 100);
    const last = edition(root)!;
    expect(last.textContent).not.toContain('2031');
    const rupture = parseCauses(causesRaw).byExtinction.w07.find((b) => b.linkedHeadline === 'rupture')!;
    expect(last.querySelector<HTMLElement>(`[data-beat="${rupture.id}"]`)!.textContent).toBe(fr['causes.ui.countdownStops']);
    expect(last.textContent).not.toContain(fr['cause.w07.8.sum']);
  });

  it('test_b_v10_softened_extinction_page_has_no_rupture_year_string', async () => {
    const run = { ...runOf(W07), softened: true };
    const { root, frames } = await open(run);
    frames.advance(TOTAL_MS);
    const ruptureYear = String(causeEditions(runOf(W07), headlines, causes, Q)[2]!.year);
    expect(ruptureYear).toBe('2031');
    expect(root.textContent).not.toContain(ruptureYear);
    expect(root.innerHTML).not.toContain(ruptureYear);
  });

  it('test_causes_screen_shows_no_gauge_or_number_beyond_year', async () => {
    const { root, frames } = await open();
    for (let i = 0; i < 3; i++) {
      const stripped = (root.textContent ?? '').replace(/(?<!\d)(19|20)\d{2}(?!\d)/g, '');
      expect(stripped).not.toMatch(/\d/);
      frames.advance(EDITION_MS[i]!);
    }
    expect(root.querySelector('progress, meter, [role="progressbar"], canvas[data-gauge]')).toBeNull();
  });

  it('test_unfilled_gabarit_sentences_are_omitted_never_invented', async () => {
    const { root, frames } = await open();
    for (const d of EDITION_MS) {
      expect(root.textContent).not.toMatch(/[{}]/);
      expect(root.textContent).not.toContain(String.fromCharCode(0));
      frames.advance(d);
    }
  });

  it('resolved fictional consequences include the affected relative without fabricated figures', async () => {
    const q20c: RunResult = { ...runOf(W07), answers: replaceOne(replaceOne(ans(W07), key('Q14'), 'A'), key('Q20'), 'C') };
    const a = await open(q20c); a.frames.advance(EDITION_MS[0]!);
    expect(a.root.querySelector('[data-beat="5"]')?.textContent).toContain('employée');
    const b = await open(runOf(W07)); b.frames.advance(EDITION_MS[0]!);
    expect(b.root.querySelector('[data-beat="5"]')?.textContent).toContain('automatisation');
    expect(b.root.querySelector('[data-beat="5"]')?.textContent).not.toContain('frère');
    expect(b.root.textContent).not.toMatch(/[{}]/);
  });

  it('short extinction is readable at the player’s pace and exposes exploration immediately', async () => {
    history.replaceState(null, '', '/');
    const {root,frames}=await open();
    const first=edition(root)?.textContent; frames.advance(60_000);
    expect(edition(root)?.textContent).toBe(first);
    expect(root.querySelector('[data-testid="causes-explore"]')).not.toBeNull();
    const next=root.querySelector<HTMLButtonElement>('[data-testid="causes-next"]')!;
    next.click(); next.click(); expect(edition(root)?.dataset['last']).toBe('true');
    expect(replayBtn(root)?.hidden).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-testid="causes-previous"]')!.click();
    expect(edition(root)?.dataset['last']).toBe('false');
  });

  it('test_unmount_stops_the_frame_loop', async () => {
    const { screen, root, frames } = await open();
    screen.unmount();
    frames.advance(TOTAL_MS);
    expect(replayBtn(root)).toBeNull();
  });
});
