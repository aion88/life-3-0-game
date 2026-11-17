import type {StoryConsequence} from './consequences';
import './consequences.css';
import type { RunResult } from '../shared/types';
import { WORLD_VARS } from '../shared/types/world';
import { AXIS_LABELS } from './explain';
import './lifeSheet.css';

interface SheetOptions {
  world: string;
  outcome: string;
  mission: string;
  moments: { title: string; text: string }[];
  resource?: { name: string; initial: number; final: number };
  arrivalStep: number;
  consequences?:StoryConsequence[];
}
/** The short story has its own consequences; the curves only describe the questionnaire simulation. */
export function lifeSheet(doc: Document, run: RunResult, options: SheetOptions): HTMLElement {
  const el = (tag: string, text = '', cls = ''): HTMLElement => { const n = doc.createElement(tag); n.textContent = text; n.className = cls; return n; };
  const sheet = el('section', '', 'life-sheet'); sheet.dataset['ui'] = 'life-sheet';
  const hero = el('header', '', 'life-hero');
  hero.append(el('small', 'LIFE 3.0 / FICHE DE VIE / 2030'), el('h2', options.world), el('p', options.outcome, 'life-outcome'), el('p', options.mission));
  const index = el('nav', '', 'life-index'); index.setAttribute('aria-label', 'Lire ma fiche');
  for (const [target, label] of [['life-moments','01 · Ce que tu as changé'],['life-curves','02 · Comment ce monde est arrivé'],['life-real','03 · Le réel derrière la fiction']]) {
    const b = doc.createElement('button'); b.type = 'button'; b.textContent = label!;
    b.addEventListener('click', () => { const section = sheet.parentElement?.querySelector<HTMLElement>(`[data-sheet-section="${target}"]`); section?.scrollIntoView({block:'start'}); section?.focus({preventScroll:true}); }); index.append(b);
  }
  const stats=el('div','','life-summary-stats');
  const count=el('div');count.append(el('strong',String(options.moments.length)),el('span','moments conservés'));
  const result=el('div');result.append(el('strong','◎'),el('span',options.outcome));stats.append(count,result);
  if(options.resource){const r=options.resource;const item=el('div');item.append(el('strong',`${r.initial} → ${r.final}`),el('span',r.name));stats.append(item);}
  hero.append(stats,index); sheet.append(hero);
  if(options.consequences?.length){
    const lived=el('section','','life-lived-results');lived.setAttribute('aria-label','Conséquences réellement obtenues');lived.append(el('small','DANS TA PARTIE · ÉTAT FINAL'),el('h2','Qui garde quoi, qui peut agir ?'));
    const cards=el('ul','','life-lived-grid');for(const fact of options.consequences){const card=el('li');card.dataset['kind']=fact.kind;card.dataset['consequence']=fact.id;card.append(el('small',fact.kind==='relationship'?'PERSONNES':fact.kind==='access'?'DROITS ET ACCÈS':'OBJETS ET TRACES'),el('strong',fact.label),el('p',fact.detail));cards.append(card);}lived.append(cards);sheet.append(lived);
  }
  const chain=el('section','','life-impact-map');chain.setAttribute('aria-label','Tes choix et leurs conséquences');
  chain.append(el('small','GESTE → CONSÉQUENCE'),el('h2','Trois moments de ta vie ici'));
  const indices=[...new Set([0,Math.floor((options.moments.length-1)/2),options.moments.length-1])].filter(i=>i>=0);
  const flow=el('ol','','life-impact-flow');
  for(const i of indices){const moment=options.moments[i]!;const row=el('li');const action=el('div','','life-impact-action');action.append(el('small',`DÉCISION ${i+1}`),el('strong',moment.title));const arrow=el('span','→','life-impact-arrow');arrow.setAttribute('aria-hidden','true');const effect=el('div','','life-impact-effect');effect.append(el('small','DANS TA PARTIE'),el('p',moment.text));row.append(action,arrow,effect);flow.append(row);}
  chain.append(flow);sheet.append(chain);
  const moments = el('section', '', 'life-moments'); moments.dataset['sheetSection'] = 'life-moments'; moments.tabIndex = -1;
  moments.append(el('small','01 / TES DÉCISIONS'), el('h2','Ce que tu as changé'));
  const grid = el('ol', '', 'life-moment-grid');
  options.moments.forEach((moment, i) => { const card = el('li'); card.append(el('span',String(i+1).padStart(2,'0'),'life-number'),el('h3',moment.title),el('p',moment.text)); grid.append(card); });
  const archive=el('details','','life-decision-archive');archive.append(el('summary',`Revoir mes ${options.moments.length} décisions, une par une`),grid);moments.append(archive);
  if (options.resource) { const r = options.resource; const resource = el('p', '', 'life-resource'); resource.append(el('strong',`${r.initial} → ${r.final}`),el('span',`${r.name} · au départ / à la fin`)); const gauge=doc.createElement('meter');gauge.min=0;gauge.max=Math.max(r.initial,r.final,1);gauge.value=r.final;gauge.setAttribute('aria-label',`${r.name} à la fin`);resource.append(gauge);moments.append(resource); }
  sheet.append(moments);
  const curves = el('section', '', 'life-curves'); curves.dataset['sheetSection'] = 'life-curves'; curves.tabIndex = -1;
  curves.append(el('small','02 / LA TRAJECTOIRE'),el('h2','Comment ce monde est arrivé'),el('p','De 2026 à 2030, tes réponses alimentent six dimensions de la simulation. Ces courbes s’arrêtent à ton arrivée : elles ne mesurent ni tes émotions ni les effets de tes décisions dans le quartier.'));
  const charts = el('div','','life-chart-grid');
  const steps = run.trajectory.steps.slice(0,options.arrivalStep+1);
  for (const axis of WORLD_VARS) {
    const figure = el('figure'); figure.dataset['axis'] = axis;
    const first = (steps[0]?.[axis] ?? 0)/1000, last = (steps.at(-1)?.[axis] ?? 0)/1000;
    figure.append(el('figcaption', AXIS_LABELS[axis]),el('strong',`${Math.round(first)} → ${Math.round(last)}`));
    const svg = doc.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 240 88'); svg.setAttribute('aria-hidden','true');
    const base = doc.createElementNS(svg.namespaceURI,'path'); base.setAttribute('d','M0 8H240 M0 44H240 M0 80H240'); base.setAttribute('class','life-grid'); svg.append(base);
    const line = doc.createElementNS(svg.namespaceURI,'polyline'); line.setAttribute('points',steps.map((step,i)=>`${i/Math.max(1,steps.length-1)*240},${80-step[axis]/100000*72}`).join(' ')); svg.append(line); figure.append(svg);
    figure.append(el('small','2026 → 2030 · indice de simulation / 100'));
    const details = el('details'); details.append(el('summary','Lire les valeurs annuelles'));
    for (let year=0;year<=4;year++) { const value = steps[Math.round((steps.length-1)*year/4)]?.[axis]; if(value !== undefined) details.append(el('p',`${2026+year} : ${(value/1000).toFixed(1)} / 100`)); }
    figure.append(details); charts.append(figure);
  }
  curves.append(charts,el('p','Ces indices sont les règles d’un modèle fictif, pas des prévisions ni des probabilités. Liberté et abondance sont distinctes : vivre confortablement ne signifie pas pouvoir contester.','life-model-note')); sheet.append(curves);
  return sheet;
}
