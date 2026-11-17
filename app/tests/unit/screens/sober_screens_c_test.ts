// @vitest-environment happy-dom
/** Écrans sobres C (langue, avertissement, sources, causes) : voix sobre, palette C, aucun jus ; fast-forward intact sauf la police [plan UI-C T11 ; spec C §3.5, I-1, I-6, P-11]. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCausesScreen } from '../../../src/screens/causes';
import { createFastForwardScreen } from '../../../src/screens/fastforward';
import { langScreen } from '../../../src/screens/lang';
import { createSourcesScreen } from '../../../src/screens/sources';
import { warningScreen } from '../../../src/screens/warning';
import { createProductionWorldLoader } from '../../../src/data/load';
import { createScreenClock } from '../../../src/ui/clock';
import { ans } from '../../support/answers';
import { fakeCanvas2d, fakeCtx, mountScreen } from '../../support/screens';
import { manualFrames } from '../../support/screens_causes';
import { core, LINES, runLine } from '../../support/screens_ff';
import { W10_LINE, sourcesCtx } from '../../support/screens_sources';
import { realI18n } from '../../support/street_ui';

const SRC = (rel: string): string => readFileSync(join(__dirname, '../../../src', rel), 'utf8');
const SOBER_FILES = ['screens/lang/index.ts', 'screens/warning/index.ts', 'screens/sources/index.ts', 'screens/causes/index.ts', 'screens/sober.ts'];

async function mountAll() {
  const out: Record<string, HTMLElement> = {};
  out['lang'] = (await mountScreen(langScreen, fakeCtx(), undefined)).root;
  out['warning'] = (await mountScreen(warningScreen, fakeCtx(), undefined)).root;
  out['sources'] = (await mountScreen(createSourcesScreen(), sourcesCtx(W10_LINE), { from: 'warning' })).root;
  const frames = manualFrames();
  out['causes'] = (await mountScreen(createCausesScreen({ frames, clock: createScreenClock() }), fakeCtx(), { run: runLine(LINES.w07) })).root;
  frames.advance(50);
  return out;
}

describe('écrans sobres C [T11]', () => {
  it('test_sober_screens_use_c_sober_and_no_motion_beyond_fade', async () => {
    const all = await mountAll();
    for (const [name, root] of Object.entries(all)) {
      const page = root.querySelector<HTMLElement>('main');
      expect(page, name).not.toBeNull();
      expect(page!.classList.contains('c-sober'), `${name} : main en voix sobre`).toBe(true);
      expect(page!.classList.contains('c-sober-page'), `${name} : page C`).toBe(true);
      // Page de document sur crème (comme le bilan) : les bandes de la rue ne la recouvrent pas.
      for (const b of root.querySelectorAll<HTMLElement>('[data-band]')) expect(b.hidden, `${name} : bande masquée`).toBe(true);
      // Aucune rotation, aucune échelle, aucune transition, aucune animation posées par le code.
      for (const e of page!.querySelectorAll<HTMLElement>('*')) {
        const css = e.style.cssText;
        expect(css, `${name} <${e.tagName.toLowerCase()}>`).not.toMatch(/transform|rotate|scale|transition|animation|filter/i);
        expect(css, `${name} <${e.tagName.toLowerCase()}>`).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
      }
      // Tout bouton est un composant C (action ou pastille de choix), jamais un bouton nu.
      for (const b of root.querySelectorAll('main button')) expect(b.className, `${name} bouton`).toMatch(/\bc-(action|sober-pill|sober-toggle)\b/);
    }
    for (const f of SOBER_FILES) expect(SRC(f), f).not.toMatch(/motionFor|\.animate\(|requestAnimationFrame\(.*opacity|createAnimator/);
  });

  it('test_sober_screens_emit_no_regime_event', () => {
    for (const f of SOBER_FILES) {
      const s = SRC(f);
      expect(s, f).not.toMatch(/ui\/events|createUiEvents|UiEvents|regime\.|bracelet\.|oeil\.|ui\.confirm|ui\.designate/);
      expect(s, f).not.toMatch(/data-ui="(bracelet|oeil)"|createEye|createBracelet|juice/);
    }
  });

  it('test_sober_screens_all_texts_come_from_keys_and_fonts_from_tokens', () => {
    const css = SRC('screens/sober.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla)\(/i);
    for (const m of css.matchAll(/font-family\s*:\s*([^;}]*)/g)) expect(m[1]!.trim()).toMatch(/^var\(--(font|t)-[a-z-]+\)$/);
    expect(css).not.toMatch(/(^|[;{\s])(filter|backdrop-filter|mix-blend-mode|transform|rotate)\s*:/);
  });

  it('test_fastforward_untouched_except_font', async () => {
    history.replaceState(null, '', '?episode=semaine');
    const frames = manualFrames();
    const rec = fakeCanvas2d();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(rec.ctx as never);
    const ctx = fakeCtx({ i18n: realI18n('fr'), worlds: createProductionWorldLoader(core.catalogue) });
    ctx.save.update({ answers: ans(LINES.w10), phase: 'fastforward', lang: 'fr' });
    const { root } = await mountScreen(createFastForwardScreen({ frames, reducedMotion: false }), ctx, { answers: ans(LINES.w10) });
    const styles = [...root.querySelectorAll<HTMLElement>('*')].map((e) => `${e.tagName.toLowerCase()}|${e.className}|${e.style.cssText.replace(/font-family:[^;]*;?\s*/g, '').replace(/--[\w-]+:[^;]*;?\s*/g, '')}`);
    expect(styles.join('\n')).toMatchSnapshot();
    // Le fast-forward est habillé en voix du régime depuis le 2026-11-03 (unes, pastille « la suite ») : jamais la voix sobre, ni un bouton d'action.
    for (const e of root.querySelectorAll('[class]')) expect(e.className, 'voix sobre dans le fast-forward').not.toMatch(/(^|\s)c-(sober|action|notice)/);
    expect(SRC('screens/fastforward/index.ts')).not.toMatch(/sober|c-sober|\bc-action\b/);
  });
});
