/**
 * Rue guidée [spec rue guidée J1-J2 §4, §9 ; plan T14] : chunk à la demande, chargé par `screen.ts` quand le monde porte `street.guided`.
 * Le metteur en scène (`guided/director.ts`) dit le temps présent ; ce montage le rend : carte du jour, ligne, choix-destination, marche, attente,
 * droit, relevé du soir, nuit, issue de l'audition, fin (bilan) ou fin de démo. Aucune touche de marche, aucun clic au sol : clic, Espace, Entrée avancent ; « Passer » saute.
 * Seul le pilote écrit (par le metteur en scène) ; ici, aucune règle de jeu.
 */
import type { AppContext } from '../app/shell';
import type { RunResult } from '../shared/types';
import type { Vec2 } from '../engine/moments/types';
import { PLAYER_BODY_ID, crowdAt, facingYaw } from '../engine/view/crowd';
import type { DriverEvent } from '../engine/view/driver';
import { shotFor, shotPose, stepShot, type Shot, type ShotKind } from '../engine/view/rig';
import { createSequencer, effectEntries, parseSequences } from '../engine/view/sequence';
import { carnet, eveningLines } from '../engine/moments';
import { braceletCount, buildLedger } from '../engine/moments/words';
import { eveningPalier } from '../engine/moments/state';
import { dossierOf } from '../engine/moments/dossier';
import { eveningRecap } from '../engine/moments/recap';
import { rightParts } from '../engine/moments/rights';
import type { GuidedData, SceneSpec } from '../data/schema/guided';
import type { RightId } from '../shared/types/street';
import type { Rejected } from '../engine/moments/types';
import { createActionButton } from '../ui/components/c';
import { resetDraft } from '../screens/draft';
import { CharacterContractError, type CharacterHandle } from './render/characters/provider';
import type { CrowdPerson } from './render/characters/crowdView';
import type { DistrictHandle } from './render/scene';
import { Box3 } from 'three';
import { projectPersonRect } from './personRect';
import { mountUi } from './ui';
import type { MontageView } from './ui';
import { make } from './ui/dom';
import { lightKit, mountKitRow } from './ui/welcome';
import { BodiesMissingError, mountStage, type Stage } from './stage';
import { priceLineOf, streetDeps, type RuntimeDeps, type StreetRuntime } from './runtime';
import { createDirector, type Beat, type Director } from './guided/director';
import { actorSpot, createActors, insideBuilding, midpoint, placeSpot } from './guided/actors';
import { parseOnboarding } from './onboarding';
import onboardingRaw from './data/w10.onboarding.json';
import sequencesRaw from './data/w10.sequences.json';

/** Touches qui avancent un temps sans « Continuer » (marche, attente, nuit) et qui passent une séquence jouée. */
const ADVANCE_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);
const SEQ_SKIP_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'Escape']);

/** Ce que la caméra cadre pendant un temps : le genre de plan, et la personne de la scène (le plan `talk` cadre le milieu joueuse-personne). */
export function shotKindOf(beat: Beat, spec: SceneSpec | null, homePlace: string): ShotKind {
  if (beat.kind === 'walk') return 'street';
  if (beat.kind === 'wait') return beat.label === 'queue' ? 'queue' : spec === null ? 'street' : sceneKind(beat, spec, homePlace);
  if (beat.kind === 'montage' || beat.kind === 'montageEnd' || (beat.kind === 'choice' && beat.card === true)) return 'home';   // la carte de montage : aucune scène 3D jouée derrière [semaine condensée T3]
  if (beat.kind === 'card' || beat.kind === 'night' || beat.kind === 'recap' || beat.kind === 'demoEnd' || beat.kind === 'end' || beat.kind === 'outcome') return 'home';
  // sans scène présente, une ligne ou un droit est celui du réveil : après la carte, avant la première scène (les lignes d'accueil du J1 qui
  // présentent le kit). La joueuse est au logement : le bureau si la ligne allume un objet, sinon la maison ; jamais le plan de rue à 36 m
  // [retour Cynthia 2026-11-08 (c) : « une vue de loin de lui sur son bureau vide »]
  if (spec === null) return beat.kind === 'line' && beat.lit !== null ? 'desk' : beat.kind === 'line' || beat.kind === 'right' ? 'home' : 'street';
  return sceneKind(beat, spec, homePlace);
}
function sceneKind(beat: Beat, spec: SceneSpec, homePlace: string): ShotKind {
  if (spec.place === homePlace) return spec.actor === null && (beat.kind === 'choice' || (beat.kind === 'line' && beat.lit !== null)) ? 'desk' : 'home';
  if (spec.waitKind === 'queue') return 'queue';
  return spec.actor === null ? 'street' : 'talk';
}
/**
 * La coupe de l'immeuble 9 n'est ouverte qu'au logement (plans `home`, `desk`) et pour une scène jouée DANS l'immeuble (le palier) : elle
 * découvre une grande part de la rue [ruling T9] ; fermée, une scène d'intérieur serait cachée par la façade.
 */
export const cutawayFor = (k: ShotKind, indoors = false): boolean => k === 'home' || k === 'desk' || indoors;

/** Monte la rue guidée. Mêmes erreurs que `mountStreet` : `DataLoadError` remonte, corps absents et GPU absent s'affichent. */
export async function mountGuidedStreet(ctx: AppContext, run: RunResult, root: HTMLElement, over: Partial<RuntimeDeps> = {}): Promise<StreetRuntime> {
  const deps = streetDeps(ctx, over);
  const { i18n } = ctx;
  const doc = root.ownerDocument;
  const cleanups: (() => void)[] = [];
  const disposeAll = (): void => { for (const c of cleanups.splice(0).reverse()) { try { c(); } catch { /* un nettoyage raté ne bloque pas les autres */ } } };

  const host = doc.createElement('div');
  host.dataset['ui'] = 'street';
  host.dataset['mode'] = 'guided';
  host.style.cssText = 'position:fixed;inset:0;overflow:hidden';
  root.appendChild(host);
  cleanups.push(() => { host.remove(); });
  const ui = mountUi(host, i18n);
  cleanups.push(() => { ui.dispose(); });
  const empty: StreetRuntime = { driver: undefined as never, player: () => ({ x: 0, z: 0 }), district: () => undefined as never, dispose: disposeAll };

  try {
    const st = await mountStage(ctx, run, host, deps, ui, { interiors: 'core' });
    if (st === 'noGpu') return empty;
    if (st instanceof BodiesMissingError) throw st;
    cleanups.push(() => { st.dispose(); });
    return assemble(st);
  } catch (e) {
    if (e instanceof BodiesMissingError) {
      const p = host.appendChild(doc.createElement('p'));
      p.dataset['ui'] = 'street-error'; p.setAttribute('role', 'alert');
      p.textContent = i18n.t('street.ui.bodiesMissing', { ids: e.missing.join(', ') });
      return empty;
    }
    disposeAll();
    throw e;
  }

  function assemble(stage: Stage): StreetRuntime {
    const { view, scene, sctx, driver, provider, crowd, loading } = stage;
    const guided = sctx.street.guided as GuidedData;
    const worldId = ctx.core.build.streetWorlds[0]!;
    const onboarding = parseOnboarding(onboardingRaw, sctx.street);
    const seq = createSequencer(parseSequences(sequencesRaw, scene, sctx.street, (k) => i18n.has(k)));
    const uiRoot = host.querySelector<HTMLElement>('[data-ui="root"]')!;
    const homePlace = specOf(guided.days[0]!.first).place;
    const high = scene.camera.high;
    // rangée du kit au-dessus de la réplique tant qu'une ligne allume un objet : le bureau 3D n'en porte aucun [retour Cynthia 2026-11-08 (c)]
    const kitRow = mountKitRow(uiRoot.querySelector<HTMLElement>('[data-zone="centre"]') ?? uiRoot, i18n);
    cleanups.push(() => { kitRow.dispose(); });
    const firstWelcomeKey = onboarding.welcome.lines[0]?.key ?? null;

    let demoEnd: HTMLElement | null = null;
    /** La carte de fin de démonstration, un seul bouton : Nouvelle partie (même effet que l'écran de reprise, la partie est effacée). */
    const newGameCard = (): void => {
      if (demoEnd !== null) return;
      const end = guided.endOfDemo;
      const card = make(doc, 'section', { 'data-ui': 'demo-end', role: 'dialog', class: 'c-welcome' });
      card.appendChild(make(doc, 'h2', { class: 'c-recap-title' }, i18n.t(end?.titleKey ?? 'w10.demo.title')));
      card.appendChild(make(doc, 'p', { class: 'c-card c-card--secondary' }, i18n.t(end?.lineKey ?? 'w10.demo.line')));
      const actions = card.appendChild(make(doc, 'div', { class: 'c-welcome-actions' }));
      const fresh = actions.appendChild(createActionButton(i18n.t('resume.new')));
      fresh.dataset['ui'] = 'demo-new';
      fresh.addEventListener('click', () => { ctx.save.reset(); resetDraft(); void ctx.navigate('lang', undefined); });
      (uiRoot.querySelector('[data-zone="centre"]') ?? uiRoot).appendChild(card);
      demoEnd = card;
      fresh.focus();
    };

    // Droits déjà dits aujourd'hui : la reprise rejoue la journée sans repousser leurs temps `right` ; le carnet les garde [revue finale I-1].
    const spoken = new Set<RightId>();      // droits dont le temps `right` a été montré puis quitté (ou dits ce jour avant la reprise)
    {
      const s0 = driver.state().street;
      if (s0.acts.some((a) => a.day === s0.day)) for (const [k, r] of Object.entries(s0.rightLines)) if (k.startsWith(`${s0.day}.`)) spoken.add(r);
    }

    // la joueuse repart du lieu de la scène où la reprise la pose (le metteur en scène rejoue la journée à la construction)
    let director: Director;
    try {
      director = createDirector(driver, guided, onboarding, sctx);
    } catch (e) {
      // Sauvegarde que le metteur en scène ne sait pas rejouer (marche libre d'avant T14, transit refusé) : la faute est nommée en console,
      // la joueuse reçoit la Nouvelle partie au lieu d'une erreur de chargement à chaque reprise [revue finale M-1]. Un transit posé par le
      // metteur en scène avant la faute peut déjà être sauvegardé [N-1] ; aucune image ne viendra, l'indicateur de chargement part [N-2].
      console.error('rue guidée : la sauvegarde ne se rejoue pas (un transit a pu être enregistré avant la faute), Nouvelle partie proposée', e);
      loading.remove();
      host.dataset['beat'] = 'demoEnd';
      newGameCard();
      return { driver, player: () => placeSpot(scene, homePlace), district: stage.district, dispose: disposeAll };
    }
    const actors = createActors(scene, placeSpot(scene, homePlace));
    const playerHandle: CharacterHandle = provider.acquire({ id: 'player', kind: 'player', bodyId: PLAYER_BODY_ID, seed: 0 });
    view.add(playerHandle.object);
    cleanups.push(() => { playerHandle.release(); });

    // Mesure de capture [rue guidée T15] : rectangle écran (corps entier) de la joueuse et de la personne de la scène. Build de capture seulement :
    // le prédicat est écrit en ligne pour qu'un build de production le plie en `false` et n'émette ni ce code ni la chaîne `__guided`.
    if (import.meta.env.VITE_CAPTURE === '1') {
      const box = new Box3();
      const api = {
        bodyRects(): { id: string; x: number; y: number; w: number; h: number }[] {
          const vp = { w: stage.canvasHost.clientWidth || 1280, h: stage.canvasHost.clientHeight || 720 };
          stage.camera.updateMatrixWorld(true);
          const bodies: [string, { updateMatrixWorld(force?: boolean): void } | null][] = [['player', playerHandle.object]];
          const who = spec?.actor;
          if (who != null) bodies.push([`actor.${who.id}`, crowd.objectOf(`actor.${who.id}`)]);
          const out: { id: string; x: number; y: number; w: number; h: number }[] = [];
          for (const [id, obj] of bodies) {
            if (obj === null) continue;
            obj.updateMatrixWorld(true);
            const r = projectPersonRect(box.setFromObject(obj as never, true), stage.camera, vp, 1);
            if (r !== null) out.push({ id, ...r });
          }
          return out;
        },
      };
      (window as unknown as { __guided?: typeof api }).__guided = api;
      cleanups.push(() => { delete (window as unknown as { __guided?: typeof api }).__guided; });
    }

    let shown: Beat | null = null;          // le temps rendu à l'écran
    let spec: SceneSpec | null = null;      // la scène du temps présent (elle reste après le choix, jusqu'à la scène suivante)
    let waited = 0;                          // ms écoulées dans un temps `wait`
    let shot: Shot | null = null;
    let cutaway: boolean | null = null;
    let cutDistrict: DistrictHandle | null = null;
    let elapsed = 0, last: number | null = null, rafHandle = 0, disposed = false, navigated = false;
    let lastBracelet = '', lastDossier = '', lastCarnet: string | null = null;
    /** La carte de montage affichée, gardée du temps `montage` au « Continuer » de `montageEnd` (le choix de carte s'ouvre dessus). */
    let cardView: MontageView | null = null;

    function specOf(id: string): SceneSpec {
      const s = guided.scenes.find((x) => x.id === id);
      if (s === undefined) throw new Error(`rue guidée : scène inconnue « ${id} »`);
      return s;
    }
    const currentSpec = (): SceneSpec | null => { const id = director.sceneId(); return id === null ? spec : specOf(id); };
    const actorPos = (): Vec2 | null => (spec?.actor == null ? null : actorSpot(scene, spec.place, spec.actor.id));

    // --- choix : le panneau désigne (prix dit, D136), le metteur en scène confirme ---
    cleanups.push(ui.onGesture((e) => {
      const b = director.current();
      if (seq.active() || b.kind !== 'choice' || e.choiceId !== b.view.id || e.gesture === 'close') return;
      if (!b.priced) {   // option narrative, jalon : un seul geste ; une option qui coûte des mots a le décompte animé, comme un choix à prix [M-3]
        const o = e.optionId === null ? undefined : b.view.options.find((x) => x.id === e.optionId);
        if (o !== undefined) choose(o.id, () => { ui.reactToConfirm({ isRefusal: o.isRefusal, words: o.words }); });
        return;
      }
      if (e.gesture === 'designate') {
        const r = driver.designate(e.choiceId, e.optionId);
        if (e.optionId === null) return;
        if (r.ok) ui.showPrice(priceLineOf(e.choiceId, e.optionId, r.price));
        else ui.showRefusal({ act: { day: driver.state().street.day, minute: driver.state().live.clock.minute, kind: 'choice', id: e.choiceId, option: e.optionId }, reason: r.reason } as Rejected);
        return;
      }
      if (e.optionId === null) return;
      const optionId = e.optionId;
      const o = b.view.options.find((x) => x.id === optionId);
      const apply = (): void => { choose(optionId, () => { if (o !== undefined) ui.reactToConfirm({ isRefusal: o.isRefusal, words: o.words }); }); };
      // séquence jouée : elle se joue d'abord, l'acte part à sa fin (une fois) ; sans séquence écrite, l'acte part tout de suite
      const snap = driver.state();
      const played = seq.begin(e.choiceId, optionId, (final) => {
        actors.set(final);
        try { apply(); } finally { ui.showSkipHint(false); ui.pulseDossier(null); }
      }, effectEntries(snap.street, sctx, snap.live.clock), { reduced: ui.reducedMotion(), day: snap.street.day });
      if (played === null) { apply(); return; }
      ui.showDestinations(null);
      ui.setNarration(played.narrationKey);
      ui.showSkipHint(true);
      if (played.dossierPulse !== 0) ui.pulseDossier(played.dossierPulse, played.pulseWeight);
    }));
    /** Pose le choix ; `accepted` (le jus du bracelet) ne part qu'une fois l'acte accepté par le moteur, avant la baisse rendue par `sync` [N-3]. */
    const choose = (optionId: string, accepted?: () => void): void => {
      const r = director.choose(optionId);
      if (r.ok) accepted?.();
      else { ui.releaseChoice(); ui.showRefusal(r.rejected); }   // refusé : l'option ne reste pas désignée [revue finale M-4]
      sync();
    };

    // --- avance : Continuer, Passer, clic, Espace, Entrée ---
    const advance = (): void => {
      const b = director.current();
      if (b.kind === 'choice' || b.kind === 'demoEnd' || b.kind === 'end') return;
      if (b.kind === 'walk') actors.finish();          // saut = pose finale
      director.advance();
      sync();
    };
    // le bouton de l'issue et celui du relevé du dernier jour avancent comme « Continuer » [J3-J7 T6]
    cleanups.push(ui.onAdvance(advance), ui.onSkip(advance), ui.onOutcome(advance), ui.onWeek(advance));
    const passive = (b: Beat): boolean => b.kind === 'walk' || b.kind === 'wait' || b.kind === 'night';
    const onKeyDown = (e: KeyboardEvent): void => {
      if (seq.active()) { if (SEQ_SKIP_KEYS.has(e.code)) seq.skip(); return; }
      // « Continuer » visible : `advance.ts` tient déjà Espace et Entrée ; ici seulement les temps qui n'ont que « Passer »
      if (e.repeat || !ADVANCE_KEYS.has(e.code) || !passive(director.current())) return;
      const t = e.target;
      if (t instanceof HTMLElement && ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      e.preventDefault(); advance();
    };
    const onPointer = (): void => { if (seq.active()) { seq.skip(); return; } advance(); };
    const onResize = (): void => { stage.resize(); };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('resize', onResize);
    stage.canvasHost.addEventListener('pointerdown', onPointer);
    cleanups.push(() => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('resize', onResize); stage.canvasHost.removeEventListener('pointerdown', onPointer); });

    // --- rendu des temps ---
    const leaveBeat = (b: Beat): void => {
      if (b.kind === 'line') { lightKit(uiRoot, null); kitRow.show(onboarding.welcome.kit, null); if (b.voice !== 'narrator') ui.clearLine(); }   // une réplique lue se ferme : la ligne de droit et le prix passent ensuite [Z-3]
      if (b.kind === 'recap') ui.showEvening([], null, null, null);
      if (b.kind === 'right') spoken.add(b.right);
      if (b.kind === 'choice') ui.showDestinations(null);
      if (b.kind === 'outcome') ui.showOutcome(null);
    };
    /** Un temps qui garde la carte de montage à l'écran : la carte, son choix, sa fin. */
    const keepsCard = (b: Beat): boolean => b.kind === 'montage' || b.kind === 'montageEnd' || (b.kind === 'choice' && b.card === true);
    const showBeat = (b: Beat): void => {
      ui.showContinue(false); ui.showSkip(null);
      if (!keepsCard(b) && cardView !== null) { cardView = null; ui.showMontage(null); }   // la carte quitte l'écran avec son dernier temps
      if (b.kind !== 'right') ui.showRightParts(null);   // la ligne de droit quitte l'écran avec son temps ; une ligne encore due (réplique ouverte) reste due, jamais perdue
      switch (b.kind) {
        case 'card': ui.showDayDate(b.day); ui.showObjective(b.day); ui.showContinue(true); break;
        case 'line':
          if (b.voice === 'narrator') ui.setNarration(b.key);
          else ui.showLine(b.key, b.speaker === null ? {} : { nameKey: b.speaker });
          lightKit(uiRoot, b.lit);
          kitRow.show(onboarding.welcome.kit, b.lit, b.key === firstWelcomeKey && !ui.reducedMotion());   // le téléphone vibre à l'appel, comme l'accueil de la rue libre
          ui.showContinue(true);
          break;
        case 'montage': {
          const fact = b.factChainId === null ? null : guided.chains.find((c) => c.id === b.factChainId)?.fact ?? null;
          cardView = { day: b.day, lineKeys: b.lineKeys, postureKey: b.postureKey, fact: fact === null ? null : { key: fact.key, sourceKey: fact.sourceKey }, tail: null };
          ui.clearLine(); ui.clearNarration(); ui.showDayDate(b.day); ui.showMontage(cardView); ui.showContinue(true);
          break;
        }
        case 'montageEnd':
          if (cardView !== null) { cardView = { ...cardView, tail: b.tail }; ui.showMontage(cardView); }
          ui.showContinue(true);
          break;
        case 'choice': ui.showDestinations(b.view); break;   // Continuer masqué : Espace et Entrée appartiennent au panneau
        case 'walk': ui.clearLine(); ui.clearNarration(); actors.walkTo(b.to); ui.showSkip('pass'); break;
        case 'wait': waited = 0; ui.showSkip(b.label); break;
        case 'right': ui.showRightParts(rightParts(worldId, b.right, (k) => i18n.t(k))); ui.showContinue(true); break;
        case 'recap': {
          const s = driver.state().street;
          ui.clearLine(); ui.clearNarration();
          const recap = eveningRecap(s, sctx, ctx.save.load().data.answers);
          ui.showEvening(eveningLines(s.day, s.acts, sctx), eveningPalier(s, sctx), s.day, recap);
          ui.showContinue(!recap.lastDay);   // dernier jour : le bouton de la semaine (`recap-week`) est le seul geste [J3-J7 T6]
          break;
        }
        case 'night': ui.clearLine(); ui.clearNarration(); ui.showSkip('pass'); break;
        case 'demoEnd': endOfDemo(); break;
        case 'end': endOfWeek(); break;
        case 'outcome': ui.clearLine(); ui.clearNarration(); ui.showOutcome(b); break;   // un seul bouton, celui de l'issue
      }
    };
    /** Fin de la démonstration : la partie arrêtée montre d'abord le bilan final (écran existant) ; sinon la carte de fin, un seul bouton. */
    const endOfDemo = (): void => {
      const bilan = driver.finishDay();
      if (bilan !== null) { if (!navigated) { navigated = true; handle(driver.drain()); void ctx.navigate('bilan', { input: bilan }); } return; }
      newGameCard();
    };
    /**
     * Fin de la partie (temps `end`) : le bilan final, une seule fois (garde `navigated`, comme `runtime.ts`). `end` sans partie finie est une
     * faute de données : elle est nommée en console et dite à l'écran, jamais remplacée par la carte de fin de démo [plan J3-J7 T6].
     */
    const endOfWeek = (): void => {
      if (navigated) return;
      const bilan = driver.finishDay();
      if (bilan === null) {
        console.error('rue guidée : temps « end » sans partie finie (faute de données)');
        const p = host.appendChild(doc.createElement('p'));
        p.dataset['ui'] = 'street-error'; p.setAttribute('role', 'alert');
        p.textContent = i18n.t('app.error.load');
        return;
      }
      navigated = true; handle(driver.drain()); void ctx.navigate('bilan', { input: bilan });
    };
    const handle = (events: readonly DriverEvent[]): void => {
      for (const ev of events) {
        if (ev.type === 'rejected') ui.showRefusal(ev.rejected);
        else if (ev.type === 'unsaved') ui.showNotSaved();
      }
    };
    /** Rend le temps présent s'il a changé, et l'état lu par l'interface et l'e2e. */
    function sync(): void {
      const b = director.current();
      if (b !== shown) {
        if (shown !== null) leaveBeat(shown);
        const s = currentSpec();
        if (s !== null && s !== spec) { spec = s; if (shown === null || shown.kind !== 'walk') actors.placeAt(s.place); }   // une scène sans marche (reprise, même lieu) pose la joueuse à son lieu
        // l'issue est cadrée au logement (`shotKindOf`) : la joueuse y est posée aussi, la scène de l'audition est quittée [revue T4, mineur]
        if (b.kind === 'card' || b.kind === 'montage' || b.kind === 'montageEnd' || (b.kind === 'choice' && b.card === true) || b.kind === 'night' || b.kind === 'demoEnd' || b.kind === 'end' || b.kind === 'outcome') { spec = null; actors.placeAt(homePlace); }
        shown = b;
        showBeat(b);
      }
      const { street } = driver.state();
      if (b.kind !== 'demoEnd' && b.kind !== 'end') ui.showObjective(street.day);   // une reprise en cours de journée ne repasse pas par la carte : l'objectif du jour s'affiche quand même (sans effet s'il est déjà là)
      const bracelet = String(braceletCount(buildLedger(street.day, street.acts, sctx)));
      if (bracelet !== lastBracelet) { lastBracelet = bracelet; ui.setBracelet(Number(bracelet)); }
      // le carnet ne garde que les droits DÉJÀ dits : celui d'un temps `right` y entre quand ce temps se ferme, jamais avant ni pendant ; ceux des jours passés, à la reprise
      const kept = carnet(street).filter((r) => spoken.has(r) || Object.entries(street.rightLines).some(([k, v]) => v === r && Number(k.split('.')[0]) < street.day));
      const carnetKey = kept.join('|');
      if (carnetKey !== lastCarnet) { lastCarnet = carnetKey; ui.showCarnet(kept); }
      const dossier = `${street.day}.${street.acts.length}.${street.survival.value}.${street.dayExtra.entries.length}.${street.dayExtra.spent}.${b.kind === 'recap'}`;
      if (dossier !== lastDossier) { lastDossier = dossier; ui.setDossier(dossierOf(street, sctx), b.kind === 'recap'); }
      host.dataset['beat'] = b.kind;
      host.dataset['scene'] = director.sceneId() ?? '';
      host.dataset['day'] = String(street.day);
      host.dataset['minute'] = String(driver.state().live.clock.minute);
      host.dataset['acts'] = String(street.acts.length);
      host.dataset['bracelet'] = bracelet;
      handle(driver.drain());
    }

    // --- image ---
    const failFrame = (e: unknown): void => {
      disposed = true; deps.frames.cancel(rafHandle); loading.remove();
      const p = host.appendChild(doc.createElement('p'));
      p.dataset['ui'] = 'street-error'; p.setAttribute('role', 'alert');
      p.textContent = e instanceof CharacterContractError ? i18n.t('street.ui.bodyFailed', { id: e.bodyId ?? '?' }) : i18n.t('app.error.load');
    };
    const frame = (nowMs: number): void => {
      if (disposed) return;
      rafHandle = deps.frames.request(frame);
      try { frameBody(nowMs); } catch (e) { failFrame(e); }
    };
    const frameBody = (nowMs: number): void => {
      const raw = last === null ? 0 : nowMs - last;
      last = nowMs;
      const dt = Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), scene.walk.maxDtMs.v);
      elapsed += dt;
      const b = director.current();
      if (seq.active()) {
        const auto = seq.step(dt, actors.player(), (scene.walk.speedMps.v * scene.walk.maxDtMs.v) / 1000);
        // le bras levé à l'image (repère `barrier.up`) ne bloque plus le pas, comme dans `runtime.ts` : sans cela la séquence finissait devant le bras
        // et la marche suivante glissait le long du bras puis du mur de télés [retour Cynthia 2026-11-08 (a)]
        if (auto.teleport !== null) actors.set(auto.teleport);
        else if (auto.dir !== null && !auto.ended) actors.nudge(auto.dir, dt, !seq.cueState().barrierUp);
      } else if (b.kind === 'walk') {
        if (actors.step(dt)) { director.advance(); }
      } else if (b.kind === 'wait') {
        waited += dt;
        if (waited >= ((b.untilMinute - b.fromMinute) * sctx.street.clock.msPerHour) / 60) director.advance();
      }
      seq.settle(actors.player(), driver.state().street.day);
      { const second = seq.takeSecondPulse(); if (second !== null) ui.pulseDossier(second.dir, second.weight); }
      sync();

      // corps : la joueuse, la personne de la scène, les passants
      const player = actors.player();
      const who = actorPos();
      const people: CrowdPerson[] = crowdAt(scene, elapsed, run.seed).map((p) => ({ ...p, kind: 'passerby' as const }));
      if (spec?.actor != null && who !== null) people.push({ id: `actor.${spec.actor.id}`, bodyId: spec.actor.bodyId, pos: who, heading: Math.atan2(player.x - who.x, -(player.z - who.z)), kind: 'npc', clip: spec.actor.clip });
      crowd.update(people, dt);
      playerHandle.object.position.set(player.x, 0, player.z);
      playerHandle.object.rotation.y = facingYaw(actors.heading());
      playerHandle.play(actors.moving() || seq.active() ? 'walk' : 'idle', 1);
      playerHandle.tick(dt);
      const cues = seq.cueState();
      const dist = stage.district();
      dist.setSlit(cues.slit); dist.setWallFace(cues.face); dist.setBarrierArm(cues.barrierUp ? 1 : 0);
      ui.setFade(seq.fade());

      // caméra haute : le plan du temps présent, amorti ; la coupe suit le plan, et le quartier remplacé (intérieurs meublés) la reçoit aussi
      const kind = shotKindOf(director.current(), spec, homePlace);
      const focus = kind === 'talk' && who !== null ? midpoint(player, who) : player;
      const want = shotFor(kind, focus, high);
      shot = shot === null ? want : stepShot(shot, want, dt, high.dampMs.v, false);
      const cut = cutawayFor(kind, insideBuilding(scene, focus));
      if (cut !== cutaway || dist !== cutDistrict) { cutaway = cut; cutDistrict = dist; dist.setCutaway(cut); }
      stage.render(dt, shotPose(shot, scene.camera.sensorHeightMm.v), shot.distM);
    };

    stage.resize();
    sync();
    rafHandle = deps.frames.request(frame);
    cleanups.push(() => { disposed = true; deps.frames.cancel(rafHandle); demoEnd?.remove(); });
    // démontage en pleine séquence : l'acte n'est jamais perdu en silence, il est appliqué (état final)
    cleanups.push(() => { if (!seq.active()) return; try { seq.skip(); } catch (e) { console.error('séquence jouée : acte non appliqué au démontage', e); } });
    return { driver, player: () => actors.player(), district: stage.district, dispose: disposeAll };
  }
}
