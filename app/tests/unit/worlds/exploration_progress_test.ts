// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { AppContext } from '../../../src/app/shell';
import type { Answers, RunResult } from '../../../src/shared/types';
import { clearExploration, explorationProgressKey, enterExploration, openExploration } from '../../../src/worlds/exploration';
const captured = vi.hoisted(() => ({ start: undefined as ((answers: Answers) => void) | undefined }));
vi.mock('../../../src/worlds/explorer', () => ({ mountExplorer: (_h: unknown, _c: unknown, _r: unknown, start: (answers: Answers) => void) => { captured.start = start; return {dispose() {}}; } }));
vi.mock('../../../src/fastforward/run', () => ({runFastForward: () => ({})}));
vi.mock('../../../src/screens/data', () => ({loadFastForwardData: () => ({headlines: []})}));
const answers = {Q01:'A'} as Answers;
const ctx = { core:{questionnaire:{questions:[{key:'Q01',answers:[{key:'A'}]}]}}, save:{load:()=>({data:{answers}})}, navigate:vi.fn() } as unknown as AppContext;
const run = {answers,softened:false} as RunResult;
beforeEach(() => {
 const storage=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)};};
 vi.stubGlobal('localStorage',storage());vi.stubGlobal('sessionStorage',storage());clearExploration();
});
afterEach(()=>vi.unstubAllGlobals());
for (const originalKey of ['aftermath.journey.v1.w03.123','aftermath.episode.1984.v2.123']) {
 test(`${originalKey}: new visits isolate completed saves, reload resumes, returning preserves original`, () => {
  localStorage.setItem(originalKey,'completed original');
  expect(explorationProgressKey(ctx,originalKey)).toBe(originalKey);
  openExploration(document.body,ctx,run); captured.start!(answers); enterExploration(ctx);
  const first=explorationProgressKey(ctx,originalKey);
  expect(first).not.toBe(originalKey); expect(localStorage.getItem(first)).toBeNull();
  localStorage.setItem(first,'completed visit');
  expect(explorationProgressKey(ctx,originalKey)).toBe(first);
  openExploration(document.body,ctx,run); captured.start!(answers); enterExploration(ctx);
  const second=explorationProgressKey(ctx,originalKey);
  expect(second).not.toBe(first); expect(localStorage.getItem(second)).toBeNull();
  clearExploration(); expect(explorationProgressKey(ctx,originalKey)).toBe(originalKey);
  expect(localStorage.getItem(originalKey)).toBe('completed original');
 });
}
test('legacy exploration gets an isolated visit once, keeping reload stable',()=>{
 sessionStorage.setItem('aftermath.exploration.v1',JSON.stringify({origin:answers,answers,entered:true}));
 const key=explorationProgressKey(ctx,'original');
 expect(key).not.toBe('original'); expect(explorationProgressKey(ctx,'original')).toBe(key);
});
