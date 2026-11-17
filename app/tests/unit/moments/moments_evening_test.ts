/**
 * Relevé du soir : une ligne par axe, toujours six [plan 02b T12 ; GDD 05 §3.5, §3.6 ; V13, V8].
 * Les douze chaînes sont lues SANS garde `if (t)` : toutes existent en FR et EN [R-02b.32].
 */
import { describe, expect, it } from 'vitest';
import enJson from '../../../src/data/strings/en.json';
import frJson from '../../../src/data/strings/fr.json';
import { AXES } from '../../../src/engine/moments/types';
import { eveningLines } from '../../../src/engine/moments/evening';
import { checkPlayerString } from '../../../src/validate/numbers';
import { act, ctxW10, loadMeta } from '../../support/street';

const FR = frJson as Record<string, string>;
const EN = enJson as Record<string, string>;
const ctx = ctxW10();
const W = ctx.world;
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

describe('relevé du soir', () => {
  it('test_evening_always_six_lines_in_axes_order', () => {
    for (const d of DAYS) expect(eveningLines(d, [], ctx).map((l) => l.axis)).toEqual(AXES);
  });
  it('test_idle_day_is_six_rien_lines', () => {
    expect(eveningLines(1, [], ctx).every((l) => l.key.endsWith('.rien'))).toBe(true);
  });
  it('test_j1_comply_and_relecture_light_pouvoir_and_travail', () => {
    const l = eveningLines(1, [act(1, 600, 'lane', 'checkpoint', 'comply'), act(1, 700, 'choice', 'relecture.j1', 'pass')], ctx);
    expect(l.filter((x) => x.key.endsWith('.fait')).map((x) => x.axis)).toEqual(['travail', 'pouvoir']);
  });
  it('test_a_refusal_counts_as_a_gesture', () => {
    expect(eveningLines(3, [act(3, 900, 'choice', 'j3.marlene', 'banal')], ctx).find((x) => x.axis === 'liens')!.key).toMatch(/\.fait$/);
  });
  it('test_evening_texts_pass_voice_and_name_no_axis', () => {                   // V13 + V8
    const meta = loadMeta();
    const keys = AXES.flatMap((a) => [`w10.evening.${a}.fait`, `w10.evening.${a}.rien`]);
    expect(keys).toHaveLength(12);
    for (const k of keys) {
      for (const [lang, S] of [['fr', FR], ['en', EN]] as const) {
        const t = S[k];
        expect(t, `${lang} ${k}`).toBeTruthy();
        expect(checkPlayerString(t!, lang, { policy: 'voice' }, W.forbiddenWords), `${lang} ${k}`).toEqual([]);
        expect(t).not.toMatch(/\b(vie|travail|rue|liens|pouvoir)\b.*:/i);
      }
    }
    expect(meta['w10.evening' as keyof typeof meta]).toBeDefined();
    expect(FR['w10.evening.liens.rien']).toBe('Tu n\'as parlé à personne.');
  });
});
