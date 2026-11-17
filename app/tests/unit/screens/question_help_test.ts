// @vitest-environment happy-dom
import {expect,it} from 'vitest';
import {QUESTION_SOURCES,annotateSources} from '../../../src/screens/questionnaire/help';
import fr from '../../../src/data/strings/fr.json';
import {core} from '../../support/screens_ff';
it('annotates only an actual cited reference, never ordinary vocabulary or answers',()=>{
 for(const q of core.questionnaire.questions){
  const p=document.createElement('p');const text=fr[`q.${q.key}.scene` as keyof typeof fr];p.textContent=text;
  annotateSources(p,q.key);
  expect(p.querySelectorAll('[data-option],details')).toHaveLength(0);
  expect(p.querySelectorAll('.q-source-trigger')).toHaveLength(QUESTION_SOURCES[q.key]?1:0);
  expect(p.querySelector('.q-source-trigger')?.textContent).not.toBe('Renouveler une ordonnance');
  expect(p.querySelector('.q-source-trigger')?.textContent).not.toBe('Compagnon IA');
  expect(p.querySelector('.q-source-sticker')?.getAttribute('popover')).toBe(QUESTION_SOURCES[q.key]?'auto':undefined);
 }
});
it('keeps fiction without an external reference unannotated',()=>{
 const p=document.createElement('p');p.textContent=fr['q.Q20.scene'];annotateSources(p,core.questionnaire.questions.find(q=>q.key==='Q20')!.key);expect(p.textContent).toBe(fr['q.Q20.scene']);expect(p.children).toHaveLength(0);
});
it('SB 53 has one concise sticker and its primary source',()=>{
 const p=document.createElement('p');p.textContent=fr['q.Q04.scene'];annotateSources(p,core.questionnaire.questions.find(q=>q.key==='Q04')!.key);
 expect(p.querySelector('.q-source-trigger')?.textContent).toBe('SB 53');expect(QUESTION_SOURCES.Q04!.text.length).toBeLessThan(150);expect(p.querySelector('a')!.href).toContain('gov.ca.gov/2025/09/29');
});
