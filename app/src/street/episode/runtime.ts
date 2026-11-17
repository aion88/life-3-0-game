import {mountSceneReading} from '../../worlds/sceneReading';
import {moralMoments} from '../../worlds/moralMoments';
import {moralCard} from '../../worlds/moralView';
import { createIllustratedJourneyView } from '../../worlds/illustratedView';
import '../../worlds/dialogueStage.css';
import { lifeSheet } from '../../worlds/lifeSheet';
import { presentComparisons } from '../../worlds/presentView';
import { openExploration, explorationReturn, explorationProgressKey } from '../../worlds/exploration';
/** Short French episode using only its illustrated stage; week saves remain separate. */
import type { AppContext } from '../../app/shell';
import type { QuestionKey } from '../../shared/types';
import type { RunResult } from '../../shared/types';
import { choose, ending, optionsFor, restoreEpisode, story, freshEpisode, episodeText, episodeConsequence, episodeConsequences } from './story';
import './style.css';
import '../../worlds/readingColumn.css';
import '../../worlds/livedScene.css';
import type { DinnerFocus } from './dinnerView';
import type { FrameLoop } from '../runtime';
import { dinnerObjects, dinnerGestures, freshDinner, inspectDinner, clearDinnerObservation, type DinnerObjectId } from './dinner';
import { objectives, report, activeObjective, priceOf, priceParts, fitFrame, autoSteps, changesBetween, balance, endingKey } from './report';
import questionnaire from '../../data/questionnaire.json';
import { createContactLink } from '../../screens/feedback';

/** Mount a separately saved, reviewable short episode. */
export async function mountEpisode(ctx: AppContext, run: RunResult, root: HTMLElement, over: {frames?:FrameLoop} = {}): Promise<{dispose():void}> {
  const SAVE = explorationProgressKey(ctx, `aftermath.episode.1984.v2.${run.seed}`);
  const doc = root.ownerDocument;
  const host = doc.createElement('div'); host.className = 'episode dialogue-mode lived-scene'; root.append(host);
  const frames = over.frames ?? {request:(cb:(now:number)=>void)=>requestAnimationFrame(cb),cancel:(id:number)=>cancelAnimationFrame(id)};
  const cleanups: (() => void)[] = [() => host.remove(), mountSceneReading(host)];
  const dispose = (): void => { for (const cb of cleanups.splice(0).reverse()) cb(); };
  try {
    let saved: string | null = null; let persistent = true;
    try { saved = localStorage.getItem(SAVE); } catch { persistent = false; }
    let { state, picks } = restoreEpisode(saved);
    const hud = doc.createElement('div'); hud.className = 'episode-hud'; host.append(hud);
    const moodAnchor = doc.createElement('aside'); moodAnchor.className = 'episode-head-mood'; moodAnchor.setAttribute('aria-label', 'État émotionnel'); host.append(moodAnchor);
    let dinnerState = freshDinner();
    try { const seen: unknown = JSON.parse(localStorage.getItem(`${SAVE}.dinner`) ?? '[]'); if (Array.isArray(seen)) for (const id of seen) if (typeof id === 'string') dinnerState = inspectDinner(dinnerState, id); dinnerState = clearDinnerObservation(dinnerState); } catch { /* Optional observations do not invalidate the episode. */ }
    const reducedMotion = doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
    const names: Record<string, string> = { 'place.cabine': 'La cabine de soins', 'street.mid': 'Au pied de l’immeuble', 'unit.9-B': 'Chez Marlène · Appartement 9-B', 'unit.9-D': 'Ton appartement · 9-D', 'stairs.9': 'Le palier du neuvième', 'door.9-B': 'La porte de Marlène', 'anchor.cp.head': 'Le contrôle du Registre', 'room.audition': 'La salle d’audition', 'anchor.stall.front': 'L’étal de Nadia' };
    const illustrated = await createIllustratedJourneyView(host, {id:'w10',title:'1984',locations:Object.entries(names).map(([id,name])=>({id,name}))});
    cleanups.push(() => illustrated.dispose()); host.classList.add('episode-illustrated');
    let illustratedLocation = '';
    let travelAction = ''; let travelFrom = '';
    let travelling = false; let sourceOpen = false; let scenariosOpen = false; let paused = false;
    let rulesOpen = false; let menuOpen = false; let observeOpen = false;
    let cameraScene = ''; let cameraFocus: DinnerFocus = 'wide'; let introElapsed = 0;
    let last = 0; let raf = 0; let disposed = false;
    const el = (tag: string, text: string, cls = ''): HTMLElement => { const e = doc.createElement(tag); e.textContent = text; e.className = cls; return e; };
    const button = (label: string, action: () => void): HTMLButtonElement => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', action); return b; };
    // Cost in amber, gain in white, on one line; the whole line is also in data-price.
    const priceLine = (option: { trust?: number; exposure?: number }): HTMLElement => {
      const line = el('small', '', 'episode-price'); line.dataset['price'] = priceOf(option);
      const { cost, gain } = priceParts(option);
      if (cost.length || !gain.length) line.append(el('span', `Prix : ${cost.length ? cost.join(' · ') : '0'}`, 'episode-cost'));
      if (gain.length) line.append(el('span', `Gain : ${gain.join(' · ')}`, 'episode-gain'));
      return line;
    };
    const persist = (): void => { try { localStorage.setItem(SAVE, JSON.stringify(picks)); } catch { persistent = false; } };
    // The gesture's effect and the lines told without a press stay in the flow: nothing to close, nothing to wait for.
    let impact: { action: string; text: string; changes: string[] } | null = null;
    let told: { speaker: string; actor: string; text: string; effect: string }[] = [];
    let flash: string[] = [];
    const settle = (): void => {
      const auto = autoSteps(state); if (!auto.steps.length) return;
      for (const step of auto.steps) {
        const taken = optionsFor(step.before).find(o => o.id === step.option)!;
        told.push({ speaker: story[step.scene]!.speaker, actor: story[step.scene]!.actor ?? '', text: episodeText(step.before), effect: taken.memory ?? taken.memories?.join(' ') ?? '' });
        picks.push(step.option);
      }
      state = auto.state; persist();
    };
    // An ending is a report where the player stands, not an unchosen journey home.
    const currentScene = (): (typeof story)[string] => {
      const scene=story[state.scene]!;
      if(state.scene!=='end')return scene;
      const previous=story[state.history.at(-1)??''];
      return previous?{...scene,place:previous.place}:scene;
    };
    const commit = (id: string): void => {
      if (travelling || paused || rulesOpen || sourceOpen || scenariosOpen) return;
      const next = choose(state, id); if (next === state) return;
      const oldPlace = currentScene().place;
      travelAction = optionsFor(state).find(option => option.id === id)?.label ?? '';
      travelFrom = names[oldPlace] ?? oldPlace;
      const before = state; told = [];
      const memory = next.memories.slice(state.memories.length).join(' ');
      state = next; picks.push(id); persist(); settle();
      const changes = changesBetween(before, state); flash = changes.length ? [...(state.trust !== before.trust ? ['trust'] : []), ...(state.exposure !== before.exposure ? ['exposure'] : [])] : [];
      impact = { action: travelAction, text: memory || 'Rien ne change pour l’instant.', changes };
      illustrated.react?.();
      const nextPlace = currentScene().place;
      if (oldPlace !== nextPlace) travelling = true;
      draw(true);
      if (travelling) {
        void illustrated.perform(nextPlace, [], () => {
          if(disposed)return;
          illustratedLocation = nextPlace;
          // Switch the interlocutor on the exact frame that changes the backdrop.
          draw();
        }).then(() => {
          if(disposed)return;
          travelling = false; draw(true);
        }, () => {
          if(disposed)return;
          travelling = false; draw(true);
        });
      }
    };
    const inspect = (id: DinnerObjectId): void => {
      impact=null;
      dinnerState = inspectDinner(dinnerState, id); illustrated.react?.(); cameraFocus = id; introElapsed = 8000;
      try { localStorage.setItem(`${SAVE}.dinner`, JSON.stringify(dinnerState.seen)); } catch { persistent = false; }
      draw(true);
    };
    const render = (focus = false): void => {
      let signalsEl: HTMLElement | null = null; let camerasNav: HTMLElement | null = null;
      const s = currentScene(); host.dataset['ended'] = String(state.scene === 'end' && !paused && !travelling && !sourceOpen && !scenariosOpen && !rulesOpen); hud.replaceChildren(); hud.dataset['scene'] = state.scene;
      const atDinner = state.scene === 'dinner' && !travelling;
      const atTable = s.place === 'unit.9-B' && !travelling;
      if (cameraScene !== state.scene) {
        cameraScene = state.scene;
        cameraFocus = state.scene === 'dinner' ? 'wide' : state.scene === 'request' ? 'player' : 'marlene';
        introElapsed = state.scene === 'dinner' ? 0 : 8000;
      }
      host.dataset['dinner'] = String(atDinner);
      moodAnchor.hidden = rulesOpen || sourceOpen || scenariosOpen;
      const top = el('header', '', 'episode-top');
      const brand = el('div', 'LIFE 3.0', 'episode-brand'); brand.append(el('small', '1984 · La place de ton frère'));
      const locationName = el('strong', `${travelling ? 'Vers · ' : ''}${names[s.place] ?? 'Le quartier · Au pied de l’immeuble'}`, 'episode-location'); locationName.dataset['ui'] = 'current-location'; brand.append(locationName);
      const chapters = el('div', '', 'episode-chapters');
      ['Retrouver les tiens', 'Intervenir', 'Assumer'].forEach((name, i) => { const c = el('span', `${i + 1}  ${name}`); if (s.chapter === i + 1) c.setAttribute('aria-current', 'step'); chapters.append(c); });
      const lastMoral=state.scene==='return'&&state.history.at(-1)==='evidence'?{scene:'evidence',option:state.memories.includes('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.')?(state.memories.includes('Tu as conservé la voix de ton frère.')?'witness_voice':'witness'):state.memories.includes('Tu as conservé la voix de ton frère.')?'voice_only':'close_file'}:undefined;
      const moral=moralCard(doc,'w10',state.scene,lastMoral);
      brand.append(el('p',moralMoments.w10.rule,'moral-world-rule'));
      // On a phone the three tools sit behind one Menu button (hidden on large screens by CSS).
      const menuToggle = button(menuOpen ? 'Fermer' : 'Menu', () => { menuOpen = !menuOpen; draw(); }); menuToggle.className = 'episode-menu-toggle'; menuToggle.dataset['ui'] = 'episode-menu'; menuToggle.setAttribute('aria-expanded', String(menuOpen));
      top.append(brand, chapters, menuToggle, button(paused ? 'Reprendre' : 'Pause', () => { paused = !paused; draw(); })); hud.append(top);
      const goal = el('aside', '', 'episode-goals'); goal.setAttribute('aria-label', 'Ton parcours'); const objectiveList = objectives(state);
      if(state.scene !== 'end') {
        const orientation=el('aside','','lived-orientation');orientation.setAttribute('aria-label','Ton but et ton prochain pas');orientation.dataset['ui']='episode-orientation';
        orientation.append(el('small','TON BUT'),el('strong','Suspendre le transfert de ton frère sans dénoncer ta mère.'),el('span',travelling?`Prochain lieu · ${names[s.place]??s.place}`:activeObjective(state)));
        hud.append(orientation);
      }
      const allGoals = el('details', ''); allGoals.append(el('summary', 'Mon parcours')); for (const item of objectiveList) allGoals.append(el('p', `${item.status} : ${item.label}`)); goal.append(allGoals);if(moral)goal.replaceChildren(moral); hud.append(goal);
      const tools = el('nav', '', 'episode-tools'); tools.setAttribute('aria-label', 'Carnet et contexte'); tools.dataset['open'] = String(menuOpen);
      explorationReturn(ctx, tools);
      tools.append(button('Dans le monde réel', () => { sourceOpen = true; menuOpen = false; draw(); }));
      tools.append(button('Repères du monde', () => { rulesOpen = true; menuOpen = false; draw(); }));
      tools.append(button(sourceOpen ? 'Fermer le carnet' : 'Carnet & contexte', () => { sourceOpen = !sourceOpen; menuOpen = false; draw(); })); hud.append(tools);
      const betrayed = state.memories.includes('Tu as signalé Marlène.');
      const opposition = state.memories.includes('Tu as signé une opposition : transfert de ton frère suspendu 48 heures, sortie personnelle retenue.');
      const mood = betrayed ? 'Culpabilité' : state.scene === 'end' ? opposition ? 'Soulagé·e' : 'Impuissance' : state.scene === 'evidence' ? 'Sous pression' : state.scene === 'confession' ? 'Bouleversé·e' : state.scene === 'request' ? 'Hésitation' : state.exposure >= 3 ? 'Sous tension' : atDinner && dinnerState.current === 'basil' ? 'Nostalgie' : 'Inquiétude';
      moodAnchor.dataset['tone'] = betrayed ? 'danger' : opposition ? 'hope' : 'warning';
      moodAnchor.textContent = mood;
      moodAnchor.title = state.memories.at(-1) ?? 'Tu découvres le quartier.';
      host.dataset['resource'] = `trust:${state.trust};exposure:${state.exposure}`;
      if (state.scene === 'end') host.dataset['ending'] = endingKey(state); else delete host.dataset['ending'];
      if(state.scene !== 'end') {
        // The resource is always on screen and moves in live: nothing folded away.
        const signals = el('div', '', 'episode-signals'); signals.setAttribute('role', 'status'); signals.setAttribute('aria-label', 'Confiance de Marlène et exposition au Registre'); signals.dataset['ui'] = 'episode-signals'; signals.dataset['resource'] = host.dataset['resource']!;
        const gauges: [string, string, string, string][] = [['trust', 'Confiance', String(state.trust), betrayed ? 'Tu as dénoncé Marlène' : state.trust < 0 ? 'Lien fragilisé' : state.trust > 0 ? 'Confiance renforcée' : 'Marlène attend de te parler'], ['exposure', 'Exposition', `${state.exposure}/3`, state.exposure >= 3 ? 'Prochain déplacement contrôlé' : 'Le Registre te contrôle dès 3']];
        for (const [key, label, value, hint] of gauges) { const item = el('span', '', 'episode-signal'); item.dataset['signal'] = key; item.title = hint; item.append(el('small', label), el('strong', value)); if (flash.includes(key)) item.dataset['flash'] = 'true'; signals.append(item); }
        signalsEl = signals; flash = [];
      }
      if (!travelling && illustratedLocation !== s.place) { illustrated.show(s.place, []); illustratedLocation = s.place; }
      illustrated.pause?.(paused || sourceOpen || scenariosOpen || rulesOpen);
      illustrated.setEmotion(rulesOpen || sourceOpen || scenariosOpen || paused ? '' : mood, moodAnchor.dataset['tone'] ?? 'warning', moodAnchor.title);
      if(!travelling || illustratedLocation === s.place) { const actor = told.at(-1)?.actor || s.actor; illustrated.setSpeaker?.(state.scene === 'end' ? '' : actor === 'marlene' ? 'MARLÈNE' : actor === 'nadia' ? 'NADIA' : s.speaker); }
      if(!travelling || illustratedLocation === s.place) illustrated.setConsequence?.(episodeConsequence(state));
      if(!travelling && !paused && !sourceOpen && !scenariosOpen && !rulesOpen) illustrated.setFraming?.(cameraFocus === 'wide' ? 'wide' : cameraFocus === 'plate' || cameraFocus === 'basil' ? 'counter' : 'portrait');
      if (rulesOpen) {
        // Optional reference, never a gate: the first decision is playable without opening it.
        const rules = el('aside', '', 'episode-notes'); rules.dataset['ui'] = 'episode-rules';
        rules.append(el('p', '2030 · 1984', 'episode-speaker'), el('h2', 'La place de ton frère'));
        rules.append(el('p', 'Tu arrives dans un quartier où un État humain utilise l’IA pour surveiller les habitants. Les services fonctionnent, mais les déplacements et les relations peuvent devenir suspects.'));
        rules.append(el('h3', 'Ce sont les tiens'), el('p', 'Marlène est ta mère. La troisième assiette est celle de ton frère, déjà présent dans la scène de l’intérim en 2026. Il est retenu et doit être transféré demain. Tu rentres dîner chez elle pour comprendre ce qui se passe et décider comment intervenir.'));
        const list = el('ul', '');
        for (const text of ['Observe les objets du dîner dans l’ordre que tu veux. Chaque détail ouvre une réaction, sans liste obligatoire à compléter.', 'Chaque geste affiche son prix avant que tu le fasses. Aucun chronomètre ne te force à décider.', 'Suis les deux jauges : la confiance de Marlène et l’exposition au regard du Registre.', 'Le carnet conserve tes gestes et relie le monde à tes réponses de 2026. Tes choix sont sauvegardés automatiquement.']) list.append(el('li', text));
        const brotherAnswer = run.answers['Q14' as QuestionKey];
        rules.append(el('h3', 'Ce que tu avais choisi en 2026'), el('p', ctx.i18n.t(`bilan.trace.Q14.${brotherAnswer}`)), list, el('p', 'Une fiction pour explorer un futur possible, pas une prédiction.', 'episode-welcome-fiction'));
        rules.append(button('Retour au quartier', () => { rulesOpen = false; draw(true); })); hud.append(rules); return;
      }
      if (!persistent) hud.append(el('p', 'Sauvegarde indisponible : cette partie restera dans cet onglet.', 'episode-save'));
      if (scenariosOpen) {
        const catalogue = el('aside', '', 'episode-notes'); catalogue.append(el('h2', 'Les douze futurs de Life 3.0'), el('p', 'Voici les mondes du jeu. Leurs situations vécues sont des adaptations fictionnelles, pas des prévisions.'));
        for (let i = 1; i <= 12; i++) { const id = `w${String(i).padStart(2, '0')}`; catalogue.append(el('h3', ctx.i18n.t(`world.${id}.name`)), el('p', ctx.i18n.t(`world.${id}.clear`))); }
        catalogue.append(button('Retour', () => { scenariosOpen = false; draw(); })); hud.append(catalogue); return;
      }
      if (sourceOpen) {
        const notes = el('aside', '', 'episode-notes'); notes.append(presentComparisons(doc)); notes.append(el('h2', 'Ce que tu emportes'));
        const list = el('ul', ''); for (const id of dinnerState.seen) { const item = dinnerObjects.find(o => o.id === id)!; list.append(el('li', `${item.label} : ${item.reaction}`)); } for (const memory of state.memories) list.append(el('li', memory)); notes.append(list);
        notes.append(el('h3', 'Une fiction pour poser une question'), el('p', 'Ce quartier est une hypothèse narrative, pas une prédiction. Le bracelet, le sort de ton frère et le rôle de ta mère sont inventés pour cette fiction. Le scénario explore la concentration du pouvoir permise par une IA de surveillance.'), el('p', 'Le cadre des futurs possibles vient des scénarios de Life 3.0, essai de Max Tegmark. Ce parcours ne démontre ni leur probabilité ni leur inévitabilité.'));
        notes.append(button('Découvrir les douze scénarios', () => { scenariosOpen = true; draw(); }));
        notes.append(el('h3', 'Ton frère, de 2026 à 2030'), el('p', `Dans « ${ctx.i18n.t('q.Q14.title')} », tu avais choisi : « ${ctx.i18n.t(`q.Q14.${run.answers['Q14' as QuestionKey]}.label`)} ».`), el('p', ctx.i18n.t(`bilan.trace.Q14.${run.answers['Q14' as QuestionKey]}`)), el('p', 'Tu retrouves le frère du questionnaire dans cette histoire. Son transfert est une situation écrite pour explorer le régime ; ce n’est pas une punition calculée pour cette réponse.'));
        notes.append(el('h3', 'Ton questionnaire et ce quartier'));
        const answer = run.answers['Q11' as QuestionKey];
        notes.append(el('p', `En 2026, à « ${ctx.i18n.t('q.Q11.title')} », tu as choisi : ${ctx.i18n.t(`q.Q11.${answer}.label`)}`));
        const push = questionnaire.questions.find(q => q.key === 'Q11')?.answers.find(a => a.key === answer)?.push;
        if (push) notes.append(el('p', `Dans le modèle du jeu, cette réponse modifie notamment la surveillance de ${push.surveillance > 0 ? '+' : ''}${push.surveillance} et la liberté de ${push.freedom > 0 ? '+' : ''}${push.freedom}. Les autres réponses se combinent à elle : ce n’est pas une cause unique.`));
        notes.append(el('p', answer === 'B' ? 'Tu avais refusé la reconnaissance en direct. Ce contrôle contredit donc ta préférence : ce monde te confronte aussi aux décisions d’un régime que tu n’as pas choisi.' : answer === 'A' ? 'Tu avais demandé des garanties et des audits. Au portique, tu rencontres précisément leur absence : demander un recours humain devient un obstacle concret.' : 'Tu avais accepté un déploiement sans limites. Le portique prolonge cette logique de contrôle jusque dans tes déplacements et tes relations.'));
        if (run.outcome.kind === 'arrival') notes.append(el('p', `Destination calculée par tes réponses : ${ctx.i18n.t(`world.${run.outcome.computedWorld}.name`)}. Tu joues dans le monde calculé par tes réponses. Le contrôle et l’absence de recours mettent en scène ses institutions ; ils ne découlent pas de ta seule réponse sur les caméras.`));
        const credits = el('details', ''); credits.append(el('summary', 'Crédits et sources documentaires'), el('p', 'Life 3.0 est le projet de Cynthia Ortu. Le cadre des scénarios est inspiré de Max Tegmark. Future of Life Institute héberge une présentation de référence ; ce site n’est ni l’auteur ni l’éditeur de ce jeu.'));
        const a = doc.createElement('a'); a.href = 'https://futureoflife.org/ai/ai-aftermath-scenarios/'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Source documentaire externe : Future of Life Institute'; credits.append(a); notes.append(credits, button('Retour au quartier', () => { sourceOpen = false; draw(true); })); hud.append(notes); return;
      }
      if (atTable && !paused) {
        const cameras = el('nav', '', 'episode-cameras'); cameras.setAttribute('aria-label', 'Point de vue');
        for (const [id,label] of [['wide','Plan large'],['marlene','Ta mère'],['player','Ton personnage']] as const) {
          const control = button(label, () => { cameraFocus = id; introElapsed = 8000; draw(); }); control.dataset['camera'] = id; control.setAttribute('aria-pressed', String(cameraFocus === id)); cameras.append(control);
        }
        if (state.scene === 'dinner' && introElapsed < 8000 && !reducedMotion) { const skip=button('Passer le plan d’arrivée', () => { introElapsed = 8000; cameraFocus = 'marlene'; draw(); });skip.dataset['ui']='dinner-intro-skip';cameras.append(skip); }
        if (state.scene === 'dinner' && introElapsed >= 8000) cameras.append(button('Revoir les plans', () => { introElapsed = 0; cameraFocus = 'wide'; draw(); }));
        hud.append(cameras); camerasNav = cameras;
        if (state.scene === 'dinner' && introElapsed < 8000 && !reducedMotion) {
          const captions = { wide: 'Chez Marlène · Le dîner attend', window: 'Dans la cour, les autres continuent leur soirée.', plate: 'Trois couverts. Ton frère devait être là.', marlene: 'Ta mère attend de pouvoir te parler.' };
          const caption = el('p', captions[cameraFocus as keyof typeof captions] ?? '', 'dinner-cinematic-caption');
          caption.dataset['ui'] = 'dinner-cinematic'; hud.append(caption);
        }
      }
      if (atDinner && !paused) {
        const exploration = el('section', '', 'dinner-exploration'); exploration.setAttribute('aria-label', 'Le dîner chez Marlène');
        const hotspots = el('div', '', 'dinner-hotspots');
        for (const object of dinnerObjects) {
          const pin = button(String(dinnerObjects.indexOf(object) + 1), () => inspect(object.id)); pin.setAttribute('aria-label', object.label); pin.title = object.label; pin.dataset['object'] = object.id; pin.tabIndex = -1;
          pin.setAttribute('aria-pressed', String(dinnerState.current === object.id)); hotspots.append(pin);
        }
        exploration.append(hotspots);
        const objects = el('nav', '', 'dinner-objects'); objects.setAttribute('aria-label', 'Observer le dîner');
        for (const object of dinnerObjects) {
          const b = button(`${dinnerObjects.indexOf(object) + 1} · ${object.label}`, () => inspect(object.id)); b.dataset['inspect'] = object.id;
          b.setAttribute('aria-pressed', String(dinnerState.current === object.id));
          if (dinnerState.seen.includes(object.id)) b.append(el('small', 'Déjà observé'));
          objects.append(b);
        }
        const reaction = el('section', '', 'dinner-reaction'); reaction.setAttribute('aria-live', 'polite');
        const observation = dinnerObjects.find(o => o.id === dinnerState.current);
        reaction.append(el('small', observation?.speaker ?? 'CHEZ TA MÈRE'), el('h1', observation?.reaction ?? 'Ton frère devait être là.'));
        if (observation) reaction.append(button('Revenir à la table', () => { dinnerState = clearDinnerObservation(dinnerState); cameraFocus = 'wide'; introElapsed = 8000; draw(true); }));
        else reaction.append(el('p', 'Le bracelet signale votre conversation. Marlène se tait : ton frère part demain, et elle a reçu son message. Restes-tu pour l’écouter ?'));
        const gestures = el('div', '', 'dinner-gestures');
        for (const gesture of dinnerGestures) {
          const b = button(gesture.label, () => commit(gesture.option)); b.dataset['gesture'] = gesture.id; b.dataset['option'] = gesture.option; b.setAttribute('aria-label', gesture.label);
          const taken = story['dinner']!.options.find(o => o.id === gesture.option);
          const price = priceLine(taken ?? {}); price.id = `episode-price-${gesture.option}`; b.setAttribute('aria-describedby', price.id);
          b.append(price, el('small', gesture.id === 'chair' ? 'Sur place · Écouter comment aider ton frère' : 'Sur place · Écourter le dîner et te protéger', 'episode-choice-place')); gestures.append(b);
        }
        if (signalsEl) reaction.prepend(signalsEl);
        const column = el('div', '', 'stage-dialogue dinner-reading'); column.append(goal, reaction, gestures);
        // One lower block (flow on a phone, transparent to layout on a large screen): points of view, objects, reaction, gestures.
        // Plans and objects are looks, not decisions: on a phone they sit behind one "Observer" button.
        const observe = el('div', '', 'episode-observe'); observe.dataset['open'] = String(observeOpen); if (camerasNav) observe.append(camerasNav); observe.append(objects);
        const observeToggle = button(observeOpen ? 'Fermer les plans' : 'Observer la pièce', () => { observeOpen = !observeOpen; draw(); }); observeToggle.className = 'episode-observe-toggle'; observeToggle.dataset['ui'] = 'episode-observe'; observeToggle.setAttribute('aria-expanded', String(observeOpen));
        const lower = el('div', '', 'episode-lower'); lower.append(observeToggle, observe, column);
        exploration.append(lower); hud.append(exploration);
        if (focus) { const h = reaction.querySelector('h1')!; h.tabIndex = -1; h.focus({preventScroll:true}); }
        return;
      }
      const panel = el('section', '', state.scene === 'end' ? 'episode-panel' : 'episode-panel episode-dialogue'); panel.setAttribute('aria-label', s.title);
      const text = episodeText(state); panel.dataset['voice']='narration';
      panel.append(el('div', paused ? 'EN PAUSE' : travelling ? 'EN CHEMIN' : `LA SCÈNE · ${s.speaker}`, 'episode-speaker'), el('h1', travelling ? `${travelFrom} → ${names[s.place] ?? s.place}` : s.title));
      if (paused) panel.append(el('p', 'Prends ton temps. Tes choix sont conservés automatiquement.'), button('Reprendre la partie', () => { paused = false; draw(true); }));
      else if (travelling) {
        panel.classList.add('episode-travel');
        panel.append(el('p', `Ton choix : ${travelAction}`, 'episode-travel-action'), el('p', `À l’arrivée · ${s.title}`, 'episode-travel-next'), button('Arriver directement', () => { illustrated.skip(); }));
      }
      else if (state.scene === 'end') {
        // One screen: the issue, what it brought, what it cost, the resources start to end, then the button.
        const bal = balance(state);
        panel.classList.add('episode-report'); panel.dataset['voice'] = 'system';
        const title = el('h1', bal.outcome); title.dataset['ui'] = 'end-outcome';
        panel.replaceChildren(el('div', 'FIN DU PARCOURS', 'episode-speaker'), title);
        for (const [ui, label, value] of [['end-gained', 'Obtenu', bal.gained], ['end-cost', 'Coûté', bal.cost], ['end-resource', 'Ressource', bal.resource]] as const) {
          const row = el('p', '', 'episode-end-line'); row.dataset['ui'] = ui; row.append(el('small', label), el('span', value)); panel.append(row);
        }
        const again = button('Rejouer autrement', () => { state = freshEpisode(); picks = []; told = []; impact = null; flash = []; dinnerState = freshDinner(); try { localStorage.removeItem(`${SAVE}.dinner`); } catch { /* Replay remains available without storage. */ } persist(); draw(true); }); again.dataset['ui'] = 'end-replay'; panel.append(again);
        const atlasButton = button(ctx.i18n.t('atlas.open'), () => { void ctx.navigate('atlas', { arrival: 'w10', back: { id: 'street', run } })}); atlasButton.dataset['ui'] = 'open-atlas'; panel.append(atlasButton, createContactLink(ctx.i18n, 'episode-contact', doc));
        const sheet = el('details', '', 'episode-sheet'); sheet.dataset['ui'] = 'end-sheet'; sheet.append(el('summary', 'Ma fiche de vie'));
        sheet.append(el('p', ending(state)), lifeSheet(doc, run, { world: '1984', outcome: activeObjective(state), mission: 'Suspendre le transfert de ton frère sans dénoncer ta mère.', arrivalStep: ctx.core.engine.steps.arrivalStep, moments: report(state), consequences: episodeConsequences(state) }), presentComparisons(doc));
        sheet.append(button('Relire mes choix', () => { sourceOpen = true; draw(); }), button('Comprendre le lien avec mes réponses de 2026', () => { sourceOpen = true; draw(); }), button('Explorer les douze scénarios', () => { const explorer = openExploration(host, ctx, run); cleanups.push(() => explorer.dispose()); }));
        panel.append(sheet);
      }
      else {
        if (impact) {
          const effect = el('div', '', 'episode-effect'); effect.dataset['ui'] = 'episode-effect'; effect.setAttribute('role', 'status');
          effect.append(el('small', 'EFFET'));
          if (impact.changes.length) effect.append(el('strong', impact.changes.join(' · '), 'episode-effect-changes'));
          effect.append(el('span', impact.text)); panel.append(effect);
        }
        if (picks.length === 0 && state.scene === 'arrival') panel.append(el('p', '2030 · Un État humain utilise l’IA pour surveiller le quartier. Une fiction, pas une prédiction.', 'episode-told episode-intro'));
        for (const line of told) { const row = el('p', '', 'episode-told'); row.append(el('small', line.speaker), doc.createTextNode(line.text + (line.effect ? ` ${line.effect}` : ''))); panel.append(row); }
        panel.append(el('p', text, 'episode-line'));
        const options = el('div', '', 'episode-options');
        for (const option of optionsFor(state)) {
          const b = button(option.label, () => commit(option.id)); b.setAttribute('aria-label', option.label); b.dataset['option'] = option.id;
          const price = priceLine(option); price.id = `episode-price-${option.id}`; b.setAttribute('aria-describedby', price.id);
          const destination = story[option.next]!;
          b.append(price, el('small', (option.next==='end'||destination.place === s.place) ? 'Sur place · La conversation continue' : `Puis → ${names[destination.place] ?? destination.place}`, 'episode-choice-place'));
          options.append(b);
        }
        panel.append(options);
      }
      if (signalsEl && state.scene !== 'end') panel.prepend(signalsEl);
      if (state.scene === 'end') hud.append(panel);
      else { const lower=el('div','','episode-lower');const stage=el('div','','stage-dialogue');stage.append(goal,panel);lower.append(stage);hud.append(lower);const choices=panel.querySelector('.episode-options');if(choices){const tray=el('nav','','scene-choices');tray.setAttribute('aria-label','Tes gestes');tray.append(el('small','À toi d’agir'),choices);lower.append(tray);}}
      if (focus) { const h = panel.querySelector<HTMLElement>('.life-hero h2, h1')!; h.tabIndex = -1; h.focus({ preventScroll: true }); }
    };
    /**
     * On a phone the picture fills exactly the height left between the objective and the gauges: the frame is as tall as that
     * window (never a blank band) and slid up so both figures stay whole. Large screens keep their own layout.
     */
    const fitImage = (): void => {
      const props = ['--iv-portrait-height', '--episode-image-top', '--episode-image-shift'];
      // The ending panel plays the part of the lower block: the picture runs down to its top edge, no dark band.
      const lowerEl = hud.querySelector<HTMLElement>('.episode-lower') ?? hud.querySelector<HTMLElement>('.episode-panel.episode-report');
      if (!lowerEl || !doc.defaultView?.matchMedia?.('(max-width:760px)').matches) { for (const p of props) host.style.removeProperty(p); return; }
      const hostTop = host.getBoundingClientRect().top;
      const orientation = hud.querySelector<HTMLElement>('[data-ui=episode-orientation]');
      const top = Math.round((orientation ?? hud.querySelector<HTMLElement>('.episode-top'))?.getBoundingClientRect().bottom ?? hostTop) - Math.round(hostTop);
      const lowerTop = Math.round(lowerEl.getBoundingClientRect().top - hostTop);
      const gauges = lowerEl.querySelector<HTMLElement>('.episode-signals');
      const visibleBottom = gauges ? Math.round(gauges.getBoundingClientRect().top - hostTop) : lowerTop;
      const observing = host.dataset['observing'] === 'true';
      const { windowHeight, shift } = fitFrame({ hostWidth: host.clientWidth, hostHeight: host.clientHeight, top, lowerTop, visibleBottom, observing });
      host.style.setProperty('--iv-portrait-height', `${windowHeight}px`); host.style.setProperty('--episode-image-top', `${top}px`); host.style.setProperty('--episode-image-shift', `${shift}px`);
    };
    const draw = (focus = false): void => { render(focus); fitImage(); };
    // "Voir la scène" flips data-observing without a redraw: the picture must grow to the bottom, then shrink back.
    const observer = new MutationObserver(() => fitImage()); observer.observe(host, { attributes: true, attributeFilter: ['data-observing'] }); cleanups.push(() => observer.disconnect());
    const onResize = (): void => fitImage(); doc.defaultView?.addEventListener('resize', onResize); cleanups.push(() => doc.defaultView?.removeEventListener('resize', onResize));
    const onKey = (e: KeyboardEvent): void => { if (host.inert || e.code !== 'Escape' || e.repeat) return; if (rulesOpen) { rulesOpen = false; draw(true); return; } if (state.scene === 'dinner' && dinnerState.current !== null && !sourceOpen && !scenariosOpen) { dinnerState = clearDinnerObservation(dinnerState); cameraFocus = 'wide'; introElapsed = 8000; draw(true); return; } if (scenariosOpen) scenariosOpen = false; else if (sourceOpen) sourceOpen = false; else paused = !paused; draw(); };
    doc.addEventListener('keydown', onKey); cleanups.push(() => doc.removeEventListener('keydown', onKey));
    const frame = (now: number): void => {
      if (disposed) return; raf = frames.request(frame);
      const dt = last === 0 ? 0 : Math.min(now - last, 100); last = now;
      if (doc.hidden || paused || sourceOpen || scenariosOpen || rulesOpen) { moodAnchor.hidden = true; return; }
      if (state.scene === 'dinner' && !travelling && !rulesOpen && introElapsed < 8000) {
        introElapsed = reducedMotion ? 8000 : Math.min(8000, introElapsed + dt);
        const nextFocus: DinnerFocus = introElapsed < 2000 ? 'wide' : introElapsed < 4000 ? 'window' : introElapsed < 6000 ? 'plate' : 'marlene';
        if (nextFocus !== cameraFocus || introElapsed === 8000) {
          cameraFocus = nextFocus;
          // Automatic cuts must not replace the action under a player's pressed finger.
          illustrated.setFraming?.(cameraFocus==='wide'?'wide':cameraFocus==='plate'?'counter':'portrait');
          for(const control of hud.querySelectorAll<HTMLElement>('[data-camera]'))control.setAttribute('aria-pressed',String(control.dataset['camera']===cameraFocus));
          const caption=hud.querySelector<HTMLElement>('[data-ui=dinner-cinematic]');
          const captions={wide:'Chez Marlène · Le dîner attend',window:'Dans la cour, les autres continuent leur soirée.',plate:'Trois couverts. Ton frère devait être là.',marlene:'Ta mère attend de pouvoir te parler.'};
          if(caption){caption.textContent=captions[cameraFocus as keyof typeof captions]??'';caption.hidden=introElapsed===8000;}
          if(introElapsed===8000){
            hud.querySelector('[data-ui=dinner-intro-skip]')?.remove();
            const cameras=hud.querySelector('.episode-cameras');
            if(cameras&&!cameras.querySelector('[data-ui=dinner-intro-replay]')){const replay=button('Revoir les plans',()=>{introElapsed=0;cameraFocus='wide';draw();});replay.dataset['ui']='dinner-intro-replay';cameras.append(replay);}
          }
        }
      }
      hud.dataset['location'] = currentScene().place;
      host.dataset['shot'] = travelling ? 'travel' : cameraFocus;
    };
    settle(); draw(); raf = frames.request(frame);
    cleanups.push(() => { disposed = true; frames.cancel(raf); });
    return { dispose };
  } catch (error) { dispose(); throw error; }
}
