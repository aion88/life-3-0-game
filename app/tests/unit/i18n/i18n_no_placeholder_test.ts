import { describe, expect, it } from 'vitest';
import frJson from '../../../src/data/strings/fr.json';
import enJson from '../../../src/data/strings/en.json';
import questionnaireJson from '../../../src/data/questionnaire.json';

// Textes provisoires du questionnaire posés au commit 13ddb47 (« Description de la scène. », « Première réponse », « Coût de la première
// réponse. ») : aucune chaîne livrée ne doit les porter, dans aucune famille de clés [GDD 01 §3.2, U-2 ; bug du 2026-11-03].
const PLACEHOLDERS: Record<'fr' | 'en', readonly RegExp[]> = {
  fr: [/Description de la scène/u, /^(Première|Deuxième|Troisième|Quatrième|Autre|Dernière) réponse\.?$/u, /^Coût de la /u],
  en: [/Description of the scene/u, /^(First|Second|Third|Fourth|Another|Last) answer\.?$/u, /^Cost of the (first|second|third|fourth|next|last) answer\.?$/u],
};
const TABLES = { fr: frJson as Record<string, string>, en: enJson as Record<string, string> };

describe('i18n placeholder texts', () => {
  it('test_no_shipped_string_is_a_questionnaire_placeholder', () => {
    const hits: string[] = [];
    for (const lang of ['fr', 'en'] as const) {
      for (const [key, value] of Object.entries(TABLES[lang])) {
        if (PLACEHOLDERS[lang].some(re => re.test(value))) hits.push(`${lang}:${key}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('test_each_question_has_distinct_scene_labels_and_costs_in_both_languages', () => {
    for (const lang of ['fr', 'en'] as const) {
      const t = TABLES[lang];
      for (const q of questionnaireJson.questions) {
        const labels = q.answers.map(a => t[`q.${q.key}.${a.key}.label`]);
        const costs = q.answers.map(a => t[`q.${q.key}.${a.key}.cost`]);
        expect(t[`q.${q.key}.scene`], `${lang} q.${q.key}.scene`).toMatch(/\S{3,}/u);
        expect(new Set(labels).size, `${lang} q.${q.key} libellés`).toBe(q.answers.length);
        expect(new Set(costs).size, `${lang} q.${q.key} coûts`).toBe(q.answers.length);
      }
    }
  });
});
