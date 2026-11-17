// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

const over = vi.hoisted(() => ({ wall: {} as Record<string, number>, render: {} as Record<string, number>, theme: {} as Record<string, number> }));
vi.mock('../../../src/data/ui/load', async (orig) => {
  const m = await orig<typeof import('../../../src/data/ui/load')>();
  return {
    ...m,
    loadUi: () => {
      const b = m.loadUi();
      return {
        ...b,
        theme: { ...b.theme, ...over.theme, wall: { ...b.theme.wall, ...over.wall } },
        triptych: { ...b.triptych, render: { ...b.triptych.render, ...over.render } },
      };
    },
  };
});

import { createCrtWall } from '../../../src/ui/backdrops/crtWall';
import { createTriptych } from '../../../src/ui/backdrops/triptych';
import { createTwoStep } from '../../../src/ui/components/twoStep';
import { loadUi } from '../../../src/data/ui/load';
import { fakeCanvas2d } from '../../support/screens';

afterEach(() => { for (const o of [over.wall, over.render, over.theme]) for (const k of Object.keys(o)) delete o[k]; });

const wallCalls = (state: number): string[] => {
  const r = fakeCanvas2d();
  const w = createCrtWall(r.canvas, { seed: 3, reducedMotion: false });
  w.setParams({ state });
  w.renderAt(500);
  return [...r.calls()];
};
const triCalls = (): string[] => {
  const r = fakeCanvas2d();
  const t = createTriptych(r.canvas, loadUi().triptych, { seed: 3, reducedMotion: false });
  t.setParams({ aiPower: 1, surveillance: 1, order: 0.6, abundance: 1, freedom: 1, unrest: 1 });
  t.renderAt(500);
  return [...r.calls()];
};

describe('le rendu lit les réglages (changer la donnée change le dessin)', () => {
  const wallKeys: [string, number, number][] = [
    ['screenInset', 0.2, 0], ['darkGlintAlpha', 0.5, 1], ['glintHeight', 0.7, 1], ['snowAlpha', 0.3, 0],
  ];
  it.each(wallKeys)('wall.%s', (key, value, state) => {
    const ref = wallCalls(state);
    over.wall[key] = value;
    expect(wallCalls(state)).not.toEqual(ref);
  });

  const renderKeys: [string, number][] = [
    ['starAlphaBase', 0.1], ['starAlphaSwing', 0.1], ['twinkleMs', 90], ['beamSwayMs', 90], ['beamSway', 0.2], ['beamAlpha', 0.9],
    ['beamConverge', 0.9], ['buildingMinRel', 0.6], ['buildingSpanRel', 0.2], ['orderFloor', 0.9], ['pathAlpha', 0.1], ['crackSpan', 5],
    ['crackAlphaBase', 0.9], ['crackAlphaSwing', 0.05], ['crackMs', 90],
  ];
  it.each(renderKeys)('triptych.render.%s', (key, value) => {
    const ref = triCalls();
    over.render[key] = value;
    expect(triCalls()).not.toEqual(ref);
  });

  it('theme.fadedOpacity', () => {
    const fade = (): string => {
      const t = createTwoStep<string>({ options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], onConfirm: () => undefined });
      t.designate('a'); t.confirm(); t.fadeOthers();
      return t.el.querySelector<HTMLElement>('[data-option="b"]')!.style.opacity;
    };
    const ref = fade();
    over.theme['fadedOpacity'] = 0.7;
    expect(fade()).not.toBe(ref);
  });
});
