/** Petits outils DOM de l'interface de la rue : création d'éléments, rendu lié à la langue [plan 02a T11]. */
import type { I18n } from '../../i18n/i18n';

/** Crée un élément avec ses attributs ; le texte est posé par `textContent`, jamais en HTML. */
export function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, attrs: Readonly<Record<string, string>> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Un composant d'interface : il se redessine quand la langue change et se retire à `dispose`. */
export interface Part { dispose(): void }

/** Branche `render` sur le changement de langue ; renvoie le désabonnement. */
export function onLang(i18n: I18n, render: () => void): () => void {
  return i18n.onChange(render);
}
