import { describe, expect, it } from 'vitest';
import { createSaveStore, SAVE_KEY } from '../../../src/save/save';
import { answersOf, questionNumber, type ActRecord } from '../../../src/shared/types';
import { memStorage, rawSave, throwingGet, throwingSet, withRaw } from '../../fixtures/save/factories';

const valid = (): boolean => true;
const checkpoint: ActRecord = { day: 1, minute: 430, kind: 'choice', id: 'checkpoint', option: 'comply' };

describe('save store', () => {
  it('test_roundtrip_and_acts_survive_reload', () => {
    const st = memStorage(); const s = createSaveStore(st, 'h1', valid);
    s.update({ lang: 'fr', phase: 'questionnaire', answers: answersOf({ Q11: 'B' }) });
    s.appendAct({ day: 1, minute: 430, kind: 'choice', id: 'checkpoint', option: 'comply' });
    const again = createSaveStore(st, 'h1', valid).load();
    expect(again.status).toBe('restored'); expect(again.data.answers).toEqual({ Q11: 'B' }); expect(again.data.acts).toHaveLength(1);
  });
  it('test_storage_throws_or_corrupt_fresh_in_memory', () => {
    expect(createSaveStore(null, 'h1', valid).load().status).toBe('unavailable');
    expect(createSaveStore(throwingGet('SecurityError'), 'h1', valid).load().status).toBe('unavailable');
    expect(createSaveStore(withRaw('{not json'), 'h1', valid).load()).toMatchObject({ status: 'discarded-corrupt', data: { phase: 'new' } });
    expect(createSaveStore(withRaw('{"v":9}'), 'h1', valid).load().status).toBe('discarded-version');
    const full = createSaveStore(throwingSet('QuotaExceededError'), 'h1', valid);
    expect(() => full.update({ lang: 'en' })).not.toThrow(); expect(full.persistent()).toBe(false); expect(full.load().data.lang).toBe('en');
  });
  it.each([['answers non objet', { answers: 'x' }], ['lang hors fr|en', { lang: 'de' }], ['acts non tableau', { acts: {} }]])('test_save_valid_json_wrong_shape_discarded %s', (_n, patch) => {
    expect(createSaveStore(withRaw(rawSave(patch)), 'h1', valid).load()).toMatchObject({ status: 'discarded-corrupt', data: { phase: 'new' } });
  });
  it('test_second_tab_write_never_erases_confirmed_act', () => {
    const st = memStorage(); const a = createSaveStore(st, 'h1', valid); const b = createSaveStore(st, 'h1', valid);
    a.appendAct({ day: 1, minute: 430, kind: 'choice', id: 'checkpoint', option: 'comply' });
    b.update({ lang: 'en' });                                       // onglet resté ouvert, rev en retard
    expect(b.persistent()).toBe(false); expect(b.load().status).toBe('stale-tab');
    expect(createSaveStore(st, 'h1', valid).load().data.acts).toHaveLength(1);
  });
  it('test_content_hash_mismatch_drops_answers_keeps_lang', () => {
    const st = memStorage(); createSaveStore(st, 'old', valid).update({ lang: 'en', phase: 'street', answers: answersOf({ Q11: 'B' }) });
    const r = createSaveStore(st, 'new', valid).load();
    expect(r.status).toBe('discarded-content'); expect(r.data).toMatchObject({ lang: 'en', phase: 'new', answers: {}, acts: [] });
  });
  it('test_invalid_answer_in_same_hash_save_dropped', () => {
    const st = withRaw(rawSave({ phase: 'questionnaire', answers: { Q11: 'B', Q13: 'A', Q04: 'Z' } }));
    expect(createSaveStore(st, 'h1', (q, a) => questionNumber(q) === 11 && a === 'B').load().data.answers).toEqual({ Q11: 'B' });
  });
  it('test_unknown_act_kind_dropped_with_known_set', () => {        // isValidAct réel : plan 01 ; ici une doublure qui lit `known`
    const st = withRaw(rawSave({ acts: [{ day: 1, minute: 430, kind: 'choice', id: 'checkpoint', option: 'comply' }, { day: 1, minute: 440, kind: 'ghost', id: 'x', option: null }] }));
    const acts = { isValidAct: (a: ActRecord, known: ReadonlySet<string>) => known.has(a.kind), known: new Set(['choice']) };
    expect(createSaveStore(st, 'h1', valid, acts).load().data.acts.map(a => a.kind)).toEqual(['choice']);
    expect(createSaveStore(st, 'h1', valid).load().data.acts).toHaveLength(2);   // sans contrôle injecté, les actes sont gardés
  });
  it('test_reset_keeps_lang_only_when_asked', () => {
    const s = createSaveStore(memStorage(), 'h1', valid); s.update({ lang: 'fr', answers: answersOf({ Q11: 'B' }) });
    s.reset({ keepLang: true }); expect(s.load().data).toMatchObject({ lang: 'fr', answers: {}, phase: 'new' });
  });

  it('test_reset_without_option_clears_lang_and_stays_persistent', () => {
    const st = memStorage(); const s = createSaveStore(st, 'h1', valid);
    s.update({ lang: 'fr', softened: true, phase: 'street' }); s.appendAct(checkpoint);
    s.reset();
    expect(s.load().data).toMatchObject({ lang: null, softened: null, phase: 'new', answers: {}, acts: [] });
    expect(s.persistent()).toBe(true);
    expect(createSaveStore(st, 'h1', valid).load().data).toMatchObject({ lang: null, phase: 'new', acts: [] });
  });
  it('test_save_keeps_only_player_inputs', () => {
    const st = memStorage(); const s = createSaveStore(st, 'h1', valid);
    s.update({ lang: 'en', softened: false, phase: 'fastforward', answers: answersOf({ Q11: 'B' }) });
    expect(Object.keys(JSON.parse(st.getItem(SAVE_KEY) ?? '{}') as object).sort())
      .toEqual(['acts', 'answers', 'contentHash', 'lang', 'phase', 'rev', 'softened', 'v']);
  });
  it('test_rev_increments_on_every_write', () => {
    const st = memStorage(); const s = createSaveStore(st, 'h1', valid);
    s.update({ lang: 'fr' }); s.appendAct(checkpoint); s.update({ phase: 'street' });
    expect((JSON.parse(st.getItem(SAVE_KEY) ?? '{}') as { rev: number }).rev).toBe(3);
  });
  it('test_stale_tab_is_sticky_and_keeps_playing_in_memory', () => {
    const st = memStorage(); const a = createSaveStore(st, 'h1', valid); const b = createSaveStore(st, 'h1', valid);
    a.update({ lang: 'fr' });
    b.update({ lang: 'en' }); b.appendAct(checkpoint);
    expect(b.persistent()).toBe(false); expect(b.load().data).toMatchObject({ lang: 'en' }); expect(b.load().data.acts).toHaveLength(1);
    expect(createSaveStore(st, 'h1', valid).load().data).toMatchObject({ lang: 'fr', acts: [] });
  });
  it('test_read_failure_before_write_degrades_to_memory', () => {
    const inner = memStorage(); let calls = 0;
    const flaky = { getItem: (k: string) => { if (calls++ > 0) throw new Error('gone'); return inner.getItem(k); }, setItem: inner.setItem, removeItem: inner.removeItem };
    const s = createSaveStore(flaky, 'h1', valid);
    expect(() => s.update({ lang: 'fr' })).not.toThrow(); expect(s.persistent()).toBe(false); expect(s.load().data.lang).toBe('fr');
  });
  it.each([['non objet', '[1]'], ['v absent', '{}'], ['phase inconnue', rawSave({ phase: 'boss' })], ['acte mal formé', rawSave({ acts: [{ kind: 1 }] })]])('test_more_malformed_saves_discarded_corrupt %s', (_n, raw) => {
    expect(createSaveStore(withRaw(raw), 'h1', valid).load().status).toBe('discarded-corrupt');
  });
  it('test_load_returns_restored_phase_and_softened', () => {
    const r = createSaveStore(withRaw(rawSave({ phase: 'fastforward', softened: true, lang: 'fr' })), 'h1', valid).load();
    expect(r.status).toBe('restored'); expect(r.data).toMatchObject({ phase: 'fastforward', softened: true, lang: 'fr' });
  });
  it('test_empty_storage_is_fresh', () => {
    expect(createSaveStore(memStorage(), 'h1', valid).load()).toMatchObject({ status: 'fresh', data: { v: 1, rev: 0, contentHash: 'h1', lang: null, softened: null, phase: 'new', answers: {}, acts: [] } });
  });
  it('test_validator_throw_propagates_not_swallowed', () => {
    const st = withRaw(rawSave({ answers: { Q11: 'B' }, acts: [checkpoint] }));
    expect(() => createSaveStore(st, 'h1', () => { throw new Error('bug-answer'); })).toThrow('bug-answer');
    const acts = { isValidAct: () => { throw new Error('bug-act'); }, known: new Set<string>() };
    expect(() => createSaveStore(st, 'h1', valid, acts)).toThrow('bug-act');
  });
  it('test_patch_extra_key_dropped_before_write', () => {
    const st = memStorage(); const s = createSaveStore(st, 'h1', valid);
    s.update({ lang: 'fr', evil: 1, rev: 99, contentHash: 'x', v: 2 } as Parameters<typeof s.update>[0]);
    const stored = JSON.parse(st.getItem(SAVE_KEY) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(['acts', 'answers', 'contentHash', 'lang', 'phase', 'rev', 'softened', 'v']);
    expect(stored).toMatchObject({ v: 1, rev: 1, contentHash: 'h1', lang: 'fr' });
    expect(createSaveStore(st, 'h1', valid).load().status).toBe('restored');
  });
  it('test_bad_patch_value_refused_state_unchanged', () => {
    const st = memStorage(); const s = createSaveStore(st, 'h1', valid);
    s.update({ lang: 'fr' });
    s.update({ lang: 'de' } as unknown as Parameters<typeof s.update>[0]);
    expect(s.load().data.lang).toBe('fr'); expect(s.persistent()).toBe(true);
    expect(createSaveStore(st, 'h1', valid).load()).toMatchObject({ status: 'restored', data: { lang: 'fr', rev: 1 } });
  });
  it('test_malformed_act_refused_not_written', () => {
    const st = memStorage(); const s = createSaveStore(st, 'h1', valid);
    s.appendAct(checkpoint);
    s.appendAct({ ...checkpoint, day: 9 } as unknown as ActRecord);
    s.appendAct({ ...checkpoint, minute: 430.5 });
    s.appendAct({ ...checkpoint, extra: 1 } as unknown as ActRecord);
    expect(s.load().data.acts).toEqual([checkpoint]); expect(s.persistent()).toBe(true);
    const again = createSaveStore(st, 'h1', valid).load();
    expect(again.status).toBe('restored'); expect(again.data.acts).toEqual([checkpoint]);
  });
});
