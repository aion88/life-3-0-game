import type { QuestionKey } from '../../shared/types';
import './help.css';
interface Reference { anchor:string; title:string; text:string; url:string }
/** Only cited external documents. No glossary and no advice about the answers. */
export const QUESTION_SOURCES:Record<string,Reference>={
 Q11:{anchor:"ministère de l'Intérieur britannique",title:'Home Office · consultation',text:'Consultation britannique sur le cadre légal de la reconnaissance faciale policière.',url:'https://www.gov.uk/government/consultations/legal-framework-for-using-facial-recognition-in-law-enforcement'},
 Q14:{anchor:'document de politique industrielle',title:'OpenAI · propositions',text:'Des propositions sur le partage des gains de l’IA, pas des mesures déjà votées.',url:'https://openai.com/index/industrial-policy-for-the-intelligence-age/'},
 Q05:{anchor:'La déclaration',title:'Déclaration sur la superintelligence',text:'Un appel public à suspendre son développement jusqu’à un accord scientifique et citoyen.',url:'https://superintelligence-statement.org/'},
 Q10:{anchor:'le projet GUARD Act',title:'GUARD Act · États-Unis',text:'Projet contre l’accès des mineurs aux compagnons IA, approuvé en commission le 30 avril 2026.',url:'https://www.hawley.senate.gov/senator-hawleys-guard-act-to-protect-kids-from-ai-chatbots-passes-committee-unanimously/'},
 Q21:{anchor:"un essai autorisé par l'État",title:'Doctronic · Utah',text:'Pilote encadré de renouvellement par IA, avec relecture médicale dans sa première phase.',url:'https://commerce.utah.gov/ai/regulatory-relief-4/authorized-pilots/doctronic/'},
 Q04:{anchor:'SB 53',title:'SB 53 · Californie',text:'Loi signée en septembre 2025 : cadres de sécurité publics et signalement des incidents critiques.',url:'https://www.gov.ca.gov/2025/09/29/governor-newsom-signs-sb-53-advancing-californias-world-leading-artificial-intelligence-industry/'},
 Q15:{anchor:"Seattle l'a fait",title:'Seattle · vote municipal',text:'Le conseil municipal a voté une pause d’un an sur les grands centres de données, le 9 juin 2026.',url:'https://council.seattle.gov/2026/06/09/city-council-passes-emergency-data-center-moratorium-and-policy-framework/'},
 Q18:{anchor:"Dialogue mondial sur l'IA de l'ONU",title:'Dialogue mondial · ONU',text:'Un forum de coopération sur l’IA, sans pouvoir d’imposer ses décisions.',url:'https://www.un.org/digital-emerging-technologies/node/1162'},
 Q16:{anchor:'Nvidia, Microsoft, Meta, IBM et Mozilla',title:'Lettre de l’industrie · presse',text:'Lettre contre des restrictions prématurées des modèles ouverts, rapportée par SiliconANGLE.',url:'https://siliconangle.com/?p=798148'},
 Q07:{anchor:'convention sur certaines armes classiques',title:'Convention · Nations unies',text:'Cadre international où les États discutent notamment des armes létales autonomes.',url:'https://www.ungeneva.org/en/meetings-events/events/observances-special-events/2026/11/seventh-review-conference-high'},
};
export function annotateSources(scene:HTMLElement,key:QuestionKey):void {
 const item=QUESTION_SOURCES[key],text=scene.textContent??'';
 if(!item)return;
 const at=text.indexOf(item.anchor);if(at<0)return;
 const doc=scene.ownerDocument;
 const wrap=doc.createElement('span');wrap.className='q-help q-source';
 const button=doc.createElement('button');button.type='button';button.className='q-source-trigger';button.textContent=item.anchor;
 button.setAttribute('aria-label',`${item.anchor} — source`);button.setAttribute('aria-expanded','false');
 const sticker=doc.createElement('span');sticker.className='q-source-sticker';sticker.id=`q-source-${key}`;sticker.setAttribute('popover','auto');
 button.setAttribute('aria-controls',sticker.id);
 const title=doc.createElement('strong');title.textContent=item.title;
 const detail=doc.createElement('span');detail.textContent=item.text;
 const link=doc.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Lire la source ↗';
 sticker.append(title,detail,link);wrap.append(button,sticker);
 scene.replaceChildren(doc.createTextNode(text.slice(0,at)),wrap,doc.createTextNode(text.slice(at+item.anchor.length)));
 button.addEventListener('click',()=>{
  if(sticker.matches(':popover-open')){sticker.hidePopover();return;}
  sticker.showPopover();button.setAttribute('aria-expanded','true');
  const r=button.getBoundingClientRect(),view=doc.defaultView!;
  sticker.style.left=`${Math.max(12,Math.min(r.left,view.innerWidth-sticker.offsetWidth-12))}px`;
  sticker.style.top=`${r.top-sticker.offsetHeight-10>=12?r.top-sticker.offsetHeight-10:Math.min(r.bottom+10,view.innerHeight-sticker.offsetHeight-12)}px`;
 });
 sticker.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(sticker.matches(':popover-open'))));
}
