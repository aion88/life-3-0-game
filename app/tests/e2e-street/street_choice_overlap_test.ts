import { expect, test, type Page } from '@playwright/test';
import { LINES, seedJson, seedSave, continueIfAsked, type SeedActs } from '../support/e2e';

/**
 * Retour de contrôle 2026-11-08 : à la scène j1.roux, la liste des destinations recouvrait le centre de l'option `laugh` (le clic de la joueuse tombait
 * sur une destination). Tout bouton d'option du panneau doit être celui que touche un vrai clic en son centre, à chaque taille de fenêtre réelle.
 */
test.use({ locale: 'fr-FR' });
test.setTimeout(300_000);

const act = (day: number, minute: number, kind: string, id: string, option: string | null = null): SeedActs => ({ day, minute, kind, id, option });
const BEFORE_ROUX: SeedActs[] = [act(1, 420, 'choice', 'j1.phone', 'take'), act(1, 421, 'choice', 'j1.component', 'leave')];
const SIZES = [{ width: 1440, height: 780 }, { width: 1366, height: 660 }, { width: 1280, height: 650 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }, { width: 960, height: 540 }, { width: 1920, height: 1080 }];
const street = (page: Page) => page.locator('[data-ui="street"]');

test('test_every_option_of_the_open_choices_is_hit_by_a_real_click_at_j1_roux', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: LINES.w10, acts: BEFORE_ROUX }));
  await page.goto('./?webgl&episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  await expect(street(page)).toHaveAttribute('data-mode', 'guided');
  for (let i = 0; i < 40; i++) {
    if ((await street(page).getAttribute('data-scene')) === 'j1.roux' && (await street(page).getAttribute('data-beat')) === 'choice') break;
    const next = page.locator('[data-ui="continue"], [data-ui="skip"]').first();
    if (await next.count()) await next.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
  await expect(page.locator('[data-choice="j1.roux"]')).toBeAttached();
  const bad: string[] = [];
  for (const sz of SIZES) {
    await page.setViewportSize(sz);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('[data-choice] [data-option]')) {
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        if (hit === null || (hit !== el && !el.contains(hit))) out.push(`${el.closest('[data-choice]')!.getAttribute('data-choice')}/${el.getAttribute('data-option')} @${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)} couvert par ${hit?.tagName ?? 'rien'}${hit?.closest('[data-ui]')?.getAttribute('data-ui') ?? ''}`);
      }
      const dest = document.querySelector('[data-ui="destinations"]')?.getBoundingClientRect();
      const roux = document.querySelector('[data-choice="j1.roux"]')?.getBoundingClientRect();
      return { out, dest: dest === undefined ? null : `${Math.round(dest.x)},${Math.round(dest.y)} ${Math.round(dest.width)}x${Math.round(dest.height)}`, roux: roux === undefined ? null : `${Math.round(roux.x)},${Math.round(roux.y)} ${Math.round(roux.width)}x${Math.round(roux.height)}` };
    });
    console.log(`${sz.width}x${sz.height} dest=${r.dest} roux=${r.roux}`);
    for (const o of r.out) bad.push(`${sz.width}x${sz.height} ${o}`);
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('test_laugh_is_hit_from_the_first_frame_the_choice_is_open', async ({ page }) => {
  for (const sz of [{ width: 1280, height: 720 }, { width: 960, height: 540 }]) {
    await page.setViewportSize(sz);
    await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: LINES.w10, acts: BEFORE_ROUX }));
    await page.goto('./?webgl&episode=semaine');
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await expect(street(page)).toHaveAttribute('data-mode', 'guided');
    for (let i = 0; i < 60; i++) {
      if ((await street(page).getAttribute('data-scene')) === 'j1.roux' && (await street(page).getAttribute('data-beat')) === 'choice') break;
      const next = page.locator('[data-ui="continue"], [data-ui="skip"]').first();
      if (await next.count()) await next.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(200);
    }
    const samples = await page.evaluate(async () => {
      const out: string[] = [];
      for (let i = 0; i < 25; i++) {
        const el = document.querySelector<HTMLElement>('[data-choice="j1.roux"] [data-option="laugh"]');
        if (el === null) { out.push('absent'); } else {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          const b = el.getBoundingClientRect();
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          const ok = hit !== null && (hit === el || el.contains(hit));
          out.push(ok ? 'ok' : `COUVERT ${hit?.tagName}[${hit?.closest('[data-ui]')?.getAttribute('data-ui')}] opt@${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)}x${Math.round(b.height)} vp ${innerWidth}x${innerHeight}`);
        }
        await new Promise((r) => setTimeout(r, 80));
      }
      return out;
    });
    console.log(`${sz.width}x${sz.height}`, [...new Set(samples)].join(' | '));
    expect(samples.filter((x) => x.startsWith('COUVERT')), `${sz.width}x${sz.height}`).toEqual([]);
  }
});
