import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openCapture, settle, st } from '../support/street_capture';
import type { SeedActs } from '../support/e2e';

/**
 * Le soir du J3 dans le runtime VIVANT (fr) : date du jour, relevé de six lignes, message du bracelet de la NUIT 3 [UI-C T9, D3].
 * `full-week.json` donne les paliers des nuits 1 à 7 : courtesy, courtesy, thanks, ... ; le soir du J3 dit « Merci. », pas la courtoisie de la veille.
 * `T9_SHOTS=<dossier>` écrit des captures de preuve.
 */
const WEEK = JSON.parse(readFileSync('tests/e2e-street/full-week.json', 'utf8')) as SeedActs[];
const W10 = JSON.parse(readFileSync('src/data/worlds/w10.json', 'utf8')) as { street: { moments: { eveningMinute: number } } };
const THEME = JSON.parse(readFileSync('src/data/ui/theme.json', 'utf8')) as { type: { message: { v: { px: number } } } };
const EVENING_MINUTE = W10.street.moments.eveningMinute;   // la donnée du monde, pas un nombre recopié
const T = JSON.parse(readFileSync('src/data/strings/fr.json', 'utf8')) as Record<string, string>;

test('test_live_evening_j3_shows_the_date_the_six_lines_and_the_night_3_message', async ({ page }) => {
  test.setTimeout(240_000);
  const acts = WEEK.slice(0, WEEK.findIndex((a) => a.day === 3 && a.kind === 'sleep'));
  await openCapture(page, { lang: 'fr', viewport: { width: 1920, height: 1080 }, query: '', acts });
  while ((await st(page, 'state')).live.clock.minute < EVENING_MINUTE) await st(page, 'step', 6000, { render: false });
  await settle(page, 500);
  await expect(page.locator('[data-ui="evening"] li')).toHaveCount(6);
  await expect(page.locator('[data-ui="evening-message"]')).toHaveText(T['w10.msg.thanks']!);
  await expect(page.locator('[data-ui="day-date"]')).toHaveText(T['w10.day.3.date']!);
  await page.waitForTimeout(600);   // l'autocollant a fini son entrée
  const msg = (await page.locator('[data-ui="evening-message"]').boundingBox())!;
  const eye = (await page.locator('[data-ui="bracelet"] .c-eye').boundingBox())!;
  expect(msg.y, 'l\'autocollant est sous l\'Œil, à droite').toBeGreaterThanOrEqual(eye.y + eye.height);
  const size = await page.locator('[data-ui="evening-message"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(size).toBe(THEME.type.message.v.px);   // plein écran : la taille du rôle `message` du thème
  if (process.env['T9_SHOTS']) await page.screenshot({ path: `${process.env['T9_SHOTS']}/soir-j3.png` });
});
