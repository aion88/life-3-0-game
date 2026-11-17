/** Lien « Contact / Donner mon avis » des écrans de fin (même adresse que l'accueil). Le texte vient de `fr.json` / `en.json`. */
import type { I18n } from '../i18n/i18n';
import './feedback.css';

export function createContactLink(i18n: I18n, className: string, doc: Document = document): HTMLAnchorElement {
  const a = doc.createElement('a');
  a.className = className;
  a.dataset['ui'] = 'contact';
  a.href = `mailto:contact@kaizntech.com?subject=${encodeURIComponent(i18n.t('feedback.subject'))}`;
  a.textContent = i18n.t('feedback.contact');
  return a;
}
