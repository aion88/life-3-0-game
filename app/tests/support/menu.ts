import { expect, type Page } from '@playwright/test';
/** The world and episode tools (rules, real-world facts, notebook, twelve futures) live in the Menu since the welcome window is gone. */
export async function openMenuAndClick(page: Page, label: string): Promise<void> {
  const target = page.getByRole('button', { name: label, exact: true });
  if (!(await target.isVisible())) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(target).toBeVisible();
  await target.click();
}
/** The full life sheet of a world ending sits in a closed `details` under the one-screen ending. */
export async function openEndSheet(page: Page): Promise<void> {
  const sheet = page.locator('[data-ui=end-sheet]');
  await expect(sheet).toBeVisible();
  if ((await sheet.getAttribute('open')) === null) await sheet.locator('>summary').click();
}
/**
 * The mayor questionnaire has no Continue button: one click on an answer records it and the next scene replaces the current one
 * (the last answer leaves for the retrospective). Returns once the page has moved on.
 */
export async function answerMayor(page: Page, option: string, last = false): Promise<void> {
  const scene = page.locator('[data-testid="q-scene"]');
  const before = last ? null : await scene.textContent();
  await page.locator(`[data-option="${option}"]`).click();
  if (before !== null) await expect(scene).not.toHaveText(before);
}
/** The real-world reference of a mayor scene (when it has one) opens in place and links to an external source. */
export async function checkMayorSource(page: Page): Promise<boolean> {
  const source = page.locator('.mayor-source');
  if (!(await source.count())) return false;
  await source.locator('summary').click();
  await expect(source.locator('a')).toHaveAttribute('href', /^https:\/\//);
  return true;
}
