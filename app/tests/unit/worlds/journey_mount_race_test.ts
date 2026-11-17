// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mountJourney} from '../../../src/worlds/runtime';
import type {JourneyView} from '../../../src/worlds/view';
import {fakeCtx} from '../../support/screens';
import {runLine} from '../../support/screens_ff';
beforeEach(()=>{const storage=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)};};vi.stubGlobal('localStorage',storage());vi.stubGlobal('sessionStorage',storage());document.body.replaceChildren();});
afterEach(()=>vi.unstubAllGlobals());
function slowView(){let ready!:(view:JourneyView)=>void;const promise=new Promise<JourneyView>(r=>{ready=r;});const view:JourneyView={show:vi.fn(),perform:vi.fn(async()=>{}),skip:vi.fn(),setEmotion:vi.fn(),setSpeaker:vi.fn(),setConsequence:vi.fn(),dispose:vi.fn()};return {ready,view,promise};}
it('preserves the first gesture button during an in-flight press when renderer loading finishes',async()=>{
 const root=document.createElement('div');document.body.append(root);const pending=slowView();const mounted=mountJourney(fakeCtx(),runLine('BAABBACBBAD'),root,{view:()=>pending.promise});
 // The welcome window is gone: the first gesture is playable at once, and it must not be replaced between pointerdown and pointerup.
 const start=root.querySelector<HTMLButtonElement>('[data-option]')!;expect(start).not.toBeNull();
 start.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));pending.ready(pending.view);const runtime=await mounted;
 expect(start.isConnected).toBe(true);expect(root.querySelector('[data-option]')).toBe(start);
 start.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));start.click();expect(root.querySelector('.journey-modal-backdrop')).toBeNull();runtime.dispose();
});
it('does not open a window nor replace choices when the renderer becomes ready',async()=>{
 const root=document.createElement('div');document.body.append(root);const pending=slowView();const mounted=mountJourney(fakeCtx(),runLine('BAABBACBBAD'),root,{view:()=>pending.promise});
 expect(root.querySelector('.journey-modal-backdrop')).toBeNull();expect(root.querySelector('.journey')?.getAttribute('data-modal')).toBe('none');
 const choice=root.querySelector('.journey-options button');expect(choice).not.toBeNull();
 pending.ready(pending.view);const runtime=await mounted;expect(root.querySelector('.journey-modal-backdrop')).toBeNull();expect(root.querySelector('.journey-options button')).toBe(choice);expect(pending.view.setSpeaker).toHaveBeenCalled();runtime.dispose();
});
it('starts an intended change of place once without a second travel confirmation',async()=>{
 const {journeys}=await import('../../../src/worlds/catalogue');
 const entry=journeys.w01;
 const source=runLine('BAABBACBBAD');if(source.outcome.kind!=='arrival')throw new Error('arrival fixture required');
 const run={...source,outcome:{...source.outcome,computedWorld:entry.id}};
 let finish!:()=>void;const moving=new Promise<void>(resolve=>{finish=resolve;});
 const pending=slowView();pending.view.perform=vi.fn(()=>moving);
 const root=document.createElement('div');document.body.append(root);
 const runtime=await mountJourney(fakeCtx(),run,root,{view:async()=>pending.view});
 let option:import('../../../src/worlds/types').JourneyOption|undefined;
 let action:HTMLButtonElement|undefined;
 for(let step=0;step<20&&!action;step++){
  const current=entry.scenes.find(s=>s.id===root.querySelector('.journey')?.getAttribute('data-scene'))!;
  option=current.options.find(o=>entry.scenes.find(s=>s.id===o.next)!.location!==current.location&&!root.querySelector<HTMLButtonElement>(`[data-option="${o.id}"]`)?.disabled);
  if(option)action=root.querySelector<HTMLButtonElement>(`[data-option="${option.id}"]`)!;
  else {
   const placements=vi.mocked(pending.view.show).mock.calls.length;
   root.querySelector<HTMLButtonElement>('.journey-options button:not(:disabled)')!.click();
   expect(pending.view.show).toHaveBeenCalledTimes(placements);
  }
 }
 if(!action||!option)throw new Error('No reachable departure');
 action.click();action.click();
 expect(pending.view.perform).toHaveBeenCalledTimes(1);
 expect(root.querySelector('[data-ui="journey-travel-go"]')).toBeNull();
 expect(root.querySelector('.journey-playback')?.textContent).toContain(option.consequence);
 const skip=[...root.querySelectorAll('button')].find(b=>b.textContent==='Passer la scène')!;
 skip.click();expect(pending.view.skip).toHaveBeenCalledOnce();
 finish();await Promise.resolve();
 expect(root.querySelector('.journey')?.getAttribute('data-scene')).toBe(option.next);
 runtime.dispose();
});
