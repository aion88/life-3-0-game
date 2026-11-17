import { expect, test, type Page } from '@playwright/test';
import { CONTENT_HASH, LINES, SAVE_KEY, answersOfLine, readSave } from '../support/e2e';

/**
 * Reprise et nouvelle partie [demande Cynthia 2026-11-03] : une sauvegarde en cours ouvre « Continuer » et « Nouvelle partie » ;
 * « Nouvelle partie » demande une confirmation, efface la partie et repart du choix de langue ; `?nouvelle` efface au chargement.
 * La sauvegarde est posée une seule fois (pas d'`addInitScript`, qui la reposerait à chaque chargement).
 */
test.use({ locale: 'fr-FR' });

const ready = (page: Page) => page.waitForSelector('html[data-ready="1"]');
const resume = (page: Page, name: string) => page.locator(`[data-ui="resume-${name}"]`);

async function seeded(page: Page, path = './?episode=semaine'): Promise<void> {
  await page.goto('./?episode=semaine');
  await ready(page);
  const answers = Object.fromEntries(Object.entries(answersOfLine(LINES.w10)).slice(0, 3));   // trois réponses sur onze : la reprise rouvre le questionnaire
  const json = JSON.stringify({ v: 1, rev: 3, contentHash: CONTENT_HASH, lang: 'fr', softened: false, phase: 'questionnaire', answers, acts: [] });
  await page.evaluate(([k, v]) => { localStorage.setItem(k!, v!); }, [SAVE_KEY, json]);
  await page.goto(path);
  await ready(page);
}

test('test_reload_keeps_game_then_new_game_restarts_from_language', async ({ page }) => {
  await seeded(page);
  await expect(resume(page, 'continue')).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(resume(page, 'continue')).toBeVisible();
  expect((await readSave(page))?.['phase']).toBe('questionnaire');

  await resume(page, 'new').click();
  expect((await readSave(page))?.['phase']).toBe('questionnaire');
  await resume(page, 'confirm').click();
  await expect(page.locator('button[data-lang]')).toHaveCount(2);
  const after = await readSave(page);
  expect([after?.['phase'], after?.['lang'], after?.['answers']]).toEqual(['new', null, {}]);
  await page.locator('button[data-lang="fr"]').click();
  await expect(page.getByTestId('warning-continue')).toBeVisible();   // la partie neuve repart bien : langue, puis avertissement

  await page.reload();
  await ready(page);
  await expect(page.locator('button[data-lang]')).toHaveCount(2);
  await expect(resume(page, 'continue')).toHaveCount(0);
});

test('test_continue_resumes_the_questionnaire', async ({ page }) => {
  await seeded(page);
  await resume(page, 'continue').click();
  await ready(page);
  await expect(page.locator('[data-option]').first()).toBeVisible();
  expect(Object.keys((await readSave(page))?.['answers'] as object)).toHaveLength(3);
});

test('test_nouvelle_param_erases_save_and_cleans_url', async ({ page }) => {
  await seeded(page, './?episode=semaine&nouvelle');
  await expect(page.locator('button[data-lang]')).toHaveCount(2);
  await expect(resume(page, 'continue')).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('?episode=semaine');
  const s = await readSave(page);
  expect(s === null || s['phase'] === 'new').toBe(true);
});
