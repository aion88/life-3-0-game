/**
 * Zones d'écran de la rue [design/ui/2026-11-02-zones-ecran-ux.md] : un budget commun au lieu d'une ancre par élément.
 * Le cadre utile U est l'hôte moins les deux bandes 2,39:1 ; son mode (large, moyen, petit) se lit sur sa largeur.
 * Bandeau haut (date, bracelet), Z-gauche (narration, fiche ou carnet, rappel des commandes), Z-centre (ligne de droit), Z-droite (options).
 * Les calculs sont purs (`zoneLayout`, `zonePolicy`) ; `mountZones` mesure le DOM, pose les variables `--z-*` et les états `data-zone-*`.
 * Aucune valeur en dur : tout vient de `data/ui/zones.json` (provenance par jeton) et du thème.
 */
import zonesRaw from '../../data/ui/zones.json';
import { parseZones } from '../../data/schema/zones';
import type { ZoneTokens } from '../../data/schema/zones';
import type { Theme } from '../../data/ui/load';
import { loadUi } from '../../data/ui/load';
import { make } from './dom';
import type { Part } from './dom';
import './zones.css';

export type ZoneMode = 'large' | 'medium' | 'small';
export interface ZoneRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface ZoneInput {
  /** Largeur et hauteur de l'hôte (px). */
  readonly w: number; readonly h: number;
  /** Hauteur de chaque bande noire (px), 0 hors observation. */
  readonly bandPx: number;
  /** Taille d'un rem (px). */
  readonly remPx: number;
  /** Hauteur du bandeau haut : le plus haut de la date et du bracelet, mesurés. */
  readonly topPx: number;
  /** Largeur de Z-droite en mode large : l'option désignée et son liseré. */
  readonly rightLargePx: number;
  /** Le panneau d'options est passé à gauche (la personne parlée coupe la droite) : Z-gauche passe à droite [§2, I-3]. */
  readonly mirrored: boolean;
}
export interface ZoneLayout { readonly mode: ZoneMode; readonly m: number; readonly top: ZoneRect; readonly left: ZoneRect; readonly centre: ZoneRect; readonly right: ZoneRect }
export interface ZoneState {
  readonly cardOpen: boolean; readonly bubbleOpen: boolean; readonly groups: number;
  /** Mode de la dernière mise en page ; `null` tant qu'aucune n'a eu lieu (DOM d'essai sans moteur de rendu). */
  readonly mode: ZoneMode | null;
}
export interface ZonePolicy {
  /** `full` : entière (elle défile en lignes entières si seule elle dépasse) ; `wait` : attend (réplique ouverte, fiche en petit, ou fiche à côté de laquelle elle ne tient pas) [§7.2]. */
  readonly narration: 'full' | 'wait';
  /** Rappel des commandes affiché. */
  readonly help: boolean;
  /** Carnet réduit à sa ligne « Droits (N) ». */
  readonly carnetFolded: boolean;
}

/** Le plus petit rectangle qui couvre deux zones (Z-gauche et Z-centre sont côte à côte, dans un sens ou dans l'autre). */
export function zoneUnion(a: ZoneRect, b: ZoneRect): ZoneRect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/**
 * Hauteur visible qui s'arrête sous une ligne entière : la plus basse des fins de ligne (`bottoms`, depuis le haut du contenu) qui tient,
 * avec `gap` de remplissage dessous, dans `visible`. `null` : tout tient déjà, ou pas même une ligne [revue T9 4, I-1 et I-2 : aucune ligne tranchée].
 */
export function wholeLinesHeight(bottoms: readonly number[], visible: number, gap: number, minLines = 1, gaps?: readonly number[]): number | null {
  // `gaps` : le remplissage propre à chaque ligne (celui de la moitié qui la porte, nul pour une ligne du milieu d'un texte) ; sans lui, `gap` vaut pour toutes
  const end = bottoms.map((b, i) => b + (gaps?.[i] ?? gap));
  if (end.length === 0 || Math.max(...end) <= visible + 0.5) return null;
  const fit = end.filter((e) => e <= visible + 0.5);
  return fit.length < minLines ? null : Math.max(...fit);
}

/** La ligne de droit attend : une réplique est ouverte (Z-3), ou une fiche en mode petit (Z-10, §7.1). Une seule formule, lue sans mise en page. */
export const rightLineWaits = (s: ZoneState): boolean => s.bubbleOpen || (s.mode === 'small' && s.cardOpen);

/**
 * Plafonne un élément qui défile à des lignes entières. `uniform` : un seul corps de texte, les fins de ligne sont des multiples de l'interligne
 * (exact même sous la rotation de la fiche) ; `items` : des éléments entiers (les droits du carnet) ; `lines` : mesurées sur le texte
 * (la ligne de droit et ses deux moitiés).
 */
function snapWholeLines(el: HTMLElement, by: 'uniform' | 'items' | 'lines'): boolean {
  el.style.maxHeight = '';
  if (el.scrollHeight <= el.clientHeight + 0.5) return true;
  const win = el.ownerDocument.defaultView; if (win === null) return true;
  const top = el.getBoundingClientRect().top + el.clientTop - el.scrollTop;
  const bottoms: number[] = []; const gaps: number[] = []; const own = parseFloat(win.getComputedStyle(el).paddingBottom) || 0; let gap = own;
  const lh = parseFloat(win.getComputedStyle(el).lineHeight);
  if (by === 'items') {
    for (const c of el.children) if (!(c as HTMLElement).hidden) bottoms.push(c.getBoundingClientRect().bottom - top);
  } else if (by === 'uniform' && Number.isFinite(lh) && lh > 0) {   // interligne `normal` : mesuré sur le texte, plus bas
    const pt = parseFloat(win.getComputedStyle(el).paddingTop) || 0;
    for (let b = pt + lh; b <= el.scrollHeight - gap + 0.5; b += lh) bottoms.push(b);
  } else {
    const walk = el.ownerDocument.createTreeWalker(el, 4);   // nœuds texte
    for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
      const range = el.ownerDocument.createRange(); range.selectNodeContents(n);
      const parent = n.parentElement;
      // la moitié porte son remplissage : il ne vaut que sous SA dernière ligne (une ligne de la moitié basse, sans remplissage, ne le réclame pas : sinon la fenêtre déborde d'une ligne tranchée)
      const pad = own === 0 && parent !== null && parent !== el && n === parent.lastChild ? parseFloat(win.getComputedStyle(parent).paddingBottom) || 0 : own;
      const rects = [...range.getClientRects()];
      rects.forEach((r, i) => { bottoms.push(r.bottom - top); gaps.push(i === rects.length - 1 ? pad : own); });
      if (gap === 0) gap = pad;
    }
  }
  const snap = wholeLinesHeight(bottoms, el.clientHeight, gap, by === 'items' ? 1 : 2, by === 'lines' ? gaps : undefined);
  if (snap === null && by === 'items') return snapWholeLines(el, 'lines');   // pas même un droit entier : au moins des lignes entières
  if (snap === null) return false;                                           // pas même deux lignes : l'élément doit céder [§7.1.2]
  el.style.maxHeight = `${Math.ceil(parseFloat(win.getComputedStyle(el).height) - (el.clientHeight - snap))}px`;
  return true;
}

/** Une fenêtre qui ne montre pas tout est focalisable et son cadre porte `data-more` (l'indicateur de suite), retiré au bas du défilement [§7.1.4, Z-13]. */
function markMore(w: HTMLElement): void {
  const scrolls = w.scrollHeight > w.clientHeight + 0.5;
  if (scrolls) w.tabIndex = 0; else w.removeAttribute('tabindex');
  w.parentElement?.toggleAttribute('data-more', scrolls && w.scrollTop + w.clientHeight < w.scrollHeight - 1);
}

let tokens: ZoneTokens | null = null;
/** Les jetons des zones, validés une fois. */
export function loadZones(): ZoneTokens { tokens ??= parseZones(zonesRaw); return tokens; }

/** Largeur de Z-droite en mode large : l'option désignée plus son liseré de part et d'autre (deux fois) [§2]. */
export const rightLargePx = (street: Theme['street']): number => street.optionDesignatedWidthPx.v + 4 * street.designatedRimPx.v;

/** Mode d'après la largeur de U [§1]. */
export function zoneMode(uWidth: number, t: ZoneTokens): ZoneMode {
  return uWidth >= t.largeMinPx.v ? 'large' : uWidth >= t.mediumMinPx.v ? 'medium' : 'small';
}

/**
 * Colonnes réservées [§2]. Chaque bord de U est à `m`, et deux colonnes voisines sont séparées de `m` :
 * le centre vaut donc U − gauche − droite − 4 m (l'UX écrit 3 m ; la quatrième marge est celle du bord droit du panneau, déjà posée).
 */
export function zoneLayout(i: ZoneInput, t: ZoneTokens): ZoneLayout {
  const m = t.marginRem.v * i.remPx;
  const uY = i.bandPx, uH = i.h - 2 * i.bandPx, uW = i.w;
  const mode = zoneMode(uW, t);
  const leftW = mode === 'large' ? t.leftLargeRem.v * i.remPx : mode === 'medium' ? t.leftMediumShare.v * uW : t.leftSmallRem.v * i.remPx;
  const rightW = mode === 'large' ? i.rightLargePx : Math.min(i.rightLargePx, (mode === 'medium' ? t.rightMediumShare.v : t.rightSmallShare.v) * uW);
  const top: ZoneRect = { x: m, y: uY + m, w: uW - 2 * m, h: i.topPx };
  const bodyY = top.y + top.h + m;
  const bodyH = Math.max(0, uY + uH - m - bodyY);
  const leftX = i.mirrored ? uW - m - leftW : m;
  const rightX = i.mirrored ? m : uW - m - rightW;
  const centreX = (i.mirrored ? rightX + rightW : leftX + leftW) + m;
  const centreW = Math.max(0, uW - leftW - rightW - 4 * m);
  return { mode, m, top, left: { x: leftX, y: bodyY, w: leftW, h: bodyH }, centre: { x: centreX, y: bodyY, w: centreW, h: bodyH }, right: { x: rightX, y: bodyY, w: rightW, h: bodyH } };
}

/** Priorités et replis [§3] : l'élément le plus bas se réduit d'abord, puis se replie, puis attend. */
export function zonePolicy(mode: ZoneMode, s: ZoneState, t: ZoneTokens): ZonePolicy {
  const narration = s.bubbleOpen || (mode === 'small' && s.cardOpen) ? 'wait' : 'full';
  const help = mode === 'large' || (mode === 'medium' && !s.cardOpen && !s.bubbleOpen && s.groups <= t.mediumHelpMaxGroups.v);
  return { narration, help, carnetFolded: s.cardOpen || mode === 'small' };   // le reste cède à la mesure, dans `mountZones`
}

export interface Zones extends Part {
  /** Colonne de gauche : narration, fiche ou carnet, rappel des commandes (dans cet ordre). */
  readonly left: HTMLElement;
  /** Colonne du centre : la ligne de droit. */
  readonly centre: HTMLElement;
  /** Appelé après chaque mise en page, avec la politique du moment (le carnet s'y range). */
  onArrange(cb: (p: ZonePolicy, mode: ZoneMode, layout: ZoneLayout) => void): void;
  /** Appelé à chaque changement du DOM, mise en page ou non : qui est ouvert (fiche, réplique) et combien de groupes de choix. */
  onState(cb: (s: ZoneState) => void): void;
  /** Recalcule tout de suite (sinon : à la prochaine micro-tâche après un changement du DOM ou de taille). */
  arrange(): void;
}

/** Monte les colonnes sous `root` et suit le DOM, la taille et les bandes. Sans mise en page (largeur nulle), rien n'est posé. */
export function mountZones(root: HTMLElement): Zones {
  const doc = root.ownerDocument; const win = doc.defaultView;
  const t = loadZones(); const { street } = loadUi().theme; const right = rightLargePx(street); const cardTurn = street.cardRotationDeg.v;
  const left = root.appendChild(make(doc, 'div', { 'data-zone': 'left' }));
  const centre = root.appendChild(make(doc, 'div', { 'data-zone': 'centre' }));
  const subs: ((p: ZonePolicy, mode: ZoneMode, layout: ZoneLayout) => void)[] = [];
  const stateSubs: ((s: ZoneState) => void)[] = [];
  const px = (n: number): string => `${Math.round(n * 100) / 100}px`;
  const height = (sel: string): number => root.querySelector(sel)?.getBoundingClientRect().height ?? 0;
  let queued = false;
  /** Les fenêtres de texte qui défilent : texte de la fiche, narration, ligne de droit, carnet déplié. */
  const windows = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[data-zone] > [data-ui="card"] > p, [data-zone] > [data-ui] > .c-window, [data-zone] > [data-ui="carnet"] > ul')];
  /** La narration ne montre pas tout (sa fenêtre défile). */
  const narrationSqueezed = (): boolean => { const w = left.querySelector(':scope > [data-ui="narration"] > .c-window'); return w !== null && w.scrollHeight > w.clientHeight + 0.5; };
  /** La fiche ouverte ne montre pas tout son texte (son paragraphe défile). */
  const cardSqueezed = (): boolean => { const p = left.querySelector(':scope > [data-ui="card"] > p'); return p !== null && p.scrollHeight > p.clientHeight + 0.5; };
  /** Le carnet déplié en lignes entières en cache (« + N ») ou n'a plus la place de s'afficher. */
  const carnetReduced = (): boolean => {
    const c = left.querySelector<HTMLElement>(':scope > [data-ui="carnet"]');
    return c !== null && c.dataset['state'] === 'full' && (c.dataset['room'] === 'none' || c.querySelector<HTMLElement>('[data-ui="carnet-more"]')?.hidden === false);
  };

  const arrange = (): void => {
    queued = false;
    const panel = root.querySelector<HTMLElement>(':scope > [data-ui="choices"]');
    const w = root.clientWidth, h = root.clientHeight;
    const state: ZoneState = {
      cardOpen: left.querySelector(':scope > [data-ui="card"]') !== null,
      bubbleOpen: root.querySelector(':scope > [data-ui="bubble"]') !== null,
      groups: panel?.querySelectorAll('[data-choice]').length ?? 0,
      mode: w > 0 && h > 0 ? zoneMode(w, t) : null,                        // U a la largeur de l'hôte (les bandes ne coupent qu'en hauteur)
    };
    for (const cb of stateSubs) cb(state);                                 // l'ordre des lectures (réplique puis ligne de droit) ne dépend pas de la mise en page
    if (w === 0 || h === 0) { mo?.takeRecords(); return; }                 // pas de mise en page (DOM d'essai sans moteur de rendu)
    const remPx = parseFloat(win?.getComputedStyle(doc.documentElement).fontSize ?? '') || parseFloat(win?.getComputedStyle(root).fontSize ?? '');
    const bandPx = parseFloat(root.style.getPropertyValue('--s-letterbox-band-px')) || 0;
    for (const sel of [':scope > [data-ui="bracelet"]', ':scope > [data-ui="dossier"]', ':scope > [data-ui="day-date"]']) { const e = root.querySelector(sel); if (e !== null) ro?.observe(e); }
    // la barre « Dossier » est collée sous le bracelet, même largeur : le bandeau haut les porte tous deux [GDD 2026-11-03 §2 A, décision Cynthia, playtest 2026-11-03]
    const bracelet = root.querySelector<HTMLElement>(':scope > [data-ui="bracelet"]')?.getBoundingClientRect() ?? null;
    const dossier = root.querySelector<HTMLElement>(':scope > [data-ui="dossier"]');
    const s = root.style;
    if (bracelet !== null) { s.setProperty('--z-bracelet-h', px(bracelet.height)); s.setProperty('--z-bracelet-w', px(bracelet.width)); }
    // en moyen et petit, la barre passe à gauche du bracelet, sur la même rangée : le bandeau haut garde sa hauteur, donc Z-gauche, Z-centre
    // et le panneau gardent leur budget (AR-13, Z-1, Z-4) [team-lead 2026-11-03]
    const beside = state.mode !== null && state.mode !== 'large';
    const dossierPx = dossier === null ? 0 : dossier.getBoundingClientRect().height + (beside ? 0 : parseFloat(win?.getComputedStyle(dossier).marginTop ?? '') || 0);
    const topPx = beside ? Math.max(height(':scope > [data-ui="bracelet"]'), dossierPx) : height(':scope > [data-ui="bracelet"]') + dossierPx;
    const L = zoneLayout({ w, h, bandPx, remPx, topPx: Math.max(topPx, height(':scope > [data-ui="day-date"]')), rightLargePx: right, mirrored: panel?.dataset['side'] === 'left' }, t);
    s.setProperty('--z-m', px(L.m)); s.setProperty('--z-top-y', px(L.top.y)); s.setProperty('--z-top-h', px(L.top.h));
    s.setProperty('--z-body-y', px(L.left.y)); s.setProperty('--z-body-h', px(L.left.h)); s.setProperty('--z-body-bottom', px(h - L.left.y - L.left.h));
    s.setProperty('--z-left-x', px(L.left.x)); s.setProperty('--z-left-w', px(L.left.w));
    s.setProperty('--z-right-x', px(L.right.x)); s.setProperty('--z-right-w', px(L.right.w));
    s.setProperty('--z-centre-x', px(L.centre.x)); s.setProperty('--z-centre-w', px(L.centre.w));
    s.setProperty('--z-centre-cap', px(t.centreCapRem.v * remPx)); s.setProperty('--z-card-cap', px(t.cardCapRem.v * remPx));
    const card = left.querySelector<HTMLElement>(':scope > [data-ui="card"]');
    if (card !== null) {                                                   // la fiche est tournée : sa boîte écran déborde de (h·sin θ + w·(1 − cos θ)) / 2 de chaque côté
      const th = Math.abs(cardTurn) * Math.PI / 180, cw = card.offsetWidth, ch = card.offsetHeight;
      s.setProperty('--z-card-inset', px(Math.ceil((ch * Math.sin(th) + cw * (1 - Math.cos(th))) / 2)));
    }
    // §3 et §7.2 : quand la colonne de gauche manque de place, le plus bas cède d'abord — le rappel (9), puis le carnet (8, il se replie
    // en « Droits (N) », puis disparaît, `carnet.ts`), puis la narration (6) attend si une fiche (4) est ouverte ; seule, elle défile en lignes entières
    for (const e of windows()) e.style.maxHeight = '';                    // mesurer à la taille que donne la colonne, pas au plafond d'avant
    left.querySelector(':scope > [data-zone-cede]')?.removeAttribute('data-zone-cede');
    left.querySelector(':scope > [data-zone-shrink]')?.removeAttribute('data-zone-shrink');
    let p = zonePolicy(L.mode, state, t);
    const apply = (): void => {
      root.dataset['zoneMode'] = L.mode; root.dataset['zoneNarration'] = p.narration; root.dataset['zoneHelp'] = p.help ? 'on' : 'off';
      for (const cb of subs) cb(p, L.mode, L);
    };
    apply();
    if (p.help && (carnetReduced() || cardSqueezed() || narrationSqueezed())) { p = { ...p, help: false }; apply(); }
    // §7.2.1 : en moyen, la narration entière passe avant le carnet, qui se replie en « Droits (N) » dès qu'il ne montre plus tout
    const narrationShown = p.narration === 'full' && left.querySelector(':scope > [data-ui="narration"] > .c-window')?.textContent?.trim();
    if (!p.carnetFolded && (cardSqueezed() || narrationSqueezed() || (L.mode === 'medium' && narrationShown && carnetReduced()))) { p = { ...p, carnetFolded: true }; apply(); }
    if (p.narration !== 'wait' && state.cardOpen && (cardSqueezed() || narrationSqueezed())) { p = { ...p, narration: 'wait' }; apply(); }
    // la réplique (priorité 3) passe avant fiche, narration, carnet et commandes (4, 6, 8, 9) : ce qu'elle couvre en Z-gauche s'efface [zones UX §2, §3]
    const said = root.querySelector(':scope > [data-ui="bubble"]')?.getBoundingClientRect() ?? null;
    for (const c of left.children) {
      const r = c.getBoundingClientRect();
      c.toggleAttribute('data-zone-yield', said !== null && r.x < said.x + said.width && said.x < r.x + r.width && r.y < said.y + said.height && said.y < r.y + r.height);
    }
    // ce qui défile s'arrête sous une ligne entière, au moins deux [§7.1.2] : ligne de droit, texte de la fiche, narration, carnet déplié
    const rl = centre.querySelector<HTMLElement>(':scope > [data-ui="right-line"] > .c-window'); if (rl !== null) snapWholeLines(rl, 'lines');
    const told = card?.querySelector<HTMLElement>(':scope > p') ?? null; if (told !== null) snapWholeLines(told, 'uniform');
    const book = left.querySelector<HTMLElement>(':scope > [data-ui="carnet"][data-state="open"] > ul'); if (book !== null) snapWholeLines(book, 'items');
    const said6 = p.narration === 'full' ? left.querySelector<HTMLElement>(':scope > [data-ui="narration"] > .c-window') : null;
    // pas deux lignes : le carnet replié (priorité 8) disparaît avant que la narration (6) n'attende [§3] ; sinon la narration attend
    const folded = left.querySelector<HTMLElement>(':scope > [data-ui="carnet"]:not([data-state="open"])');
    if (said6 !== null && !snapWholeLines(said6, 'uniform') && folded !== null) { folded.setAttribute('data-zone-cede', ''); said6.style.maxHeight = ''; }
    // en dernier recours, la ligne d'objectif cède à son tour, en lignes entières, jamais sous deux lignes : la ligne d'arrivée du narrateur dit
    // où l'on est (playtest 2026-11-03) et passe avant l'objectif entier (retour T14), qui n'est rogné que si la narration n'aurait plus deux lignes
    const goalCard = left.querySelector<HTMLElement>(':scope > [data-ui="objective"]');
    if (said6 !== null && !snapWholeLines(said6, 'uniform') && goalCard !== null) { goalCard.setAttribute('data-zone-shrink', ''); said6.style.maxHeight = ''; }
    if (said6 !== null && !snapWholeLines(said6, 'uniform')) { folded?.removeAttribute('data-zone-cede'); goalCard?.removeAttribute('data-zone-shrink'); p = { ...p, narration: 'wait' }; apply(); }
    const goal = left.querySelector<HTMLElement>(':scope > [data-ui="objective"] > .c-window'); if (goal !== null) snapWholeLines(goal, 'uniform');   // ligne d'objectif : lignes entières, défile si le cadre utile est court [playtest 2026-11-03 §1 A]
    for (const e of windows()) markMore(e);
    mo?.takeRecords();                                                     // nos propres écritures ne relancent pas la mise en page
  };
  const schedule = (): void => { if (queued) return; queued = true; queueMicrotask(arrange); };
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null;
  mo?.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'data-side', 'data-state'] });   // data-state : le carnet s'ouvre et défile
  // la mise en page change aussi sans mutation du DOM : taille de l'hôte, des colonnes, du bracelet (police chargée, Œil), polices web
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  for (const e of [root, left, centre]) ro?.observe(e);
  doc.fonts?.addEventListener('loadingdone', schedule);
  const onScroll = (e: Event): void => { const w = e.target; if (w instanceof HTMLElement && windows().includes(w)) markMore(w); };   // l'indicateur suit le défilement
  root.addEventListener('scroll', onScroll, true);
  return {
    left, centre,
    onArrange(cb) { subs.push(cb); },
    onState(cb) { stateSubs.push(cb); },
    arrange,
    dispose() { mo?.disconnect(); ro?.disconnect(); doc.fonts?.removeEventListener('loadingdone', schedule); root.removeEventListener('scroll', onScroll, true); left.remove(); centre.remove(); },
  };
}
