/** Deterministic short-journey state; all costs and requirements come from the world content. */
import type { Journey, JourneyOption, JourneyState } from './types';

/** Initial state, independent from all other world and week saves. */
export function startJourney(journey: Journey): JourneyState {
  return { scene: journey.start, resource: journey.resource.initial, inventory: [], choices: [] };
}
/** Returns a readable reason instead of hiding a potentially useful choice. */
export function blockedReason(state: JourneyState, option: JourneyOption, journey: Journey, ignoreClock = false): string | null {
  const missing = (option.require ?? []).filter(item => !state.inventory.includes(item));
  if (missing.length) return `Il te manque : ${missing.join(', ')}.`;
  if ((option.cost ?? 0) > state.resource) return `${journey.resource.name} insuffisant : ${option.cost} requis, ${state.resource} disponible.`;
  // The clock never blocks a free gesture, so a scene always keeps a way forward.
  if (!ignoreClock && journey.short && option.minutes && elapsed(journey, state) + option.minutes + (journey.short.clock.reserve[state.scene] ?? 0) > journey.short.clock.limit) return 'Plus le temps.';
  return null;
}
/** Minutes spent so far, replayed from the decisions: the clock is never stored and never runs on its own. */
export function elapsed(journey: Journey, state: JourneyState): number {
  const clock = journey.short?.clock; if (!clock) return 0;
  let minutes = clock.travel[state.scene] ?? 0;
  for (const choice of state.choices) minutes += (clock.travel[choice.scene] ?? 0) + (journey.scenes.find(s => s.id === choice.scene)?.options.find(o => o.id === choice.option)?.minutes ?? 0);
  return minutes;
}
/** The companion's visible state is the one left by the latest gesture that changed it. */
export function companionMood(journey: Journey, state: JourneyState): string {
  let mood = journey.short?.companion.initial ?? '';
  for (const choice of state.choices) mood = journey.scenes.find(s => s.id === choice.scene)?.options.find(o => o.id === choice.option)?.mood ?? mood;
  return mood;
}
/** Applies only an available current-scene option. Rejected gestures never change state. */
/** `ignoreClock` replays a saved history as it happened: a save made before the clock existed is never rejected by it. */
export function decide(journey: Journey, state: JourneyState, id: string, ignoreClock = false): JourneyState {
  const scene = journey.scenes.find(s => s.id === state.scene);
  const option = scene?.options.find(o => o.id === id);
  if (!option || blockedReason(state, option, journey, ignoreClock) !== null) return state;
  const inventory = [...new Set([...state.inventory.filter(item => !(option.remove ?? []).includes(item)), ...(option.give ?? [])])];
  return {
    scene: option.nextIf?.find(route => inventory.includes(route.has))?.next ?? option.next,
    resource: state.resource - (option.cost ?? 0) + (option.gain ?? 0),
    inventory,
    choices: [...state.choices, { scene: state.scene, option: id }],
  };
}
/** Replays a bounded history, rejecting wrong-world, invalid or obsolete saves rather than trusting stored scores. */
export function restoreJourney(journey: Journey, raw: string | null): JourneyState {
  const initial = startJourney(journey);
  if (raw === null) return initial;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || !('v' in data) || data.v !== 1 || !('world' in data) || data.world !== journey.id || !('choices' in data) || !Array.isArray(data.choices) || data.choices.length > 100) return initial;
    let state = initial;
    for (const item of data.choices as unknown[]) {
      // New encounters must not erase an existing save or invent past decisions.
      const pending=journey.scenes.find(s=>s.id===state.scene);
      const original=pending?.interludeFor;
      if(original&&typeof item==='object'&&item!==null&&'scene' in item&&original===item.scene)state={...state,scene:original};
      if (typeof item !== 'object' || item === null || !('scene' in item) || !('option' in item) || typeof item.option !== 'string') return initial;
      // Old saves used a second confirmation after a response. Replay only that exact old edge.
      const prior=state.choices.at(-1);
      if(prior?.scene.startsWith('encounter_')&&prior.option.startsWith('respond_')&&item.scene===`${prior.scene}_${prior.option.slice(-1)}`&&item.option==='act')state={...state,scene:String(item.scene)};
      // Removed optional scenes are still valid historical decisions, but only at
      // their authored anchor. Never accept a jump to an unrelated or repeated node.
      if (item.scene !== state.scene && typeof item.scene === 'string') {
        const historical = journey.scenes.find(scene => scene.id === item.scene);
        if (historical?.legacyBefore === state.scene && !state.choices.some(choice => choice.scene === item.scene)) {
          state = { ...state, scene: historical.id };
        }
      }
      if(item.scene!==state.scene)return initial;
      // v1 originally used one presentation gesture for several distinct contracts.
      // Recover only those identifiable historical edges from already replayed evidence.
      let option = item.option;
      if (journey.id === 'w01' && state.scene === 'crossing' && option === 'both' && state.inventory.includes('Bail commun') && !state.inventory.includes('Preuve certifiée')) {
        if (state.inventory.includes('Données cédées')) option = 'both_data';
        else if (state.inventory.includes('Tomasz exposé')) option = 'both_public';
      }
      if (journey.id === 'w06' && state.scene === 'repair' && option === 'contract' && state.inventory.includes('Intervention privée') && state.inventory.includes('Demande privée') && !state.inventory.includes('Demande commune')) option = 'contract_private';
      const next = decide(journey, state, option, true); if (next === state) return initial; state = next;
    }
    return state;
  } catch { return initial; }
}
/** Persists decisions only, not derived balances or an inferred ending. */
export const serializeJourney = (journey: Journey, state: JourneyState): string => JSON.stringify({ v: 1, world: journey.id, choices: state.choices });
