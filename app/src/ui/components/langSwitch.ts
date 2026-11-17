/** Choix de langue : un bouton par langue, nommé par sa propre clé `lang.<code>` ; met à jour `i18n` et `<html lang>`. */
import type { I18n } from '../../i18n/i18n';
import type { Lang } from '../../shared/types';

const LANGS: readonly Lang[] = ['fr', 'en'];

export function createLangSwitch(i18n: I18n, onChange: (lang: Lang) => void): { readonly el: HTMLElement } {
  const el = document.createElement('div');
  el.dataset['ui'] = 'lang-switch';
  const buttons = new Map<Lang, HTMLButtonElement>();
  const paint = (): void => { for (const [l, b] of buttons) b.setAttribute('aria-pressed', String(i18n.lang() === l)); };
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset['lang'] = l;
    b.lang = l;
    b.textContent = i18n.t(`lang.${l}`);
    b.addEventListener('click', () => {
      i18n.setLang(l);
      document.documentElement.lang = l;
      paint();
      onChange(l);
    });
    buttons.set(l, b);
    el.append(b);
  }
  paint();
  return { el };
}
