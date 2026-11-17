/**
 * Tuile d'un chiffre : la valeur en grand, une ligne qui dit ce qu'elle mesure, l'auteur et l'année, et, pour une mesure à jauge, une barre
 * remplie à valeur/max avec un trait et un libellé par seuil (teinte ocre propre au futur hors droit). Le détail (question exacte, échantillon,
 * limite, lien source) s'ouvre au toucher dans la même fiche papier que les lois (`sheet.openFigure`). Sans jauge : aucune barre, aucune échelle inventée.
 */
import { FR, type Labels } from '../../atlas/labels';
import { anneeDe, auteurCourt, bigValue, jaugeLisible, motsAffiches, seuilLabel, valeurAffichee } from '../../atlas/model';
import type { Chiffre } from '../../atlas/schema';
import { el, link, svg } from './dom';

/** Valeur en grand d'une tuile : la forme lisible de la jauge si elle existe, sinon celle du registre. */
export const bigOf = (c: Chiffre, L: Labels = FR): string => valeurAffichee(c, L) ?? jaugeLisible(c, L) ?? bigValue(c, L).big;

function gaugeBar(c: Chiffre, L: Labels): HTMLElement | null {
  const j = c.jauge;
  if (!j) return null;
  const pct = Math.min(100, Math.max(0, (j.valeur / j.max) * 100));
  const box = el('span', 'at-gauge');
  box.dataset['fill'] = pct.toFixed(2);
  const bar = svg('svg', { class: 'at-gbar', viewBox: '0 0 100 10', width: '100%', height: 10, preserveAspectRatio: 'none', role: 'img', 'aria-label': L.gaugeAria(L.num(j.valeur), L.num(j.max)) },
    svg('rect', { x: 0, y: 0, width: 100, height: 10, class: 'at-gtrack' }),
    svg('rect', { x: 0, y: 0, width: pct.toFixed(2), height: 10, class: 'at-gfill' }));
  for (const s of j.seuils) {
    const x = Math.min(100, Math.max(0, (s.valeur / j.max) * 100));
    bar.append(svg('line', { x1: x.toFixed(2), y1: 0, x2: x.toFixed(2), y2: 10, class: 'at-gtick', 'data-seuil': s.valeur }));
  }
  box.append(bar);
  const ticks = el('span', 'at-gticks');
  for (const s of j.seuils) {
    const x = Math.min(100, Math.max(0, (s.valeur / j.max) * 100));
    const t = el('span', `at-gt${x > 80 ? ' edge' : x < 12 ? ' start' : ''}`, seuilLabel(s.valeur, j.unite, L));
    t.style.setProperty('--x', `${x.toFixed(2)}%`);
    ticks.append(t);
  }
  if (j.seuils.length > 0) box.append(ticks);
  return box;
}

/** « Auteur · année », sans répéter l'année quand le nom de l'auteur la porte déjà. */
export const parAnnee = (auteur: string, annee: string): string => (auteur.includes(annee) ? auteur : `${auteur} · ${annee}`);

export function figureTile(c: Chiffre, L: Labels, open: (id: string) => void): HTMLElement {
  const big = bigOf(c, L);
  const line = c.libelle_court ?? c.titre_court ?? c.titre ?? bigValue(c, L).rest;
  const b = el('button', `at-ctile${c.jauge ? ' has-gauge' : ''}`);
  b.type = 'button';
  b.id = c.id;
  b.dataset['open'] = c.id;
  b.setAttribute('aria-label', `${L.tileOpen(big)} : ${line}`);
  b.append(el('span', `at-tbig${big.length > 9 ? ' small' : ''}`, big));
  const mots = motsAffiches(c);
  if (mots) b.append(el('span', 'at-trest at-tmots', mots));
  b.append(el('span', 'at-trest', line));
  const g = gaugeBar(c, L);
  if (g) b.append(g);
  b.append(el('span', 'at-tby', parAnnee(auteurCourt(c.auteur), anneeDe(c.date_publication))));
  b.addEventListener('click', () => open(c.id));
  return b;
}

/** Pourcentage d'un chiffre tenu en une seule valeur (« 73 % », « 68,3 % ») : de quoi remplir une jauge de 0 à 100. Les fourchettes et les paires n'en ont pas. */
export function pourcentageDe(big: string): number | null {
  const m = /^(\d+(?:[,.]\d+)?)\s?%$/.exec(big.trim());
  const v = m?.[1] ? Number(m[1].replace(',', '.')) : NaN;
  return Number.isFinite(v) && v <= 100 ? v : null;
}

/**
 * Ticket d'un chiffre : le nombre, une ligne d'étiquette, une jauge 0 à 100 quand le chiffre est un pourcentage, la source en machine à écrire,
 * puis le verdict et le lien source. Tout le reste (question, effectif, auteurs, limite) s'ouvre au toucher dans la fiche papier.
 */
export function figureTicket(c: Chiffre, L: Labels, open: (id: string) => void): HTMLElement {
  const big = bigOf(c, L);
  const line = c.libelle_court ?? c.titre_court ?? c.titre ?? bigValue(c, L).rest;
  const ticket = el('article', 'at-ticket');
  const b = el('button', 'at-ctile at-tbtn');
  b.type = 'button';
  b.id = c.id;
  b.dataset['open'] = c.id;
  b.setAttribute('aria-label', `${L.tileOpen(big)} : ${line}`);
  b.append(el('span', `at-tbig${big.length > 9 ? ' small' : ''}`, big));
  const mots = motsAffiches(c);
  if (mots) b.append(el('span', 'at-trest at-tmots', mots));
  b.append(el('span', 'at-trest', line));
  const pct = pourcentageDe(big);
  if (pct !== null) {
    const track = el('span', 'at-pg');
    track.dataset['fill'] = String(pct);
    const fill = el('i');
    fill.style.width = `${pct}%`;
    track.append(fill);
    b.append(track, el('span', 'at-pg-s', ''));
    b.lastElementChild?.append(el('span', undefined, '0'), el('span', undefined, '100'));
  }
  b.append(el('span', 'at-tby', parAnnee(auteurCourt(c.auteur), anneeDe(c.date_publication))));
  b.addEventListener('click', () => open(c.id));
  const foot = el('div', 'at-tfoot');
  const calc = c.calcule_par_nous || c.jauge?.calcule_par_nous;
  foot.append(el('span', 'at-v', calc ? `${L.verdict(c.verdict)} · ${L.calcByUs}` : L.verdict(c.verdict)), link(L.source, c.url));
  ticket.append(b, foot);
  return ticket;
}
