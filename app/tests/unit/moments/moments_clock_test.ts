import { describe, expect, it } from 'vitest';
import { activityOf, advance, momentOf, startDay } from '../../../src/engine/moments/clock';
import type { StreetState } from '../../../src/engine/moments/types';
import type { DayIndex } from '../../../src/shared/types/street';
import { ctxW10, day1State } from '../../support/street';

const S = ctxW10().street;
const day = (d: DayIndex = 1) => startDay(d, S);

describe('horloge entière et moments [plan 02b T2]', () => {
  it('test_day_is_180s_for_900_minutes', () => { expect(advance(day(), 180_000, 'scene', S).clock.minute).toBe(1320); });   // 15 h × 12 s/h [GDD 05 F1 ; playtest 2026-11-03 §3 A, borne haute du design §4.4]
  it('test_walk_freezes_the_clock', () => { expect(advance(day(), 21_000, 'walk', S).clock.minute).toBe(420); });          // 50 m à 2,4 m/s ≈ 21 s [bible w10 §5.0]
  it('test_queue_hour_is_12s', () => { expect(advance(day(), 12_000, 'queue', S).clock.minute).toBe(480); });             // la file du checkpoint [bible w10 §5.0]
  it('test_carry_makes_slicing_irrelevant', () => {
    // 7 × 1001 ms : chaque tranche vaut 1001 × 60 = 60 060, soit 5 minutes et un reste de 60 ; le reste s'accumule (60 × k).
    // Une seule tranche de 7007 ms : 7007 × 60 = 420 420 = 35 × 12 000 + 420, soit 35 minutes (455) et un carry de 420.
    // Sans carry, 7 tranches donneraient 7 × 5 = 35 minutes avec un reste perdu : l'égalité du reste seul le falsifie.
    let c = day(); for (let i = 0; i < 7; i++) c = advance(c, 1001, 'wait', S);
    expect(c).toEqual(advance(day(), 7007, 'wait', S));
    expect(c.carry).toBe(420);
    expect(c.clock.minute).toBe(455);
  });
  it('test_walk_does_not_consume_carry', () => {
    const waited = advance(day(), 3, 'wait', S);                       // 3 × 60 = 180 : zéro minute, carry 180
    expect(waited.carry).toBe(180);
    expect(advance(waited, 21_000, 'walk', S)).toEqual(waited);
  });
  it('test_advance_ignores_negative_and_non_finite_ms', () => {
    for (const ms of [-5000, Number.NaN, Number.POSITIVE_INFINITY]) expect(advance(day(), ms, 'wait', S)).toEqual(day());
  });
  it('test_clock_caps_at_day_end', () => { expect(advance(day(), 999_999, 'scene', S).clock.minute).toBe(1320); });
  it.each([
    [{ minute: 420, location: 'home', flags: {} }, 'lever'], [{ minute: 430, location: 'street', flags: { left: true } }, 'rueAller'],
    [{ minute: 540, location: 'registre', flags: { left: true } }, 'travail'], [{ minute: 900, location: 'street', flags: { left: true, workDone: true } }, 'rueMidi'], [{ minute: 720, day: 3, location: 'street', flags: { left: true } }, 'rueMidi'],   // J3 : Registre fermé, midi ouvre la rue de mi-journée
    [{ minute: 1050, location: 'street', flags: { left: true } }, 'soir'], [{ minute: 1320, location: 'home', flags: {} }, 'nuit'],
  ] as const)('test_moment_%#', (s, expected) => {
    const day = ('day' in s ? s.day : 1) as DayIndex;
    expect(momentOf({ clock: { day, minute: s.minute }, location: s.location, flags: s.flags }, S)).toBe(expected);
  });   // 17 h 30 = 1050
  it.each([                                                                  // « l'horloge ne court que pendant la file, les scènes et l'attente » [bible w10 §5.0 ; GDD 05 §5 joueur immobile]
    [{ moving: true, inQueue: false, inDialogue: false }, 'idle', 'walk'], [{ moving: false, inQueue: true, inDialogue: false }, 'idle', 'queue'],
    [{ moving: false, inQueue: false, inDialogue: true }, 'idle', 'scene'], [{ moving: false, inQueue: false, inDialogue: false }, 'designated', 'scene'],
    [{ moving: false, inQueue: false, inDialogue: false }, 'idle', 'wait'],
  ] as const)('test_activity_%#', (input, phase, expected) => { expect(activityOf({ ...day1State(), phase } as StreetState, input)).toBe(expected); });
});
