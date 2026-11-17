import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../../../src/save/save';
import { consumeNewGameParam } from '../../../src/save/newGame';
import { memStorage } from '../../support/street_screen';

/** `?nouvelle` efface la sauvegarde au chargement et rend l'adresse nettoyée, pour qu'un rechargement ne l'efface pas une seconde fois [demande Cynthia 2026-11-03]. */
describe('paramètre ?nouvelle', () => {
  it('test_new_game_param_erases_save_and_returns_clean_url', () => {
    const storage = memStorage({ [SAVE_KEY]: '{"v":1}' });
    const clean = consumeNewGameParam('http://h/app/?nouvelle&webgl#x', storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(clean).toBe('http://h/app/?webgl#x');
  });
  it('test_new_game_param_alone_leaves_no_question_mark', () => {
    const storage = memStorage({ [SAVE_KEY]: '{"v":1}' });
    expect(consumeNewGameParam('http://h/?nouvelle', storage)).toBe('http://h/');
  });
  it('test_without_param_save_is_kept_and_null_returned', () => {
    const storage = memStorage({ [SAVE_KEY]: '{"v":1}' });
    expect(consumeNewGameParam('http://h/?webgl', storage)).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe('{"v":1}');
  });
  it('test_without_storage_param_is_still_consumed', () => {
    expect(consumeNewGameParam('http://h/?nouvelle', null)).toBe('http://h/');
  });
});
