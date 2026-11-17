import { PRESENT_BOUNDARY, PRESENT_SIGNALS } from './present';
import './present.css';

const connections: Record<string, string> = {
  'glukhin-peaceful-protest': 'Le contrôle des déplacements dans 1984 pousse cette question : peux-tu agir pour un proche si tes mouvements permettent de te retrouver ?',
  'uk-live-facial-recognition': 'Les caméras du questionnaire et le contrôle du Registre dans 1984 interrogent le même arbitrage : sécurité, identification et liberté de circuler.',
  'utah-prescription-pilot': 'L’ordonnance de ton père, dans le questionnaire, pose la question de la délégation des soins : qui vérifie et qui répond d’une erreur ?',
  'ilo-work-exposure': 'L’intérim de ton frère et le choix du temps de travail, dans le questionnaire, interrogent la place du travail lorsque les tâches sont automatisées.',
  'eu-social-scoring-prohibition': 'Les choix de régulation du questionnaire et les obstacles du Registre dans 1984 posent la question des limites et des recours face au pouvoir.',
};
/** Keep observation, fictional connection and source limits together at every entry point. */
export function presentComparisons(doc: Document, question = 'Q11'): HTMLElement {
  const node = (tag: string, text: string): HTMLElement => { const e = doc.createElement(tag); e.textContent = text; return e; };
  const section = node('section', ''); section.className = 'present-comparisons'; section.dataset['sheetSection'] = 'life-real'; section.tabIndex = -1; section.dataset['ui'] = 'real-world-comparisons';
  section.append(node('h2', 'Dans le monde réel'), node('p', PRESENT_BOUNDARY));
  const signals = [...PRESENT_SIGNALS].sort((a, b) => Number(b.questions.includes(question)) - Number(a.questions.includes(question)));
  const more = node('details', ''); more.append(node('summary', 'Les autres faits qui éclairent le jeu'));
  for (const [index, signal] of signals.entries()) {
    const card = node('article', ''); card.dataset['signal'] = signal.id;
    card.append(node('small', `${signal.place} · ${signal.date}`), node('h3', signal.title), node('p', signal.fact));
    const connection = node('p', connections[signal.id] ?? ''); connection.className = 'present-connection';
    connection.prepend(node('strong', 'Le lien avec le jeu · '));
    card.append(connection, node('p', signal.boundary));
    const link = doc.createElement('a'); link.href = signal.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `Lire la source externe · ${signal.source}`; card.append(link);
    (index < 2 ? section : more).append(card);
  }
  section.append(more); return section;
}
