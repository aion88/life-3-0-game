// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
import {mountRetrospective} from '../../../src/screens/fastforward/retrospective';
import {planFastForward} from '../../../src/screens/fastforward';
import {loadUi} from '../../../src/data/ui/load';
import {fakeCtx} from '../../support/screens';
import {core,H,runLine,shownOf} from '../../support/screens_ff';
it('shows every year and headline without tabs while preserving optional causes',()=>{
 const run=runLine('BAABBACBBAD');const plan=planFastForward(run,shownOf(run),loadUi().timing,core.engine,H);
 const root=document.createElement('div');document.body.append(root);
 const dispose=mountRetrospective(fakeCtx(),run,plan,root);
 expect(root.querySelector('[role=tab]')).toBeNull();
 const papers=[...root.querySelectorAll<HTMLElement>('.retro-paper')];
 expect(papers).toHaveLength(plan.fronts.length);
 papers.forEach(paper=>{
  expect(paper.hidden).toBe(false);expect(paper.querySelector('.retro-year')?.textContent).toBeTruthy();
  expect(paper.querySelector(':scope>.retro-lead')?.textContent).toBeTruthy();
  expect(paper.querySelector('dialog .retro-contribution')).not.toBeNull();
 });
 const detail=papers[0]!.querySelector('dialog')!;detail.showModal=vi.fn();
 papers[0]!.querySelector<HTMLButtonElement>('.retro-detail-button')!.click();
 expect(detail.showModal).toHaveBeenCalledOnce();
 expect(root.querySelector('[data-ui=present-signals] a')).not.toBeNull();
 dispose();root.remove();
});
