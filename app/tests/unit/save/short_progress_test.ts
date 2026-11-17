// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { clearShortProgress } from '../../../src/save/shortProgress';
import { consumeNewGameParam } from '../../../src/save/newGame';
import { SAVE_KEY } from '../../../src/save/save';
function storage() {
  const entries = new Map<string,string>();
  return { get length(){return entries.size;}, key:(i:number)=>[...entries.keys()][i]??null, getItem:(key:string)=>entries.get(key)??null, setItem:(key:string,value:string)=>entries.set(key,value), removeItem:(key:string)=>entries.delete(key), clear:()=>entries.clear() };
}
beforeEach(()=>{vi.stubGlobal('localStorage',storage());vi.stubGlobal('sessionStorage',storage());});
afterEach(()=>vi.unstubAllGlobals());
function seed(){
  localStorage.setItem(SAVE_KEY,'original questionnaire');
  localStorage.setItem('unrelated','keep');
  localStorage.setItem('aftermath.journey.v1.w03.123','old ending');
  localStorage.setItem('aftermath.episode.1984.v2.123','old choices');
  localStorage.setItem('aftermath.episode.1984.v2.123.dinner','observations');
  localStorage.setItem('aftermath.journey.v1.w04.456','other run');
  sessionStorage.setItem('aftermath.exploration.v1','alternative');
}
test('new questionnaire clears only progress for its exact seed and preserves original answers',()=>{
  seed();clearShortProgress(localStorage,123);
  expect(localStorage.getItem('aftermath.journey.v1.w03.123')).toBeNull();
  expect(localStorage.getItem('aftermath.episode.1984.v2.123')).toBeNull();
  expect(localStorage.getItem('aftermath.episode.1984.v2.123.dinner')).toBeNull();
  expect(localStorage.getItem('aftermath.journey.v1.w04.456')).toBe('other run');
  expect(localStorage.getItem(SAVE_KEY)).toBe('original questionnaire');
  expect(localStorage.getItem('unrelated')).toBe('keep');
});
test('explicit nouvelle resets all short progress without deleting unrelated storage',()=>{
  seed();consumeNewGameParam('http://localhost/?nouvelle',localStorage);
  expect(localStorage.length).toBe(1);expect(localStorage.getItem('unrelated')).toBe('keep');
  expect(sessionStorage.getItem('aftermath.exploration.v1')).toBeNull();
});
test('normal entry preserves progress for resume',()=>{
  seed();expect(consumeNewGameParam('http://localhost/',localStorage)).toBeNull();
  expect(localStorage.getItem('aftermath.journey.v1.w03.123')).toBe('old ending');
});
