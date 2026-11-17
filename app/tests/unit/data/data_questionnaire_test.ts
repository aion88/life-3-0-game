import { describe, expect, it } from 'vitest';
import { DataLoadError, assertContent, parseQuestionnaire } from '../../../src/data/load';
import { qRaw, qSkeletonRaw, withExtraQuestion, withOrder, withPush } from '../../fixtures/data/factories';

describe('data questionnaire', () => {
  it('test_skeleton_counts_match_gdd01', () => {
    const q = parseQuestionnaire(qRaw);
    expect(q.questions.map((x) => x.key)).toEqual(['Q11', 'Q14', 'Q05', 'Q10', 'Q21', 'Q04', 'Q15', 'Q18', 'Q16', 'Q20', 'Q07']);
    expect(q.questions.reduce((n, x) => n + x.answers.length, 0)).toBe(38);
    expect(q.questions.reduce((n, x) => n * x.answers.length, 1)).toBe(746_496);
    expect(q.questions.flatMap((x) => x.answers.filter((a) => a.hypothesis)).length).toBe(7);
  });
  it.each([
    ['bad format', 'Q1'],
    ['retired reused', 'Q13'],
    ['duplicate key', 'Q11'],
  ])('test_key_rule_%s_refused', (_n, key) => {
    expect(() => parseQuestionnaire(withExtraQuestion(qRaw, key, 12))).toThrow(DataLoadError);
  });
  it('test_duplicate_order_refused', () => {
    expect(() => parseQuestionnaire(withExtraQuestion(qRaw, 'Q22', 3))).toThrow(DataLoadError);
  });
  it('test_order_with_hole_accepted', () => {
    // Q07 passe de 11 à 13 : trou en 12, légal après un retrait [GDD 01 §3.1 règle 4 : « entier unique »].
    const q = parseQuestionnaire(withOrder(qRaw, 'Q07', 13));
    expect(q.questions.map((x) => x.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13]);
    expect(q.questions.at(-1)!.key).toBe('Q07');
    // ordre inversé : les questions sont rendues triées par order, pas dans l'ordre du fichier
    const swapped = withOrder(withOrder(qRaw, 'Q11', 20), 'Q07', 1);
    expect(parseQuestionnaire(swapped).questions[0]!.key).toBe('Q07');
  });
  it('test_non_integer_push_refused', () => {
    expect(() => parseQuestionnaire(withPush(qRaw, 'Q11', 'A', 'order', 1.5))).toThrow(DataLoadError);
  });
  it('test_skeleton_refused_by_assert_content', () => {
    expect(() => assertContent(parseQuestionnaire(qSkeletonRaw), 'questionnaire.json')).toThrow(/skeleton/);
  });
});
