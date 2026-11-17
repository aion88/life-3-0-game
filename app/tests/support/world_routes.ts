import { journeyRoutes } from '../../src/worlds/atelierRoutes';
import type { Journey } from '../../src/worlds/types';
/**
 * Ids of the options a player actually PRESSES to reach a success ending of a world. The shortest route is replayed on the engine
 * (`atelierRoutes.ts`), so scenes with a single displayed option, which the game applies by itself, are not in the list.
 */
export function successPressIds(journey: Journey): string[] {
  const ends = new Set(journey.scenes.filter(s => s.ending === 'success').map(s => s.id));
  const routes = journeyRoutes(journey).filter(r => ends.has(r.ending)).sort((a, b) => a.path.length - b.path.length);
  if (!routes.length) throw new Error(`${journey.id}: no success route`);
  return routes[0]!.path.filter(step => step.decision).map(step => step.option);
}
import { blockedReason, decide, startJourney } from '../../src/worlds/state';
import { displayedOptions } from '../../src/worlds/atelierRoutes';
import type { JourneyState } from '../../src/worlds/types';
/** The model state after the game has applied, on its own, every scene that shows a single available option (same rule as `settle` in the runtime). */
export function settled(journey: Journey, from: JourneyState): JourneyState {
  let state = from;
  for (let guard = 0; guard < 12; guard++) {
    const scene = journey.scenes.find(s => s.id === state.scene);
    if (!scene || scene.ending) return state;
    const shown = displayedOptions(journey, state);
    const only = shown[0];
    if (shown.length !== 1 || !only || blockedReason(state, only, journey) !== null) return state;
    const next = decide(journey, state, only.id);
    if (next === state) return state;
    state = next;
  }
  return state;
}
/** Ids pressed, from the start, until the player stands in a scene spoken by `speaker` (breadth-first on the engine, auto-applied scenes followed). */
export function pressIdsUntilSpeaker(journey: Journey, speaker: string): string[] {
  const speakerOf = (state: JourneyState): string | undefined => journey.scenes.find(s => s.id === state.scene)?.speaker;
  const key = (state: JourneyState): string => `${state.scene}|${state.resource}|${[...state.inventory].sort().join(',')}`;
  const start = settled(journey, startJourney(journey));
  const seen = new Set([key(start)]);
  let frontier: { state: JourneyState; presses: string[] }[] = [{ state: start, presses: [] }];
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { state, presses } of frontier) {
      if (speakerOf(state) === speaker) return presses;
      const scene = journey.scenes.find(s => s.id === state.scene);
      if (!scene || scene.ending) continue;
      for (const option of displayedOptions(journey, state)) {
        if (blockedReason(state, option, journey) !== null) continue;
        const after = settled(journey, decide(journey, state, option.id));
        if (after === state || seen.has(key(after))) continue;
        seen.add(key(after)); next.push({ state: after, presses: [...presses, option.id] });
      }
    }
    frontier = next;
  }
  throw new Error(`${journey.id}: no route reaches a scene spoken by ${speaker}`);
}
