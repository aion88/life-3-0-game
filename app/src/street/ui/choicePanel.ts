/**
 * Panneau de choix : deux gestes (désigner, confirmer), prix dit entre les deux, refus au même rang [GDD 05 §3.4].
 * Le panneau prend le focus à l'ouverture et le rend à la fermeture. Échap le ferme, sauf si un choix ouvert a `blocksExit`.
 * Aucun texte n'est écrit ici : libellés, prix et refus viennent de clés.
 */
import type { I18n } from '../../i18n/i18n';
import type { PriceLine, Rejected } from '../../engine/moments';
import { loadUi } from '../../data/ui/load';
import type { MotionId } from '../../data/schema/ui';
import { designateParams, motionFor } from '../../ui/motion';
import type { Animator, MotionParams } from '../../ui/motion';
import type { UiEvents } from '../../ui/events';
import { createActionButton } from '../../ui/components/c';
import { make, onLang } from './dom';
import type { Part } from './dom';

/** `words` : le prix en mots de l'option, lu des données ; il alimente la pièce de prix (jamais le libellé). */
export interface ChoiceOptionView { readonly id: string; readonly labelKey: string; readonly isRefusal: boolean; readonly words: number }
/**
 * Un choix ouvert. `blocksExit` vient de la donnée du choix (la porte du J2) : tant qu'il est vrai, Échap ne ferme pas le panneau.
 * `destination: true` : options-lieux, numérotées 1 à 3 (touches 1, 2, 3), coût en mots dit sur chaque option avant tout geste, aucune pièce de prix [rue guidée T10].
 * `priced: false` (jalon, sommeil) : option unique sans prix à afficher, donc sans pièce ; absent = prix affiché sauf choix listé dans le thème.
 */
export interface ChoiceView { readonly id: string; readonly labelKey: string; readonly blocksExit: boolean; readonly priced?: boolean; readonly destination?: boolean; readonly options: readonly ChoiceOptionView[] }
/** Ce que le panneau tient du montage : bus d'événements, animateur, mouvement réduit, flèches (défaut : le thème). */
export interface ChoicePanelDeps { readonly events: UiEvents; readonly animator: Animator; readonly reduced: boolean; readonly arrowKeys?: boolean }
export interface GestureEvent { readonly choiceId: string; readonly optionId: string | null; readonly gesture: 'designate' | 'confirm' | 'close' }

export interface ChoicePanel extends Part {
  showChoices(cs: readonly ChoiceView[]): void; showPrice(p: PriceLine): void; showRefusal(r: Rejected): void;
  /** Relâche la désignation tenue (un choix refusé par le moteur ne reste pas désigné), sans geste émis. */
  releaseChoice(): void;
  onGesture(cb: (e: GestureEvent) => void): () => void;
}

export function mountChoicePanel(root: HTMLElement, i18n: I18n, deps: ChoicePanelDeps): ChoicePanel {
  const doc = root.ownerDocument;
  const { theme, timing } = loadUi();
  const { events, animator, reduced } = deps;
  const arrowKeys = deps.arrowKeys ?? theme.street.arrowKeys.v;
  const hidePill: readonly string[] = theme.street.hidePricePillFor.v;
  const designation = designateParams(theme, 'street');
  /** Joue un mouvement sur un élément ; sans effet s'il est supprimé en mouvement réduit. Jamais bloquant. */
  const play = (el: Element, id: MotionId, params?: MotionParams): Promise<void> => {
    const spec = motionFor(id, reduced, timing, params);
    return spec === null ? Promise.resolve() : animator.play(el, spec).catch(() => undefined);
  };
  let priceEl: HTMLElement | null = null;           // le dernier rendu de la ligne de prix et du refus système
  let refusalEl: HTMLElement | null = null;
  let nameSeq = 0;
  let animateIn = false;                           // les options entrent depuis la droite à l'ouverture seulement
  let choices: readonly ChoiceView[] = [];
  let designated: { choiceId: string; optionId: string } | null = null;
  let price: PriceLine | null = null;
  let refusal: Rejected | null = null;
  let expandedId: string | null = null;            // le seul groupe déplié [spec choix simultanés §3.2]
  let listOpen = false;                            // mode petit : la liste de tous les en-têtes remplace le corps du groupe [§6.1]
  let pointerIn = false;                           // le pointeur est sur le panneau (garde I-8)
  let held = false;                                // le joueur tient le panneau au clavier (le focus posé à l'ouverture n'est pas une prise)
  let tearing = false;                             // vrai pendant le retrait du panneau par `render` : son `focusout` ne relance aucun rendu
  let pending: string | null = null;               // le choix actif arrivé pendant que le joueur tenait le panneau au clavier : déplié dès que le focus sort
  let renderedMode = '';
  const small = (): boolean => root.dataset['zoneMode'] === 'small';
  let condensed = false;                           // mesuré, hors mode petit : les en-têtes complets ne tiennent plus avec le corps minimal [spec §6.3 AR-12]
  let lostKey = '';                                // la situation où la mesure a manqué de place : le bloc de décision est retenu tant qu'elle ne change pas
  const situation = (): string => `${panel === null ? '' : getComputedStyle(panel).maxHeight}|${expandedId}|${designated?.optionId ?? ''}|${price?.textKey ?? ''}|${refusal !== null}`;
  let compact = false;                             // mesuré : la rangée seule ne suffit pas, le prix défile sous l'option collée (bloc de décision du mode petit)
  const dec = (): boolean => small() || compact;
  const cond = (): boolean => small() || condensed || compact;
  let panel: HTMLElement | null = null;
  const live = make(doc, 'div', { 'aria-live': 'polite', 'data-ui': 'choices-live', class: 'c-visually-hidden' });   // annonce l'arrivée et le départ d'un groupe [§3.6]
  root.appendChild(live);
  let opener: HTMLElement | null = null;          // l'élément qui avait le focus avant l'ouverture
  let scoped = false;                              // le panneau tient le focus (il a des choix)
  const listeners: ((e: GestureEvent) => void)[] = [];
  const emit = (e: GestureEvent): void => { for (const cb of [...listeners]) cb(e); };

  const refusalText = (r: Rejected): string => {
    const k = `street.ui.refusal.${r.reason}`;
    return i18n.t(i18n.has(k) ? k : 'street.ui.refusal.generic');
  };

  /**
   * Après une désignation : mode petit, le haut du bloc de décision (option puis prix) s'aligne sur le haut de la zone qui défile [spec §6.1 point 4] ;
   * sinon (moyen, large), l'option et son pied sont ramenés dans la zone, Confirmer d'abord : le geste ne sort jamais de la zone.
   */
  const reveal = (designatedEl: Element): void => {
    const g = designatedEl.closest<HTMLElement>('.c-street-group');
    if (g === null) return;
    const block = designatedEl.closest<HTMLElement>('[data-ui="decision"]');
    if (block !== null) { g.scrollTop += block.getBoundingClientRect().top - g.getBoundingClientRect().top; return; }
    const foot = designatedEl.nextElementSibling instanceof HTMLElement && designatedEl.nextElementSibling.matches('[data-ui="foot"]') ? designatedEl.nextElementSibling : null;
    const over = (foot ?? designatedEl).getBoundingClientRect().bottom - g.getBoundingClientRect().bottom;
    if (over > 0) g.scrollTop += over;
    const under = g.getBoundingClientRect().top - designatedEl.getBoundingClientRect().top;
    const slack = g.getBoundingClientRect().bottom - (foot ?? designatedEl).getBoundingClientRect().bottom;
    if (under > 0 && under <= slack) g.scrollTop -= under;                   // l'option désignée remonte seulement si Confirmer reste visible
  };

  /** Bloc de décision : fondu de 24 px au bas de la zone qui défile, seulement s'il reste du contenu dessous [constat 41, art-director]. */
  const fade = (g: HTMLElement): void => { g.toggleAttribute('data-more', dec() && g.scrollTop + g.clientHeight < g.scrollHeight - 0.5); };
  /** Moyen et large : la zone qui défile s'arrête sous un élément entier (option, ligne de prix, Confirmer), jamais au milieu [zones UX 7.1]. */
  const snapGroup = (g: HTMLElement): boolean => {   // vrai : la place ne tient pas l'option désignée avec son pied (la fenêtre ne garderait que le pied)
    const at = g.scrollTop;
    g.style.maxHeight = '';
    if (g.offsetHeight === 0 || g.scrollHeight <= g.clientHeight + 0.5) return false;
    const gr = g.getBoundingClientRect();
    // bords non tournés d'une ligne, dans le repère du contenu du groupe (la rotation de l'option désignée est décorative)
    const edge = (k: HTMLElement): { top: number; bottom: number } => { const r = k.getBoundingClientRect(); const mid = r.top + r.height / 2 - gr.top + g.scrollTop; return { top: mid - k.offsetHeight / 2, bottom: mid + k.offsetHeight / 2 }; };
    if (dec()) {
      // bloc de décision : la fenêtre s'arrête sous une ligne ENTIÈRE du prix (jamais une ligne tranchée), l'option collée restant entière [zones UX 7.1]
      const price = g.querySelector<HTMLElement>('[data-ui="price"]'); const opt = g.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (price === null || opt === null) return false;
      const cs = getComputedStyle(price); const lh = parseFloat(cs.lineHeight); const pt = parseFloat(cs.paddingTop) || 0; const pb = parseFloat(cs.paddingBottom) || 0;
      if (!(lh > 0)) return false;
      const pe = edge(price); const count = Math.max(1, Math.round((price.offsetHeight - pt - pb) / lh));
      // La fenêtre s'arrête au bas d'une ligne ENTIÈRE (jamais une ligne tranchée) ; s'il reste à lire dessous, un fondu de 24 px le dit [constat 41, art-director].
      // Aucune ligne entière ne tient (plafond descendu) : la fenêtre s'arrête sous l'option, le prix attend dessous.
      const room = g.clientHeight + g.scrollTop; const ob = edge(opt).bottom;
      const fit = Array.from({ length: count }, (_, k) => pe.top + pt + (k + 1) * lh).filter((l) => l >= ob - 0.5 && l <= room + 0.5);
      const stop = pe.bottom <= room + 0.5 ? pe.bottom : fit.length > 0 ? Math.max(...fit) : ob;
      if (stop - g.scrollTop > 0) g.style.maxHeight = `${stop - g.scrollTop}px`;
      fade(g);
      return false;
    }
    const lines: { top: number; bottom: number }[] = [];
    for (const c of g.children) {
      const kids = c instanceof HTMLElement && c.matches('[data-ui="foot"]') ? [...c.children] : [c];
      for (const k of kids) if (k instanceof HTMLElement) lines.push(edge(k));
    }
    const room = g.clientHeight;
    const foot = g.querySelector<HTMLElement>(':scope > [data-ui="foot"]');
    if (foot !== null && foot.children.length > 0) {
      // une option est désignée : la fenêtre se ferme sous Confirmer et remonte autant de lignes ENTIÈRES que la place le permet (l'option d'abord)
      const end = Math.max(...[...foot.children].map((k) => (k instanceof HTMLElement ? edge(k).bottom : 0)));
      const inside = lines.filter((l) => l.top >= end - room - 0.5 && l.bottom <= end + 0.5);
      const o = g.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (inside.length > 0) { const top = Math.min(...inside.map((l) => l.top)); g.style.maxHeight = `${end - top}px`; g.scrollTop = top; return o !== null && edge(o).top < top - 0.5; }
      return o !== null;
    }
    const fit = lines.map((l) => l.bottom).filter((b) => b <= room + 0.5);
    if (fit.length > 0) g.style.maxHeight = `${Math.max(...fit)}px`;
    g.scrollTop = at;   // lever la limite plafonnait le défilement : on le rend
    return false;
  };
  let revealWanted = false;                        // la mise en page finale (condensation, arrêt sous une ligne entière) peut déplacer la cible : on aligne de nouveau une fois posée
  const settleReveal = (): void => {
    if (!revealWanted) return;
    revealWanted = false;
    const d = panel?.querySelector('[aria-pressed="true"]'); if (d) reveal(d);
  };
  /** Cale chaque fenêtre ; si la place ne tient pas l'option désignée avec son pied, bloc de décision (le prix défile sous l'option), retenu tant que la situation ne change pas. */
  const snapAll = (): void => {
    let lost = false;
    panel?.querySelectorAll<HTMLElement>('.c-street-group:not([hidden])').forEach((g) => { if (snapGroup(g)) lost = true; });
    if (lost && !small() && !compact) { lostKey = situation(); compact = true; condensed = true; render(); }
  };

  /** Boutons atteignables du panneau, dans l'ordre du DOM : un groupe replié (`hidden`) n'en offre aucun. */
  const focusables = (): HTMLElement[] => [...(panel?.querySelectorAll<HTMLElement>('button') ?? [])].filter((b) => b.closest('[hidden]') === null);

  /** Échap referme la liste des en-têtes (mode petit) et rend le focus à « + N » ; il ne ferme pas le panneau [spec §6.1 point 5]. */
  const onPanelKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && e.defaultPrevented) return;   // une couche du dessus (fiche, carnet, réplique) a pris cet Échap
    if (e.key === 'Escape' && listOpen) { e.preventDefault(); e.stopPropagation(); listOpen = false; render(); panel?.querySelector<HTMLElement>('[data-ui="more-groups"]')?.focus(); return; }
    if (arrowKeys) onArrow(e);
  };

  /** Flèches haut et bas, Début et Fin : le focus parcourt tout le panneau (en-têtes, options du groupe déplié, Confirmer), avec butée aux extrémités [§3.4]. */
  const onArrow = (e: KeyboardEvent): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (t === null || t.tagName !== 'BUTTON') return;
    const all = focusables();
    if (all.length === 0) return;
    const at = all.indexOf(t);
    const i = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : Math.min(all.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)));
    e.preventDefault();
    all[i]?.focus();
  };

  /** Relâche la désignation tenue : même événement et même geste que le clic qui la défait. Rend ce qui a été relâché. */
  const release = (): { choiceId: string } | null => {
    if (designated === null) return null;
    const was = designated; designated = null; price = null;
    events.emit('ui.undesignate');
    return { choiceId: was.choiceId };
  };

  /**
   * Condensation à la mesure [spec §6.3 AR-12] : les en-têtes passent en une rangée dès que `H_en-têtes + H_corps_min > H_panneau_max`
   * (corps minimal : option désignée ou la plus haute, avec son pied et le refus affichés). Le retour aux en-têtes complets exige une interligne
   * de marge : pas d'oscillation. Jamais au défilement. Sans mise en page (jsdom) ou sans plafond de zone, aucun effet.
   */
  const measure = (): void => {
    if (panel === null || small() || choices.length < 2) return;
    const max = parseFloat(getComputedStyle(panel).maxHeight);
    const list = panel.querySelector<HTMLElement>('ul');
    const head = panel.querySelector<HTMLElement>('[data-ui="choice-name"]');
    if (!Number.isFinite(max) || list === null || head === null || head.offsetHeight === 0) return;
    const cs = getComputedStyle(list);
    const gap = parseFloat(cs.rowGap) || 0;
    const n = choices.length;
    const open = panel.querySelector<HTMLElement>(`[data-choice="${CSS.escape(expandedId ?? '')}"]`);
    const opts = [...(open?.querySelectorAll<HTMLElement>('.c-street-option') ?? [])];
    const desig = opts.find((o) => o.getAttribute('aria-pressed') === 'true');
    const refusalEl2 = panel.querySelector<HTMLElement>('[data-ui="refusal"]');
    const refusalM = refusalEl2 !== null ? (parseFloat(getComputedStyle(refusalEl2).marginTop) || 0) + (parseFloat(getComputedStyle(refusalEl2).marginBottom) || 0) : 0;
    const refusalH = (refusalEl2?.offsetHeight ?? 0) + refusalM;
    const optionH = desig !== undefined ? desig.offsetHeight : Math.max(0, ...opts.map((o) => o.offsetHeight));
    // le corps minimal compte la VRAIE ligne de prix (sa hauteur à la largeur du panneau, 1 à 3 lignes selon le texte) et Confirmer, quelle que soit la disposition posée
    const priceH = open?.querySelector<HTMLElement>('[data-ui="price"]')?.offsetHeight ?? 0;
    const confirmH = open?.querySelector<HTMLElement>('[data-ui="confirm"]')?.offsetHeight ?? 0;
    const footEl = open?.querySelector<HTMLElement>('[data-ui="foot"]') ?? null;
    const footGap = footEl !== null ? parseFloat(getComputedStyle(footEl).rowGap) || 0 : 0;
    const inGroup = parseFloat(getComputedStyle(open?.querySelector('[role="group"]') ?? list).rowGap) || 0;   // espace entre l'option et son pied
    const decided = desig !== undefined;
    const body = optionH + (decided ? inGroup + priceH + (priceH > 0 ? footGap : 0) + confirmH : 0) + (refusalH > 0 ? refusalH + gap : 0);
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const inner = open !== null ? parseFloat(getComputedStyle(open).rowGap) || 0 : 0;   // espace entre l'en-tête déplié et son corps
    const h = head.offsetHeight;
    const line = parseFloat(getComputedStyle(panel).lineHeight) || h / 2;
    const needFull = n * h + (n - 1) * gap + inner + body + pad;     // tous les en-têtes et le corps minimal
    const needRow = h + inner + body + pad;                          // la rangée condensée et le corps minimal
    const wantCompact = decided && (situation() === lostKey || (compact ? needRow + line > max : needRow > max));   // même avec la rangée, la ligne de prix ne tient pas : bloc de décision, le prix défile sous l'option
    const wantCondensed = wantCompact || (condensed ? needFull + line > max : needFull > max);
    if (wantCompact !== compact || wantCondensed !== condensed) { compact = wantCompact; condensed = wantCondensed; render(); }
  };

  const render = (): void => {
    const focused = doc.activeElement instanceof HTMLElement && panel?.contains(doc.activeElement) ? doc.activeElement : null;
    const keep = focused === null ? null : { c: focused.closest('[data-choice]')?.getAttribute('data-choice'), o: focused.getAttribute('data-option'), ui: focused.getAttribute('data-ui') };
    // le défilement survit à un nouveau rendu (un refus ou une arrivée ne ramène pas la liste en haut)
    const scrolls = new Map<string, number>(); const listTop = panel?.querySelector('ul')?.scrollTop ?? 0;
    panel?.querySelectorAll<HTMLElement>('.c-street-group').forEach((g) => { const id = g.closest('[data-choice]')?.getAttribute('data-choice'); if (id) scrolls.set(id, g.scrollTop); });
    const side = panel?.dataset['side'];
    if (panel !== null) sizeWatch?.unobserve(panel);
    // Retirer un panneau qui a le focus émet `focusout` en synchrone : sans garde, `settle` relançait un rendu DANS celui-ci, le rendu imbriqué
    // retirait le panneau et ce retrait-ci levait (NotFoundError), ce qui figeait la rue [bug 2026-11-03]. Le rendu en cours fait déjà le travail.
    const old = panel; panel = null; tearing = true;
    try { old?.remove(); } finally { tearing = false; }
    refusalEl?.remove();   // en petit mode le refus vit en Z-centre, hors du panneau : on le retire aussi
    renderedMode = root.dataset['zoneMode'] ?? '';
    const ids = choices.map((c) => c.id);
    if (designated !== null && ids.includes(designated.choiceId)) expandedId = designated.choiceId;   // la désignation tient son groupe ouvert
    else if (expandedId === null || !ids.includes(expandedId)) { expandedId = ids[0] ?? null; }
    const many = choices.length > 1;
    const isDec = dec();
    const isCond = cond();
    if (!many) { listOpen = false; condensed = false; compact = false; }
    if (choices.length === 0 && refusal === null) {
      if (scoped) { scoped = false; if (opener?.isConnected) opener.focus(); opener = null; }
      return;
    }
    const opening = choices.length > 0 && !scoped;
    if (opening) { opener = doc.activeElement instanceof HTMLElement && doc.activeElement !== doc.body ? doc.activeElement : null; scoped = true; }
    if (choices.length === 0 && scoped) { scoped = false; if (opener?.isConnected) opener.focus(); opener = null; }

    const list = make(doc, 'ul');
    if (choices.some((k) => k.destination === true)) list.setAttribute('data-ui', 'destinations');   // accroche des destinations : le rendu reste celui du panneau
    panel = make(doc, 'div', { 'data-ui': 'choices' });
    if (isCond) panel.dataset['condensed'] = '';
    if (isCond && listOpen) panel.dataset['listOpen'] = '';
    if (side !== undefined) panel.dataset['side'] = side;   // posé de l'extérieur (placement miroir) : un nouveau rendu ne l'efface pas
    list.tabIndex = 0;   // la liste est la zone défilante : focusable pour défiler au clavier
    panel.appendChild(list);
    panel.addEventListener('keydown', onPanelKey);
    const entering: HTMLElement[][] = [];
    priceEl = null; refusalEl = null;
    for (const c of choices) {
      const li = make(doc, 'li', { 'data-choice': c.id });
      // P-3 : toutes les options d'un choix masqué, jamais une seule. Aucune pièce non plus si aucune option du choix ne coûte de mots (permis) : « 0 mots » dirait faux là où le prix est ailleurs [GD 2026-11-02].
      const showPill = c.destination !== true && c.priced !== false && !hidePill.includes(c.id) && c.options.some((o) => o.words > 0);
      // Un choix = un groupe nommé (aria-labelledby) ; l'en-tête est visible dès qu'il y a plusieurs choix ouverts, c'est la frontière entre deux décisions [revue T6, 12 ; spec §3.3].
      const seq = ++nameSeq;
      const nameId = `choice-name-${seq}`; const groupId = `choice-group-${seq}`;
      const open = c.id === expandedId;
      const showLi = !isCond || open || listOpen;                     // condensé : un seul en-tête, sauf la liste ouverte
      if (!showLi) li.hidden = true;
      const nameEl = make(doc, 'button', { type: 'button', id: nameId, 'data-ui': 'choice-name', class: 'c-pill c-street-choice-name' }, i18n.t(c.labelKey));
      if (many) { nameEl.setAttribute('aria-expanded', String(open)); nameEl.setAttribute('aria-controls', groupId); } else nameEl.hidden = true;
      nameEl.addEventListener('click', () => {
        if (!many || (c.id === expandedId && !listOpen)) return;
        expandedId = c.id; listOpen = false;
        const out = release();
        render();
        panel?.querySelector<HTMLElement>(`[data-choice="${CSS.escape(c.id)}"] [data-ui="choice-name"]`)?.focus();
        const g = panel?.querySelector<HTMLElement>(`[data-choice="${CSS.escape(c.id)}"] [role="group"]`);
        if (g) void play(g, 'priceReveal');
        if (out !== null) emit({ choiceId: out.choiceId, optionId: null, gesture: 'designate' });
      });
      li.appendChild(nameEl);
      if (isCond && many && open) {
        const more = make(doc, 'button', { type: 'button', 'data-ui': 'more-groups', 'aria-expanded': String(listOpen), 'aria-label': i18n.t('street.ui.choices.moreLabel', { n: choices.length - 1 }), class: 'c-pill c-street-choice-name c-street-more' }, i18n.t('street.ui.choices.more', { n: choices.length - 1 }));
        more.addEventListener('click', () => { listOpen = !listOpen; render(); panel?.querySelector<HTMLElement>('[data-ui="more-groups"]')?.focus(); });
        li.appendChild(more);
      }
      const opts = make(doc, 'div', { role: 'group', id: groupId, 'aria-labelledby': nameId, class: 'c-street-group' });
      opts.addEventListener('scroll', () => fade(opts), { passive: true });
      if (many && (!open || (isCond && listOpen))) opts.hidden = true;
      let designatedBtn: HTMLElement | null = null;
      const row: HTMLElement[] = [];
      for (const [oi, o] of c.options.entries()) {
        const on = designated?.choiceId === c.id && designated.optionId === o.id;
        const b = make(doc, 'button', { type: 'button', 'data-option': o.id, 'aria-pressed': String(on), class: 'c-option c-street-option' });
        b.appendChild(make(doc, 'span', { 'data-ui': 'option-label' }, i18n.t(o.labelKey)));
        if (c.destination === true) {
          // le coût en mots est dit sur CHAQUE option avant tout geste, zéro compris ; le nom accessible garde le lieu, le numéro est décoratif
          const cost = o.words > 0 ? i18n.tPlural('street.ui.words.price', o.words, { n: o.words }) : i18n.t('street.ui.words.none');
          b.setAttribute('aria-label', `${i18n.t('street.ui.goTo', { place: i18n.t(o.labelKey) })}, ${cost}`);
          b.prepend(make(doc, 'span', { 'data-ui': 'number', 'aria-hidden': 'true' }, String(oi + 1)));
          b.appendChild(make(doc, 'span', { 'data-ui': 'words' }, cost));
        }
        if (on) designatedBtn = b;
        if (showPill) {
          const pill = make(doc, 'span', { class: 'c-pill c-pill--soleil' }, o.words > 0 ? i18n.tPlural('street.ui.words.price', o.words, { n: o.words }) : i18n.t('street.ui.words.none'));   // zéro : « aucun mot », jamais « 0 mots »
          pill.setAttribute('data-ui', 'price-pill');
          b.appendChild(pill);
        }
        b.addEventListener('click', () => {
          const same = designated?.choiceId === c.id && designated.optionId === o.id;
          designated = same ? null : { choiceId: c.id, optionId: o.id }; price = null; render();
          const nb = panel?.querySelector<HTMLElement>(`[data-choice="${CSS.escape(c.id)}"] [data-option="${CSS.escape(o.id)}"]`);
          events.emit(same ? 'ui.undesignate' : 'ui.designate');   // le même événement et le même mouvement pour toute option, refus compris [I-4]
          if (nb) { void play(nb, same ? 'undesignate' : 'designate', designation); if (!same) { revealWanted = true; reveal(nb); } }
          emit({ choiceId: c.id, optionId: same ? null : o.id, gesture: 'designate' });
        });
        opts.appendChild(b); row.push(b);
      }
      if (open) entering.push(row);
      li.appendChild(opts);
      if (designated?.choiceId === c.id && price !== null && price.choiceId === c.id && price.optionId === designated.optionId) {
        // `textKey` vide : le writer n'a pas écrit la ligne. Aucune ligne plutôt qu'un faux prix (« Continuer ») [GD 2026-11-02] ; le validateur V3 signale la dette.
        const p = price.textKey === '' ? null : make(doc, 'p', { 'data-ui': 'price', class: 'c-card c-card--ink c-price-line' }, i18n.t(price.textKey, Object.keys(price.inventoryParams).length > 0 ? price.inventoryParams : undefined));
        priceEl = p;
        const d = designated;
        const ok = createActionButton(i18n.t('street.ui.confirm'));
        ok.setAttribute('data-ui', 'confirm');
        ok.addEventListener('click', () => {
          events.emit('ui.confirm');                           // un seul événement, pour toute option : le jus appartient au régime, après coup [I-5]
          const shadow = { shadowColor: 'var(--sh-menthe)' };
          void play(ok, 'confirmPress', shadow).then(() => play(ok, 'confirmRelease', shadow));
          emit({ choiceId: d.choiceId, optionId: d.optionId, gesture: 'confirm' });
        });
        if (isDec) {
          // mode petit : l'option et sa ligne de prix forment UN bloc (la séparation devient impossible) ; Confirmer seul reste hors de la zone qui défile [spec §6.1]
          const block = make(doc, 'div', { 'data-ui': 'decision', class: 'c-street-decisionblock' });
          if (designatedBtn !== null) { designatedBtn.before(block); block.append(designatedBtn); }
          if (p !== null) { p.id = `choice-price-${seq}`; designatedBtn?.setAttribute('aria-describedby', p.id); block.append(p); }
          const foot = make(doc, 'div', { 'data-ui': 'foot', class: 'c-street-foot' });   // le pied du mode petit ne garde que Confirmer
          foot.append(ok); li.appendChild(foot);
        } else {
          const foot = make(doc, 'div', { 'data-ui': 'foot', class: 'c-street-foot' });   // ligne de prix et Confirmer ensemble, sous l'option désignée [spec C §3.2]
          if (p !== null) foot.append(p);
          foot.append(ok);
          designatedBtn?.after(foot);   // sous l'option DÉSIGNÉE, jamais sous la dernière du choix
        }
      }
      list.appendChild(li);
    }
    if (refusal !== null) { refusalEl = make(doc, 'p', { 'data-ui': 'refusal', role: 'alert', class: 'c-refusal c-street-refusal' }, refusalText(refusal)); ((small() ? root.querySelector('[data-zone="centre"]') : null) ?? panel).appendChild(refusalEl); }   // hors de la liste qui défile : le refus ne recouvre jamais un groupe
    root.appendChild(panel);
    sizeWatch?.observe(panel);   // le plafond de zone change sans que la fenêtre change (fiche, refus, bracelet) : le panneau change de hauteur, on recale
    list.scrollTop = listTop;
    panel.querySelectorAll<HTMLElement>('.c-street-group').forEach((g) => { const id = g.closest('[data-choice]')?.getAttribute('data-choice'); if (id && scrolls.has(id)) g.scrollTop = scrolls.get(id)!; });
    if (typeof ResizeObserver === 'undefined') { snapAll(); measure(); } else queueMicrotask(() => { measure(); snapAll(); settleReveal(); });
    if (animateIn) { animateIn = false; for (const row of entering) row.forEach((b, i) => { void play(b, 'optionsIn', { index: i }); }); }

    if (choices.length === 0) return;
    const target = keep === null ? null
      : keep.ui === 'confirm' ? panel.querySelector<HTMLElement>('[data-ui="confirm"]')
      : keep.ui === 'choice-name' ? panel.querySelector<HTMLElement>(`[data-choice="${CSS.escape(keep.c ?? '')}"] [data-ui="choice-name"]`)
      : panel.querySelector<HTMLElement>(`[data-choice="${CSS.escape(keep.c ?? '')}"] [data-option="${CSS.escape(keep.o ?? '')}"]`);
    const ok = target !== null && target.closest('[hidden]') === null && !target.hidden ? target : null;
    // le focus ne saute jamais vers l'arrivant : si son option est repliée, il va à l'en-tête de SON groupe
    const home = ok ?? (keep?.c ? panel.querySelector<HTMLElement>(`[data-choice="${CSS.escape(keep.c)}"] [data-ui="choice-name"]`) : null);
    (home !== null && home.closest('[hidden]') === null && !home.hidden ? home : focusables()[0])?.focus();
  };

  /** Le pointeur ou le focus est dans le panneau : rien ne doit bouger sous eux [I-8]. */
  /** Le joueur tient le panneau au clavier : le dépli d'un arrivant attend que le focus sorte (garde I-8, clavier seulement). */
  const keyHeld = (): boolean => held && doc.activeElement instanceof HTMLElement && panel?.contains(doc.activeElement) === true;
  const settle = (): void => {
    if (pending === null || keyHeld() || choices.length === 0) return;
    const id = pending; pending = null;
    if (designated === null && choices.some((c) => c.id === id)) { expandedId = id; }
    render();
  };
  const onFocusOut = (e: FocusEvent): void => { if (!(e.relatedTarget instanceof Node && panel?.contains(e.relatedTarget) === true)) held = false; if (!tearing && pending !== null) settle(); };
  const onHold = (): void => { held = true; };
  root.addEventListener('keydown', onHold);
  const onPointer = (e: PointerEvent): void => { const was = pointerIn; pointerIn = e.target instanceof Element && e.target.closest('[data-ui="choices"]') !== null; if (was && !pointerIn) settle(); };
  root.addEventListener('focusout', onFocusOut); root.addEventListener('pointermove', onPointer);
  const modeWatch = typeof MutationObserver === 'function' ? new MutationObserver(() => { if ((root.dataset['zoneMode'] ?? '') !== renderedMode && panel !== null) render(); }) : null;
  modeWatch?.observe(root, { attributes: true, attributeFilter: ['data-zone-mode'] });
  const sizeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { measure(); snapAll(); settleReveal(); }) : null;   // la fenêtre ou le plafond de zone change : condensation et fenêtre du groupe recalées sur la place réelle
  sizeWatch?.observe(root);

  const onKey = (e: KeyboardEvent): void => {
    const dest = choices.find((c) => c.destination === true);
    if (dest !== undefined && !e.repeat && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code) ?? /^([1-9])$/.exec(e.key);
      const o = m === null ? undefined : dest.options[Number(m[1]) - 1];
      if (o !== undefined) {
        e.preventDefault();
        if (designated?.choiceId === dest.id && designated.optionId === o.id) {
          // second geste : confirmer. Un choix à prix ne confirme qu'après la ligne de prix dite [D136] ; sans prix (`priced: false`), tout de suite.
          if (dest.priced === false) { events.emit('ui.confirm'); emit({ choiceId: dest.id, optionId: o.id, gesture: 'confirm' }); }
          else panel?.querySelector<HTMLElement>(`[data-choice="${CSS.escape(dest.id)}"] [data-ui="confirm"]`)?.click();
        } else panel?.querySelector<HTMLElement>(`[data-choice="${CSS.escape(dest.id)}"] [data-option="${CSS.escape(o.id)}"]`)?.click();
        return;
      }
    }
    if (e.key !== 'Escape' || e.defaultPrevented || choices.length === 0 || choices.some((c) => c.blocksExit)) return;   // un Échap, une couche
    e.preventDefault();
    const was = designated;
    choices = []; designated = null; price = null; render();
    if (was !== null) emit({ choiceId: was.choiceId, optionId: null, gesture: 'designate' });   // le moteur lâche la désignation
    emit({ choiceId: '', optionId: null, gesture: 'close' });                                    // l'appelant oublie ce qu'il a montré
  };
  doc.addEventListener('keydown', onKey);
  const off = onLang(i18n, () => { if (panel !== null) render(); });

  return {
    showChoices(cs) {
      const prev = choices;
      choices = [...cs]; refusal = null; animateIn = prev.length === 0 && cs.length > 0;
      if (cs.length === 0) { expandedId = null; listOpen = false; pending = null; }
      // La désignation survit à l'arrivée ou au départ d'un autre groupe, sauf si son option a disparu ou changé de prix ou de nom :
      // le second geste ne confirme jamais un prix que le joueur n'a pas vu [GD 2026-11-02].
      let out: { choiceId: string } | null = null;
      if (designated !== null) {
        const d = designated;
        const now = cs.find((c) => c.id === d.choiceId)?.options.find((o) => o.id === d.optionId);
        const was = prev.find((c) => c.id === d.choiceId)?.options.find((o) => o.id === d.optionId);
        if (cs.length === 0) { designated = null; price = null; }
        else if (!now || !was || now.words !== was.words || now.labelKey !== was.labelKey) out = release();
      }
      if (prev.length > 0) {
        const arrived = cs.filter((c) => !prev.some((p) => p.id === c.id)); const left = prev.filter((p) => !cs.some((c) => c.id === p.id));
        const say = [...arrived.map((c) => i18n.t('street.ui.choices.opened', { name: i18n.t(c.labelKey) })), ...left.map((c) => i18n.t('street.ui.choices.closed', { name: i18n.t(c.labelKey) }))];
        if (say.length > 0) live.textContent = say.join(' ');
      }
      // Le choix ACTIF est déplié d'office, sans clic [retour de Cynthia, build 35ed56c : « je dois cliquer pour voir les options », refusé] :
      // le choix qui vient d'arriver (celui que la joueuse vient d'atteindre) prend le dépli, même si elle en avait déplié un autre ; seuls les choix
      // secondaires restent repliés. Une désignation tient son groupe. Au clavier dans le panneau (garde I-8), le dépli attend la sortie du focus.
      const fresh = cs.find((c) => !prev.some((p) => p.id === c.id));
      if (designated === null && prev.length > 0 && fresh !== undefined && fresh.id !== expandedId) {
        if (keyHeld()) pending = fresh.id; else { expandedId = fresh.id; listOpen = false; }
      }
      render();
      if (out !== null) emit({ choiceId: out.choiceId, optionId: null, gesture: 'designate' });
    },
    showPrice(p) {
      price = p; render();
      if (priceEl !== null) { events.emit('ui.price.reveal'); void play(priceEl, 'priceReveal'); }
      const d = panel?.querySelector('[aria-pressed="true"]'); if (d && panel?.querySelector('[data-ui="decision"], [data-ui="foot"]')) { revealWanted = true; reveal(d); }
    },
    showRefusal(r) {
      refusal = r; render();
      const d = panel?.querySelector('[aria-pressed="true"]'); if (d) { revealWanted = true; reveal(d); }   // le refus prend de la place : Confirmer reste à l'écran
      if (refusalEl !== null) { events.emit('ui.refusal.system'); void play(refusalEl, 'refusalShake'); }   // seul le refus SYSTÈME tremble [I-5]
    },
    releaseChoice() { if (release() !== null) render(); },
    onGesture(cb) { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },
    dispose() { doc.removeEventListener('keydown', onKey); root.removeEventListener('focusout', onFocusOut); root.removeEventListener('pointermove', onPointer); root.removeEventListener('keydown', onHold); modeWatch?.disconnect(); sizeWatch?.disconnect(); off(); choices = []; refusal = null; render(); live.remove(); listeners.length = 0; },
  };
}
