import { describe, expect, it } from 'vitest';
import { KIT_EVENT_BY_ENTRY, KIT_EVENTS, KIT_FLAG_BY_EVENT, kitAfter } from '../../../src/engine/moments/kit';
import type { KitItemState } from '../../../src/shared/types/street';
import { ctxW10 } from '../../support/street';

const W = ctxW10().world;
const k0: Readonly<Record<string, KitItemState>> = { component: 'kept', phone: 'kept', machineReceipt: 'kept' };

describe('moments : états du kit [plan 02b T8]', () => {
  it.each([
    ['j1.component.leave', 'left'], ['j2.hide', 'left'], ['j2.keep', 'kept'], ['j2.declare', 'declared'],
    ['j2.leaveVisible', 'seized'], ['comply.found', 'seized'], ['m5.exchange', 'handedOver'], ['buy:component', 'handedOver'],
    ['j1.component.take', 'kept'],
  ])('test_component_%s', (ev, st) => { expect(kitAfter(k0, ev).component).toBe(st); });
  it('test_terminal_states_do_not_move', () => {
    for (const t of ['seized', 'declared', 'handedOver'] as const)
      for (const ev of KIT_EVENTS) expect(kitAfter({ ...k0, component: t }, ev).component).toBe(t);
  });
  it('test_left_component_cannot_be_handed_over_or_seized_before_returning_home', () => {
    for (const ev of ['m5.exchange', 'buy:component', 'comply.found']) expect(kitAfter({ ...k0, component: 'left' }, ev).component).toBe('left');
  });
  it('test_only_j2_keep_brings_a_left_component_back', () => {
    const left = { ...k0, component: 'left' } as const;
    expect(kitAfter(left, 'j2.keep').component).toBe('kept');
    expect(kitAfter(left, 'j2.hide').component).toBe('left');
    expect(kitAfter(left, 'j1.component.take').component).toBe('left');
  });
  it('test_phone_and_receipt', () => {
    expect(kitAfter(k0, 'j1.phone.leave').phone).toBe('left');
    expect(kitAfter(k0, 'j1.phone.take').phone).toBe('kept');
    expect(kitAfter(k0, 'j2.showReceipt').machineReceipt).toBe('declared');
  });
  it('test_unknown_event_returns_the_kit_unchanged_and_input_is_not_mutated', () => {
    expect(kitAfter(k0, 'nope')).toBe(k0);
    const before = JSON.stringify(k0); kitAfter(k0, 'j2.declare'); expect(JSON.stringify(k0)).toBe(before);
  });
  it('test_letter_is_added_kept_on_letter_keep', () => {
    expect(kitAfter(k0, 'letter.keep').letter).toBe('kept');
    expect(kitAfter({ ...k0, letter: 'kept' }, 'letter.keep').letter).toBe('kept');
  });
  it('test_event_tables_are_consistent', () => {
    expect(KIT_FLAG_BY_EVENT).toEqual({ 'j2.hide': 'hidden', 'permit.request': 'permitBookHalved' });
    expect(KIT_EVENT_BY_ENTRY).toEqual({ found7: 'comply.found' });
    for (const ev of [...Object.keys(KIT_FLAG_BY_EVENT), ...Object.values(KIT_EVENT_BY_ENTRY)]) expect(KIT_EVENTS.has(ev)).toBe(true);
    expect(KIT_EVENTS.has('j1.leave')).toBe(false);
  });
  it('test_kit_keys_are_the_seven_of_the_bible', () => { expect(W.kit.map(k => k.id)).toEqual(['bracelet', 'sectorCard', 'phone', 'permitBook', 'classSheet', 'machineReceipt', 'component']); });
});
