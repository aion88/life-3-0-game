import {mountSceneReading} from './sceneReading';
import {journeyConsequences,journeyMaterial} from './consequences';
import { narrativeScene } from './narrative';
import {moralMoments,journeyLighting} from './moralMoments';
import {moralCard} from './moralView';
import { spokenLine } from './spokenLines';
import { type DecisionImpact } from './decisionImpact';
import './dialogueStage.css';
import { lifeSheet } from './lifeSheet';
import { presentComparisons } from './presentView';
import { openExploration, explorationReturn, explorationProgressKey } from './exploration';
/** World-specific short journeys, isolated from the legacy seven-day action log. */
import type { AppContext } from '../app/shell';
import type { RunResult } from '../shared/types';
import { DataLoadError } from '../data/schema/common';
import { resetDraft } from '../screens/draft';
import { journeys } from './catalogue';
import { reviews } from './review';
import type { JourneyWorldId } from './types';
import { createIllustratedJourneyView as createJourneyView } from './illustratedView';
import { blockedReason, companionMood, decide, elapsed, restoreJourney, serializeJourney, startJourney } from './state';
import { shortCosts } from './shortForm';
import './shortForm.css';
import { alternative, AXIS_LABELS, contributions } from './explain';
import './style.css';
import './readingColumn.css';
import './livedScene.css';
import './protoLayout.css';
import { createPiece, type Piece, type PieceProp } from './pieces';
import { createWeekSound } from './week/weekSound';
import { createContactLink } from '../screens/feedback';

/**
 * The world's resource name, in agreement with the amount (French: zero and one are singular). Display only: game values never change.
 * « Crédits » → « crédit », « Créneaux avant le départ » → « créneau avant le départ », « Temps … » stays as it is.
 */
export function resourceUnit(name: string, amount: number): string {
  const lower = name.toLowerCase(); if (Math.abs(amount) >= 2) return lower;
  const [first = '', ...rest] = lower.split(' ');
  const one = first === 'temps' ? first : first.endsWith('eaux') ? first.slice(0, -1) : first.endsWith('s') ? first.slice(0, -1) : first;
  return [one, ...rest].join(' ');
}
/** Dependency injection keeps browser rendering separate from gameplay and persistence tests. */
export interface JourneyDeps { view: typeof createJourneyView }
/** Mount the computed destination. No world selector can silently substitute another world. */
export async function mountJourney(ctx: AppContext, run: RunResult, root: HTMLElement, deps: Partial<JourneyDeps> = {}): Promise<{ dispose(): void }> {
  if (run.outcome.kind !== 'arrival' || run.outcome.computedWorld === 'w10') throw new DataLoadError('reference', 'journey', '', 'Destination incompatible avec ce parcours.');
  const id = run.outcome.computedWorld as JourneyWorldId;
  const journey = journeys[id];
  if (!journey) throw new DataLoadError('reference', 'journey', id, 'Ce monde ne possède pas de parcours.');
  const doc = root.ownerDocument;
  const host = doc.createElement('main'); host.className = 'journey proto-scene'; host.dataset['world'] = id; host.setAttribute('aria-label', ctx.i18n.t(`world.${id}.name`)); root.append(host);
  const disposeSceneReading=mountSceneReading(host);
  // The decor sits alone in its own clipped frame; nothing is laid over it but the place's mood label. The view box is taller than the frame so the 3D/plate keeps its cover behaviour.
  const sceneHost = doc.createElement('div'); sceneHost.className = 'journey-view'; const stageBox = doc.createElement('div'); stageBox.className = 'proto-stage'; stageBox.append(sceneHost); host.append(stageBox);
  const hud = doc.createElement('div'); hud.className = 'journey-hud'; host.append(hud);
  const saveKey = explorationProgressKey(ctx, `aftermath.journey.v1.${id}.${run.seed}`);
  let raw: string | null = null; let persistent = true;
  try { raw = localStorage.getItem(saveKey); } catch { persistent = false; }
  let state = restoreJourney(journey, raw);
  // No welcome window: the intro is told above the first scene (see `intro` in draw), "Règles du monde" stays in the menu.
  let modal: 'none' | 'journal' | 'worlds' | 'pause' | 'welcome' | 'facts' = 'none';
  let acting = false;
  /** True while the player's choice is being put on the piece (a short beat before the decision is applied). */
  let marking = false;
  const sound = createWeekSound(doc.defaultView); host.addEventListener('pointerdown', () => sound.unlock());
  let scenePiece: Piece | null = null;
  const printTimers: ReturnType<typeof setTimeout>[] = []; let printedEnding = '';
  let cafeFilm = false;
  let feedback = '';
  let impact:DecisionImpact|null=null;
  /** Scenes applied on their own (single displayed gesture) since the player's last gesture, told in grey. */
  let told: string[] = [];
  let travel: { fromScene: string; stage: 'ready' | 'moving' } | null = null;
  // A reload during a journey keeps its orientation card instead of silently skipping it.
  try {
    if (raw && JSON.parse(raw).inTransit === true) {
      const last = state.choices.at(-1), from = journey.scenes.find(scene => scene.id === last?.scene);
      const current = journey.scenes.find(scene => scene.id === state.scene);
      if (from && current && from.location !== current.location) {
        travel = { fromScene: from.id, stage: 'ready' };
        feedback = from.options.find(option => option.id === last?.option)?.consequence ?? '';
      }
    }
  } catch { /* The state restorer already handles invalid saves. */ }
  /** A scene whose only displayed gesture is available asks for no press: it is applied and told, decision recorded as before, so saves replay unchanged. */
  const settle = (): void => {
    for (let guard = 0; guard < 12; guard++) {
      const original = journey.scenes.find(s => s.id === state.scene); if (!original || original.ending) return;
      const current = narrativeScene(id, original, state);
      const shown = current.options.filter(o => !(o.hideWhenBlocked && blockedReason(state, o, journey) !== null));
      const only = shown[0];
      if (current.ending || shown.length !== 1 || !only || blockedReason(state, only, journey) !== null) return;
      const next = decide(journey, state, only.id); if (next === state) return;
      told.push(current.text, only.consequence); state = next;
    }
  };
  if (!travel) { const first = state; settle(); if (state !== first) { told = []; try { localStorage.setItem(saveKey, JSON.stringify({ ...JSON.parse(serializeJourney(journey, state)), inTransit: false })); } catch { persistent = false; } } }
  const effects = contributions(ctx.core, run.answers, journey.axes);
  const counterfactual = alternative(ctx.core, run.answers, journey.question, id);
  let view: Awaited<ReturnType<typeof createJourneyView>> | null = null;
  let disposed = false;
  let explorer: { dispose(): void } | null = null;
  const make = (tag: string, text = '', cls = ''): HTMLElement => { const node = doc.createElement(tag); node.textContent = text; node.className = cls; return node; };
  const button = (text: string, action: () => void): HTMLButtonElement => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', action); return b; };
  /** The line of a scene: what is said (between « ») in white, what is told in grey. The text itself is unchanged. */
  const lineNode = (text: string): HTMLElement => {
    const p = make('p', '', 'journey-line');
    for (const part of text.split(/(«[^»]*»)/).filter(chunk => chunk !== '')) {
      const said = part.startsWith('«'); const span = make('span', part, said ? 'line-said' : 'line-told'); span.dataset['ink'] = said ? 'said' : 'told'; p.append(span);
    }
    return p;
  };
  /** Smallest picture band kept (px). When the text and the plateau leave less, the grey intro, then the told lines and the title, then the optional extras give way first. */
  const MIN_BAND = 120;
  /** One column: bar, mission, picture, text band, plateau. The picture takes what the rest leaves; the text keeps its natural height. */
  const fit = (): void => {
    const phone = doc.defaultView?.matchMedia?.('(max-width:760px)').matches ?? false;
    // Aim for a comfortable picture; accept the floor (120 px on a phone) when the text and the plateau need the room.
    const floor = phone ? MIN_BAND : 220, aim = phone ? 150 : 300;
    const fits = (need: number): boolean => stageBox.clientHeight >= need && host.scrollHeight <= host.clientHeight + 1;
    let level = 0, firstFloor = -1;
    for (; level <= 5; level++) { host.dataset['squeeze'] = String(level); if (firstFloor < 0 && fits(floor)) firstFloor = level; if (fits(aim)) break; }
    if (level > 5) { level = firstFloor >= 0 ? firstFloor : 5; host.dataset['squeeze'] = String(level); }
    // The picture is cropped (cover) to the frame the grid gave it.
    host.style.setProperty('--iv-portrait-height', `${Math.max(MIN_BAND, stageBox.clientHeight)}px`);
    host.dataset['band'] = 'show';
    // Mission stays readable on ONE line: cut by « … » in the text itself (no clipping box), full text in the Menu.
    const o = hud.querySelector<HTMLElement>('.lived-orientation');
    for (const el of o?.querySelectorAll<HTMLElement>('strong,span') ?? []) {
      const full = el.dataset['full'] ?? (el.dataset['full'] = el.textContent ?? ''); el.textContent = full; el.removeAttribute('title');
      if (getComputedStyle(el).whiteSpace !== 'nowrap' || !el.clientWidth || el.scrollWidth <= el.clientWidth) continue;
      let lo = 0, hi = full.length;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; el.textContent = `${full.slice(0, mid).trimEnd()}…`; if (el.scrollWidth <= el.clientWidth) lo = mid; else hi = mid - 1; }
      el.textContent = `${full.slice(0, lo).trimEnd()}…`; el.title = full;
    }
  };
  /** A decision is not offered in front of an empty frame: the scene is busy until the picture of the place is painted (no timer, the view says when). */
  const paintWaiting = (): boolean => view === null || sceneHost.querySelector('[data-image-state=loading]') !== null;
  const syncReady = (): void => {
    const waiting = paintWaiting(); host.dataset['busy'] = String(acting || travel !== null || waiting);
    for (const b of hud.querySelectorAll<HTMLButtonElement>('[data-option]')) b.disabled = b.dataset['locked'] === '1' || acting || waiting;
  };
  const paintObserver = new MutationObserver(syncReady); paintObserver.observe(sceneHost, { subtree: true, attributes: true, attributeFilter: ['data-image-state'] });
  const persist = (): void => { try { localStorage.setItem(saveKey, JSON.stringify({ ...JSON.parse(serializeJourney(journey, state)), inTransit: travel !== null })); } catch { persistent = false; } };
  const explain = (parent: HTMLElement): void => {
    parent.append(make('h2', 'Pourquoi ce monde ?'), make('p', `Tes réponses ont conduit à ${ctx.i18n.t(`world.${id}.name`)} dans la simulation. Elles modifient six dimensions, puis le modèle fait évoluer leur combinaison de 2026 à 2030.`));
    parent.append(make('p', 'Les contributions ci-dessous sont des règles de cette simulation, pas des probabilités réelles. Une réponse ne provoque pas à elle seule ce futur.'));
    for (const effect of effects) {
      const section = make('section', '', 'journey-cause');
      section.append(make('h3', ctx.i18n.t(`q.${effect.question}.title`)), make('p', `Tu avais choisi : « ${ctx.i18n.t(`q.${effect.question}.${effect.answer}.label`)} »`), make('p', effect.deltas.map(d => `${AXIS_LABELS[d.axis]} ${d.value > 0 ? '+' : ''}${d.value}`).join(' · ')));
      parent.append(section);
    }
    parent.append(make('h3', 'Et avec une autre réponse ?'));
    parent.append(make('p', counterfactual ? `Toutes tes autres réponses identiques, choisir « ${ctx.i18n.t(`q.${journey.question}.${counterfactual.answer}.label`)} » à « ${ctx.i18n.t(`q.${journey.question}.title`)} » aurait conduit à ${ctx.i18n.t(`world.${counterfactual.world}.name`)} dans ce modèle.` : `Changer seulement ta réponse à « ${ctx.i18n.t(`q.${journey.question}.title`)} » ne suffit pas à changer ta destination. C’est la combinaison de tes réponses qui compte.`));
    parent.append(make('p', 'Les lieux, les personnes et la mission sont une fiction écrite pour ce monde. Les règles d’accès, les coûts et les ressources que tu rencontres rendent ses tensions jouables ; ce ne sont pas des faits annoncés pour 2030.'));
  };
  const history = (parent: HTMLElement): void => {
    const list = make('ol', '', 'journey-history');
    for (const choice of state.choices) {
      const scene = journey.scenes.find(s => s.id === choice.scene)!;
      const option = scene.options.find(o => o.id === choice.option)!;
      const item = make('li'); item.append(make('strong', option.label), make('p', option.consequence)); list.append(item);
    }
    parent.append(list);
  };
  const playCafeArrival = (): void => {
    if (disposed || cafeFilm || !view) return;
    view.setFraming?.('wide'); cafeFilm = true; draw();
    void view.perform('cafe',state.inventory).finally(()=>{ if(disposed)return;cafeFilm=false;draw(); });
  };
  /** The scene's piece: drag it onto an option to decide, or press the option. A tap on the piece only opens its reading (`onTap`); it decides nothing. */
  const dragObject = (piece: HTMLButtonElement, scope: HTMLElement, onTap: () => void): void => {
    let held = false, moved = false, x0 = 0, y0 = 0;
    const under = (x: number, y: number): HTMLButtonElement | null => { piece.style.pointerEvents = 'none'; const hit = doc.elementFromPoint?.(x, y) ?? null; piece.style.pointerEvents = ''; return hit?.closest<HTMLButtonElement>('[data-option]') ?? null; };
    const aim = (target: HTMLButtonElement | null): void => { for (const option of scope.querySelectorAll<HTMLElement>('[data-option]')) option.classList.toggle('vise', option === target); };
    piece.addEventListener('pointerdown', event => { held = true; moved = false; x0 = event.clientX; y0 = event.clientY; piece.setPointerCapture?.(event.pointerId); piece.classList.add('pris'); });
    piece.addEventListener('pointermove', event => {
      if (!held) return; const dx = event.clientX - x0, dy = event.clientY - y0; if (Math.hypot(dx, dy) > 6) moved = true;
      if (moved) { piece.style.transform = `translate(${dx}px,${dy}px) rotate(-2deg)`; aim(under(event.clientX, event.clientY)); }
    });
    const release = (event: PointerEvent): void => {
      if (!held) return; held = false; piece.classList.remove('pris'); const target = moved ? under(event.clientX, event.clientY) : null; piece.style.transform = ''; aim(null);
      if (target && !target.disabled) target.click(); else if (!moved) onTap();
    };
    piece.addEventListener('pointerup', release); piece.addEventListener('pointercancel', () => { held = false; moved = false; piece.style.transform = ''; piece.classList.remove('pris'); aim(null); });
    // Keyboard and assistive tech press the button without pointer events (detail 0).
    piece.addEventListener('click', event => { if (event.detail === 0) onTap(); });
  };
  /** The help card (object in the decor) is a paper: it leaves the picture, shows as a small tab, opens on touch over the picture, closes on touch. */
  const gatherCard = (): void => {
    const card = host.querySelector<HTMLElement>('.scene-consequence'); host.dataset['hasCard'] = String(Boolean(card && !card.hidden && card.dataset['visual']));
    if (!card) return;
    if (card.parentElement !== host) host.append(card);
    if (card.dataset['paper'] === '1') return; card.dataset['paper'] = '1';
    let wasOpen = false;
    card.addEventListener('click', () => { wasOpen = card.dataset['open'] === 'true'; }, true);
    card.addEventListener('click', event => { if (wasOpen && !(event.target as HTMLElement).closest('.prop-close')) card.querySelector<HTMLButtonElement>('.prop-close')?.click(); });
  };
  let syncView = ():void => {};
  /** Last values shown in the short-form bar, to flash only what a gesture changed. */
  let shown: Record<string, string> = {};
  const draw = (focus = false): void => {
    const originalScene = journey.scenes.find(s => s.id === (travel?.fromScene ?? state.scene))!;
    const scene = narrativeScene(id, originalScene, state);
    const lived=journeyConsequences(id,state);
    const physical=journeyMaterial(id,state,scene.location)??lived.at(-1)??null;
    const subjectVisible=(id==='w01'&&scene.speaker==='ESTEBAN')||(id==='w02'&&scene.speaker==='SORAYA');
    const place = journey.locations.find(l => l.id === scene.location)!;
    host.dataset['ended'] = String(Boolean(scene.ending));
    host.dataset['scene'] = scene.id; host.dataset['location'] = place.id; host.dataset['modal'] = modal;
    host.dataset['sceneLight']=journeyLighting(id,place.id,scene.id,state.choices);
    host.dataset['busy']=String(acting||travel!==null||paintWaiting());
    if(scene.ending){host.dataset['ending']=scene.id;host.dataset['endingKind']=scene.ending;}else{delete host.dataset['ending'];delete host.dataset['endingKind'];}
    const short=journey.short;
    if(short)host.dataset['short']='true';
    const moral=short?null:moralCard(doc,id,scene.id,state.choices.at(-1));
    scenePiece?.closeReading(); scenePiece = null; for (const timer of printTimers.splice(0)) clearTimeout(timer);
    hud.replaceChildren();
    const header = make('header', '', 'journey-header');
    const identity = make('div', '', 'journey-identity'); identity.append(make('span', 'LIFE 3.0'), make('h1', place.name, 'journey-location'), make('p', ctx.i18n.t(`world.${id}.name`)));
    identity.append(make('p',moralMoments[id].rule,'moral-world-rule'));
    identity.querySelector('.journey-location')!.setAttribute('data-ui', 'current-location');
    const nav = make('nav'); nav.setAttribute('aria-label', 'Parcours'); nav.append(button('Menu', () => { modal = 'pause'; draw(true); }));
    explorationReturn(ctx, nav);
    header.append(identity, nav); hud.append(header);
    let barNode: HTMLElement | null = null;
    const unitName=journey.resource.name.toLowerCase();
    const unit=(n:number):string=>resourceUnit(journey.resource.name,n);
    {
      // The resource and what the player carries stay in view on every scene, in every world, never folded away.
      const bar=make('aside','','short-bar');bar.setAttribute('aria-label','Où tu en es');
      const purse=make('div','','short-purse');purse.dataset['ui']='short-purse';purse.dataset['resource']=String(state.resource);purse.setAttribute('aria-label',`${state.resource} ${unit(state.resource)}`);
      purse.classList.toggle('rouge',state.resource<0);purse.append(make('b',String(state.resource),'rond'),make('small',unit(state.resource)));
      const carried=make('div','','short-objects');carried.dataset['ui']='short-objects';
      for(const item of short?state.inventory.filter(entry=>short.objects.includes(entry)):state.inventory)carried.append(make('span',item));
      const parts:Record<string,HTMLElement>={purse,objects:carried};
      const values:Record<string,string>={purse:String(state.resource),objects:carried.textContent??''};
      if(short){
        const spent=Math.min(elapsed(journey,state),short.clock.limit),left=short.clock.limit-spent,now=short.clock.from+spent;
        const clock=make('div','','short-clock');clock.dataset['ui']='short-clock';
        const gauge=doc.createElement('meter');gauge.min=0;gauge.max=short.clock.limit;gauge.value=left;gauge.setAttribute('aria-label','Temps restant');
        clock.append(make('strong',`${Math.floor(now/60)} h ${String(now%60).padStart(2,'0')}`),gauge,make('small',short.clock.deadline));
        const companion=make('p',`${short.companion.name} ${companionMood(journey,state)}`,'short-companion');companion.dataset['ui']='short-companion';
        bar.append(clock,purse,companion,carried);
        parts['clock']=clock;parts['companion']=companion;values['clock']=String(spent);values['companion']=companion.textContent??'';
      } else { bar.dataset['plain'] = 'true'; bar.append(purse,carried); }
      barNode=bar;
      for(const key of Object.keys(values))if(shown[key]!==undefined&&shown[key]!==values[key])parts[key]!.classList.add('short-flash');
      shown=values;
    }
    const mission = make('aside', '', 'journey-mission'); mission.setAttribute('aria-label', 'Mission');
    mission.append(make('small', scene.ending ? 'BILAN DE MISSION' : 'MISSION'), make('strong', journey.mission), make('p', scene.objective));
    if(moral&&!scene.ending)mission.replaceChildren(moral);
    if(host.dataset['sceneLight']==='infrared')mission.prepend(make('small','COURANT COUPÉ · VISION INFRAROUGE','moral-power')); 
    const orientation = make('div', '', 'lived-orientation');
    orientation.append(make('strong', journey.mission), make('span', scene.objective));
    orientation.setAttribute('aria-label', 'Ton but et ton prochain pas'); orientation.dataset['compact'] = String(state.choices.length > 0);
    if(!scene.ending)hud.append(orientation);
    const mood = scene.ending === 'success' ? 'Soulagement' : scene.ending === 'failure' ? 'Déception' : scene.ending === 'compromise' ? 'Partagé·e' : state.resource === 0 ? 'Sous tension' : state.choices.length ? 'Détermination' : 'Curiosité';
    const tone = scene.ending === 'success' ? 'success' : scene.ending === 'failure' ? 'failure' : scene.ending === 'compromise' || state.resource === 0 ? 'warning' : state.choices.length ? 'hope' : 'curious';
    syncView=()=>{
      view?.pause?.(modal !== 'none' || doc.hidden);
      view?.setSpeaker?.(scene.ending ? '' : scene.speaker);
      view?.setConsequence?.(physical?{...physical,companion:subjectVisible?physical.companion:undefined}:null); gatherCard();
      view?.setEmotion(modal === 'none' && !travel ? mood : '', tone, feedback || 'Un monde à découvrir');
    };
    syncView();
    // Consequences stay beside the next action, not in a second floating panel.
    if (!persistent) hud.append(make('p', 'Sauvegarde indisponible. Garde cet onglet ouvert pour continuer cette partie.', 'journey-storage'));
    const panel = make('section', '', scene.ending ? 'journey-panel journey-ending' : 'journey-panel');
    panel.setAttribute('aria-label', scene.title);
    const spoken=short||scene.text!==originalScene.text?null:scene.id===moralMoments[id].scene?moralMoments[id].voice:spokenLine(id,scene.id,scene.text);
    panel.dataset['voice']=spoken?'speech':'narration';
    if (/ORACLE|CUVE|GARDIEN|GATEKEEPER|PROTECTEUR|ARCHIV|LECTEUR|REGISTRE|TERMINAL|SYSTÈME|ASSISTANT|IA\b/i.test(scene.speaker)) panel.dataset['machine'] = 'true';
    if (!scene.ending) {
      const context = make('header', '', 'journey-context');
      context.append(make('small', short||spoken?scene.speaker:`LA SCÈNE · ${scene.speaker}`, 'journey-speaker'), make('h2', reviews[id]?.[scene.id]?.title ?? scene.presentation?.incident ?? scene.title, 'journey-scene-title'));
      panel.append(context);
      // Before the first gesture the world is told here, in grey: no window to close.
      if (!state.choices.length) {
        const intro = make('div', '', 'journey-intro'); intro.dataset['ui'] = 'journey-intro'; intro.dataset['ink'] = 'told';
        for (const line of short ? short.intro : [journey.resource.explanation]) intro.append(make('p', line, 'short-intro'));
        panel.append(intro);
      }
      if (feedback) { const outcome = make('p', feedback, 'journey-feedback'); outcome.setAttribute('role', 'status'); panel.append(outcome); if(impact?.changes.length)panel.append(make('small',impact.changes.join(' · '),'lived-changes')); }
      if (told.length) { const aside = make('p', told.join(' '), 'journey-told'); aside.dataset['ink'] = 'told'; panel.append(aside); }
      // A decision's reasons and constraints must be visible before choosing.
      // Optional encounters keep their extra descriptive material in the notebook.
      const optional = !short && Boolean(scene.interludeFor) && scene.text === originalScene.text;
      const sentences = scene.text.split(/(?<=[.!?])\s/);
      panel.append(lineNode(optional ? `${scene.id === journey.start ? moralMoments[id].context + ' ' : ''}${spoken ?? sentences.slice(0, 3).join(' ')}` : scene.text));
      if (optional) { const more = make('details', '', 'journey-more'); more.append(make('summary', 'Prendre le temps d’écouter')); more.append(make('p', scene.text)); panel.append(more); }
    }
    if (scene.ending) {
      // One screen: outcome, what was obtained, what it cost, the resource, the two ways on. The full sheet is one optional press away.
      const verdict = scene.ending === 'success' ? 'Objectif atteint' : scene.ending === 'compromise' ? 'Objectif atteint en partie' : 'Objectif non atteint';
      const title = make('h2', reviews[id]?.[scene.id]?.title ?? scene.presentation?.incident ?? scene.title, 'journey-scene-title'); title.dataset['ui'] = 'end-title';
      const outcomeLine = make('p', '', 'end-outcome'); outcomeLine.dataset['ui'] = 'end-outcome'; outcomeLine.append(make('strong', verdict), doc.createTextNode(` ${scene.text}`));
      const section = (ui: string, heading: string, lines: [string, string][], none: string): HTMLElement => {
        const box = make('section', '', 'end-block'); box.dataset['ui'] = ui; box.append(make('h3', heading));
        const list = make('ul', '', 'end-list');
        for (const [who, what] of lines.length ? lines : [['', none] as [string, string]]) { const item = make('li'); if (who) item.append(make('b', who), doc.createTextNode(' ')); item.append(make('span', what)); list.append(item); }
        box.append(list); return box;
      };
      const obtained: [string, string][] = lived.length ? lived.map(f => [f.label, f.detail]) : state.inventory.map(item => [item, '']);
      const paid: [string, string][] = short ? shortCosts(id, state, scene.id) : state.choices.flatMap(c => { const o = journey.scenes.find(x => x.id === c.scene)?.options.find(x => x.id === c.option); return o?.cost ? [[o.label, `−${o.cost} ${unit(o.cost)}`] as [string, string]] : []; });
      const grid = make('div', '', 'end-grid');
      grid.append(section('end-gained', 'Ce que tu as obtenu', obtained, 'Rien de nouveau entre tes mains.'), section('end-cost', 'Ce que ça a coûté', paid, `Aucun coût en ${unitName}.`));
      const resource = make('p', '', 'end-resource'); resource.dataset['ui'] = 'end-resource'; resource.dataset['resource'] = String(state.resource);
      resource.append(make('b', journey.resource.name), doc.createTextNode(` : ${journey.resource.initial} → ${state.resource}`));
      // The end prints as a paper receipt, one line after the other (the first time only; a redraw shows it whole).
      const paper = make('div', '', 'ticket-fin'); paper.dataset['ui'] = 'end-ticket'; paper.append(title, outcomeLine, grid, resource);
      const win = doc.defaultView; const lines = [title, outcomeLine, ...grid.querySelectorAll<HTMLElement>('li'), resource]; const printing = printedEnding !== scene.id && typeof paper.animate === 'function' && !win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      lines.forEach((line, index) => { line.classList.add('imprime'); line.style.setProperty('--i', String(index)); if (printing) printTimers.push(setTimeout(() => sound.line(), 120 + index * 220)); });
      paper.dataset['printing'] = String(printing); printedEnding = scene.id; panel.append(paper);
      const next = make('nav', '', 'life-next'); next.setAttribute('aria-label', 'Et maintenant ?');
      const explore = button('Explorer un autre monde', () => { explorer?.dispose(); explorer = openExploration(host, ctx, run); }); explore.dataset['ui'] = 'explore';
      const replay = button('Rejouer ce monde', () => { state = startJourney(journey); travel = null; feedback = ''; impact = null; told = []; shown = {}; settle(); told = []; persist(); view?.show(journey.scenes.find(s => s.id === state.scene)!.location, state.inventory); draw(true); }); replay.dataset['ui'] = 'replay';
      next.append(explore, replay); panel.append(next);
      const sheet=lifeSheet(doc, run, { world: ctx.i18n.t(`world.${id}.name`), outcome: verdict, mission: journey.mission, arrivalStep: ctx.core.engine.steps.arrivalStep, resource: { name: journey.resource.name, initial: journey.resource.initial, final: state.resource }, consequences:lived, moments: state.choices.map(choice => { const past = journey.scenes.find(s => s.id === choice.scene)!; const option = past.options.find(o => o.id === choice.option)!; return { title: option.label, text: option.consequence }; }) });
      const fold = make('details', '', 'short-sheet'); fold.dataset['ui'] = 'end-sheet'; fold.append(make('summary', 'Ma fiche de vie'), sheet, presentComparisons(doc, journey.question));
      const method = make('details', '', 'life-method'); method.append(make('summary', 'Comprendre le modèle et mes réponses de départ')); explain(method); fold.append(method);
      const more = make('nav', '', 'life-more'); more.append(button('Les douze futurs', () => { modal = 'worlds'; draw(true); }), button('Changer mes réponses de 2026', () => { resetDraft(); void ctx.navigate('questionnaire', undefined); }));
      const atlasButton = button(ctx.i18n.t('atlas.open'), () => { void ctx.navigate('atlas', { arrival: id, back: { id: 'street', run } }); }); atlasButton.dataset['ui'] = 'open-atlas'; const out = make('nav', '', 'life-out'); out.setAttribute('aria-label', 'Atlas et contact'); out.append(atlasButton, createContactLink(ctx.i18n, 'life-contact', doc));
      fold.append(more); panel.append(out, fold); hud.append(panel);
    } else {
      panel.append(make('small', 'À toi de choisir', 'journey-options-label'));
      const options = make('div', '', 'journey-options');
      for (const option of scene.options) {
        const reason = blockedReason(state, option, journey);
        if (option.hideWhenBlocked && reason !== null) continue;
        const b = button(option.label, () => {
          if (disposed || acting || marking || modal !== 'none' || travel || state.scene !== scene.id) return;
          sound.pose();
          const go = (): void => {
            if (disposed) return; marking = false;
            const before = state;
            const next = decide(journey, state, option.id); if (next === state) { draw(); return; }
            state = next; feedback = option.consequence; told = []; settle(); view?.react?.();
            const delta = state.resource - before.resource;
            impact={action:option.label,text:option.consequence,changes:[...(delta?[`${delta>0?'+':''}${delta} ${resourceUnit(journey.resource.name,delta)}`]:[]),...state.inventory.filter(item=>!before.inventory.includes(item)).map(item=>`Acquis · ${item}`),...before.inventory.filter(item=>!state.inventory.includes(item)).map(item=>`Cédé · ${item}`)]};
            const destination = journey.scenes.find(s => s.id === state.scene)!.location;
            if (destination === scene.location) { persist(); draw(true); return; }
            // The selected intention already authorizes this destination. Do not ask
            // for the same movement again; retain an explicit route during arrival.
            travel = { fromScene: scene.id, stage: 'moving' }; acting = true; persist(); draw();
            const arrival = view?.perform(destination, state.inventory) ?? Promise.resolve();
            void arrival.then(() => {
              if (disposed) return;
              acting = false; travel = null; persist(); draw(true);
            }, () => {
              if (disposed) return;
              acting = false; travel = { fromScene: scene.id, stage: 'ready' }; persist(); draw(true);
            });
          };
          // The choice is put on the piece first (stamp, reply sent, card turned), then the decision is applied.
          const wait = scenePiece?.mark(option.label) ?? null;
          if (!wait) { go(); return; }
          marking = true; for (const other of host.querySelectorAll<HTMLButtonElement>('[data-option]')) other.disabled = true;
          void wait.then(go);
        });
        b.setAttribute('aria-label', option.label);
        const target = journey.scenes.find(nextScene => nextScene.id === option.next)!;
        const targetPlace = journey.locations.find(location => location.id === target.location)!;
        b.dataset['option'] = option.id; b.dataset['locked'] = reason !== null ? '1' : '0'; b.disabled = acting || reason !== null || paintWaiting();
        // Label on its own line; under it, one row: the price (before the gesture, in the world's own resource, "0" when free), then what it asks or why it is blocked.
        b.textContent = ''; b.append(make('span', option.label, 'option-label'));
        const meta = make('span', '', 'option-meta');
        const price = `Prix : ${[short && option.minutes ? `${option.minutes} min` : '', option.cost ? `−${option.cost} ${unit(option.cost)}` : `0 ${unit(0)}`].filter(Boolean).join(' · ')}`;
        const tag = make('small', price, 'short-price option-price'); tag.dataset['price'] = price; meta.append(tag);
        if (option.gain) meta.append(make('small', `Gain : +${option.gain} ${unit(option.gain)}`, 'option-gain'));
        const needs = reason === null ? option.require ?? [] : [];
        if (needs.length) meta.append(make('small', `Requiert : ${needs.join(', ')}`, 'option-require'));
        if (reason) meta.append(make('small', reason.startsWith(journey.resource.name) ? `Pas assez de ${unitName}` : reason.replace(/\.$/, ''), 'short-blocked'));
        if (!short && target.location !== scene.location) meta.append(make('small', `Vers ${targetPlace.name}`, 'journey-route-hint'));
        b.append(meta);
        options.append(b);
      }
      panel.append(options);
    }
    if (journey.id === 'w05' && scene.location === 'cafe' && !travel && !scene.ending) {
      if(cafeFilm){const skipFilm=button('Passer le plan du café',()=>view?.skip());skipFilm.dataset['action']='skip';panel.append(skipFilm);}
      const observe = make('details', '', 'journey-more'); observe.append(make('summary','Regarder le café'));
      const note = make('p'); note.setAttribute('aria-live','polite');
      for (const [shot,label,caption] of [
        ['wide','La salle et le quai','Le café donne sur la rivière. Les maisons de l’autre rive sont encore inaccessibles.'],
        ['counter','Le comptoir',state.inventory.includes('Eau vérifiée') ? 'L’eau a été vérifiée. Les premières tasses peuvent être préparées.' : 'La machine et les tasses sont là. Servir des voisins exige encore de vérifier l’eau.'],
        ['blankets','Les couvertures',state.inventory.includes('Couchages prêts') ? 'Les couvertures sont réparties : les couchages sont prêts pour la nuit.' : 'Les voisins ont apporté de quoi se couvrir. Il reste à organiser leur accueil.'],
        ['portrait','Brigitte',scene.ending ? 'Brigitte organise la suite avec les voisins, selon ce que vous avez préparé.' : 'Elle attend de savoir comment accueillir les voisins ce soir.']
      ] as const) {
        const control = button(label,()=>{view?.setFraming?.(shot);note.textContent=caption;});control.dataset['cafeShot']=shot;observe.append(control);
      }
      observe.append(button('Voir l’arrivée depuis le quai',playCafeArrival),note);panel.append(observe);
    }
    if (!scene.ending) { const stage = make('div', '', 'stage-dialogue lived-interaction'); stage.dataset['interaction']=scene.presentation?.kind??'decision'; stage.dataset['prop']=scene.presentation?.prop??'none'; stage.append(panel); hud.append(stage);
      const choices=panel.querySelector<HTMLElement>('.journey-options');const label=panel.querySelector('.journey-options-label');
      // The plateau: the resource in its round on the left; on the right the instruction (green), the scene's object (paper or metal) and the options as targets.
      const plateau = make('div', '', 'plateau'); if (barNode) plateau.append(barNode);
      const geste = make('nav', '', 'scene-choices geste'); geste.setAttribute('aria-label', 'Tes gestes');
      const consigne = make('p', scene.objective, 'consigne'); consigne.dataset['ui'] = 'consigne'; geste.append(consigne);
      const prop = scene.presentation?.prop;
      if (choices) {
        if (label) geste.append(label);
        // The scene's piece (phone screen, paper, object card) sits left of the targets. Touch opens its reading; dragging it onto a target decides.
        if (prop && prop !== 'none') {
          const piece = createPiece(doc, { prop: prop as PieceProp, sender: scene.speaker, title: scene.title, text: scene.presentation?.incident ?? scene.title }, { onTouch: () => sound.pose() });
          scenePiece = piece; plateau.append(piece.el); plateau.dataset['piece'] = prop;
          dragObject(piece.el, plateau, () => piece.openReading(host));
        }
        choices.dataset['count'] = String(choices.childElementCount);
        geste.append(choices);
      }
      plateau.append(geste); hud.append(plateau);
    } else if (barNode) hud.append(barNode);
    if (travel?.stage === 'ready') {
      panel.hidden = true; host.dataset['travelling'] = 'ready';
      for (const child of [...hud.children]) (child as HTMLElement).inert = true;
      const target = journey.scenes.find(item => item.id === state.scene)!;
      const destination = journey.locations.find(location => location.id === target.location)!;
      const overlay = make('div', '', 'journey-travel');
      const card = make('section'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', 'Changer de lieu');
      card.append(make('small', `${place.name} → ${destination.name}`, 'journey-travel-route'), make('h2', destination.name), make('p', feedback));
      const goal = make('div', '', 'journey-travel-goal'); goal.append(make('small', 'À ton arrivée'), make('p', target.objective)); if(!short)card.append(goal);
      const go = button(short?'Continuer':'Rejoindre ce lieu', () => {
        if (!travel || travel.stage !== 'ready') return;
        travel.stage = 'moving'; acting = true; draw();
        const performance = view?.perform(target.location, state.inventory) ?? Promise.resolve();
        void performance.finally(() => { if (disposed) return; acting = false; travel = null; persist(); draw(true); });
      }); go.dataset['ui'] = 'journey-travel-go'; card.append(go); overlay.append(card); hud.append(overlay); go.focus();
    } else if (!travel) delete host.dataset['travelling'];
    if (acting) {
      panel.hidden = true; host.dataset['acting'] = 'true';
      host.dataset['travelling'] = 'moving';
      const target = journey.scenes.find(item => item.id === state.scene)!;
      const destination = journey.locations.find(location => location.id === target.location)!;
      identity.append(make('p',moralMoments[id].rule,'moral-world-rule'));
    identity.querySelector('.journey-location')!.textContent = `Vers · ${destination.name}`;
      const playback = make('div', '', 'journey-playback'); playback.setAttribute('role','status'); playback.append(make('small', `${place.name} → ${destination.name}`), make('p', feedback || `Arrivée · ${destination.name}`)); const skip = button('Passer la scène', () => { view?.skip(); }); skip.dataset['action'] = 'skip'; playback.append(skip); hud.append(playback);
    } else delete host.dataset['acting'];
    if (modal !== 'none') {
      const backdrop = make('div', '', 'journey-modal-backdrop');
      const dialog = make('section', '', 'journey-modal'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', modal === 'facts' ? 'Dans le monde réel' : modal === 'welcome' ? 'Bienvenue dans ce monde' : modal === 'worlds' ? 'Les douze futurs' : modal === 'pause' ? 'Pause' : 'Carnet');
      // Make the underlying HUD inert so Tab cannot select hidden actions behind the modal.
      for (const child of [...hud.children]) (child as HTMLElement).inert = true;
      dialog.append(button('Fermer', () => { modal = 'none'; draw(true); }));
      if (modal === 'facts') {
        dialog.append(presentComparisons(doc, journey.question));
      } else if (modal === 'welcome') {
        dialog.classList.add('journey-welcome');
        if(short)dialog.append(make('small', `2030 · ${ctx.i18n.t(`world.${id}.name`)}`), make('h2', journey.title), ...short.intro.map(line=>make('p',line)));
        else dialog.append(make('small', '2030 · TON NOUVEAU QUOTIDIEN'), make('h2', ctx.i18n.t(`world.${id}.name`)), make('p', ctx.i18n.t(`world.${id}.clear`)), make('h3', 'Ta place dans ce monde'), make('p', journey.mission), make('h3', 'Ce qui rend tes choix difficiles'), make('p', journey.resource.explanation), make('h3', 'Comment jouer'), make('p', 'Choisis une action en bas de l’écran. Son coût et ses conditions sont affichés avant de décider. Les objets obtenus ouvrent de nouvelles possibilités. Ta mission reste visible, et le carnet conserve les conséquences de tes choix.'), make('p', 'Observe ton personnage entre les décisions ; tu peux passer ces scènes. Aucun chronomètre ne te pousse à répondre. À la fin, le bilan relie tes actes aux règles du monde et à tes réponses de 2026.'));
        dialog.append(button('Retour au jeu', () => { modal = 'none'; draw(true); }));
      } else if (modal === 'worlds') {
        dialog.append(make('h2', 'Les douze futurs'), make('p', 'Des scénarios possibles pour réfléchir, pas douze prédictions. Chaque monde vivant possède ici son propre parcours. Les deux extinctions conduisent à une fin dédiée.'));
        for (let n = 1; n <= 12; n++) { const w = `w${String(n).padStart(2, '0')}`; dialog.append(make('h3', ctx.i18n.t(`world.${w}.name`)), make('p', ctx.i18n.t(`world.${w}.clear`))); }
      } else if (modal === 'journal') {
        dialog.append(make('h2', 'Ton parcours'), make('p', journey.mission)); history(dialog); explain(dialog);
        const credits = make('details'); credits.append(make('summary', 'Crédits et sources'), make('p', 'Life 3.0 est le projet de Cynthia Ortu. Le cadre des scénarios est inspiré de Max Tegmark. Future of Life Institute héberge une présentation documentaire ; cet organisme n’est ni l’auteur ni l’éditeur du jeu.'));
        const link = doc.createElement('a'); link.href = 'https://futureoflife.org/ai/ai-aftermath-scenarios/'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Source documentaire externe : Future of Life Institute'; credits.append(link); dialog.append(credits);
      } else dialog.append(make('h2', 'Pause'), make('p', 'L’horloge n’avance que quand tu agis. Prends le temps de lire. Tes choix sont enregistrés automatiquement.'), button('Reprendre', () => { modal = 'none'; draw(true); }), button('Dans le monde réel', () => { modal = 'facts'; draw(true); }), button('Règles du monde', () => { modal = 'welcome'; draw(true); }), button('Carnet & mes réponses', () => { modal = 'journal'; draw(true); }), button('Les douze futurs', () => { modal = 'worlds'; draw(true); }));

      backdrop.append(dialog); hud.append(backdrop); dialog.querySelector('button')?.focus();
    } else if (focus && !travel) { const title = panel.querySelector('h2')!; title.tabIndex = -1; title.focus({ preventScroll: true }); }
    fit();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (host.inert) return;
    if (travel?.stage === 'ready') {
      if (event.key === 'Tab') { event.preventDefault(); hud.querySelector<HTMLButtonElement>('[data-ui=journey-travel-go]')?.focus(); }
      return;
    }
    if (event.key === 'Escape') { modal = modal === 'none' ? 'pause' : 'none'; draw(true); return; }
    if (event.key === 'Tab' && modal !== 'none') {
      const nodes = [...hud.querySelectorAll<HTMLElement>('.journey-modal button, .journey-modal a, .journey-modal summary')].filter(e => e.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  doc.addEventListener('keydown', onKey);
  const observingWatch = new MutationObserver(fit); observingWatch.observe(host, { attributes: true, attributeFilter: ['data-observing'] });
  const win = doc.defaultView; win?.addEventListener('resize', fit); void doc.fonts?.ready.then(() => { if (!disposed) fit(); });
  const dispose = (): void => { disposed = true; scenePiece?.closeReading(); for (const timer of printTimers.splice(0)) clearTimeout(timer); disposeSceneReading(); explorer?.dispose(); doc.removeEventListener('keydown', onKey); win?.removeEventListener('resize', fit); paintObserver.disconnect(); observingWatch.disconnect(); view?.dispose(); host.remove(); };
  draw();
  try {
    view = await (deps.view ?? createJourneyView)(sceneHost, journey);
    if (disposed) { view.dispose(); return { dispose }; }
    view.show(journey.scenes.find(s => s.id === (travel?.fromScene ?? state.scene))!.location, state.inventory);
    // Loading the renderer must never replace a button between pointerdown and pointerup.
    // The HUD already represents the latest state; only attach that state to the new view.
    syncView(); fit(); syncReady();
  } catch (error) {
    dispose(); throw new DataLoadError('fetch', 'journey/view', id, error instanceof Error ? error.message : String(error));
  }
  return { dispose };
}
