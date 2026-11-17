/** Shared contract for world-specific short journeys. Extinctions keep their existing dedicated ending. */
import type { ArrivalWorldId, QuestionKey, WorldVar } from '../shared/types';
export type JourneyWorldId = Exclude<ArrivalWorldId, 'w10'>;
export interface JourneyOption {
  id: string; label: string; next: string;
  /** Immediate consequence shown before the next location. */
  consequence: string;
  give?: string[]; require?: string[]; remove?: string[];
  /** Visible costs and benefits, in this world's named resource. */
  cost?: number; gain?: number;
  /** Short form only. Minutes spent by this gesture, a visible companion state after it, and a destination that depends on what the player carries. */
  minutes?: number; mood?: string; nextIf?: { has: string; next: string }[];
  /** Short form only. An unavailable gesture that would only repeat a visible one is not listed. */
  hideWhenBlocked?: boolean;
}
/** A world played in the short form: a clock that only advances with gestures, a companion whose state stays visible, and costs told at the end. */
export interface ShortForm {
  intro: string[]; startLabel: string;
  /** `from` is the displayed start in minutes after midnight; `limit` the minutes available; `reserve` what must remain after a gesture of that scene to reach the last one; `travel` minutes spent entering a scene. */
  clock: { from: number; limit: number; deadline: string; reserve: Record<string, number>; travel: Record<string, number> };
  companion: { name: string; initial: string };
  /** Inventory entries that are physical things the player carries. */
  objects: string[];
}
export interface JourneyScene {
  /** Authored surface and interaction, shared by all public journeys. */
  presentation?: {kind:'intent'|'event'|'decision';prop:'phone'|'document'|'tool'|'object'|'none';incident:string};
  /** Retained conversation from an older route, replayable only before this exact destination. */
  legacyBefore?: string;
  id: string; location: string; title: string; speaker: string; text: string;
  objective: string; options: JourneyOption[];
  /** Endings must explain actual success, costs and institutional limits. */
  ending?: 'success' | 'compromise' | 'failure';
  /** Original decision following an authored encounter; also permits old saves to bypass new material already behind them. */
  interludeFor?: string;
}
export interface Journey {
  id: JourneyWorldId; title: string; mission: string; emotion: string;
  resource: { name: string; initial: number; explanation: string };
  /** Relevant questionnaire axes, used to explain actual contributions, not fabricated causality. */
  axes: WorldVar[]; question: QuestionKey;
  locations: { id: string; name: string; kind: 'home' | 'public' | 'work' | 'landmark' }[];
  scenes: JourneyScene[]; start: string;
  short?: ShortForm;
}
export interface JourneyState { scene: string; resource: number; inventory: string[]; choices: { scene: string; option: string }[] }
