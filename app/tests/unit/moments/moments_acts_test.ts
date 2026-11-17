import { describe, expect, it } from 'vitest';
import { createSaveStore } from '../../../src/save/save';
import { isValidAct } from '../../../src/shared/acts';
import { echoKeyOf, knownActKinds, streetActKinds } from '../../../src/engine/moments/verbs';
import { memStorage } from '../../fixtures/save/factories';
import { act, ctxW10 } from '../../support/street';

const { street: S, world: W } = ctxW10();

describe('moments : verbes, kinds d\'actes, known, clés d\'écho [plan 02b T3]', () => {
  it('test_street_kinds_are_the_eleven', () => { expect([...streetActKinds].sort()).toEqual(['buyWords', 'choice', 'enter', 'exit', 'glance', 'lane', 'obey', 'say', 'scene', 'sleep', 'use']); });
  it('test_known_is_base_union_street', () => { const k = knownActKinds(); expect(k.size).toBe(14); expect(k.has('routine') && k.has('choice')).toBe(true); });   // 3 + 11
  it('test_every_street_kind_passes_is_valid_act', () => { for (const kind of streetActKinds) expect(isValidAct(act(2, 600, kind, 'x'), knownActKinds())).toBe(true); });
  it('test_save_store_keeps_street_acts_and_drops_ghost', () => {
    const st = memStorage(); const s = createSaveStore(st, 'h', () => true, { isValidAct, known: knownActKinds() });
    s.appendAct(act(1, 600, 'lane', 'checkpoint', 'comply')); s.appendAct(act(1, 610, 'ghost', 'x'));
    expect(createSaveStore(st, 'h', () => true, { isValidAct, known: knownActKinds() }).load().data.acts.map(a => a.kind)).toEqual(['lane']);
  });
  it('test_echo_keys_exist_in_the_world_table', () => {
    expect(echoKeyOf(act(1, 480, 'use', 'phone'), S)).toBe('usePhone'); expect(echoKeyOf(act(1, 540, 'choice', 'relecture.j1', 'flag'), S)).toBe('workTech');
    expect(echoKeyOf(act(1, 540, 'say', 'x'), S)).toBeNull();
    for (const e of S.echo) expect(Object.keys(W.engine.routineEcho.table)).toContain(e.key);
  });
});
