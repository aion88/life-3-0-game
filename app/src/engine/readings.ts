/** Lectures des pentes et du neutre : indicateurs booléens avec hystérésis, et premier moment de lecture [GDD 03 §3.4, §5.2 ; D121]. */
import type { Condition } from '../data/schema/common';
import type { WorldData } from '../data/schema/world';
import type { GameClock, MomentReading, WorldId, WorldVar, WorldVector } from '../shared/types';
import { worldNumber } from '../shared/types';
import { holds } from './conditions';

/** Indicateurs de lecture : clé `${slopeId}.${WorldVar}` ou `neutral.${WorldVar}`, vrai si allumé. */
export type Readings = Readonly<Record<string, boolean>>;

/** Identifiant réservé des lectures neutres, qui ne sont portées par aucune pente. */
export const NEUTRAL_ID = 'neutral';

/** Clé d'un indicateur de lecture. */
export function readingKey(slopeId: string, variable: WorldVar): string {
  return `${slopeId}.${variable}`;
}

interface Reading { readonly key: string; readonly slopeIndex: number; readonly to: WorldId | null; readonly cond: Condition }

/** Les lectures du monde dans l'ordre du fichier : pentes (leurs lectures dans l'ordre), puis le neutre. */
function readingsOf(world: WorldData): readonly Reading[] {
  const slopes = world.engine.slopes.flatMap((s, slopeIndex) => s.readings.map((cond) => ({ key: readingKey(s.id, cond.var), slopeIndex, to: s.to, cond })));
  const neutral = world.engine.neutralReadings.map((cond) => ({ key: readingKey(NEUTRAL_ID, cond.var), slopeIndex: slopes.length, to: null, cond }));
  return [...slopes, ...neutral];
}

/** Tant que la valeur n'a pas dépassé le seuil de PLUS de `h`, l'indicateur allumé reste allumé [GDD 03 §3.4]. */
function withinHysteresis(c: Condition, x: number, h: number): boolean {
  const wantsAbove = c.cmp === '>' || c.cmp === '>=';
  return wantsAbove ? x >= c.threshold - h : x <= c.threshold + h;
}

/**
 * Indicateurs après un nouveau vecteur : allumé quand la condition tient, éteint seulement quand la valeur
 * repasse au-delà du seuil de plus de `h` (millièmes). Sans état précédent, un indicateur est éteint.
 */
export function nextReadings(prev: Readings, ws: WorldVector, world: WorldData, h: number): Readings {
  return Object.fromEntries(readingsOf(world).map((r) => [r.key, holds(ws, r.cond) || (prev[r.key] === true && withinHysteresis(r.cond, ws[r.cond.var], h))]));
}

/**
 * Premier franchissement d'une pente entre deux jeux d'indicateurs : une lecture de pente éteinte puis allumée.
 * À égalité : l'ordre des pentes du fichier, puis le numéro du monde cible [GDD 03 §5.2].
 */
export function momentOf(prev: Readings, next: Readings, world: WorldData, at: GameClock): MomentReading | null {
  const lit = readingsOf(world).filter((r) => r.to !== null && prev[r.key] !== true && next[r.key] === true);
  lit.sort((a, b) => a.slopeIndex - b.slopeIndex || worldNumber(a.to!) - worldNumber(b.to!));
  const first = lit[0];
  if (first === undefined) return null;
  return { slopeId: first.key.slice(0, first.key.lastIndexOf('.')), var: first.cond.var, day: at.day, minute: at.minute };
}
