/**
 * Jetons du thème posés comme variables CSS sur un élément [art bible §B.1, §E ; spec interface C §1, §2, §4].
 * Le CSS ne lit que ces variables : aucune couleur, taille, durée ni courbe en dur.
 */
import { loadUi } from '../data/ui/load';

const kebab = (name: string): string => name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Unité d'un réglage numérique d'après le suffixe de son nom (`...Px`, `...Deg`), sinon sans unité. */
function withUnit(name: string, v: number): string {
  if (name.endsWith('Px')) return `${v}px`;
  if (name.endsWith('Deg')) return `${v}deg`;
  return String(v);
}

/**
 * Pose `--font-ui`, `--font-display`, `--font-text`, une variable `--c-<nom>` par jeton de couleur (mur de CRT et palette C), `--sh-<ombre>`, `--s-<forme>`
 * (`--s-q-*` questionnaire, `--s-street-*` rue), `--t-<rôle>-{size,weight,family,lh}` et `--m-<mouvement>-{ms,easing,delay,stagger}`.
 * La taille de texte suit la fenêtre (base 1920) avec un plancher absolu `minTextPx` [spec §2, §6].
 */
export function applyTheme(el: HTMLElement): void {
  const { theme, timing } = loadUi();
  const set = (k: string, v: string): void => el.style.setProperty(k, v);
  set('--font-ui', theme.fontUi);
  set('--font-display', theme.fontDisplay);
  set('--font-text', theme.fontText);
  for (const [name, value] of Object.entries(theme.colors)) set(`--c-${kebab(name)}`, value);
  for (const [name, s] of Object.entries(theme.palette)) set(`--c-${kebab(name)}`, s.v);
  for (const [name, s] of Object.entries(theme.shadows)) set(`--sh-${kebab(name)}`, s.v);
  for (const [name, s] of Object.entries(theme.shape)) set(`--s-${kebab(name)}`, withUnit(name.endsWith('Deg') ? name : `${name}Px`, s.v));   // formes : px sauf rotation
  for (const [name, s] of Object.entries(theme.questionnaire)) set(`--s-q-${kebab(name)}`, withUnit(name, s.v));
  for (const [name, s] of Object.entries(theme.street)) if (typeof s.v === 'number') set(`--s-street-${kebab(name)}`, withUnit(name, s.v));
  const floor = theme.minTextPx.v;
  set('--t-min-text-px', `${floor}px`);
  for (const [role, s] of Object.entries(theme.type)) {
    const n = kebab(role);
    const { px, weight, family, lineHeight } = s.v;
    set(`--t-${n}-size`, `clamp(${floor}px, calc(${px} * 100vw / ${theme.street.referenceWidthPx.v}), ${px}px)`);
    set(`--t-${n}-weight`, String(weight));
    set(`--t-${n}-family`, `var(--font-${family})`);
    set(`--t-${n}-lh`, String(lineHeight));
  }
  for (const [name, s] of Object.entries(timing.easings)) set(`--e-${kebab(name)}`, s.v);
  for (const [id, m] of Object.entries(timing.motion)) {
    const n = kebab(id);
    set(`--m-${n}-ms`, `${m.v.ms}ms`);
    set(`--m-${n}-easing`, timing.easings[m.v.easing].v);
    set(`--m-${n}-delay`, `${m.v.delayMs}ms`);
    set(`--m-${n}-stagger`, `${m.v.staggerMs}ms`);
  }
}
