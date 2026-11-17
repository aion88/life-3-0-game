/** Aides DOM de l'écran Atlas : éléments, SVG, glyphes de stade et symboles de la matrice. Aucun réseau, aucun innerHTML. */
import { STADE_KEY, type CellKind } from '../../atlas/model';
import type { Stade } from '../../atlas/schema';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: SVGElement[]): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
}

/** Lien externe : s'ouvre dans un autre onglet, sans référent. */
export function link(label: string, url: string, cls?: string): HTMLAnchorElement {
  const a = el('a', cls, label);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

const GLYPH: Readonly<Record<string, () => SVGElement[]>> = {
  vig: () => [svg('rect', { x: 2, y: 2, width: 10, height: 10, fill: 'currentColor' })],
  ado: () => [svg('rect', { x: 2.5, y: 2.5, width: 9, height: 9, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 })],
  deb: () => [svg('path', { d: 'M7 1 13 7 7 13 1 7Z', fill: 'currentColor' })],
  dep: () => [svg('path', { d: 'M7 1.5 13 12H1Z', fill: 'currentColor' })],
  ann: () => [svg('path', { d: 'M7 2 12.5 12h-11Z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round' })],
  cen: () => [svg('path', { d: 'M2.5 2.5 11.5 11.5M11.5 2.5 2.5 11.5', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none' })],
  exp: () => [svg('circle', { cx: 7, cy: 7, r: 4.7, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-dasharray': '3 2.2' })],
};

/** Forme d'un stade, dessinée dans une boîte 14 x 14 (le mot reste à côté : la forme et la couleur ne portent jamais seules). */
export function stadeShape(stade: Stade): SVGElement[] {
  return (GLYPH[STADE_KEY[stade]] ?? (() => []))();
}

export function stadeGlyph(stade: Stade, size = 12): SVGSVGElement {
  return svg('svg', { class: 'at-sg', width: size, height: size, viewBox: '0 0 14 14', 'aria-hidden': 'true' }, ...stadeShape(stade));
}

/** Pastille de stade : forme + mot. */
export function pill(stade: Stade, label: string): HTMLSpanElement {
  const p = el('span', `at-pill st-${STADE_KEY[stade]}`);
  p.append(stadeGlyph(stade), el('span', undefined, label));
  return p;
}

/** Symbole de cellule : rond plein (lien direct), rond creux (indirect), barre (frein), petit point (même levier). */
export function symbol(kind: CellKind, size = 18): SVGSVGElement {
  const kids: SVGElement[] = [];
  if (kind === 'direct') kids.push(svg('circle', { cx: 10, cy: 10, r: 6, fill: 'currentColor' }));
  else if (kind === 'indirect') kids.push(svg('circle', { cx: 10, cy: 10, r: 5.2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2 }));
  else if (kind === 'frein') kids.push(svg('rect', { x: 3.5, y: 8.4, width: 13, height: 3.2, rx: 1.6, fill: 'currentColor' }));
  else kids.push(svg('circle', { cx: 10, cy: 10, r: 2.2, fill: 'currentColor' }));
  return svg('svg', { class: `at-sym sym-${kind}`, width: size, height: size, viewBox: '0 0 20 20', 'aria-hidden': 'true' }, ...kids);
}

/** Tampon d'encre : bordure, majuscules, légèrement penché (la couleur vient de la classe ajoutée : ext, hors, ou un stade). */
export function stamp(text: string, cls = ''): HTMLSpanElement {
  return el('span', `at-stamp${cls ? ` ${cls}` : ''}`, text);
}

/** Jeton d'un texte : la forme de son stade dans un carré de 14 px, à la couleur du stade. Le mot vit dans le libellé voisin. */
export function token(stade: Stade, size = 14): HTMLSpanElement {
  const t = el('span', `at-tk sk-${STADE_KEY[stade]}`);
  t.append(stadeGlyph(stade, size));
  return t;
}
