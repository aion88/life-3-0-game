import {moralMoments,type MoralWorld} from './moralMoments';
import './moralView.css';
export function moralCard(doc:Document,world:MoralWorld,scene:string,choice?:{scene:string;option:string}):HTMLElement|null {
 const moment=moralMoments[world];const result=choice?.scene===moment.scene?moment.results[choice.option]:undefined;
 if(scene!==moment.scene&&!result)return null;
 const box=doc.createElement('section');box.className='moral-card';box.dataset['ui']='moral-event';box.setAttribute('aria-label',result?'Conséquences de ton choix':'Ce qui arrive');
 const title=doc.createElement('strong');title.textContent=result?'CE QUE TON CHOIX CHANGE':moment.event;
 box.append(title);
 if(result){const grid=doc.createElement('dl');for(const [who,what] of result){const tile=doc.createElement('div'),dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=who;dd.textContent=what;tile.append(dt,dd);grid.append(tile);}box.append(grid);box.setAttribute('role','status');}
 else {const rule=doc.createElement('p');rule.textContent=moment.rule;box.append(rule);}
 return box;
}
