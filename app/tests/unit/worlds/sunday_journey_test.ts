// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mountSundayJourney} from '../../../src/worlds/sundayJourney';
let root:HTMLElement, dispose:()=>void;
const click=(action:string)=>root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
const beat=()=>root.querySelector<HTMLElement>('main')!.dataset['beat'];
beforeEach(()=>{vi.useFakeTimers();Object.defineProperty(document,'hidden',{value:false,configurable:true});root=document.createElement('div');document.body.append(root);dispose=mountSundayJourney(root);});
afterEach(()=>{dispose();root.remove();vi.useRealTimers();});
describe('lived Sunday sequence',()=>{
 it('plays the journey without extra clicks but never decides for the player',()=>{click('depart');vi.advanceTimersByTime(15000);expect(beat()).toBe('decision');vi.advanceTimersByTime(60000);expect(beat()).toBe('decision');expect(root.querySelectorAll('.sj-choices button')).toHaveLength(2);});
 it('shows consent, registration and the meal in the guarantor branch',()=>{click('depart');click('next');click('next');click('guarantor');expect(beat()).toBe('request');vi.advanceTimersByTime(23000);expect(beat()).toBe('lunch');expect(root.textContent).toContain('Un lien de surveillance ajouté.');});
 it('shows returning home without adding a guarantor, and restarts cleanly',()=>{click('depart');click('next');click('next');click('return');vi.advanceTimersByTime(8000);expect(beat()).toBe('home');expect(root.textContent).toContain('Aucun garant ajouté');click('replay');expect(beat()).toBe('invitation');vi.advanceTimersByTime(60000);expect(beat()).toBe('invitation');});
 it('preserves the remaining reading time when paused or hidden',()=>{click('depart');vi.advanceTimersByTime(2000);click('pause');vi.advanceTimersByTime(60000);expect(beat()).toBe('street');click('pause');vi.advanceTimersByTime(4499);expect(beat()).toBe('street');vi.advanceTimersByTime(1);expect(beat()).toBe('blocked');Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));vi.advanceTimersByTime(60000);expect(beat()).toBe('blocked');Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));vi.advanceTimersByTime(8500);expect(beat()).toBe('decision');});
 it('cancels pending progression on disposal and never changes saved data',()=>{const saved=JSON.stringify(window.localStorage);click('depart');dispose();vi.advanceTimersByTime(60000);expect(root.children).toHaveLength(0);expect(JSON.stringify(window.localStorage)).toBe(saved);});
});
