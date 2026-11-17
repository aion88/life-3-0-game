/**
 * Interface DOM de l'écran de la rue [plan 02a T11]. Aucun mot du monde n'est écrit ici : tout texte vient d'une clé, par `i18n.t`.
 * Les règles de pureté du moteur ne s'appliquent pas ici (DOM permis), mais ni hasard ni minuterie.
 */
import type { I18n } from '../../i18n/i18n';
import type { PriceLine, Rejected } from '../../engine/moments';
import type { EveningLine } from '../../engine/moments/evening';
import type { PalierId } from '../../data/schema/world';
import type { DayIndex } from '../../shared/types/street';
import type { RightId } from '../../shared/types/street';
import { applyTheme } from '../../ui/theme';
import { loadUi } from '../../data/ui/load';
import { reducedMotionOf, webAnimator } from '../../ui/motion';
import type { Animator } from '../../ui/motion';
import { createUiEvents } from '../../ui/events';
import type { UiEvents } from '../../ui/events';
import { make, onLang } from './dom';
import { mountNarrator } from './narrator';
import { mountBubble } from './bubble';
import type { LineOptions } from './bubble';
import { placePanel, scaledMargin } from './placement';
import type { ScreenRect } from './placement';
import type { Params } from './narrator';
import { mountBracelet } from './bracelet';
import { mountDossier } from './dossier';
import type { DossierView } from '../../survival/dossier';
import { mountChoicePanel } from './choicePanel';
import type { GestureEvent } from './choicePanel';
import { mountAdvance } from './advance';
import { mountDestinations } from './destinations';
import { mountCard } from './card';
import { mountCarnet } from './carnet';
import { mountRightLine } from './rightLine';
import { mountEvening } from './evening';
import type { EveningOpened } from './evening';
import { mountWelcome } from './welcome';
import type { WelcomeContent } from './welcome';
import { mountObjective } from './objective';
import { mountOutcome } from './outcome';
import { mountMontage } from './montage';
import type { MontageView } from './montage';
import type { OutcomeView } from './outcome';
import { mountDayDate } from './dayDate';
import { mountControls } from './controls';
import { mountNotices } from './noGpu';
import { mountZones, rightLineWaits, zoneUnion } from './zones';
import type { ZoneRect, ZoneState } from './zones';
import '../../ui/font';
import '../../ui/c.css';
import './ui.css';

export type { ChoiceView, ChoiceOptionView, GestureEvent } from './choicePanel';
export type { EveningOpened } from './evening';
export type { WelcomeContent } from './welcome';
export type { OutcomeView } from './outcome';
export type { MontageView, MontageTail } from './montage';

export interface UiHandle {
  /** Le bus d'événements d'interface de ce montage : noms seulement, le son relève de `sound-designer` [spec C §5]. */
  readonly events: UiEvents;
  setNarration(key: string, params?: Params): void;
  /** Retire la ligne du narrateur (son lieu s'est refermé) : la case d'encre disparaît. */
  clearNarration(): void;
  /** Réplique d'une personne : une seule bulle, sans historique ; `nameKey` seulement si sa fiche a été lue [spec C §3.2, I-8, P-9]. */
  showLine(key: string, o?: LineOptions): void;
  /** Retire la bulle de réplique. */
  clearLine(): void;
  /** Rectangle écran de la personne QUI PARLE (zone interdite d'I-3 pour la bulle), `null` si elle n'est plus visible. */
  setSpeakerRect(r: ScreenRect | null): void;
  /** Rectangle écran de l'interlocuteur du choix ouvert (zone interdite d'I-3 pour le panneau d'options), `null` sans choix ou sans PNJ visible. */
  setInterlocutorRect(r: ScreenRect | null): void;
  setBracelet(n: number): void;
  /** Barre « Dossier » sous le bracelet : valeur consolidée et nuit en attente, sans nombre ; `evening` : relevé du soir ouvert, la nuit s'y consolide [GDD 2026-11-03 §2 A, décision Cynthia, playtest 2026-11-03]. */
  setDossier(v: DossierView, evening?: boolean): void;
  /** Séquence jouée : le segment en attente de la barre Dossier pulse dans le sens de l'effet (-1, +1) ; `null` arrête le battement. */
  pulseDossier(dir: -1 | 1 | null, weight?: import('./dossier').PulseWeight): void;
  /** Une option vient d'être confirmée : le décompte qui suit joue le jus de son prix, après coup seulement [spec C §4, I-5]. */
  reactToConfirm(o: { readonly isRefusal: boolean; readonly words: number }): void;
  /** Bouton « Continuer » visible sous tout texte qui attend ; clic, Espace, Entrée déclenchent `onAdvance`. */
  showContinue(visible: boolean): void;
  /** Bouton d'avance rapide : `queue` -> « Avancer jusqu'à mon tour », `pass` -> « Passer » ; `null` le retire. */
  showSkip(label: 'queue' | 'pass' | null): void;
  onAdvance(cb: () => void): () => void;
  /** Le bouton d'avance rapide a été activé. */
  onSkip(cb: () => void): () => void;
  /** Choix-destinations : options numérotées 1 à 3, touches 1, 2, 3 ; même `GestureEvent` que le panneau (désigner, confirmer) ; `null` le retire. */
  showDestinations(v: import('./choicePanel').ChoiceView | null): void;
  showChoices(cs: readonly import('./choicePanel').ChoiceView[]): void;
  showPrice(p: PriceLine): void;
  showCard(cardId: string): void;
  showCarnet(rights: readonly RightId[]): void;
  showRightLine(h: { readonly first: string; readonly second: string } | null): void;
  /** Trois lignes : `[data-ui="right-here"]`, `[data-ui="right-source"]`, `[data-ui="right-quote"]` ; `null` les retire. */
  showRightParts(p: import('../../engine/moments/rights').RightParts | null): void;
  showControls(visible: boolean): void;
  /** Voile noir plein cadre (0 à 1) : le fondu court d'un saut de séquence [GDD sequences-jouees §0.3]. */
  setFade(opacity: number): void;
  /** Mouvement réduit demandé : le fondu est sauté. */
  reducedMotion(): boolean;
  /** Séquence jouée : « un clic passe la scène » à l'écran pendant toute la séquence. */
  showSkipHint(visible: boolean): void;
  showRefusal(r: Rejected): void;
  /** Relâche l'option désignée du panneau (choix refusé par le moteur). */
  releaseChoice(): void;
  /** Relevé du soir et message du bracelet (`w10.msg.<palier>`) ; `palier` nul ou absent : pas de message. `day` donné : le relevé est une scène (titre, ligne du narrateur). */
  showEvening(lines: readonly EveningLine[], palier?: PalierId | null, day?: DayIndex | null, recap?: import('../../engine/moments/recap').Recap | null): void;
  /** Point d'accroche du soir : appelé à chaque ouverture du relevé avec la scène à compléter (la barre Dossier s'y consolide) ; rend le désabonnement. */
  onEvening(cb: (e: EveningOpened) => void): () => void;
  /** Bouton du relevé du dernier jour (`Recap.weekButtonKey`) activé : la semaine passe à sa fin. */
  onWeek(cb: () => void): () => void;
  /** Issue de l'audition (`[data-ui="outcome"]`) : ligne du régime, ligne du narrateur si non nulle, un bouton ; `null` la retire [J3-J7 T6]. */
  showOutcome(v: OutcomeView | null): void;
  /** Carte de montage d'un jour résumé (`[data-ui="montage"]`, Z-centre, texte seul) ; `null` la retire [semaine condensée T3]. */
  showMontage(v: MontageView | null): void;
  /** Le bouton de l'issue a été activé. */
  onOutcome(cb: () => void): () => void;
  /** Accueil du Service de courtoisie : une ligne à la fois, l'objet de la ligne s'allume ; `done` à la fin ou au clic « Passer ». */
  showWelcome(c: WelcomeContent, done: () => void): void;
  /** Ferme l'accueil sans appeler `done`. */
  closeWelcome(): void;
  /** L'accueil est-il ouvert ? (l'horloge de la rue l'attend) */
  welcomeOpen(): boolean;
  /** Ligne d'objectif du jour (`w10.goal.N`), en tête de Z-gauche ; `null` la retire. */
  showObjective(day: DayIndex | null): void;
  /** Date du jour (`w10.day.N.date`), pastille soleil en haut à gauche ; `null` l'efface. */
  showDayDate(day: DayIndex | null): void;
  showNoGpu(): void;
  showNotSaved(): void;
  onGesture(cb: (e: GestureEvent) => void): () => void;
  /** Hauteur (px) de la bande noire du letterbox 2,39:1 en haut et en bas ; le panneau de choix se plafonne hors des bandes [spec choix simultanés §3.5]. 0 hors observation. */
  setLetterboxBand(px: number): void;
  dispose(): void;
}

export interface MountUiOptions {
  readonly reducedMotion?: boolean;
  /** Animateur des mouvements ; défaut : Web Animations (sans effet là où `animate` manque). Les tests passent `createInstantAnimator()`. */
  readonly animator?: Animator;
  /** Flèches entre options d'un choix ; défaut : `theme.street.arrowKeys`. */
  readonly arrowKeys?: boolean;
}

const safeAnimator: Animator = { play: (el, spec) => (typeof el.animate === 'function' ? webAnimator.play(el, spec) : Promise.resolve()) };

const rectText = (r: ScreenRect): string => [r.x, r.y, r.w, r.h].map((n) => Math.round(n)).join(',');
const sameRect = (a: ScreenRect | null, b: ScreenRect | null): boolean => a === b || (a !== null && b !== null && rectText(a) === rectText(b));

/** Monte l'interface sous `host` ; `dispose` retire tout et les écouteurs. */
export function mountUi(host: HTMLElement, i18n: I18n, opts: MountUiOptions = {}): UiHandle {
  const root = host.appendChild(make(host.ownerDocument, 'div', { 'data-ui': 'root' }));
  applyTheme(root);   // D2 : la rue lit les mêmes jetons que les autres écrans
  const reduced = reducedMotionOf(opts.reducedMotion);
  root.dataset['reducedMotion'] = String(reduced);
  const events = createUiEvents();
  const bubble = mountBubble(root, i18n, { events, animator: opts.animator ?? safeAnimator, reduced });
  let bandPx = 0; let interlocutor: ScreenRect | null = null; let speakerRect: ScreenRect | null = null;
  const zones = mountZones(root);   // zones d'écran : la colonne de gauche et le centre reçoivent leurs éléments [design/ui/2026-11-02-zones-ecran-ux.md]
  const narrator = mountNarrator(zones.left, i18n); const animator = opts.animator ?? safeAnimator; const bracelet = mountBracelet(root, i18n, { events, animator, reduced }); const dossier = mountDossier(root, i18n, { animator, reduced }); const rightLine = mountRightLine(zones.centre);
  const choices = mountChoicePanel(root, i18n, { events, animator: opts.animator ?? safeAnimator, reduced, ...(opts.arrowKeys === undefined ? {} : { arrowKeys: opts.arrowKeys }) }); const destinations = mountDestinations(choices); const card = mountCard(zones.left, i18n, { events, animator, reduced }); const carnet = mountCarnet(zones.left, i18n);
  const advance = mountAdvance(root, i18n);
  const veil = make(root.ownerDocument, 'div', { 'data-ui': 'fade', class: 'c-fade', 'aria-hidden': 'true' }); veil.hidden = true; root.appendChild(veil);
  const evening = mountEvening(root, i18n, { events, animator, reduced }); const dayDate = mountDayDate(root, i18n); const welcome = mountWelcome(zones.centre, root, i18n); const objective = mountObjective(zones.left, i18n); const controls = mountControls(zones.left, i18n); const outcome = mountOutcome(zones.centre, i18n); const montage = mountMontage(zones.centre, i18n); const notices = mountNotices(root, i18n);
  /** Le rectangle coupé au-dessus de la barre d'avance visible, à une marge de zone : la réplique ne couvre jamais « Continuer » [revue T14 #1]. */
  const aboveAdvance = (r: ZoneRect, m: number): ZoneRect => {
    if (advance.bar.hidden) return r;
    const limit = advance.bar.getBoundingClientRect().top - root.getBoundingClientRect().top - m;
    return r.y + r.h <= limit ? r : { ...r, h: Math.max(0, limit - r.y) };
  };
  let zoneMarginPx = 0;
  /**
   * Le relevé du soir finit au-dessus de la barre d'avance visible (sinon au-dessus de la bande du bas), à une marge de zone : il défile dans
   * cette borne et ne couvre jamais « Continuer ». Sans elle, le relevé précis du J1 (948 px à 1280x720) recouvrait le bouton, le vrai clic
   * tombait sur le relevé et le jour ne passait plus [retours Cynthia 2026-11-08, « Je suis toujours en lundi 4 mars »]. Recalculée à
   * l'ouverture du relevé, à chaque bouton d'avance posé ou ôté, à chaque arrangement des zones et à chaque changement de langue (la scène est
   * recréée).
   */
  const fitEvening = (): void => {
    const scene = root.querySelector<HTMLElement>('[data-ui="evening-scene"]');
    if (scene === null) return;
    const floor = advance.bar.hidden ? root.getBoundingClientRect().bottom - bandPx : advance.bar.getBoundingClientRect().top;
    scene.style.maxBlockSize = `${Math.max(0, Math.floor(floor - zoneMarginPx - scene.getBoundingClientRect().top))}px`;
  };
  const offEveningLang = onLang(i18n, fitEvening);   // abonné après `mountEvening` : la scène recréée par la langue est bornée à son tour
  zones.onArrange((_p, _mode, L) => { zoneMarginPx = L.m; fitEvening(); });
  zones.onArrange((p, _mode, L) => { carnet.arrange(p.carnetFolded); bubble.setBounds(aboveAdvance(L.centre, L.m), aboveAdvance(zoneUnion(L.left, L.centre), L.m)); });   // la réplique tient dans Z-centre, sinon dans Z-gauche et Z-centre, jamais sur les options [Z-1, I-3] ni sur la barre d'avance
  let zoneState: ZoneState | null = null;
  zones.onState((s) => { zoneState = s; rightLine.hold(rightLineWaits(s)); });   // une seule lecture au centre : la ligne de droit attend la réplique [Z-3], et la fiche en petit [Z-10]
  /** Le panneau d'options va en bas à droite, ou à gauche si la zone interdite de la personne le coupe [I-3]. */
  const placeChoices = (): void => {
    const panel = root.querySelector<HTMLElement>('[data-ui="choices"]');
    if (panel === null) return;
    const w = root.clientWidth || root.ownerDocument.defaultView?.innerWidth || 1280, h = root.clientHeight || root.ownerDocument.defaultView?.innerHeight || 720;
    // la boîte du panneau vaut son budget de zone ; seul le contenu posé (liste, refus) occupe l'écran : c'est lui qui décide du côté
    const box = panel.getBoundingClientRect();
    const tops = [...panel.children].map((k) => k.getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.top);
    const pr = { width: box.width, height: tops.length > 0 ? box.bottom - Math.min(...tops) : box.height };
    const rem = parseFloat(root.ownerDocument.defaultView?.getComputedStyle(root).fontSize ?? '') || 16;
    const p = placePanel(interlocutor, { w: pr.width, h: pr.height }, { w, h }, scaledMargin(loadUi().theme.street.personMarginPx.v, w, loadUi().theme.street.referenceWidthPx.v), rem, bandPx);
    panel.dataset['side'] = p.side;
  };
  return {
    events,
    setNarration: (k, p) => { narrator.setNarration(k, p); },
    clearNarration: () => { narrator.clearNarration(); },
    showLine: (k, o) => { rightLine.hold(true); bubble.showLine(k, o); },   // la ligne de droit quitte le centre AVANT que la réplique n'y entre
    clearLine: () => { bubble.clearLine(); },
    setSpeakerRect: (r) => {
      if (sameRect(speakerRect, r)) return;                 // rien ne bouge : ni mise en page forcée ni écriture du DOM
      speakerRect = r; bubble.setPersonRect(r);
      if (r === null) delete root.dataset['speakerRect']; else root.dataset['speakerRect'] = rectText(r);   // lisible par les tests e2e
    },
    setInterlocutorRect: (r) => {
      if (sameRect(interlocutor, r)) return;
      interlocutor = r; placeChoices();
      if (r === null) delete root.dataset['interlocutorRect']; else root.dataset['interlocutorRect'] = rectText(r);
    },
    setBracelet: (n) => { bracelet.setBracelet(n); },
    setDossier: (v, e) => { dossier.setDossier(v, e); },
    pulseDossier: (d, w) => { dossier.pulse(d, w); },
    reactToConfirm: (o) => { bracelet.reactToConfirm(o); },
    showContinue: (v) => { advance.showContinue(v); fitEvening(); },
    showSkip: (l) => { advance.showSkip(l); fitEvening(); },
    onAdvance: (cb) => advance.onAdvance(cb),
    onSkip: (cb) => advance.onSkip(cb),
    showDestinations: (v) => { destinations.showDestinations(v); },
    showChoices: (cs) => { destinations.showChoices(cs); },
    showPrice: (p) => {
      // décision game-designer : la ligne de droit passe TOUJOURS avant la ligne de prix ; une ligne due ferme la réplique, s'affiche, puis le prix
      // en petit, la fiche retient aussi la ligne : le prix (priorité 1) ferme la fiche (4), la ligne passe, puis le prix [zones UX §3, §7.1]
      if (rightLine.owed) { bubble.clearLine(); if (zoneState?.mode === 'small') card.close(); rightLine.whenShown(() => { choices.showPrice(p); }); } else choices.showPrice(p);
    },
    showCard: (id) => { card.showCard(id); },
    showCarnet: (r) => { carnet.showCarnet(r); },
    showRightLine: (h) => { rightLine.showRightLine(h); },
    showRightParts: (p) => { rightLine.showRightParts(p); },
    showControls: (v) => { controls.showControls(v); },
    setFade: (o) => { veil.style.opacity = String(o); veil.hidden = o <= 0; },
    reducedMotion: () => reduced,
    showSkipHint: (v) => { controls.showSkipHint(v); root.dataset['sequencing'] = String(v); },   // la joueuse a perdu la main : curseur masqué [GDD sequences-jouees §1.3]
    showRefusal: (r) => { choices.showRefusal(r); },
    releaseChoice: () => { choices.releaseChoice(); },
    showEvening: (l, p, d, r) => { evening.showEvening(l, p, d, r); fitEvening(); },
    onEvening: (cb) => evening.onEvening(cb),
    onWeek: (cb) => evening.onWeek(cb),
    showOutcome: (v) => { outcome.showOutcome(v); },
    showMontage: (v) => { montage.showMontage(v); },
    onOutcome: (cb) => outcome.onContinue(cb),
    showWelcome: (c, done) => { welcome.showWelcome(c, done); },
    closeWelcome: () => { welcome.close(); },
    welcomeOpen: () => welcome.isOpen(),
    showObjective: (d) => { objective.showObjective(d); },
    showDayDate: (d) => { dayDate.showDayDate(d); },
    showNoGpu: () => { notices.showNoGpu(); },
    showNotSaved: () => { notices.showNotSaved(); },
    onGesture: (cb) => choices.onGesture(cb),
    setLetterboxBand: (px) => { bandPx = Math.max(0, Math.round(px)); root.style.setProperty('--s-letterbox-band-px', `${Math.max(0, Math.round(px))}px`); },
    dispose() { offEveningLang(); for (const p of [advance, bubble, narrator, bracelet, dossier, rightLine, choices, card, carnet, evening, dayDate, welcome, objective, controls, outcome, montage, notices, zones]) p.dispose(); root.remove(); },
  };
}
