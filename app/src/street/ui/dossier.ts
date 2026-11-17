/**
 * Barre « Dossier » [GDD 2026-11-03 §2 option A, décision Cynthia, playtest 2026-11-03] : l'Intégrité de w10 vue depuis la rue, SANS
 * nombre. Seule jauge permise à l'écran (GDD 05 §3.5 amendé, R-C2, 3j) ; sœur du bracelet, jamais dans son sous-arbre (I-10 : le bracelet
 * ne dépend pas de la valeur).
 * Partie pleine : la valeur consolidée par la dernière nuit, couleur de son palier. Segments gris : ce que la nuit du jour versera.
 * Au relevé du soir (`evening`), la partie pleine glisse vers la valeur que la nuit écrira (`pending`, D89 à l'identique) et le gris s'efface ;
 * au matin, la valeur consolidée est déjà celle-là, rien ne bouge. Une ligne d'aide dit le gris au premier affichage, jusqu'au premier soir
 * (team-lead, 2026-11-03) ; l'infobulle la garde ensuite. Tout changement de la partie pleine glisse ; en mouvement réduit, il saute (I-9).
 */
import type { I18n } from '../../i18n/i18n';
import type { Animator } from '../../ui/motion';
import type { DossierView } from '../../survival/dossier';
import dossierRaw from '../../data/ui/dossier.json';
import { parseDossier } from '../../data/schema/dossier';
import { loadUi } from '../../data/ui/load';
import { make, onLang } from './dom';
import type { Part } from './dom';
import './dossier.css';

export type PulseWeight = 'low' | 'medium' | 'strong';
export interface Dossier extends Part {
  /** `evening` : le relevé du soir est ouvert, la barre montre la nuit consolidée (`pending`) sans gris. */
  setDossier(v: DossierView, evening?: boolean): void;
  /** Séquence jouée : le segment en attente pulse dans le sens de l'effet (-1 baisse, +1 hausse ; un effet nul ne pulse pas) ; `null` l'arrête. */
  pulse(dir: -1 | 1 | null, weight?: PulseWeight): void;
}
export interface DossierDeps { readonly animator: Animator; readonly reduced: boolean }

const tokens = parseDossier(dossierRaw);
const kebab = (name: string): string => name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const cssVar = (token: string): string => `var(--c-${kebab(token)})`;
const pct = (f: number): string => `${Math.round(Math.min(1, Math.max(0, f)) * 10_000) / 100}%`;

export function mountDossier(root: HTMLElement, i18n: I18n, deps: DossierDeps): Dossier {
  const doc = root.ownerDocument;
  const t = tokens;
  const el = make(doc, 'div', { 'data-ui': 'dossier', class: 'c-dossier' });
  const s = el.style;
  s.setProperty('--dossier-track', cssVar(t.track.v)); s.setProperty('--dossier-border', cssVar(t.border.v));
  s.setProperty('--dossier-ghost', cssVar(t.ghost.v)); s.setProperty('--dossier-ghost-opacity', String(t.ghostOpacity.v));
  s.setProperty('--dossier-gap-color', cssVar(t.segmentGap.v)); s.setProperty('--dossier-mark', cssVar(t.mark.v));
  s.setProperty('--dossier-pulse', cssVar(t.pulse.v)); s.setProperty('--dossier-pulse-ms', `${t.pulseMs.v}ms`);
  if (deps.reduced) el.dataset['reduced'] = 'true';
  s.setProperty('--dossier-track-h', `${t.trackHeightPx.v}px`); s.setProperty('--dossier-mark-w', `${t.markWidthPx.v}px`); s.setProperty('--dossier-gap', `${t.gapPx.v}px`);
  const name = make(doc, 'span', { 'data-ui': 'dossier-name', class: 'c-dossier__name', 'aria-hidden': 'true' });
  const track = make(doc, 'span', { 'data-ui': 'dossier-track', class: 'c-dossier__track', 'aria-hidden': 'true' });
  const fill = make(doc, 'span', { 'data-ui': 'dossier-fill', class: 'c-dossier__fill' });
  const ghost = make(doc, 'span', { 'data-ui': 'dossier-ghost', class: 'c-dossier__ghost' });
  const mark = make(doc, 'span', { 'data-ui': 'dossier-mark', class: 'c-dossier__mark' });
  const pulseEl = make(doc, 'span', { 'data-ui': 'dossier-pulse', class: 'c-dossier__pulse', 'aria-hidden': 'true' });
  track.append(fill, ghost, pulseEl, mark);
  const auditionRow = make(doc, 'span', { 'data-ui': 'dossier-audition-row', class: 'c-dossier__audition-row', 'aria-hidden': 'true' });
  const audition = auditionRow.appendChild(make(doc, 'span', { 'data-ui': 'dossier-audition', class: 'c-dossier__audition' }));
  const announce = make(doc, 'span', { 'data-ui': 'dossier-announce', class: 'c-visually-hidden' });
  let hint: HTMLElement | null = make(doc, 'span', { 'data-ui': 'dossier-hint', class: 'c-dossier__hint' });
  el.append(name, track, auditionRow, hint, announce);
  root.append(el);

  let palier: DossierView['palier'] | null = null;
  let shownFill: number | null = null;
  let run = 0;
  let disposed = false;
  let lastView: DossierView | null = null;
  let pulsing: -1 | 1 | null = null;
  let pulseEnding = false;
  let pulseWeight: PulseWeight = 'medium';

  const writeText = (): void => {
    name.textContent = i18n.t('street.ui.dossier.name');
    audition.textContent = i18n.t('street.ui.dossier.audition');
    el.title = i18n.t('street.ui.dossier.hint');
    if (hint !== null) hint.textContent = i18n.t('street.ui.dossier.hint');
    announce.textContent = palier === null ? '' : `${i18n.t('street.ui.dossier.name')} : ${i18n.t(`w10.msg.${palier}`)}`;
  };
  const drawGhost = (v: DossierView | null): void => {
    ghost.replaceChildren(...(v?.segments ?? []).map((g) => {
      const seg = make(doc, 'span', { 'data-ui': 'dossier-segment', 'data-source': g.source, 'data-dir': g.to < g.from ? 'down' : 'up' });
      seg.style.left = pct(Math.min(g.from, g.to)); seg.style.width = pct(Math.abs(g.to - g.from));
      return seg;
    }));
  };
  const drawFill = (f: number, p: DossierView['palier']): void => {
    fill.style.width = pct(f);
    fill.style.background = cssVar(t.palierColor[p].v);
    fill.dataset['palier'] = p; el.dataset['palier'] = p; palier = p;
    shownFill = f;
  };
  const place = (v: DossierView): void => { el.style.setProperty('--dossier-audition-at', pct(v.auditionAt)); };
  /** Pose le battement au bord du segment en attente (`pendingFill`, ou la partie pleine quand le relevé du soir l'a rattrapée), côté de l'effet. */
  const placePulse = (): void => {
    if (pulsing === null || lastView === null) { el.removeAttribute('data-pulse'); return; }
    const w = t.pulseWidth[pulseWeight].v, edge = lastView.pendingFill;
    const from = pulsing > 0 ? edge : edge - w;
    const at = Math.min(Math.max(from, 0), 1 - w);
    pulseEl.style.left = pct(at); pulseEl.style.width = pct(w);
    el.dataset['pulse'] = pulsing > 0 ? 'up' : 'down';
  };
  writeText();
  const off = onLang(i18n, writeText);

  async function settle(from: number, to: number, ghostAfter: DossierView | null, mine: number): Promise<void> {
    drawGhost(null);                                         // le gris part d'abord : la partie pleine le rattrape
    const easing = loadUi().timing.easings[t.settleEasing.v].v;
    fill.dataset['settling'] = 'true';
    await deps.animator.play(fill, { keyframes: [{ width: pct(from) }, { width: pct(to) }], options: { duration: t.settleMs.v, easing, fill: 'none' } });
    if (disposed || mine !== run) return;
    delete fill.dataset['settling'];
    drawGhost(ghostAfter);
  }

  return {
    setDossier(v, evening = false) {
      const before = shownFill;
      lastView = v; placePulse();
      place(v);
      const mine = ++run;
      const target = evening ? v.pendingFill : v.fill;
      const ghostAfter = evening ? null : v;
      drawFill(target, evening ? v.pendingPalier : v.palier); writeText();
      el.toggleAttribute('data-evening', evening);
      if (evening && hint !== null) { hint.remove(); hint = null; }   // le premier soir a montré ce que le gris devient : la ligne s'en va
      if (before !== null && before !== target && !deps.reduced) { void settle(before, target, ghostAfter, mine); return; }
      drawGhost(ghostAfter);
    },
    pulse(dir, weight = 'medium') {
      pulseEnding = false;
      if (dir !== null) {
        const again = pulsing !== null;
        pulsing = dir; pulseWeight = weight; el.dataset['pulseWeight'] = weight; placePulse();
        if (again) { pulseEl.style.animation = 'none'; void pulseEl.offsetWidth; pulseEl.style.animation = ''; }   // un second battement : l'animation repart
        return;
      }
      // fin de séquence : le battement en cours va jusqu'au bout (il se pose alors sur le segment que l'acte vient d'ajouter), puis s'arrête
      if (pulsing === null) return;
      if (deps.reduced || el.dataset['pulse'] === undefined) { pulsing = null; placePulse(); return; }
      pulseEnding = true;
      const stop = (): void => { pulseEl.removeEventListener('animationiteration', stop); if (pulseEnding) { pulseEnding = false; pulsing = null; placePulse(); } };
      pulseEl.addEventListener('animationiteration', stop);
    },
    dispose() { disposed = true; off(); el.remove(); },
  };
}
