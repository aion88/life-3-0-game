/**
 * Composants communs de l'interface C : bouton, pastille, avis, Œil [plan UI-C T4 ; spec C §3.0, I-6, I-10, P-1].
 * Aucune couleur ni taille en dur : les classes de `c.css` lisent les jetons ; l'Œil prend ses grandeurs du thème.
 */
import { loadUi } from '../../data/ui/load';
import { motionFor } from '../motion';
import type { Animator } from '../motion';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Bouton d'action : pastille menthe, texte encre. */
export function createActionButton(label: string, testid?: string): HTMLButtonElement {
  const b = el('button', 'c-action', label);
  b.type = 'button';
  if (testid !== undefined) b.dataset['testid'] = testid;
  return b;
}

export type PillTone = 'soleil' | 'lavande' | 'lavandeClaire' | 'creme' | 'encre';

/** Pastille de texte : le ton choisit le fond (`c-pill--<ton>`). */
export function createPill(text: string, tone: PillTone): HTMLElement {
  return el('span', `c-pill c-pill--${tone}`, text);
}

/** Avis système : carte grisAcier, texte blanc, voix sobre (aucune rotation ni jus). */
export function createNotice(text: string, role: 'status' | 'alert' = 'status'): HTMLElement {
  const n = el('p', 'c-notice c-sober', text);
  n.setAttribute('role', role);
  return n;
}

export interface Eye { readonly el: HTMLElement; shutter(animator: Animator, reduced: boolean): Promise<void> }

/**
 * Œil : objectif d'appareil photo, jamais un visage [I-10]. `pupil: false` = pastille unie de 2026 ; `pupil: true` = pupille encre
 * et un reflet fixe, hors centre [P-1]. Aucun attribut d'état, aucun écouteur : la pupille ne suit ni curseur ni joueuse.
 */
export function createEye(opts: { pupil: boolean; sizePx: number }): Eye {
  const { theme, timing } = loadUi();
  const t = theme.street;
  const k = opts.sizePx / t.eyePx.v;
  const px = (v: number): string => `${v * k}px`;
  const eye = el('span', 'c-eye');
  eye.setAttribute('aria-hidden', 'true');
  eye.style.setProperty('--eye-px', `${opts.sizePx}px`);
  let pupil: HTMLElement | null = null;
  if (opts.pupil) {
    pupil = el('span', 'c-eye__pupil');
    pupil.style.width = px(t.pupilPx.v);
    pupil.style.height = px(t.pupilPx.v);
    const glint = el('span', 'c-eye__glint');
    glint.style.width = px(t.glintPx.v);
    glint.style.height = px(t.glintPx.v);
    glint.style.transform = `translate(calc(-50% + ${px(t.glintOffsetXPx.v)}), calc(-50% + ${px(t.glintOffsetYPx.v)}))`;
    pupil.append(glint);
    eye.append(pupil);
  }
  return {
    el: eye,
    async shutter(animator, reduced) {
      if (pupil === null) return;
      const spec = motionFor('shutter', reduced, timing);
      if (spec === null) return;
      await animator.play(pupil, spec);
    },
  };
}
