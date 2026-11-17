// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mountRetrospective, newspaperPhoto } from '../../../src/screens/fastforward/retrospective';
import { planFastForward } from '../../../src/screens/fastforward';
import { loadUi } from '../../../src/data/ui/load';
import { fakeCtx } from '../../support/screens';
import { core, H, runLine, shownOf } from '../../support/screens_ff';

describe('newspaper editions', () => {
  it('never repeats an editorial image even when all leads share a topic', () => {
    const used = new Set<string>();
    const photos = Array.from({length:12}, () => newspaperPhoto('surveillance', used));
    expect(photos.every(Boolean)).toBe(true);expect(new Set(photos).size).toBe(photos.length);
  });
  it('lays out one full edition per front on a chronology timeline without entering the world', () => {
    const ctx = fakeCtx();const run = runLine('AAAAAAAAAAA');
    const plan = planFastForward(run,shownOf(run),loadUi().timing,core.engine,H);
    const root = document.createElement('div');document.body.append(root);
    const dispose = mountRetrospective(ctx,run,plan,root);
    expect(root.querySelector('[data-ui=retrospective]')!.getAttribute('data-layout')).toBe('chronology');
    const timeline = root.querySelector<HTMLElement>('.retro-timeline')!;
    const papers = [...timeline.querySelectorAll<HTMLElement>('.retro-paper')];
    // Une édition par front du plan, toutes présentes d'un coup dans la frise (plus d'onglets ni de panneau masqué).
    expect(papers).toHaveLength(plan.fronts.length);
    expect(papers.every(p => !p.hidden)).toBe(true);
    expect(root.querySelector('[role=tab]')).toBeNull();
    expect(papers.map(p => p.dataset['edition'])).toEqual(papers.map((_, i) => String(i)));
    expect(papers.every(p => p.querySelector('.retro-lead') !== null)).toBe(true);
    const leads = [...timeline.querySelectorAll(':scope > .retro-paper > .retro-lead')].map(el=>el.textContent);
    expect(new Set(leads).size).toBe(leads.length);
    const images = [...root.querySelectorAll<HTMLImageElement>('.retro-archive-photo img')].map(img=>img.src);
    expect(images).toHaveLength(papers.length);expect(new Set(images).size).toBe(images.length);
    expect(ctx.navigate).not.toHaveBeenCalled();
    if (run.outcome.kind === 'arrival') expect(root.querySelector<HTMLElement>('.retro-world-preview')!.style.backgroundImage).toContain(run.outcome.livedWorld);
    expect(root.querySelector('[data-ui=world-entry]')!.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    dispose();expect(root.children).toHaveLength(0);root.remove();
  });
});
