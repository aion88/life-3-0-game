import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { LINES, seedJson, seedSave, continueIfAsked, type SeedActs } from '../support/e2e';

/**
 * Fiche C à la fin d'une semaine guidée [retours Cynthia 2026-11-08 ; spec C §3.4 ; maquette `c/bilan.png`]. Build de production, sauvegarde
 * d'une partie finie qui rouvre sur le bilan, aucun crochet de capture. La première page est la fiche, et tout ce que la maquette met dans un
 * écran y tient sans défiler : les sept pastilles des jours sur UNE rangée, les sept cartes du kit entières dans la fenêtre, le monde et la fin.
 * Captures dans `FICHE_OUT` (défaut : `test-results/`), jamais sous `production/qa/evidence`.
 */
test.use({ locale: 'fr-FR' });
test.setTimeout(300_000);

/** Semaine de w10 jouée jusqu'à l'audition par le metteur en scène, premières options (`ACTS_FULL_WEEK_FIXTURE`, fin `arrestedAudition` au J7). */
const WEEK = JSON.parse(readFileSync('tests/e2e-street/week-full-default.json', 'utf8')) as SeedActs[];
const OUT = process.env['FICHE_OUT'] ?? 'test-results/bilan-fiche-c';
const SIZES = [{ width: 1280, height: 650 }, { width: 1366, height: 660 }, { width: 1440, height: 780 }, { width: 1512, height: 860 }, { width: 1920, height: 1080 }] as const;

async function openSaved(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: LINES.w10, acts: WEEK }));
  await page.goto('/?episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  await expect(page.getByTestId('bilan-page')).toBeVisible({ timeout: 120_000 });
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
}

test.describe('bilan : la fiche C tient dans un écran', () => {
  for (const size of SIZES) {
    test(`test_bilan_sheet_fits_one_screen_${size.width}x${size.height}`, async ({ page }) => {
      await openSaved(page, size);
      mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: `${OUT}/fiche-${size.width}x${size.height}.png` });
      await expect(page.getByTestId('bilan-page')).toHaveAttribute('data-page', 'sheet');
      const m = await page.evaluate(() => {
        const box = (e: Element): DOMRect => e.getBoundingClientRect();
        const pills = [...document.querySelectorAll('[data-day-pill]')].map(box);
        const kit = [...document.querySelectorAll('[data-kit-card]')].map(box);
        return {
          pillTops: [...new Set(pills.map((r) => Math.round(r.top)))],
          pills: pills.length,
          kit: kit.length,
          kitMaxBottom: Math.max(...kit.map((r) => r.bottom)),
          worldBottom: box(document.querySelector('[data-testid="bilan-world"]')!).bottom,
          fateBottom: box(document.querySelector('[data-testid="bilan-fate"]')!).bottom,
          vh: window.innerHeight,
        };
      });
      expect(m.pills).toBe(7);
      expect(m.pillTops, 'les sept jours sur une seule rangée').toHaveLength(1);
      expect(m.kit).toBe(7);
      expect(m.kitMaxBottom, 'les sept cartes du kit dans la fenêtre, sans défiler').toBeLessThanOrEqual(m.vh);
      expect(m.worldBottom).toBeLessThanOrEqual(m.vh);
      expect(m.fateBottom).toBeLessThanOrEqual(m.vh);
    });
  }
});
