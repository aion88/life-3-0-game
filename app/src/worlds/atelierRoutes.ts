/**
 * Chemins de recette de l'atelier de monde : pour chaque fin atteignable, le chemin le plus court.
 * Plan : production/session-state/plan-semaine-1984-3d.md, lot S1 (§9.2).
 * Fonctions pures, calculées depuis le vrai catalogue (`decide` + `blockedReason`, horloge comprise) ou depuis
 * `street/episode/story.ts` pour w10. Exposées par l'atelier en `window.__atelierRoutes`.
 */
import { blockedReason, decide, elapsed, startJourney } from './state';
import { narrativeScene } from './narrative';
import type { Journey, JourneyOption, JourneyState, JourneyWorldId } from './types';
import { choose, ending, freshEpisode, optionsFor, story, type EpisodeState } from '../street/episode/story';

/** Un geste du chemin : la scène où il se fait et l'option appuyée. */
export interface AtelierStep {
  scene: string;
  option: string;
  /** Libellé exact du bouton (w10 n'a pas de `[data-option]` dans le DOM). */
  label: string;
  /** Faux quand UNE seule option est affichée dans cet état (fichier à option unique, ou autres masquées par `hideWhenBlocked`) : le jeu l'applique seul, aucun appui. */
  decision: boolean;
}
/** Le chemin le plus court vers une fin. */
export interface AtelierRoute {
  world: JourneyWorldId | 'w10';
  /** Scène de fin (monde runtime) ; `end#n` pour w10, dont la fin est composée. */
  ending: string;
  /** Texte de fin atteint (w10 seulement), pour distinguer les fins composées. */
  endingText?: string;
  path: AtelierStep[];
  /** Nombre d'appuis qui sont des décisions (fin exclue). */
  decisions: number;
}
/** Ce que l'atelier expose pour un monde. */
export interface AtelierWorldRoutes {
  routes: AtelierRoute[];
  /** Les scènes non finales dont le fichier ne définit qu'une option. */
  single: string[];
}
/** `window.__atelierRoutes` : par monde (`w01` à `w11`, w10 compris), ses chemins et ses scènes à option unique. */
export type AtelierRoutes = Record<string, AtelierWorldRoutes>;

/**
 * Options AFFICHÉES d'une scène dans un état : même règle que `settle` de `runtime.ts` (texte narratif puis
 * masquage des options bloquées qui portent `hideWhenBlocked`). Une seule option affichée est appliquée seule.
 */
export function displayedOptions(journey: Journey, state: JourneyState): JourneyOption[] {
  const original = journey.scenes.find(s => s.id === state.scene);
  if (!original) return [];
  return narrativeScene(journey.id, original, state).options.filter(o => !(o.hideWhenBlocked && blockedReason(state, o, journey) !== null));
}

/** Chemins les plus courts d'un monde runtime, une fin par scène de fin (parcours en largeur). */
export function journeyRoutes(journey: Journey): AtelierRoute[] {
  const isEnding = (scene: string): boolean => journey.scenes.find(s => s.id === scene)?.ending !== undefined;
  const found = new Map<string, JourneyState>();
  // L'horloge de la forme courte ne se lit que dans les gestes faits : elle entre dans la clé de dédoublonnage.
  const keyOf = (state: JourneyState): string => `${state.scene}|${state.resource}|${[...state.inventory].sort().join(',')}|${elapsed(journey, state)}`;
  const seen = new Set<string>();
  let frontier: JourneyState[] = [startJourney(journey)];
  seen.add(keyOf(frontier[0]!));
  while (frontier.length) {
    const next: JourneyState[] = [];
    for (const state of frontier) {
      if (isEnding(state.scene)) { if (!found.has(state.scene)) found.set(state.scene, state); continue; }
      const scene = journey.scenes.find(s => s.id === state.scene);
      for (const option of scene?.options ?? []) {
        const after = decide(journey, state, option.id);
        if (after === state) continue;
        const key = keyOf(after);
        if (seen.has(key)) continue;
        seen.add(key); next.push(after);
      }
    }
    frontier = next;
  }
  return [...found.entries()].map(([ending, final]) => {
    // Rejoue le chemin : `decision` se lit dans l'état d'où chaque geste part, comme le fait `settle` de `runtime.ts`.
    let state = startJourney(journey);
    const path = final.choices.map(choice => {
      const decision = displayedOptions(journey, state).length > 1;
      const scene = journey.scenes.find(s => s.id === choice.scene);
      const step = { scene: choice.scene, option: choice.option, label: scene?.options.find(o => o.id === choice.option)?.label ?? '', decision };
      state = decide(journey, state, choice.option);
      return step;
    });
    return { world: journey.id, ending, path, decisions: path.filter(s => s.decision).length };
  });
}

const episodeKey = (state: EpisodeState): string =>
  `${state.scene}|${state.trust}|${state.exposure}|${[...new Set(state.memories)].sort().join(',')}|${[...new Set(state.history)].sort().join(',')}`;

/** Chemins les plus courts de w10 court, un par texte de fin distinct (fin composée). */
export function episodeRoutes(): AtelierRoute[] {
  const found = new Map<string, { state: EpisodeState; steps: AtelierStep[] }>();
  const seen = new Set<string>();
  let frontier: { state: EpisodeState; steps: AtelierStep[] }[] = [{ state: freshEpisode(), steps: [] }];
  seen.add(episodeKey(frontier[0]!.state));
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      if (node.state.scene === 'end') { const text = ending(node.state); if (!found.has(text)) found.set(text, node); continue; }
      const offered = optionsFor(node.state);
      // `autoSteps` de `report.ts` : une scène qui AFFICHE une seule option est racontée, pas demandée.
      const single = offered.length <= 1;
      for (const option of offered) {
        const after = choose(node.state, option.id);
        if (after === node.state) continue;
        const key = episodeKey(after);
        if (seen.has(key)) continue;
        seen.add(key); next.push({ state: after, steps: [...node.steps, { scene: node.state.scene, option: option.id, label: option.label, decision: !single }] });
      }
    }
    frontier = next;
  }
  return [...found.entries()].map(([text, node], index) => ({
    world: 'w10' as const, ending: `end#${index + 1}`, endingText: text, path: node.steps, decisions: node.steps.filter(s => s.decision).length,
  }));
}

/**
 * Chemins de toutes les fins atteignables, par monde : neuf mondes runtime et w10 court.
 * `single` réunit les scènes à option unique du fichier et celles dont une seule option est affichée sur chaque chemin
 * qui les traverse ; une scène qui est décision sur un chemin et appliquée seule sur un autre n'y figure pas (lire `decision` par étape).
 * @param journeys Le vrai catalogue (`journeys` de `catalogue.ts`), couches comprises.
 */
export function atelierRoutes(journeys: Readonly<Record<JourneyWorldId, Journey>>): AtelierRoutes {
  const out: AtelierRoutes = {};
  // Une scène est « seule » si aucun chemin n'y décide : `decision` par étape gouverne les scènes qui sont tantôt l'un tantôt l'autre.
  const merge = (fromFile: string[], routes: AtelierRoute[]): string[] => {
    const steps = routes.flatMap(route => route.path);
    const decided = new Set(steps.filter(step => step.decision).map(step => step.scene));
    return [...new Set([...fromFile, ...steps.filter(step => !step.decision).map(step => step.scene)])].filter(scene => !decided.has(scene));
  };
  for (const journey of Object.values(journeys)) {
    const routes = journeyRoutes(journey);
    out[journey.id] = { routes, single: merge(journey.scenes.filter(s => s.ending === undefined && s.options.length === 1).map(s => s.id), routes) };
  }
  const routes = episodeRoutes();
  out['w10'] = { routes, single: merge(Object.entries(story).filter(([, s]) => s.options.length === 1).map(([id]) => id), routes) };
  return out;
}
