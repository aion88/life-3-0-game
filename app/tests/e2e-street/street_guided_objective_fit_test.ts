import { expect, test, type Page } from '@playwright/test';
import { LINES, seedJson, seedSave, continueIfAsked, type SeedActs } from '../support/e2e';

/**
 * Rue guidée, build de production : la ligne d'objectif tient en entier dans sa carte, sans défilement, de 960 px à 1920 px, même sous
 * une longue narration (Mme Roux au palier, J1) [retour T14 : texte coupé à 960 px, capture j1.roux].
 */
test.use({ locale: 'fr-FR' });

const act = (day: number, minute: number, kind: string, id: string, option: string | null = null): SeedActs => ({ day, minute, kind, id, option });
/** Reprise juste avant la scène de Mme Roux : téléphone et composant décidés. */
const BEFORE_ROUX: SeedActs[] = [act(1, 420, 'choice', 'j1.phone', 'take'), act(1, 421, 'choice', 'j1.component', 'leave')];
const SIZES = [{ width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }];
const street = (page: Page) => page.locator('[data-ui="street"]');

for (const vp of SIZES) {
  test(`test_objective_fits_its_card_without_scroll_at_${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: LINES.w10, acts: BEFORE_ROUX }));
    await page.goto('./?webgl&episode=semaine');
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await expect(street(page)).toHaveAttribute('data-mode', 'guided');
    // jusqu'à la narration de Mme Roux (la plus longue du J1) : Continuer, ou Passer pendant la marche
    for (let i = 0; i < 20; i++) {
      if ((await street(page).getAttribute('data-scene')) === 'j1.roux' && (await street(page).getAttribute('data-beat')) === 'line') break;
      const next = page.locator('[data-ui="continue"], [data-ui="skip"]').first();
      await next.click();
    }
    await expect(street(page)).toHaveAttribute('data-scene', 'j1.roux');
    await expect(page.locator('[data-ui="narration"]')).toBeVisible();
    const objective = page.locator('[data-ui="objective"]');
    await expect(objective).toBeVisible();
    // un aller-retour par essai (`page.evaluate`, pas un localisateur) : à 1920x1080, une image de WebGL logiciel tient le fil principal le plus
    // longtemps, et chaque commande du protocole l'attend [T15 J3-J7 : débordement mesuré à 0 sur 17 s, le poll seul était en cause]
    await expect.poll(() => page.evaluate(() => {
      const all = document.querySelectorAll('[data-ui="objective"] .c-window');   // mode strict, comme le localisateur d'avant : une seule fenêtre
      if (all.length !== 1) throw new Error(`objectif : ${all.length} fenêtres .c-window, une attendue`);
      const w = all[0]!; return w.scrollHeight - w.clientHeight;
    }),
      { message: 'objectif sans défilement' }).toBeLessThanOrEqual(1);
    const box = (await objective.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  });
}
