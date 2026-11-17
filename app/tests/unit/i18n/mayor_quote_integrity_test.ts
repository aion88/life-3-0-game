import {expect,it} from 'vitest';
import scenes from '../../../src/screens/mayor/scenes.json';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
/** The retrospective must quote the decision actually displayed, not the retired questionnaire wording. */
it('French quotes and titles in the retrospective match the public mayor choices',()=>{
 for(const scene of scenes){
  expect(fr[`q.${scene.id}.title` as keyof typeof fr]).toBe(scene.titre);
  for(const choice of scene.choix){
   const key=`q.${scene.id}.${choice.key}.label`;
   expect(fr[key as keyof typeof fr]).toBe(choice.t);
   expect(en[key as keyof typeof en]).toBeTruthy();
  }
 }
});
it('English quotations do not add motives absent from the selected choices',()=>{
 expect(en['q.Q15.B.label']).toBe('Build it');
 expect(en['q.Q07.C.label']).toBe('I won’t sign');
 expect(en['q.Q14.title']).not.toContain('brother');
 expect(en['q.Q10.title']).not.toContain('niece');
});
