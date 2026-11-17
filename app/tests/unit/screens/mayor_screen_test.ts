// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { questionnaireScreen } from '../../../src/screens/questionnaire';
import { fakeCtx, mountScreen } from '../../support/screens';
import { answersOf } from '../../../src/shared/types';
import scenes from '../../../src/screens/mayor/scenes.json';
const buttons=(root:HTMLElement)=>[...root.querySelectorAll<HTMLButtonElement>('[data-option]')];
const current=(root:HTMLElement)=>root.querySelector<HTMLElement>('main')?.dataset['question'];
const edit=(root:HTMLElement,key:string)=>root.querySelector<HTMLButtonElement>(`[data-edit-question="${key}"]`)!.click();
describe('production mayor prologue',()=>{
 it('commits all eleven keys and 38 options with no Continue step',async()=>{
  const ctx=fakeCtx();const {root,screen}=await mountScreen(questionnaireScreen,ctx,undefined);
  expect(root.textContent).toContain('Tu es la maire');expect(scenes).toHaveLength(11);expect(scenes.flatMap(s=>s.choix)).toHaveLength(38);
  const expected:Record<string,'A'>={};
  for(const q of [...ctx.core.questionnaire.questions].sort((a,b)=>a.order-b.order)){
   expect(scenes.find(s=>s.id===q.key)?.choix.map(c=>c.key)).toEqual(q.answers.map(a=>a.key));expect(current(root)).toBe(q.key);
   expect(root.querySelector('[data-testid=q-continue]')).toBeNull();
   const choices=buttons(root);choices[0]!.click();choices[1]!.click();expected[q.key]='A';
   expect(ctx.save.load().data.answers[q.key]).toBe('A');
   if(q.order<11){expect(root.querySelector('.mayor-last-choice')?.textContent).toContain(scenes.find(s=>s.id===q.key)!.choix[0]!.t);expect(document.activeElement).toBe(root.querySelector('h1'));}
  }
  expect(ctx.navigate).toHaveBeenCalledExactlyOnceWith('fastforward',{answers:answersOf(expected)});expect(ctx.save.load().data.phase).toBe('fastforward');screen.unmount();
 });
 it('resumes a partial save at the next unanswered position',async()=>{
  const ctx=fakeCtx();ctx.save.update({phase:'questionnaire',answers:answersOf({Q11:'B'})});const {root,screen}=await mountScreen(questionnaireScreen,ctx,undefined);
  expect(current(root)).toBe('Q14');expect(ctx.save.load().data.answers[ctx.core.questionnaire.questions[0]!.key]).toBe('B');screen.unmount();
 });
 it('preserves a previous playthrough until all replacement positions are complete',async()=>{
  const ctx=fakeCtx();const old=answersOf(Object.fromEntries(ctx.core.questionnaire.questions.map(q=>[q.key,'B'])));ctx.save.update({phase:'bilan',answers:old});
  const {root,screen}=await mountScreen(questionnaireScreen,ctx,undefined);for(let i=0;i<10;i++){buttons(root)[0]!.click();expect(ctx.save.load().data.answers).toEqual(old);}
  edit(root,'Q11');buttons(root)[2]!.click();expect(current(root)).toBe('Q07');expect(ctx.save.load().data.answers).toEqual(old);
  const final=buttons(root)[0]!;final.click();final.click();expect(ctx.save.load().data.answers).not.toEqual(old);expect(ctx.navigate).toHaveBeenCalledTimes(1);screen.unmount();
 });
 it('allows inspecting, correcting and cancelling a previous answer without losing the current act',async()=>{
  const ctx=fakeCtx();const {root,screen}=await mountScreen(questionnaireScreen,ctx,undefined);buttons(root)[0]!.click();buttons(root)[0]!.click();expect(current(root)).toBe('Q05');
  expect(root.querySelector('.mayor-history')?.textContent).toContain('audit des biais');edit(root,'Q11');expect(current(root)).toBe('Q11');expect(buttons(root)[0]!.getAttribute('aria-pressed')).toBe('true');
  buttons(root)[1]!.click();expect(current(root)).toBe('Q05');expect(ctx.save.load().data.answers).toEqual({Q11:'B',Q14:'A'});
  edit(root,'Q14');const cancel=root.querySelector<HTMLButtonElement>('.mayor-edit-cancel')!;cancel.click();cancel.click();expect(current(root)).toBe('Q05');expect(ctx.navigate).not.toHaveBeenCalled();expect(ctx.save.load().data.answers).toEqual({Q11:'B',Q14:'A'});screen.unmount();
 });
 it('ignores a second double-click activation and held Enter',async()=>{
  const ctx=fakeCtx();const {root,screen}=await mountScreen(questionnaireScreen,ctx,undefined);buttons(root)[0]!.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));expect(current(root)).toBe('Q14');
  buttons(root)[0]!.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:2}));expect(current(root)).toBe('Q14');expect(ctx.save.load().data.answers).toEqual({Q11:'A'});
  const repeated=new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true});buttons(root)[0]!.dispatchEvent(repeated);expect(repeated.defaultPrevented).toBe(true);screen.unmount();
 });
 it('retains the decisive conditions lost in shortened labels',()=>{
  const label=(q:string,a:string)=>scenes.find(s=>s.id===q)!.choix.find(c=>c.key===a)!.t;
  expect(label('Q11','A')).toMatch(/cadre légal.*autorisation.*audit des biais/);expect(label('Q11','A')).not.toMatch(/juge/);
  expect(label('Q10','B')).toMatch(/sécurité.*sans vérification d’âge/);expect(label('Q21','A')).toMatch(/seule.*suivi en continu/);
  expect(label('Q04','C')).toMatch(/Abroger.*cadre de transparence/);expect(label('Q20','A')).toMatch(/Trente-deux heures.*même salaire/);
 });
});
