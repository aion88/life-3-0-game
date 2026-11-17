/**
 * Aides des tests du pilote de la rue [R-02a.2, plan 02a T10] : un fichier, un écrivain. Rien sous `src/` ne l'importe.
 */
import { vi, type Mock } from 'vitest';
import type { ActRecord } from '../../src/shared/types/street';
import { createDriver, type DriverEvent, type StreetDriver } from '../../src/engine/view/driver';
import type { Vec2 } from '../../src/engine/moments/types';
import { act, ctxW10, SEVEN_DAYS_SLEEP_ONLY } from './street';
import { SCENE } from './street_walk';

export const REST = { moving: false, inQueue: false, inDialogue: false } as const;
export const WALKING = { moving: true, inQueue: false, inDialogue: false } as const;

export interface TestSink {
  readonly saved: ActRecord[]; readonly appendAct: Mock<(a: ActRecord) => void>; readonly persistent: Mock<() => boolean>;
}

/** Puits de test : garde les actes reçus, `persistent()` vaut vrai tant qu'on ne le change pas. */
export function makeSink(): TestSink {
  const saved: ActRecord[] = [];
  return { saved, appendAct: vi.fn((a: ActRecord) => { saved.push(a); }), persistent: vi.fn(() => true) };
}

export function makeDriver(sink: TestSink, over: { readonly savedActs?: readonly ActRecord[]; readonly onGreyCar?: (v: boolean) => void } = {}): StreetDriver {
  const district = over.onGreyCar === undefined ? undefined : { setVisible: (_id: 'greyCar', v: boolean) => over.onGreyCar!(v) };
  return createDriver({ ctx: ctxW10(), sink, savedActs: over.savedActs ?? [], scene: SCENE, ...(district === undefined ? {} : { district }) });
}

/** Un J1 neuf a la joueuse au logement : la sortie vient avant tout acte de rue [R-02a.15 (a)]. */
export const EXIT_HOME: ActRecord = act(1, 430, 'exit', 'home');
/** Passer le checkpoint en se pliant, après la sortie [R-02a.15 (a)]. */
export const GOOD: ActRecord = act(1, 440, 'lane', 'checkpoint', 'comply');

/** Sort du logement puis joue `acts` (minute >= 431). */
export function drive(d: StreetDriver, acts: readonly ActRecord[]): void {
  d.act(EXIT_HOME);
  for (const a of acts) d.act(a);
}

/** Écoule les événements en attente sans faire avancer l'horloge. */
export function drain(d: StreetDriver): readonly DriverEvent[] {
  return d.tick(0, REST, FAR, []).events;
}

/** Un joueur loin de toute nacelle. */
export const FAR: Vec2 = { x: 0, z: 90 };

/** Le joueur reste à portée de la nacelle n16 : `ms` de session, par pas de 50 ms ; rend tous les événements. */
export function stayInCone(d: StreetDriver, ms: number): DriverEvent[] {
  const out: DriverEvent[] = [];
  const player: Vec2 = { x: 0, z: 16 };
  for (let t = 0; t < ms; t += 50) out.push(...d.tick(50, REST, player, []).events);
  return out;
}

/** Une semaine dormie jusqu'à l'audition sans parole : la fin de la partie. */
export const FULL_WEEK: readonly ActRecord[] = SEVEN_DAYS_SLEEP_ONLY;
