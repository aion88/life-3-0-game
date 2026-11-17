// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createFrameClock, createScreenClock } from '../../../src/ui/clock';
import { manualFrames } from '../../support/street_screen';

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}
afterEach(() => setHidden(false));

describe('horloge d\'écran', () => {
  it('test_clock_advances_only_when_running', () => {
    const c = createScreenClock();
    expect(c.now()).toBe(0);
    c.advance(500);
    expect(c.now()).toBe(500);
    c.pause();
    c.advance(500);
    expect(c.now()).toBe(500);
    c.dispose();
  });

  it('test_pause_stops_the_clock_and_resume_continues', () => {
    const c = createScreenClock();
    c.advance(100);
    c.pause();
    expect(c.paused()).toBe(true);
    c.advance(900);
    c.resume();
    expect(c.paused()).toBe(false);
    c.advance(50);
    expect(c.now()).toBe(150);
    c.dispose();
  });

  it('test_speed_multiplies_real_delta : x2, 1000 ms réels donnent 2000 ms d\'écran', () => {
    const c = createScreenClock();
    c.setSpeed(2);
    c.advance(1000);
    expect(c.now()).toBe(2000);
    c.setSpeed(4);
    c.advance(1000);
    expect(c.now()).toBe(6000);
    c.dispose();
  });

  it('test_hidden_tab_pauses_the_clock : sans changer la vitesse', () => {
    const c = createScreenClock();
    c.setSpeed(4);
    setHidden(true);
    expect(c.paused()).toBe(true);
    c.advance(1000);
    expect(c.now()).toBe(0);
    expect(c.speed()).toBe(4);
    c.dispose();
  });

  it('test_visible_again_resumes_only_if_not_user_paused', () => {
    const c = createScreenClock();
    setHidden(true);
    setHidden(false);
    expect(c.paused()).toBe(false);
    c.pause();
    setHidden(true);
    setHidden(false);
    expect(c.paused()).toBe(true);
    c.resume();
    expect(c.paused()).toBe(false);
    c.dispose();
  });

  it('dispose retire l\'écouteur de visibilité', () => {
    const c = createScreenClock();
    c.dispose();
    setHidden(true);
    expect(c.paused()).toBe(false);
  });
});

describe('horloge d\'images (boucle injectée, R-03.4)', () => {
  it('avance l\'horloge de l\'écart entre images, pas du temps absolu', () => {
    const frames = manualFrames();
    const c = createScreenClock();
    const seen: number[] = [];
    const fc = createFrameClock(frames, c, (t) => seen.push(t));
    fc.start();
    frames.step(16);
    frames.step(16);
    frames.step(16);
    expect(c.now()).toBe(32);
    expect(seen.length).toBe(3);
    fc.stop();
    expect(frames.pending()).toBe(0);
    c.dispose();
  });

  it('un onglet resté caché 60 s ne fait pas sauter l\'horloge : au plus une image au retour', () => {
    const frames = manualFrames();
    const c = createScreenClock();
    const fc = createFrameClock(frames, c);
    fc.start();
    frames.step(16);
    frames.step(16);
    const before = c.now();
    setHidden(true);
    setHidden(false); // aucune image pendant 60 s : rAF est suspendu
    frames.step(60_000);
    expect(c.now() - before).toBeLessThanOrEqual(16);
    frames.step(16);
    expect(c.now() - before).toBeLessThanOrEqual(32);
    fc.stop();
    c.dispose();
  });

  it('même sans événement de visibilité, un écart géant est plafonné par maxFrameMs', () => {
    const frames = manualFrames();
    const c = createScreenClock();
    const fc = createFrameClock(frames, c, undefined, { maxFrameMs: 40 });
    fc.start();
    frames.step(16);
    frames.step(60_000);
    expect(c.now()).toBe(40);
    fc.stop();
    c.dispose();
  });

  it('une pause ne laisse pas un saut au retour : le premier écart après reprise est un écart d\'une image', () => {
    const frames = manualFrames();
    const c = createScreenClock();
    const fc = createFrameClock(frames, c);
    fc.start();
    frames.step(16);
    frames.step(16);
    c.pause();
    frames.step(5000);
    c.resume();
    frames.step(16);
    frames.step(16);
    expect(c.now()).toBe(48);
    fc.stop();
    c.dispose();
  });
});
