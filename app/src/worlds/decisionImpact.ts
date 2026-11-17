/** Consequences use the actual chosen option and state deltas, never a fabricated score. */
export interface DecisionImpact { action:string; text:string; changes:string[] }
export function decisionImpact(doc:Document,impact:DecisionImpact,onClose:()=>void):HTMLElement {
 const box=doc.createElement('aside');box.className='choice-impact';box.dataset['ui']='choice-impact';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
 const tag=doc.createElement('small');tag.textContent='TON GESTE → SON EFFET';
 const action=doc.createElement('strong');action.textContent=impact.action;
 const text=doc.createElement('p');text.textContent=impact.text;
 const changes=doc.createElement('ul');changes.className='impact-changes';
 for(const value of impact.changes){const li=doc.createElement('li');li.textContent=value;changes.append(li);}
 const close=doc.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Masquer la conséquence');close.addEventListener('click',onClose);
 box.append(tag,action,text,changes,close);return box;
}
