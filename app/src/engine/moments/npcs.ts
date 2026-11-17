/**
 * Présence des personnages dans la rue [bible w10 §5.0, §7.1, §8.4 ; plan 02b T11].
 * Lecture pure des données : aucun état, aucune horloge.
 */
import type { StreetData } from '../../data/schema/street';
import type { Palier } from '../../survival/integrity';

/** Vrai si `id` est dans la rue ce `day` à cette `minute` (demi-ouvert, `toMinute` exclu) et à ce palier (`null` : tous). */
export function presentAt(id: string, day: number, minute: number, palier: Palier, street: StreetData): boolean {
  const n = street.npcs.find((x) => x.id === id);
  if (n === undefined || !n.days.some((d) => d === day)) return false;
  return minute >= n.fromMinute && minute < n.toMinute && (n.paliers === null || n.paliers.includes(palier));
}
