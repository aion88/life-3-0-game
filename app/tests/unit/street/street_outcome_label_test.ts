// @vitest-environment happy-dom
/** Nom accessible du dialogue de l'issue [revue finale J3-J7 m-6] : `aria-labelledby` vers la ligne du régime, dans les deux langues. */
import { describe, expect, it } from 'vitest';
import { mountOutcome } from '../../../src/street/ui/outcome';
import { realI18n } from '../../support/street_ui';

describe('issue : nom accessible du dialogue', () => {
  for (const lang of ['fr', 'en'] as const) {
    it(`test_outcome_dialog_is_labelled_by_the_regime_line_${lang}`, () => {
      const i18n = realI18n(lang);
      const host = document.createElement('div'); document.body.appendChild(host);
      const h = mountOutcome(host, i18n);
      h.showOutcome({ endId: 'released', regimeKey: 'w10.end.released.regime', narratorKey: null, nameKeys: [] });
      const box = host.querySelector('[role="dialog"]')!;
      const id = box.getAttribute('aria-labelledby');
      expect(id).toBeTruthy();
      const label = host.querySelector(`#${id}`)!;
      expect(label.getAttribute('data-ui')).toBe('outcome-regime');
      expect(label.textContent).toBe(i18n.t('w10.end.released.regime'));
      expect(label.textContent!.length).toBeGreaterThan(0);
      h.dispose(); host.remove();
    });
  }
});
