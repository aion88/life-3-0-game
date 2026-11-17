import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { actsOfProfile } from '../../support/profile_acts';
import { LINES, answersOfLine, displayLetters } from '../../support/e2e';
import { ans } from '../../support/answers';
import { loadCore } from '../../../src/data/load';

describe('fixtures des parcours e2e [plan 03 T15]', () => {
  // Playwright ne peut pas importer les données du monde : la copie est figée et ce test la tient à la source.
  // Régénérer : écrire `JSON.stringify(actsOfProfile('Zéro nom', { audition: 'none' }), null, 1)` dans ce fichier.
  it('test_zero_name_fixture_is_the_profile_acts', () => {
    expect(JSON.parse(readFileSync('tests/fixtures/e2e/zero-name-acts.json', 'utf8'))).toEqual(actsOfProfile('Zéro nom', { audition: 'none' }));
  });

  it('test_recruited_fixture_replays_ok', () => {
    // Régénérer : écrire `JSON.stringify(actsOfProfile('Quatre noms', { audition: 'none' }), null, 1)` dans ce fichier [plan UI-C T10].
    expect(JSON.parse(readFileSync('tests/fixtures/e2e/recruited-acts.json', 'utf8'))).toEqual(actsOfProfile('Quatre noms', { audition: 'none' }));
  });

  it('test_answers_of_line_matches_the_unit_helper_and_display_order_follows_screen_order', () => {
    for (const line of Object.values(LINES)) expect(answersOfLine(line)).toEqual(ans(line));
    const core = loadCore();
    const byOrder = [...core.questionnaire.questions].sort((a, b) => a.order - b.order);
    const letters = displayLetters(LINES.w10);
    expect(letters).toHaveLength(11);
    byOrder.forEach((q, i) => { expect(ans(LINES.w10)[q.key as keyof ReturnType<typeof ans>], q.key).toBe(letters[i]); });
  });
});
