// @vitest-environment happy-dom
import {expect,it} from 'vitest';
import {createConsequenceVisual} from '../../../src/worlds/consequenceVisual';
it('tests material state inline with a keyboard button, without modifying the state fact',()=>{
 const host=document.createElement('div');document.body.append(host);const view=createConsequenceVisual(host);
 const fact={id:'tap-private',label:'Dispensaire sans eau',detail:'La réparation couvre une seule adresse.',kind:'object',visual:'tap',active:false,action:'Ouvrir le robinet'} as const;
 view.set(fact);const original=JSON.stringify(fact);expect(host.querySelector('.prop-closeup')?.hasAttribute('hidden')).toBe(true);
 (host.querySelector('.prop-inspect') as HTMLButtonElement).click();expect(host.querySelector('.scene-consequence')?.getAttribute('data-working')).toBe('false');expect(host.querySelector('.prop-closeup')?.hasAttribute('hidden')).toBe(false);expect(host.querySelector('[role=status]')?.textContent).toContain('une seule adresse');expect(JSON.stringify(fact)).toBe(original);
 view.set({...fact,id:'tap-common',active:true});expect(host.querySelector('.scene-consequence')?.getAttribute('data-working')).toBe('true');view.dispose();expect(host.children).toHaveLength(0);host.remove();
});
