import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LINES, SAVE_KEY, seedJson, seedSave, type SeedActs, continueIfAsked } from '../support/e2e';

/**
 * Reprise de la rue dans le navigateur [plan 02a T12, R-02a.20 d ; T13 : les neuf corps sont livrés, plus aucun saut].
 * Build de production : depuis la rue guidée (T14), c'est elle qui reprend (le metteur en scène rejoue la journée sans écrire).
 * `full-week.json` : copie figée de `SEVEN_DAYS_SLEEP_ONLY` (`tests/support/street.ts`) ; l'égalité est tenue par `street_screen_test.ts` (fixture e2e).
 */
test.use({ locale: 'en-US' });

type Act = SeedActs;
const act = (day: number, minute: number, kind: string, id: string, option: string | null = null): Act => ({ day, minute, kind, id, option });
/** Trois actes du J1 : le téléphone pris, le composant laissé, la sortie du logement (dernier acte à 430). */
const THREE: Act[] = [act(1, 420, 'choice', 'j1.phone', 'take'), act(1, 421, 'choice', 'j1.component', 'leave'), act(1, 430, 'exit', 'home')];
/** Les écrans réels du plan 03 sont câblés : la sauvegarde en phase `street` avec réponses complètes mène droit à la rue, sans geste [plan 03 T15]. */
const seed = (acts: Act[]): string => seedJson({ lang: 'en', phase: 'street', line: LINES.w10, acts });

async function toStreet(page: Page, acts: Act[]): Promise<void> {
  await seedSave(page, seed(acts));
  await page.goto('./?webgl&episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
}
const saved = (page: Page): Promise<string | null> => page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
const street = (page: Page) => page.locator('[data-ui="street"]');

test.describe('rue : reprise', () => {
  test('test_street_resumes_same_engine_state_after_reload_without_saving', async ({ page }) => {
    await toStreet(page, THREE);
    await expect(street(page)).toHaveAttribute('data-mode', 'guided');   // build de production, monde guidé : la rue guidée [T14]
    await expect(street(page)).toHaveAttribute('data-acts', '3');
    const bracelet = await street(page).getAttribute('data-bracelet');
    const minute = await street(page).getAttribute('data-minute');
    const before = await saved(page);
    await page.reload();
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await expect(street(page)).toHaveAttribute('data-acts', '3');
    await expect(street(page)).toHaveAttribute('data-bracelet', bracelet!);
    // la minute attendue après le dernier acte est perdue (plan 02b) : la rue repart de la minute du dernier acte
    await expect(street(page)).toHaveAttribute('data-minute', /^\d+$/);
    expect(Number(await street(page).getAttribute('data-minute'))).toBeLessThanOrEqual(Number(minute) + 1);
    expect(await saved(page)).toBe(before);
  });

  test('test_street_navigates_to_bilan_when_the_week_is_over', async ({ page }) => {
    // La partie jouée jusqu'au bout est rechargée telle que la sauvegarde la porte : la rue la rejoue et rend la main au bilan.
    const full = JSON.parse(readFileSync('tests/e2e-street/full-week.json', 'utf8')) as Act[];
    await toStreet(page, full);
    await expect(page.getByTestId('bilan-page')).toHaveCount(1);
  });
});
