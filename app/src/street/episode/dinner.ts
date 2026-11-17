/**
 * Optional dinner observations: a view state, not another sequence to complete.
 * Inspecting an object reveals a short reaction and records it once. It never grants
 * trust, exposure, inventory or progress; only the existing stay/leave choices do that.
 */
export type DinnerObjectId = 'plate' | 'basil' | 'bracelet';

/** Object identity is independent of its 3D mesh and screen position. */
export interface DinnerObject {
  readonly id: DinnerObjectId;
  readonly label: string;
  readonly speaker: string;
  readonly reaction: string;
}

/** Gestures remain available even when no object has been inspected. */
export interface DinnerGesture {
  readonly id: 'chair' | 'coat';
  readonly label: string;
  /** Pass directly to the existing episode choice reducer when the gesture is committed. */
  readonly option: 'stay' | 'leave';
}

/** Optional observation history, in first-inspection order; no completion counter. */
export interface DinnerState {
  readonly seen: readonly DinnerObjectId[];
  readonly current: DinnerObjectId | null;
}

/** Three independent cues: an absence, a personal pleasure and an intrusion. */
export const dinnerObjects: readonly DinnerObject[] = [
  {
    id: 'plate', label: 'La troisième assiette', speaker: 'MARLÈNE',
    reaction: 'C’est la place de ton frère. Ta mère effleure son assiette : « Je n’arrive pas à la ranger. »',
  },
  {
    id: 'basil', label: 'Le basilic', speaker: 'MARLÈNE',
    reaction: '« Ton frère en mettait dans tout, même les œufs. » Ta mère sourit pour la première fois du repas.',
  },
  {
    id: 'bracelet', label: 'Mon bracelet', speaker: 'LE BRACELET',
    reaction: '« Interaction inhabituelle détectée. » Ta mère baisse la voix : « Même à notre table… »',
  },
];

/** Physical gestures map to the original narrative branches and their saved consequences. */
export const dinnerGestures: readonly DinnerGesture[] = [
  { id: 'chair', label: 'Rapprocher ma chaise', option: 'stay' },
  { id: 'coat', label: 'Prendre ma veste', option: 'leave' },
];

/** Start without any obligatory observation or selected object. */
export function freshDinner(): DinnerState {
  return { seen: [], current: null };
}

/** Inspect freely; repeated or invalid input cannot multiply observations or rewards. */
export function inspectDinner(state: DinnerState, id: string): DinnerState {
  const object = dinnerObjects.find(candidate => candidate.id === id);
  if (!object || state.current === object.id) return state;
  return {
    seen: state.seen.includes(object.id) ? state.seen : [...state.seen, object.id],
    current: object.id,
  };
}

/** Dismiss the reaction without forgetting observations or advancing the scene. */
export function clearDinnerObservation(state: DinnerState): DinnerState {
  return state.current === null ? state : { ...state, current: null };
}
