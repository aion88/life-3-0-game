import { expect, test, type Page } from '@playwright/test';
import { LINES, seedJson, seedSave, continueIfAsked } from '../support/e2e';

/**
 * Rue guidée, build de production [rue guidée T14, revue #1] : sur un temps `line` du réveil (J1, avant le choix j1.wake : le service de
 * courtoisie parle en bulle), la réplique ne couvre pas « Continuer ».
 * Le clic est un vrai clic Playwright : un bouton recouvert échoue au contrôle d'actionnabilité, pas de `force`.
 */
test.use({ locale: 'en-US' });

const street = (page: Page) => page.locator('[data-ui="street"]');

async function toFreshStreet(page: Page): Promise<void> {
  await seedSave(page, seedJson({ lang: 'en', phase: 'street', line: LINES.w10, acts: [] }));
  await page.goto('./?webgl&episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  await expect(street(page)).toHaveAttribute('data-mode', 'guided');
}

test.describe('rue guidée : Continuer sur une réplique', () => {
  test('test_continue_clickable_on_wake_line_and_next_beat_follows', async ({ page }) => {
    await toFreshStreet(page);
    const cont = page.locator('[data-ui="continue"]');
    const bubble = page.locator('[data-ui="bubble"]');
    await expect(street(page)).toHaveAttribute('data-beat', 'card');
    await cont.click();                                              // la carte du J1 se ferme : première réplique du réveil
    await expect(street(page)).toHaveAttribute('data-beat', 'line');
    await expect(street(page)).toHaveAttribute('data-day', '1');
    await expect(bubble).toBeVisible();
    await expect(cont).toBeVisible();
    // les deux rectangles en UN aller-retour : deux `boundingBox()` coûtent chacun plusieurs commandes du protocole, et chaque commande attend le
    // fil principal, qu'une image de WebGL logiciel à 1280x720 tient 0,5 à 0,9 s sous une charge de 4 (2,7 s par `boundingBox()`, mesuré en T15
    // J3-J7) ; sous une forte charge, aucun essai ne finissait dans les 5 s du poll. L'écart lui-même ne bouge pas (+16 px à chaque mesure).
    const gap = (): Promise<number> => page.evaluate(() => {
      const b = document.querySelector('[data-ui="bubble"]')!.getBoundingClientRect(), c = document.querySelector('[data-ui="continue"]')!.getBoundingClientRect();
      return c.y - (b.y + b.height);
    });
    await expect.poll(gap).toBeGreaterThanOrEqual(0);                // la réplique se pose au-dessus de la barre d'avance
    const said = await bubble.textContent();
    await cont.click();                                              // sans `force` : recouvert, le clic échouerait
    await expect.poll(async () => `${await street(page).getAttribute('data-beat')}|${await street(page).getAttribute('data-scene') ?? ''}|${await page.evaluate(() => document.querySelector('[data-ui="bubble"]')?.textContent ?? '')}`)
      .not.toBe(`line||${said ?? ''}`);
  });
});
