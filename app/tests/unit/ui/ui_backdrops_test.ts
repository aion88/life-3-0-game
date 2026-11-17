// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCrtWall } from '../../../src/ui/backdrops/crtWall';
import { createTriptych } from '../../../src/ui/backdrops/triptych';
import { loadUi } from '../../../src/data/ui/load';
import { WORLD_VARS, type WorldVar } from '../../../src/shared/types';
import { fakeCanvas2d } from '../../support/screens';
import { manualFrames } from '../../support/street_screen';

afterEach(() => vi.unstubAllGlobals());

describe('mur de CRT', () => {
  it('test_crt_wall_has_three_states', () => {
    const r = fakeCanvas2d();
    const wall = createCrtWall(r.canvas, { seed: 7, reducedMotion: false });
    expect(wall.states()).toEqual(['snow', 'dark', 'testcard']);
  });

  it('test_crt_wall_draws_no_glyph : aucun fillText ni strokeText, dans les trois états et la sortie', () => {
    const r = fakeCanvas2d();
    const wall = createCrtWall(r.canvas, { seed: 7, reducedMotion: false });
    wall.states().forEach((_s, i) => { wall.setParams({ state: i }); wall.renderAt(100); wall.renderAt(900); });
    void wall.exit();
    wall.renderAt(2000);
    wall.renderAt(9000);
    const calls = r.calls();
    expect(calls.length).toBeGreaterThan(50);
    expect(calls.filter((c) => c.startsWith('fillText') || c.startsWith('strokeText'))).toEqual([]);
  });

  it('test_crt_wall_screen_off_colour_is_data_driven : changer screenOff change le fond tracé', () => {
    const w = loadUi().theme.wall as { screenOff: string };
    const original = w.screenOff;
    const draw = (): readonly string[] => {
      const r = fakeCanvas2d();
      const wall = createCrtWall(r.canvas, { seed: 7, reducedMotion: false });
      wall.setParams({ state: 1 });
      wall.renderAt(100);
      return r.calls();
    };
    try {
      w.screenOff = '#102030';
      const a = draw();
      w.screenOff = '#304050';
      const b = draw();
      expect(a).toContain('fillStyle="#102030"');
      expect(a).not.toEqual(b);
      expect(b).not.toContain('fillStyle="#102030"');
    } finally { w.screenOff = original; }
  });

  it('test_crt_wall_frame_is_deterministic_for_a_seed', () => {
    const a = fakeCanvas2d(); const b = fakeCanvas2d();
    createCrtWall(a.canvas, { seed: 42, reducedMotion: false }).renderAt(1234);
    createCrtWall(b.canvas, { seed: 42, reducedMotion: false }).renderAt(1234);
    expect(a.calls()).toEqual(b.calls());
    const c = fakeCanvas2d();
    createCrtWall(c.canvas, { seed: 43, reducedMotion: false }).renderAt(1234);
    expect(c.calls()).not.toEqual(a.calls());
  });

  it('test_reduced_motion_freezes_the_frame', () => {
    const r = fakeCanvas2d();
    const wall = createCrtWall(r.canvas, { seed: 5, reducedMotion: true });
    wall.renderAt(100);
    const first = r.calls();
    r.reset();
    wall.renderAt(7777);
    expect(r.calls()).toEqual(first);
    const live = fakeCanvas2d();
    const w2 = createCrtWall(live.canvas, { seed: 5, reducedMotion: false });
    w2.renderAt(100);
    const f1 = live.calls();
    live.reset();
    w2.renderAt(7777);
    expect(live.calls()).not.toEqual(f1);
  });

  it('test_backing_store_follows_dpr : devicePixelRatio 2 donne width = 2 x clientWidth', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const r = fakeCanvas2d({ clientWidth: 800, clientHeight: 450 });
    createCrtWall(r.canvas, { seed: 1, reducedMotion: false }).renderAt(0);
    expect(r.canvas.width).toBe(1600);
    expect(r.canvas.height).toBe(900);
    const t = fakeCanvas2d({ clientWidth: 800, clientHeight: 450 });
    createTriptych(t.canvas, loadUi().triptych, { seed: 1, reducedMotion: false }).renderAt(0);
    expect(t.canvas.width).toBe(1600);
  });

  it('start boucle sur la boucle injectée, stop la libère ; le mouvement réduit ne boucle pas', () => {
    const frames = manualFrames();
    const r = fakeCanvas2d();
    const wall = createCrtWall(r.canvas, { seed: 1, reducedMotion: false, frames });
    wall.start();
    frames.step(16);
    frames.step(16);
    expect(frames.pending()).toBe(1);
    wall.stop();
    expect(frames.pending()).toBe(0);
    const still = createCrtWall(fakeCanvas2d().canvas, { seed: 1, reducedMotion: true, frames });
    still.start();
    expect(frames.pending()).toBe(0);
  });

  it('exit appelé deux fois rend la même promesse ; changer d\'état rouvre le mur', async () => {
    const r = fakeCanvas2d();
    const wall = createCrtWall(r.canvas, { seed: 1, reducedMotion: false });
    const a = wall.exit();
    expect(wall.exit()).toBe(a);
    wall.renderAt(0);
    wall.renderAt(loadUi().timing.wallExitMs + 1);
    await a;
    r.reset();
    wall.renderAt(10);
    const dark = r.calls();
    wall.setParams({ state: 0 });
    r.reset();
    wall.renderAt(10);
    expect(r.calls()).not.toEqual(dark);
  });

  it('exit se résout une fois la durée écoulée, tout de suite en mouvement réduit', async () => {
    const r = fakeCanvas2d();
    const wall = createCrtWall(r.canvas, { seed: 1, reducedMotion: false });
    let done = false;
    const p = wall.exit().then(() => { done = true; });
    wall.renderAt(0);
    await Promise.resolve();
    expect(done).toBe(false);
    wall.renderAt(loadUi().timing.wallExitMs + 1);
    await p;
    expect(done).toBe(true);
    const still = createCrtWall(fakeCanvas2d().canvas, { seed: 1, reducedMotion: true });
    await still.exit();
  });
});

describe('triptyque', () => {
  const pairing = loadUi().triptych;
  const base = Object.fromEntries(WORLD_VARS.map((v) => [v, 0.5])) as Record<WorldVar, number>;
  const draw = (params: Record<WorldVar, number>): string[] => {
    const r = fakeCanvas2d();
    const t = createTriptych(r.canvas, pairing, { seed: 9, reducedMotion: false });
    t.setParams(params);
    t.renderAt(500);
    return [...r.calls()];
  };

  it('test_triptych_reacts_to_all_six_vars : changer une variable change au moins un appel', () => {
    const ref = draw(base);
    for (const v of WORLD_VARS) {
      expect(draw({ ...base, [v]: 0.95 }), v).not.toEqual(ref);
      expect(draw({ ...base, [v]: 0.05 }), v).not.toEqual(ref);
    }
  });

  it('chaque variable ne change que sa bande (trois groupes save/restore)', () => {
    const bands = (calls: string[]): string[][] => {
      const out: string[][] = []; let cur: string[] | null = null;
      for (const c of calls) {
        if (c === 'save()') cur = [];
        else if (c === 'restore()') { if (cur) out.push(cur); cur = null; }
        else cur?.push(c);
      }
      return out;
    };
    const ref = bands(draw(base));
    expect(ref.length).toBe(3);
    const where = { sky: 0, city: 1, ground: 2 } as const;
    for (const [band, vars] of Object.entries(pairing.bands) as [keyof typeof where, WorldVar[]][]) {
      for (const v of vars) {
        const got = bands(draw({ ...base, [v]: 0.95 }));
        got.forEach((g, i) => { if (i === where[band]) expect(g).not.toEqual(ref[i]); else expect(g).toEqual(ref[i]); });
      }
    }
  });

  it('le triptyque ne dessine aucun glyphe', () => {
    expect(draw(base).filter((c) => c.startsWith('fillText'))).toEqual([]);
  });
});
