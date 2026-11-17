import { expect, test, type Page } from '@playwright/test';
import { seedJson, seedSave, continueIfAsked } from '../support/e2e';
import { lineWith, playGuided } from '../support/guided_e2e';

/**
 * Rue guidée, build de production [retours Cynthia 2026-11-08, « Je suis toujours en lundi 4 mars »] : au relevé du soir du J1 (temps `recap`),
 * « Continuer » reçoit un VRAI clic Playwright (contrôle d'actionnabilité, sans `force`) et le jour passe au J2. Le relevé précis faisait 948 px
 * de haut à 1280x720 et recouvrait le bouton : sa borne `max-block-size: min(560px, 60 %)` ne se résolvait pas (60 % d'un parent de hauteur
 * auto), le clic de la joueuse tombait sur le relevé. `playGuided` clique en JS (`el.click()`), sans contrôle de recouvrement : il ne le voyait pas.
 */
test.use({ locale: 'fr-FR' });
test.setTimeout(600_000);

const street = (page: Page) => page.locator('[data-ui="street"]');
/** Fin du parcours voulue, levée depuis le crochet : `playGuided` n'a pas d'arrêt au premier relevé. */
class ReachedRecap extends Error {}

/** Fenêtres réelles d'un Chrome de Mac chez Cynthia, plus le 16:9 des anciennes suites [contrôleur, 2026-11-08]. */
const SIZES = [{ width: 1440, height: 780 }, { width: 1366, height: 660 }, { width: 1280, height: 650 }, { width: 960, height: 540 }, { width: 1920, height: 1080 }] as const;

/** Le geste du temps présent (Continuer, ou le bouton de la semaine du dernier relevé, ou celui de l'issue), et ce qui est sous son centre. */
async function gestureHit(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-ui="continue"], [data-ui="recap-week"], [data-ui="outcome-continue"]');
    if (el === null) return 'aucun bouton';
    el.scrollIntoView({ block: 'nearest' });
    const b = el.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    if (hit !== null && (hit === el || el.contains(hit))) return 'ok';
    return `${el.getAttribute('data-ui')} recouvert par ${hit?.closest('[data-ui]')?.getAttribute('data-ui') ?? 'rien'}`;
  });
}

test('test_recap_and_outcome_button_uncovered_every_day_at_real_sizes', async ({ page }) => {
  // Arrange : une semaine guidée entière, jouée au clic (playGuided juge déjà chaque clic par elementFromPoint)
  test.setTimeout(1_800_000);
  await page.setViewportSize({ width: 960, height: 540 });
  await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: lineWith({}) }));
  await page.goto('/?episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  const bad: string[] = []; const seen: string[] = [];
  // Act : à chaque relevé du soir et à l'issue, la fenêtre passe par les cinq tailles
  await playGuided(page, {}, {
    through: 7,
    onBeat: async (beat, _scene, s) => {
      if (beat !== 'recap' && beat !== 'outcome') return;
      if (seen.includes(`${beat}.${s.day}`)) return;
      seen.push(`${beat}.${s.day}`);
      for (const size of SIZES) {
        await page.setViewportSize(size);
        await page.waitForTimeout(300);                                  // l'arrangement des zones suit le redimensionnement
        const hit = await gestureHit(page);
        if (hit !== 'ok') bad.push(`J${s.day} ${beat} ${size.width}x${size.height} : ${hit}`);
      }
      await page.setViewportSize({ width: 960, height: 540 });
      await page.waitForTimeout(300);
    },
  });
  // Assert : sept relevés vus, aucun geste recouvert
  expect(seen.filter((k) => k.startsWith('recap.')).length, seen.join(', ')).toBeGreaterThanOrEqual(6);
  expect(bad, bad.join('\n')).toEqual([]);
});

for (const size of [{ width: 1280, height: 720 }, { width: 960, height: 540 }]) {
  test(`test_recap_continue_real_click_reaches_next_day_${size.width}x${size.height}`, async ({ page }) => {
    // Arrange : partie neuve en rue guidée, jouée au clic jusqu'au relevé du soir du J1
    await page.setViewportSize(size);
    await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: lineWith({}) }));
    await page.goto('/?episode=semaine');
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await playGuided(page, {}, { onBeat: async (beat) => { if (beat === 'recap') throw new ReachedRecap(); } })
      .then(() => { throw new Error('le relevé du soir du J1 n\'est jamais venu'); }, (e: unknown) => { if (!(e instanceof ReachedRecap)) throw e; });
    await expect(street(page)).toHaveAttribute('data-beat', 'recap');
    await expect(street(page)).toHaveAttribute('data-day', '1');

    // Assert (géométrie) : le relevé tient au-dessus de la barre d'avance, et le point visé par le clic est bien le bouton
    const cont = page.locator('[data-ui="continue"]');
    await expect(cont).toBeVisible();
    const geo = await page.evaluate(() => {
      const c = document.querySelector('[data-ui="continue"]')!.getBoundingClientRect();
      const r = document.querySelector('[data-ui="recap"]')!.getBoundingClientRect();
      const hit = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2);
      return { gap: c.y - (r.y + r.height), hit: hit?.closest('[data-ui]')?.getAttribute('data-ui') ?? '' };
    });
    expect(geo.hit, 'le clic au centre de « Continuer » touche').toBe('continue');
    expect(geo.gap, 'bas du relevé au-dessus de « Continuer »').toBeGreaterThanOrEqual(0);

    // Act : le geste de la joueuse, un vrai clic
    await cont.click();

    // Assert : la nuit passe, le jour suivant commence
    await expect.poll(async () => street(page).getAttribute('data-beat'), { timeout: 30_000 }).not.toBe('recap');
    for (let i = 0; i < 20 && (await street(page).getAttribute('data-day')) === '1'; i++) {   // la nuit n'a que « Passer »
      const skip = page.locator('[data-ui="skip"]');
      if (await skip.isVisible()) await skip.click().catch(() => undefined);
      await page.waitForTimeout(500);
    }
    await expect(street(page)).toHaveAttribute('data-day', '2');
  });
}
