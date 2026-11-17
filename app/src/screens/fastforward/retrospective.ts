import {worldHeadline} from './worldHeadlines';
import { illustratedLocations, plateStyle } from '../../worlds/illustrationAssets';
import { enterExploration, explorationReturn, exploration } from '../../worlds/exploration';
import { PRESENT_SIGNALS, PRESENT_BOUNDARY } from '../../worlds/present';
/** One-screen retrospective: real scheduled news, model changes and selected-answer contributions. */
import type { AppContext } from '../../app/shell';
import type { CoreData } from '../../data/schema/core';
import type { HeadlineCond, HeadlineSet } from '../../data/schema/headlines';
import type { RunResult } from '../../shared/types/run';
import { WORLD_VARS, type WorldVar } from '../../shared/types/world';
import { contributions } from '../../worlds/explain';
import { loadFastForwardData } from '../data';
import mayorScenes from '../mayor/scenes.json';
import type { FfPlan } from './index';
import type { FrontLine } from './fronts';
import { firstStepOfYear } from './fronts';
import { STEPS_PER_YEAR } from '../../fastforward/timeline';
import './retrospective.css';

const LABELS: Record<'fr' | 'en', Record<WorldVar, string>> = {
  fr: { aiPower: 'Puissance de l’IA', order: 'Ordre', abundance: 'Ressources matérielles', freedom: 'Liberté', surveillance: 'Surveillance', unrest: 'Tensions' },
  en: { aiPower: 'AI power', order: 'Order', abundance: 'Material resources', freedom: 'Freedom', surveillance: 'Surveillance', unrest: 'Unrest' },
};
const COPY = {
  fr: {
    eyebrow: 'LIFE 3.0 · TA TRAJECTOIRE', title: 'Les années passent.',
    intro: 'Feuillette les éditions de ton futur. Puis entre dans la ville.',
    note: 'Titres inventés. Les chiffres viennent des règles du jeu, pas d’une prévision. Une réponse pousse une tendance ; elle ne crée pas seule un événement.',
    origin: '2026 · Ton mandat', journal: 'Dans ce futur', movement: 'Ce qui change cette année',
    enter: 'Entrer dans ce monde', causes: 'Comprendre ce qui s’est passé', destination: 'Le monde où tu arrives',
    extinction: 'Une trajectoire interrompue', extinctionBody: 'Cette trajectoire ne mène à aucun monde habitable. Retrouve ses causes et les décisions qui ont pesé.',
    reading: 'Fresque de ta partie', contribution: 'En 2026, tu avais défendu', change: 'Ce qui a changé cette année',
    rule: 'Pourquoi ce titre', contributionScale: 'Effet de ta réponse seule, avant le reste.',
    same: 'Les indicateurs restent stables', noPush: 'Tes réponses n’ont pas joué sur ce changement. Il vient des autres règles du jeu.',
    allRules: 'Ce qui a déclenché les titres de cette année :', answer: 'Ta réponse', step: 'À partir de l’étape', rupture: 'La trajectoire s’interrompt', yearDelta: 'En un an', twoYears: 'Deux années de suite', below: 'sous', above: 'au-dessus de', orMore: 'ou plus', orLess: 'ou moins',
    originBody: 'Tes décisions se croisent avec celles des autres. Voici les années qui séparent ton mandat de ta nouvelle vie.',
    units: 'Sur une échelle de zéro à cent.',
  },
  en: {
    eyebrow: 'LIFE 3.0 · YOUR TRAJECTORY', title: 'The years go by.',
    intro: 'Browse the editions of your future. Then step into the city.',
    note: 'Made-up headlines. The figures come from the game’s rules, not a forecast. An answer pushes a trend; it does not create an event on its own.',
    origin: '2026 · Your term as mayor', journal: 'In this future', movement: 'What changes this year',
    enter: 'Enter this world', causes: 'Understand what happened', destination: 'The world you arrive in',
    extinction: 'A trajectory interrupted', extinctionBody: 'This trajectory does not lead to any habitable world. Look at its causes and the decisions that weighed in.',
    reading: 'Your playthrough timeline', contribution: 'In 2026, you had supported', change: 'What changed this year',
    rule: 'Why this headline', contributionScale: 'Effect of your answer alone, before everything else.',
    same: 'The indicators remain stable', noPush: 'Your answers did not affect this change. It comes from the game’s other rules.',
    allRules: 'What triggered this year’s headlines:', answer: 'Your answer', step: 'From step', rupture: 'The trajectory is cut short', yearDelta: 'Over one year', twoYears: 'Two years in a row', below: 'below', above: 'above', orMore: 'or more', orLess: 'or less',
    originBody: 'Your decisions cross with those of others. Here are the years between your term and your new life.',
    units: 'On a scale from zero to one hundred.',
  },
} as const;

const EDITORIAL_DECKS: Record<WorldVar, readonly [string, string]> = {
  surveillance: ['Les machines voient davantage. Qui pourra contester ce qu’elles croient reconnaître ?', 'Moins de regards automatiques sur la ville. La sécurité doit trouver d’autres réponses.'],
  freedom: ['Davantage de place pour choisir sa propre vie. Reste à savoir qui aura les moyens d’en profiter.', 'Les choix individuels se resserrent. Ce qui semblait une protection devient une limite à négocier.'],
  abundance: ['La ville dispose de davantage de ressources. Leur partage devient la question décisive.', 'Il y a moins à distribuer. Chaque priorité oblige à laisser quelque chose de côté.'],
  unrest: ['La tension monte. Les promesses de progrès ne suffisent plus à faire accepter les décisions.', 'La tension retombe. Le calme dit-il que les besoins sont satisfaits, ou que l’on s’est habitué ?'],
  order: ['La ville devient plus ordonnée. La place laissée à l’imprévu se négocie désormais avec le système.', 'L’ordre établi se fragilise. Ce qui tenait la ville ensemble ne va plus de soi.'],
  aiPower: ['L’IA prend davantage de pouvoir. Les décisions confiées aux machines pèsent sur la vie quotidienne.', 'La puissance de l’IA recule. La ville doit composer avec les décisions prises pendant son essor.'],
};

/** Editorial illustrations follow the story topic, never an answer's ranking. */
const EDITORIAL_PHOTOS: Record<WorldVar, readonly string[]> = {
  surveillance: ['full-frame/w10-street.mid', 'full-frame/w10-anchor.cp.head', 'full-frame/w10-place.cabine', 'full-frame/w10-room.audition'],
  aiPower: ['prologue/labo', 'full-frame/w06-vault', 'full-frame/w08-workshop', 'full-frame/w04-annex'],
  abundance: ['full-frame/w03-farm', 'full-frame/w01-market', 'prologue/entrepot', 'full-frame/w03-workshop'],
  freedom: ['full-frame/w04-wall', 'full-frame/w03-square', 'full-frame/w09-glass', 'full-frame/w02-studio'],
  unrest: ['full-frame/w11-square', 'prologue/mairie', 'full-frame/w05-bridge', 'full-frame/w01-line'],
  order: ['prologue/mairie', 'full-frame/w06-hall', 'full-frame/w10-anchor.cp.head', 'full-frame/w04-annex'],
};
export function newspaperPhoto(axis: WorldVar, used: Set<string>): string | null {
  const candidate = [...EDITORIAL_PHOTOS[axis], ...Object.values(EDITORIAL_PHOTOS).flat()].find(path => !used.has(path));
  if (!candidate) return null;
  used.add(candidate); return candidate;
}

type Change = { readonly axis: WorldVar; readonly from: number; readonly to: number; readonly delta: number };
/** Derives annual evidence without inventing news or treating answer contributions as individual event causes. */
export function retrospectiveYears(core: CoreData, run: RunResult, plan: FfPlan, set: HeadlineSet) {
  const metadata = new Map(set.headlines.map(h => [h.id, h]));
  return plan.fronts.map(front => {
    const start = firstStepOfYear(front.year) - 1;
    const end = Math.min(start + STEPS_PER_YEAR, plan.stepSec.length - 1);
    const before = run.trajectory.steps[start]!; const after = run.trajectory.steps[end]!;
    const changes: Change[] = WORLD_VARS.map(axis => ({ axis, from: before[axis] / 1000, to: after[axis] / 1000, delta: (after[axis] - before[axis]) / 1000 })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const news = plan.headlines.filter(h => h.year === front.year);
    const conditions = news.flatMap(h => metadata.get(h.id)?.when ?? []);
    const related = new Set<WorldVar>();
    for (const condition of conditions) {
      if (condition.kind === 'state' || condition.kind === 'twoYears') condition.all.forEach(c => related.add(c.var));
      else if (condition.kind === 'yearDelta') related.add(condition.var);
      else if (condition.kind === 'answer') {
        const question = core.questionnaire.questions.find(q => q.key === condition.question);
        const answer = question?.answers.find(a => a.key === run.answers[condition.question]);
        if (answer) WORLD_VARS.filter(axis => answer.push[axis] !== 0).forEach(axis => related.add(axis));
      }
    }
    const axes = related.size > 0 ? [...related] : changes.filter(c => c.delta !== 0).slice(0, 2).map(c => c.axis);
    const answers = contributions(core, run.answers, axes).filter(c => c.magnitude > 0);
    // Prefer an answer explicitly tested by a headline, otherwise the strongest contribution on its axes.
    const selected = answers.find(a => conditions.some(c => c.kind === 'answer' && c.question === a.question && c.answer === a.answer)) ?? answers[0] ?? null;
    return { year: front.year, news, conditions, changes, axes, selected };
  });
}

/** Mounts all years at once; only explicit entry changes the saved phase or screen. */
export function mountRetrospective(ctx: AppContext, run: RunResult, plan: FfPlan, root: HTMLElement): () => void {
  const doc = root.ownerDocument;
  const main = doc.createElement('main'); main.className = 'retro'; main.dataset['ui'] = 'retrospective'; main.dataset['layout'] = 'chronology';
  root.append(main);
  let entering = false; let disposed = false;
  const years = retrospectiveYears(ctx.core, run, plan, loadFastForwardData().headlines);
  const node = (tag: string, text = '', className = ''): HTMLElement => { const el = doc.createElement(tag); el.textContent = text; el.className = className; return el; };
  const yearLabel = (year: number): string => year === plan.hiddenYear ? ctx.i18n.t('ff.ui.yearHidden') : String(year);
  const lineText = (line: FrontLine): string => {
    if (line.variantKind === null) return ctx.i18n.t(line.key);
    if (line.variant === null) throw new Error(`retrospective: headline ${line.id} has no ${line.variantKind} variant`);
    return ctx.i18n.t(line.key, { [line.variantKind]: ctx.i18n.t(`ff.var.${line.variantKind}.${line.variant}`) });
  };
  const enter = (): void => {
    if (entering || disposed) return;
    entering = true; render();
    if (run.outcome.kind === 'arrival') { if (!enterExploration(ctx)) ctx.save.update({ phase: 'street' }); void ctx.navigate('street', { run }); }
    else { enterExploration(ctx); void ctx.navigate('causes', { run }); }
  };
  const render = (): void => {
    const lang = ctx.i18n.lang(); const copy = COPY[lang]; const axes = LABELS[lang];
    const number = (n: number): string => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n);
    const signed = (n: number): string => `${n > 0 ? '+' : ''}${number(n)}`;
    main.replaceChildren(); main.setAttribute('aria-label', copy.reading);
    const header = node('header', '', 'retro-header');
    header.append(node('p', copy.eyebrow, 'retro-eyebrow'), node('h1', copy.title), node('p', copy.intro, 'retro-control'));
    explorationReturn(ctx, header);
    main.append(header);
    const origin = node('article', '', 'retro-origin'); origin.dataset['ui'] = 'retro-paper'; origin.dataset['year'] = '2026'; origin.dataset['source'] = 'answers';
    const originTitle = node('h2', copy.origin); originTitle.dataset['ui'] = 'retro-year';
    origin.append(originTitle, node('p', copy.originBody)); main.append(origin);
    const timeline = node('section', '', 'retro-timeline');
    let editionIndex = 0;
    const usedPhotos = new Set<string>(); const coveredTopics = new Set<WorldVar>(); timeline.dataset['ui'] = 'retro-timeline'; timeline.setAttribute('aria-label', copy.reading);
    timeline.style.setProperty('--retro-years', String(years.length));
    for (const year of years) {
      const index = editionIndex++;
      const article = node('article', '', 'retro-paper'); article.dataset['ui'] = 'retro-paper'; article.id = `retro-edition-${index}`;
      article.setAttribute('aria-labelledby', `retro-year-${index}`); article.dataset['edition'] = String(index);
      if (year.year !== plan.hiddenYear) article.dataset['year'] = String(year.year);
      const editorial = worldHeadline(run.outcome.kind === 'arrival' ? run.outcome.livedWorld : run.outcome.world, year.year, run.answers, year.selected, lang);
      article.dataset['source'] = year.news.length > 0 ? 'headlines' : editorial.source;
      const stamp = node('h2', yearLabel(year.year), 'retro-year'); stamp.dataset['ui'] = 'retro-year'; stamp.id = `retro-year-${index}`;
      const paperHeader = node('header', '', 'retro-paper-header');
      paperHeader.append(node('p', lang === 'fr' ? 'LE QUOTIDIEN' : 'THE DAILY', 'retro-masthead'), stamp);
      article.append(paperHeader, node('p', lang === 'fr' ? `JOURNAL DES FUTURS POSSIBLES · ÉDITION ${index + 1} · FICTION` : `JOURNAL OF POSSIBLE FUTURES · EDITION ${index + 1} · FICTION`, 'retro-edition'));
      article.append(node('p', year.news.length > 0 ? copy.journal : copy.movement, 'retro-eyebrow'));
      let photoAxis = year.axes[0] ?? year.changes[0]!.axis;
      if (year.news.length > 0) {
        for (const line of year.news) { const text = node('h3', lineText(line), 'retro-lead'); text.dataset['line'] = line.id; article.append(text); }
      } else {
        const candidates = year.changes.filter(change => change.delta !== 0);
        const movement = candidates.find(change => !coveredTopics.has(change.axis)) ?? candidates[0];
        if (movement) photoAxis = movement.axis;
        article.append(node('h3', editorial.title, 'retro-lead'), node('p', editorial.boundary, 'retro-control'));
      }
      coveredTopics.add(photoAxis);
      const spread = node('div', '', 'retro-spread');
      const photoPath = newspaperPhoto(photoAxis, usedPhotos);
      if (photoPath) {
        const figure = node('figure', '', 'retro-archive-photo');
        const photo = doc.createElement('img'); photo.src = `${import.meta.env.BASE_URL}illustrated/${photoPath}.jpg`; photo.alt = lang === 'fr' ? `Illustration du dossier : ${axes[photoAxis]}` : `Illustration: ${axes[photoAxis]}`; photo.loading = index === 0 ? 'eager' : 'lazy';
        figure.append(photo, node('figcaption', lang === 'fr' ? `Illustration fictive · ${axes[photoAxis]}` : `Fictional illustration · ${axes[photoAxis]}`));
        spread.append(figure);
      }
      const column = node('aside', '', 'retro-editorial');
      const editorialChange = year.changes.find(change => change.axis === photoAxis)!;
      column.append(node('h4', axes[photoAxis]), node('p', lang === 'fr' ? (editorialChange.delta === 0 ? 'Les équilibres restent stables. Le quotidien continue de porter les choix des années précédentes.' : EDITORIAL_DECKS[photoAxis][editorialChange.delta > 0 ? 0 : 1]) : 'Your choices have shaped the balances of this possible future.', 'retro-standfirst'));
      const trend = node('div', '', 'retro-trend'); trend.dataset['ui'] = 'retro-change';
      trend.append(node('h4', copy.change));
      for (const axis of ['freedom', 'abundance', 'unrest', 'order', 'surveillance', 'aiPower'] as const) {
        const change = year.changes.find(c => c.axis === axis)!;
        const row = node('p', `${axes[axis]} ${number(change.from)} → ${number(change.to)} (${signed(change.delta)})`);
        row.dataset['axis'] = axis; trend.append(row);
      }
      const indicators = node('details', '', 'retro-indicators');
      indicators.append(node('summary', lang === 'fr' ? 'Les évolutions en chiffres' : 'Changes in figures'), trend);
      column.append(indicators);
      // Le titre de scène seul (« Des badges désactivés ») ne dit pas ce qui était défendu : en français on affiche la question du prologue.
      const questionText = (id: string): string => (lang === 'fr' ? (mayorScenes.find(s => s.id === id)?.question ?? '') : '') || ctx.i18n.t(`q.${id}.title`);
      const cause = node('div', '', 'retro-contribution'); cause.dataset['ui'] = 'retro-contribution'; cause.append(node('h4', copy.contribution));
      const answer = year.selected;
      if (answer) {
        cause.dataset['question'] = answer.question; cause.dataset['answer'] = answer.answer;
        cause.append(node('p', questionText(answer.question), 'retro-question'), node('p', `« ${ctx.i18n.t(`q.${answer.question}.${answer.answer}.label`)} »`, 'retro-answer'));
        const deltas = answer.deltas.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 2);
        cause.append(node('p', deltas.map(d => `${axes[d.axis]} ${signed(d.value)}`).join(' · '), 'retro-deltas'));
      } else cause.append(node('p', copy.noPush));
      column.append(cause);
      if (year.conditions.length > 0) {
        const details = node('details', '', 'retro-rules'); details.append(node('summary', copy.rule), node('p', copy.allRules));
        const level = (c: { readonly var: WorldVar; readonly cmp: string; readonly threshold: number }): string => `${axes[c.var]} ${c.cmp.startsWith('<') ? copy.below : copy.above} ${number(c.threshold / 1000)}`;
        const rule = (condition: HeadlineCond): string => {
          switch (condition.kind) {
            case 'state': return condition.all.map(level).join(' · ');
            case 'twoYears': return `${copy.twoYears} : ${condition.all.map(level).join(' · ')}`;
            case 'yearDelta': return `${copy.yearDelta} : ${axes[condition.var]} ${signed(condition.delta / 1000)} ${condition.cmp === '>=' ? copy.orMore : copy.orLess}`;
            case 'answer': return `${copy.answer} : ${questionText(condition.question)} « ${ctx.i18n.t(`q.${condition.question}.${condition.answer}.label`)} »`;
            case 'atStep': return `${copy.step} ${condition.step}`;
            case 'rupture': return copy.rupture;
          }
        };
        for (const condition of year.conditions) details.append(node('p', rule(condition)));
        details.append(node('p', copy.contributionScale), node('p', copy.units)); column.append(details);
      }
      article.append(spread);
      const detail = doc.createElement('dialog'); detail.className = 'retro-detail-dialog'; detail.setAttribute('aria-label', `${yearLabel(year.year)} · ${lang === 'fr' ? 'Sources et causes' : 'Sources and causes'}`);
      const close = doc.createElement('button'); close.type = 'button'; close.textContent = lang === 'fr' ? 'Fermer' : 'Close';
      const inspect = doc.createElement('button'); inspect.type = 'button'; inspect.className = 'retro-detail-button'; inspect.textContent = lang === 'fr' ? 'Pourquoi ?' : 'Why?';
      close.addEventListener('click', () => detail.close());
      detail.addEventListener('close', () => inspect.focus());
      inspect.addEventListener('click', () => detail.showModal());
      detail.append(close, node('h2', yearLabel(year.year)), ...[...article.querySelectorAll('.retro-lead')].map(lead => lead.cloneNode(true)), node('p', year.news.length ? copy.journal : editorial.boundary), column);
      article.append(inspect, detail); timeline.append(article);
    }
    main.append(timeline);
    const contextNote = node('p', lang === 'fr' ? 'Le jeu ne donne pas de score de bonheur : c’est en vivant avec les personnages que tu verras si on y vit bien.' : 'The game gives no happiness score: you’ll see how people live by meeting them.', 'retro-fiction');
    const sourceDialog = doc.createElement('dialog'); sourceDialog.className = 'retro-detail-dialog'; sourceDialog.setAttribute('aria-label', lang === 'fr' ? 'Sources et méthode' : 'Sources and method');
    const sourceClose = doc.createElement('button'); sourceClose.type='button'; sourceClose.textContent=lang==='fr'?'Fermer':'Close'; sourceClose.addEventListener('click',()=>sourceDialog.close());
    const sourceOpen = doc.createElement('button'); sourceOpen.type='button'; sourceOpen.className='retro-source-open'; sourceOpen.textContent=lang==='fr'?'Sources et méthode':'Sources and method'; sourceOpen.addEventListener('click',()=>sourceDialog.showModal());
    sourceDialog.addEventListener('close',()=>sourceOpen.focus()); sourceDialog.append(sourceClose, contextNote, node('p',copy.note));
    main.append(sourceOpen,sourceDialog);
    if (lang === 'fr') {
      const present = node('details', '', 'retro-present'); present.dataset['ui'] = 'present-signals';
      present.append(node('summary', `Aujourd’hui déjà · ${PRESENT_SIGNALS.length} faits réels, leurs sources et leurs limites`), node('p', PRESENT_BOUNDARY));
      const cards = node('div', '', 'retro-present-cards');
      for (const signal of PRESENT_SIGNALS) {
        const card = node('article'); card.append(node('h3', signal.title), node('small', `${signal.place} · ${signal.date}`), node('p', signal.fact), node('p', signal.boundary));
        const link = doc.createElement('a'); link.href = signal.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `Source documentaire externe · ${signal.source}`; card.append(link); cards.append(card);
      }
      present.append(cards); sourceDialog.append(present);
    }
    const footer = node('section', '', 'retro-arrival'); footer.dataset['ui']='world-entry';
    const destination = node('div', '', 'retro-destination'); destination.append(node('p', copy.destination, 'retro-eyebrow'));
    if (run.outcome.kind === 'arrival') destination.append(node('h2', ctx.i18n.t(`world.${run.outcome.livedWorld}.name`)), node('p', ctx.i18n.t(`world.${run.outcome.livedWorld}.clear`)));
    else destination.append(node('h2', copy.extinction), node('p', copy.extinctionBody));
    const go = doc.createElement('button'); go.type = 'button'; go.textContent = run.outcome.kind === 'arrival' ? copy.enter : copy.causes; go.dataset['ui'] = 'retro-enter'; go.disabled = entering; go.addEventListener('click', enter);
    if(run.outcome.kind==='arrival') {
      const world=run.outcome.livedWorld;const plate=Object.values(illustratedLocations[world]??{})[0];
      if(plate){const preview=node('div','','retro-world-preview');preview.style.cssText=plateStyle(plate);preview.setAttribute('role','img');preview.setAttribute('aria-label',ctx.i18n.t(`world.${world}.name`));footer.append(preview);}
      destination.append(node('p',lang==='fr'?(exploration(ctx) ? 'Explore cette autre trajectoire comme habitant. Tes décisions d’origine sont conservées.' : 'Tu as pris position comme maire. Maintenant, entre dans ce futur comme habitant : une mission, des proches et les conséquences à vivre.'):(exploration(ctx) ? 'Explore this other trajectory as a resident. Your original decisions are kept.' : 'You took a stand as mayor. Now step into this future as a resident: a mission, loved ones and consequences to live.'),'retro-play-promise'));
    }
    footer.append(destination, go); main.insertBefore(footer,origin);
  };
  const offLanguage = ctx.i18n.onChange(render); render();
  return () => { disposed = true; offLanguage(); main.remove(); };
}
