/** Playable short journeys. This registry never borrows 1984 for an unavailable world. */
import type { ArrivalWorldId } from '../shared/types';
export const SHORT_WORLDS: readonly ArrivalWorldId[] = ['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w08', 'w09', 'w10', 'w11'];
/** The completed short game is canonical; the historical week remains explicitly accessible. */
export const shortMode = (search: string): boolean => new URLSearchParams(search).get('episode') !== 'semaine';
