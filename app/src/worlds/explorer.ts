/** Read-only catalogue and counterfactual answer comparison. Only the supplied callback starts exploration. */
import type { AppContext } from '../app/shell';
import type { Answers, RunResult, WorldId } from '../shared/types';
import { findAlternative, type AlternativePath } from './alternatives';
import './explorer.css';

const WORLDS: readonly WorldId[] = ['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08', 'w09', 'w10', 'w11', 'w12'];
const COPY = {
  fr: {
    title: 'Douze futurs. D’autres choix.', eyebrow: 'LIFE 3.0 · EXPLORER', close: 'Fermer l’exploration',
    intro: 'Dix mondes à habiter, deux trajectoires qui s’interrompent. Choisis un futur pour voir quelles autres réponses y auraient mené.',
    note: 'Ce sont des fictions, pas des prédictions. Le chemin proposé est un chemin possible : ni unique, ni nécessairement celui qui change le moins de réponses.',
    worlds: 'Les douze futurs', playable: 'Monde jouable', ending: 'Fin de trajectoire', current: 'Ta destination',
    choose: 'Quel autre futur veux-tu comprendre ?', chooseBody: 'Sélectionne un monde. Tu pourras comparer les réponses avant d’explorer sa trajectoire.',
    busy: 'Recherche des réponses qui y mènent…', unavailable: 'Aucun chemin vérifié n’a été trouvé pour ce futur avec cette version du modèle.',
    changes: 'Les réponses qui changent', before: 'Ta réponse', after: 'Dans cette hypothèse', unchanged: 'Tes réponses conduisent déjà à ce futur. Aucune réponse ne change.',
    go: 'Voir cette autre trajectoire', sameGo: 'Revoir cette trajectoire', preserve: 'Consulter ces différences ne modifie pas ta partie. Le bouton ouvre ensuite la chronologie de cette hypothèse.',
    extinction: 'Cette trajectoire se termine par une extinction : tu en verras la chronologie et les causes, sans monde à visiter.',
    failure: 'Le calcul n’a pas pu aboutir. Ferme puis rouvre l’exploration pour réessayer.',
  },
  en: {
    title: 'Twelve futures. Other choices.', eyebrow: 'LIFE 3.0 · EXPLORE', close: 'Close exploration',
    intro: 'Ten worlds to inhabit, two paths that end. Choose a future to see which alternative answers would have led there.',
    note: 'These are fictions, not predictions. The proposed path is one possible path: neither unique nor necessarily the one that changes the fewest answers.',
    worlds: 'The twelve futures', playable: 'Playable world', ending: 'End of the path', current: 'Your destination',
    choose: 'Which other future would you like to understand?', chooseBody: 'Select a world. Compare answers before exploring its timeline.',
    busy: 'Finding the answers that lead there…', unavailable: 'No verified path was found for this future in this version of the model.',
    changes: 'Answers that change', before: 'Your answer', after: 'In this hypothesis', unchanged: 'Your answers already lead to this future. No answers change.',
    go: 'See this alternative timeline', sameGo: 'Revisit this timeline', preserve: 'Reading these differences does not change your playthrough. The button opens the timeline of this hypothesis.',
    extinction: 'This path ends in extinction: you will see its timeline and causes, without a world to visit.',
    failure: 'The calculation could not finish. Close and reopen exploration to try again.',
  },
} as const;
let explorerCount = 0;

/** Accessible modal; never writes saves, mutates the original run or navigates on its own. */
export function mountExplorer(host: HTMLElement, ctx: AppContext, run: RunResult, onExplore: (answers: Answers) => void): { dispose(): void } {
  const doc = host.ownerDocument;
  const previousFocus = doc.activeElement;
  const wasInert = host.inert;
  const dialog = doc.createElement('dialog'); dialog.className = 'world-explorer'; dialog.dataset['ui'] = 'world-explorer';
  const titleId = `world-explorer-title-${++explorerCount}`;
  dialog.setAttribute('aria-labelledby', titleId);
  doc.body.append(dialog);
  if (host !== doc.body) host.inert = true;
  const destination = run.outcome.kind === 'arrival' ? run.outcome.computedWorld : run.outcome.world;
  const cache = new Map<WorldId, AlternativePath | null>();
  let selected: WorldId | null = null;
  let candidate: AlternativePath | null = null;
  let pending = false, failed = false, disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const node = (tag: string, text = '', className = ''): HTMLElement => {
    const el = doc.createElement(tag); el.textContent = text; el.className = className; return el;
  };
  const button = (text: string, action: () => void, className = ''): HTMLButtonElement => {
    const el = doc.createElement('button'); el.type = 'button'; el.textContent = text; el.className = className;
    el.addEventListener('click', action); return el;
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true; clearTimeout(timer); offLanguage();
    if (host !== doc.body) host.inert = wasInert;
    dialog.close(); dialog.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  const select = (id: WorldId): void => {
    clearTimeout(timer); selected = id; candidate = null; failed = false; pending = true; render();
    // Yield so the pending state is painted before a bounded synchronous model search.
    timer = setTimeout(() => {
      if (disposed) return;
      try {
        if (!cache.has(id)) cache.set(id, findAlternative(ctx.core, run.answers, id));
        candidate = cache.get(id) ?? null;
      } catch { failed = true; }
      pending = false; render();
      dialog.querySelector<HTMLElement>('.world-explorer-detail h2')?.focus();
    }, 25);
  };
  const render = (): void => {
    const c = COPY[ctx.i18n.lang()];
    dialog.replaceChildren();
    const top = node('header', '', 'world-explorer-header');
    const heading = node('div'); const title = node('h1', c.title); title.id = titleId;
    heading.append(node('p', c.eyebrow, 'world-explorer-eyebrow'), title, node('p', c.intro));
    const close = button(c.close, dispose, 'world-explorer-close'); close.dataset['ui'] = 'explorer-close';
    top.append(heading, close); dialog.append(top);
    const layout = node('div', '', 'world-explorer-layout');
    const catalogue = node('section', '', 'world-explorer-cards'); catalogue.setAttribute('aria-label', c.worlds);
    for (const id of WORLDS) {
      const extinction = id === 'w07' || id === 'w12';
      const card = button('', () => select(id), 'world-explorer-card');
      card.dataset['world'] = id; card.dataset['ui'] = 'explorer-world';
      card.setAttribute('aria-pressed', String(selected === id));
      card.append(node('span', extinction ? c.ending : c.playable, 'world-explorer-kind'),
        node('strong', ctx.i18n.t(`world.${id}.name`)), node('span', ctx.i18n.t(`world.${id}.clear`), 'world-explorer-description'));
      if (id === destination) card.append(node('span', c.current, 'world-explorer-current'));
      catalogue.append(card);
    }
    const detail = node('section', '', 'world-explorer-detail'); detail.dataset['ui'] = 'explorer-detail';
    detail.setAttribute('aria-busy', String(pending));
    const detailTitle = node('h2', selected ? ctx.i18n.t(`world.${selected}.name`) : c.choose); detailTitle.tabIndex = -1;
    detail.append(detailTitle);
    if (!selected) detail.append(node('p', c.chooseBody));
    else if (pending) { const status = node('p', c.busy); status.setAttribute('role', 'status'); detail.append(status); }
    else if (failed || !candidate) { const status = node('p', failed ? c.failure : c.unavailable); status.setAttribute('role', 'status'); detail.append(status); }
    else {
      if (selected === 'w07' || selected === 'w12') detail.append(node('p', c.extinction, 'world-explorer-extinction'));
      detail.append(node('h3', c.changes));
      if (!candidate.changes.length) detail.append(node('p', c.unchanged));
      const list = node('ol', '', 'world-explorer-diff');
      for (const change of candidate.changes) {
        const item = node('li'); item.dataset['question'] = change.question;
        const values = node('dl');
        values.append(node('dt', c.before), node('dd', ctx.i18n.t(`q.${change.question}.${change.from}.label`)),
          node('dt', c.after), node('dd', ctx.i18n.t(`q.${change.question}.${change.to}.label`)));
        item.append(node('h4', ctx.i18n.t(`q.${change.question}.title`)), values); list.append(item);
      }
      detail.append(list, node('p', c.note, 'world-explorer-note'), node('p', c.preserve, 'world-explorer-preserve'));
      const answers = candidate.answers;
      const go = button(candidate.changes.length ? c.go : c.sameGo, () => { dispose(); onExplore(answers); }, 'world-explorer-go');
      go.dataset['ui'] = 'explorer-go'; detail.append(go);
    }
    layout.append(catalogue, detail); dialog.append(layout);
  };
  dialog.addEventListener('cancel', event => { event.preventDefault(); dispose(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dispose(); } });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const offLanguage = ctx.i18n.onChange(render);
  render(); dialog.showModal(); dialog.querySelector<HTMLButtonElement>('.world-explorer-close')?.focus();
  return { dispose };
}
