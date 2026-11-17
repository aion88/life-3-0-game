import type { ScreenFactory } from '../../app/shell';
import { answersOf, type AnswerKey } from '../../shared/types';
import { runSeed } from '../../shared/seed';
import { clearShortProgress } from '../../save/shortProgress';
import { clearExploration } from '../../worlds/exploration';
import { getDraft } from '../draft';
import { QUESTION_SOURCES } from '../questionnaire/help';
import scenes from './scenes.json';
import '../../ui/font';
import '../../ui/tokens.css';
import '../../ui/worlds.css';
import './mayor.css';

const plain = (text: string): string => text.replace(/<q>/g, '« ').replace(/<\/q>/g, ' »');
/** Eleven unchanged engine decisions; one activation commits, history permits corrections. */
export const mayorScreen: ScreenFactory<'questionnaire'> = ctx => {
  let main: HTMLElement | undefined;
  let disposed = false;
  return {
    mount(root) {
      clearExploration();
      const saved = ctx.save.load().data;
      const replay = ['fastforward', 'street', 'bilan'].includes(saved.phase);
      const mem: Record<string, AnswerKey> = replay ? {} : Object.fromEntries(Object.entries(saved.answers).filter((e): e is [string, AnswerKey] => e[1] !== undefined));
      const questions = [...ctx.core.questionnaire.questions].sort((a, b) => a.order - b.order);
      let finished = false;
      let returnTo: number | undefined;
      let lastChoice: string | undefined;
      const doc = root.ownerDocument;
      const el = (tag: string, text = '', cls = ''): HTMLElement => {
        const item = doc.createElement(tag); item.textContent = plain(text); item.className = cls; return item;
      };
      const finish = (): void => {
        if (disposed || finished) return;
        finished = true;
        clearShortProgress(undefined, runSeed(answersOf(mem)));
        const patch = { answers: answersOf(mem), acts: [], phase: 'fastforward' as const };
        ctx.save.update(replay ? { ...patch, softened: getDraft().softened ?? false } : patch);
        void ctx.navigate('fastforward', { answers: answersOf(mem) });
      };
      main = el('main', '', 'mayor'); root.append(main);
      // A second click of one double-click must not answer the newly displayed question.
      main.addEventListener('click', event => {
        if (event.detail > 1) { event.preventDefault(); event.stopImmediatePropagation(); }
      }, true);
      main.addEventListener('keydown', event => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopImmediatePropagation(); }
      }, true);
      const show = (index: number): void => {
        if (disposed || finished || !main) return;
        const question = questions[index];
        if (!question) { finish(); return; }
        const scene = scenes.find(s => s.id === question.key);
        if (!scene || question.answers.some(a => !scene.choix.some(c => c.key === a.key))) throw new Error(`Missing mayor dossier: ${question.key}`);
        main.dataset['question'] = question.key;
        main.style.setProperty('--mayor-image', `url("${import.meta.env.BASE_URL}illustrated/prologue/${scene.decor}.jpg")`);
        main.replaceChildren(); main.scrollTop = 0;
        const header = el('header', '', 'mayor-header');
        header.append(el('p', 'Life 3.0 · 2026', 'mayor-kicker'), el('p', 'Tu es la maire.', 'mayor-role'), el('p', 'Tu agis dans ta commune et défends des positions sur l’IA. Puis tu vivras un futur possible comme habitante.', 'mayor-promise'));
        const progress = doc.createElement('progress'); progress.max = questions.length; progress.value = Object.keys(mem).length; progress.setAttribute('aria-label', 'Positions enregistrées'); header.append(progress);
        if (lastChoice) {
          const status = el('p', `Position enregistrée : ${lastChoice}`, 'mayor-last-choice'); status.setAttribute('role', 'status'); header.append(status);
        }
        const answered = questions.filter(q => mem[q.key] !== undefined);
        if (answered.length) {
          const history = doc.createElement('details'); history.className = 'mayor-history';
          history.append(el('summary', `Revoir ou modifier mes choix (${answered.length})`));
          for (const previous of answered) {
            const previousScene = scenes.find(s => s.id === previous.key)!;
            const choice = previousScene.choix.find(c => c.key === mem[previous.key]);
            if (!choice) continue;
            const item = el('section', '', 'mayor-history-item');
            item.append(el('h2', previousScene.titre), el('p', choice.t), el('p', choice.r, 'mayor-history-reaction'));
            const edit = doc.createElement('button'); edit.type = 'button'; edit.textContent = 'Modifier ce choix'; edit.dataset['editQuestion'] = previous.key;
            edit.addEventListener('click', () => { if (returnTo === undefined) returnTo = index; show(questions.indexOf(previous)); });
            item.append(edit); history.append(item);
          }
          header.append(history);
        }
        main.append(header);
        const paper = el('section', '', 'mayor-paper');
        paper.dataset['format'] = scene.forme === 'sms' ? 'message' : 'dossier';
        const folio = el('div', '', 'mayor-folio');
        folio.append(el('span', returnTo !== undefined ? 'Modifier une position' : scene.forme === 'sms' ? 'Messagerie · Maman' : 'Cabinet de la maire'), el('span', `Question ${question.order} sur ${questions.length}`));
        const date = el('p', scene.moment, 'mayor-date'); date.dataset['testid'] = 'q-date';
        const title = el('h1', scene.titre); title.tabIndex = -1;
        const story = el('p', scene.recit, 'mayor-story'); story.dataset['testid'] = 'q-scene';
        paper.append(folio, date, title, story);
        if (scene.bulles) { const messages = el('div', '', 'mayor-messages'); scene.bulles.forEach(b => messages.append(el('p', b))); paper.append(messages); }
        const reference = QUESTION_SOURCES[question.key];
        if (reference) {
          const source = el('details', '', 'mayor-source'); source.append(el('summary', `Repère réel · ${reference.title}`));
          source.append(el('p', reference.text));
          const link = doc.createElement('a'); link.href = reference.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Lire la source externe ↗'; source.append(link); paper.append(source);
        }
        paper.append(el('h2', scene.question ?? 'Ta réponse ?', 'mayor-question'));
        const choices = el('div', '', 'mayor-choices');
        choices.dataset['fresh'] = ''; choices.addEventListener('pointermove', () => { delete choices.dataset['fresh']; }, { once: true });   // pas de survol tant que la souris n'a pas bougé : sinon l'option sous le curseur paraît déjà choisie
        let signed = false;
        for (const answer of question.answers) {
          const choice = scene.choix.find(c => c.key === answer.key)!;
          const button = doc.createElement('button'); button.type = 'button'; button.className = 'mayor-choice c-option--q'; button.dataset['option'] = answer.key; button.textContent = choice.t; button.setAttribute('aria-pressed', String(mem[question.key] === answer.key));
          button.addEventListener('click', () => {
            if (signed || disposed || finished) return;
            signed = true; mem[question.key] = answer.key; lastChoice = choice.t;
            // Replays keep the previous completed run intact until the final answer.
            if (!replay) ctx.save.update({ answers: answersOf(mem), phase: 'questionnaire' });
            const destination = returnTo ?? index + 1; returnTo = undefined;
            show(destination);
          });
          choices.append(button);
        }
        const context = el('div', '', 'mayor-context'); context.append(...Array.from(paper.childNodes));
        const prompt = context.querySelector<HTMLElement>('.mayor-question')!; paper.append(context, prompt, choices);
        if (returnTo !== undefined) {
          const back = doc.createElement('button'); back.type = 'button'; back.className = 'mayor-edit-cancel'; back.textContent = 'Revenir sans modifier';
          back.addEventListener('click', () => { if (signed || returnTo === undefined) return; signed = true; const destination = returnTo; returnTo = undefined; show(destination); }); paper.append(back);
        }
        paper.append(el('p', 'Scène fictive · Les sources documentent les débats réels.', 'mayor-fiction'));
        main.append(paper, el('p', scene.moment.split(' · ').at(-1) ?? '', 'mayor-location'));
        title.focus({ preventScroll: true });
      };
      const first = questions.findIndex(q => mem[q.key] === undefined);
      if (first === -1) finish(); else show(first);
    },
    unmount() { disposed = true; main?.remove(); },
  };
};
