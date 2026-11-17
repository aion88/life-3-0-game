/**
 * Relevé du soir précis, rue guidée [spec rue guidée J1-J2 §5.1, §9.5, T11] : une ligne par maillon franchi (qui, à quelle heure, ce qui a été dit
 * ou le silence), puis trois encarts : « En 2026 » (la réponse de la joueuse, une entrée par chaîne), « Fait réel » (le fait sourcé de chaque chaîne),
 * « Ce qui est écrit » (le droit dit aujourd'hui). Aucun texte en dur : tout passe par `i18n.t`. Les six lignes par axe n'y sont pas [décision 4].
 */
import type { I18n } from '../../i18n/i18n';
import type { Recap } from '../../engine/moments/recap';
import { rightParts } from '../../engine/moments/rights';
import { make } from './dom';

/** Monde vécu de la démonstration : le préfixe des lignes de droit, comme `runtime.ts`. */
const WORLD = 'w10';

/** `street.recap.stamp` pour une minute du jour : heures et minutes à deux chiffres, sans calcul de texte. */
export function stampOf(i18n: I18n, minute: number): string {
  return i18n.t('street.recap.stamp', { h: Math.floor(minute / 60), m: String(minute % 60).padStart(2, '0') });
}

/** `{noms}` : les noms traduits, joints par « , » et `street.recap.names.and` avant le dernier ; `street.recap.names.none` quand personne n'est nommé. */
export function namesOf(i18n: I18n, keys: readonly string[]): string {
  const names = keys.map((k) => i18n.t(k));
  if (names.length === 0) return i18n.t('street.recap.names.none');
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} ${i18n.t('street.recap.names.and')} ${names[names.length - 1]!}`;
}

/** Construit le relevé précis ; la racine porte `[data-ui="recap"]`. `onWeek` : le bouton du dernier jour (`recap.weekButtonKey`) mène à la fin de la semaine. */
export function renderRecap(doc: Document, i18n: I18n, recap: Recap, onWeek: () => void = () => undefined): HTMLElement {
  const root = make(doc, 'section', { 'data-ui': 'recap', 'data-day': String(recap.day), class: 'c-recap' });
  root.appendChild(make(doc, 'h2', { 'data-ui': 'recap-title', class: 'c-recap-title' }, i18n.t('w10.recap.title')));
  const list = root.appendChild(make(doc, 'ol', { class: 'c-recap-list' }));
  const noms = namesOf(i18n, recap.names);
  for (const it of recap.items) {
    const li = list.appendChild(make(doc, 'li', { 'data-minute': String(it.minute) }));
    const by = li.appendChild(make(doc, 'p', { class: 'c-recap-by' }));
    by.appendChild(make(doc, 'time', { class: 'c-recap-stamp' }, stampOf(i18n, it.minute)));
    if (it.personKey !== null) by.appendChild(make(doc, 'span', { class: 'c-recap-person' }, i18n.t(it.personKey)));   // pas de personne : pas de nom, jamais une phrase à sa place
    li.appendChild(make(doc, 'p', { class: 'c-recap-what' }, i18n.t(it.recapKey, { noms })));
    if (it.speech === 'said') li.appendChild(make(doc, 'p', { class: 'c-recap-said' }, i18n.t('street.recap.said', { text: i18n.t(it.saidKey!) })));
    else if (it.speech === 'silence') li.appendChild(make(doc, 'p', { class: 'c-recap-said' }, i18n.t('w10.recap.silence')));
  }
  if (recap.chains.length > 0) {
    const box = root.appendChild(make(doc, 'section', { 'data-ui': 'recap-2026', class: 'c-recap-box' }));
    box.appendChild(make(doc, 'h3', { class: 'c-recap-box-title' }, i18n.t('w10.recap.box2026')));
    for (const c of recap.chains) {
      const e = box.appendChild(make(doc, 'div', { 'data-chain': c.chainId, class: 'c-recap-entry' }));
      e.appendChild(make(doc, 'p', { class: 'c-recap-chain' }, i18n.t(c.titleKey)));
      e.appendChild(make(doc, 'p', { class: 'c-recap-question' }, i18n.t(c.questionTitleKey)));
      if (c.answerLabelKey !== null) e.appendChild(make(doc, 'p', { class: 'c-recap-answer' }, i18n.t(c.answerLabelKey)));
      e.appendChild(make(doc, 'p', { class: 'c-recap-link' }, c.linkKey === null ? i18n.t('w10.recap.noAnswer') : i18n.t(c.linkKey)));
    }
    const fact = root.appendChild(make(doc, 'section', { 'data-ui': 'recap-fact', class: 'c-recap-box' }));
    fact.appendChild(make(doc, 'h3', { class: 'c-recap-box-title' }, i18n.t('w10.recap.boxFact')));
    for (const c of recap.chains) {
      const e = fact.appendChild(make(doc, 'div', { 'data-chain': c.chainId, class: 'c-recap-entry' }));
      e.appendChild(make(doc, 'p', { class: 'c-recap-chain' }, i18n.t(c.titleKey)));
      e.appendChild(make(doc, 'p', { class: 'c-recap-fact' }, i18n.t(c.fact.key)));
      e.appendChild(make(doc, 'p', { class: 'c-recap-source' }, i18n.t(c.fact.sourceKey)));   // la ligne lisible ; `fact.source` (chemin interne) n'est jamais montrée
    }
  }
  if (recap.right !== null) {
    const parts = rightParts(WORLD, recap.right, (k) => i18n.t(k));
    const right = root.appendChild(make(doc, 'section', { 'data-ui': 'recap-right', 'data-right': recap.right, class: 'c-recap-box' }));
    right.appendChild(make(doc, 'h3', { class: 'c-recap-box-title' }, i18n.t('w10.recap.boxRight')));
    right.appendChild(make(doc, 'p', { class: 'c-recap-here' }, parts.here));
    right.appendChild(make(doc, 'p', { class: 'c-recap-source' }, parts.source));
    right.appendChild(make(doc, 'p', { class: 'c-recap-quote' }, parts.quote));
  }
  if (recap.lastDay && recap.weekButtonKey !== null) {
    const week = root.appendChild(make(doc, 'button', { type: 'button', 'data-ui': 'recap-week', class: 'c-recap-week' }, i18n.t(recap.weekButtonKey)));
    week.addEventListener('click', onWeek);
  }
  return root;
}
