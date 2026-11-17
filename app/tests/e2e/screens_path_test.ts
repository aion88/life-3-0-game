import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { LINES, advance, displayLetters, installClock, readSave, seedJson, seedSave, type SeedActs, continueIfAsked } from '../support/e2e';

/**
 * Parcours des sept écrans du plan 03 dans le navigateur [T15, R-03.9], en français puis en anglais pour le premier.
 * L'horloge de la page est accélérée (`page.clock`) : le temps de chaque écran ne suit que les images, et aucune attente n'est réelle.
 * La rue réelle (02a) n'a pas de corps livrés : elle monte puis affiche son erreur nommée. Le passage rue -> bilan d'une fin anticipée est donc
 * posé par la sauvegarde (`phase: 'bilan'`, sans actes), que la rue écrirait elle-même ; il se rejoue sur la rue réelle quand les corps arrivent.
 */
type Lang = 'fr' | 'en';
const strings = (lang: Lang): Record<string, string> => JSON.parse(readFileSync(`src/data/strings/${lang}.json`, 'utf8')) as Record<string, string>;
const fill = (text: string, p: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (_m, k: string) => p[k] ?? `{${k}}`);
const timing = JSON.parse(readFileSync('src/data/ui/timing.json', 'utf8')) as { causesEditionsMs: number[]; minReadMs: number; costDelayMs: number };
const CAUSES_MS = timing.causesEditionsMs.reduce((a, b) => a + b, 0);
const STREET = '[data-ui="street"]';

/** Fait avancer l'horloge par pas de `step` ms jusqu'à ce que `selector` existe ; échoue au-delà de `capMs`. */
async function advanceUntil(page: Page, selector: string, capMs = 240_000, step = 2_000): Promise<void> {
  for (let t = 0; t < capMs; t += step) {
    if (await page.locator(selector).count() > 0) return;
    await advance(page, step);
  }
  throw new Error(`« ${selector} » absent après ${capMs} ms d'horloge accélérée`);
}

/** Répond aux onze questions : désigner, confirmer, attendre la lecture, continuer. La onzième sort par le mur vers le fast-forward. */
async function answerAll(page: Page, line: string): Promise<void> {
  const letters = displayLetters(line);
  // Prologue de la maire (français) : un clic répond et passe à la question suivante, sans bouton « continuer ».
  if (await page.locator('main.mayor').count() > 0) {
    for (const [i, letter] of letters.entries()) {
      await expect(page.locator('.mayor-folio')).toContainText(`Question ${i + 1} sur ${letters.length}`);
      await page.locator(`main.mayor [data-option="${letter}"]`).click();
    }
    return;
  }
  for (const [i, letter] of letters.entries()) {
    const option = page.locator(`[data-option="${letter}"]`);
    await option.click();
    await option.click();
    await advance(page, timing.minReadMs + timing.costDelayMs + 200);
    await page.getByTestId('q-continue').click();
    if (i === letters.length - 1) break;
  }
}

async function boot(page: Page, json: string | null): Promise<void> {
  await installClock(page);
  if (json !== null) await seedSave(page, json);
  await page.goto('./?episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
}

const dataPage = (page: Page): Promise<string | null> => page.getByTestId('bilan-page').getAttribute('data-page');

for (const lang of ['fr', 'en'] as const) {
  test(`test_path_questionnaire_to_bilan_${lang}`, async ({ page }) => {
    const s = strings(lang);
    await boot(page, null);
    await page.locator(`[data-lang="${lang}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await page.getByTestId('warning-continue').click();
    await answerAll(page, LINES.w10);
    await expect(page.getByTestId('ff-year')).toHaveCount(1);
    await advanceUntil(page, STREET);
    // la rue réelle monte ; sa sauvegarde dit `street`, et rien d'autre n'a bougé
    const onStreet = await readSave(page);
    expect(onStreet).toMatchObject({ phase: 'street', lang, acts: [] });
    expect(Object.keys(onStreet!['answers'] as object)).toHaveLength(11);

    // fin anticipée, sans actes : la rue enverrait `bilan` ; on pose ce que la rue écrirait et on recharge
    await page.evaluate(([k, v]) => { localStorage.setItem(k!, v!); }, ['aiaftermath.v2.save', JSON.stringify({ ...onStreet, phase: 'bilan', rev: (onStreet!['rev'] as number) + 1 })]);
    await page.reload();
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await expect(page.getByTestId('bilan-page')).toHaveCount(1);
    // fin anticipée : la fiche d'abord, sans journal des sept jours (seulement ce qu'on portait)
    expect(await dataPage(page)).toBe('sheet');
    await expect(page.locator('[data-page-title]')).toHaveText(s['bilan.sheet.title']!);
    expect(await page.getByTestId('bilan-page').locator('li').count()).toBeLessThan(14);
    await expect(page.getByTestId('bilan-world-redirect')).toHaveCount(0);

    await page.getByTestId('bilan-sources').click();
    await expect(page.getByTestId('sources-back')).toHaveCount(1);
    await page.getByTestId('sources-back').click();
    await expect(page.getByTestId('bilan-page')).toHaveCount(1);
    expect((await readSave(page))!['phase']).toBe('bilan');
  });
}

test('test_path_redirected_arrival_shows_d140_line_and_space_continues_to_the_street', async ({ page }) => {
  const s = strings('en');
  await boot(page, seedJson({ lang: 'en', phase: 'fastforward', line: LINES.redirected }));
  // plus de commandes (2026-11-03) : Espace saute de une en une jusqu'à l'arrivée, puis à la rue
  await advanceUntil(page, '[data-testid="ff-arrival"]', 20_000, 250);
  const line = fill(s['redirect.arrival']!, { computed: s['world.w03.name']!, lived: s['world.w10.name']! });
  await expect(page.getByTestId('ff-arrival')).toContainText(line);
  expect((await readSave(page))!['phase']).toBe('fastforward');
  await page.keyboard.press('Space');
  await expect(page.locator(STREET)).toHaveCount(1);
  expect((await readSave(page))!['phase']).toBe('street');

  // le bilan de la même partie nomme les deux mondes
  await page.evaluate(([k, v]) => { localStorage.setItem(k!, v!); }, ['aiaftermath.v2.save', seedJson({ lang: 'en', phase: 'bilan', line: LINES.redirected })]);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  await expect(page.getByTestId('bilan-world-redirect')).toContainText(fill(s['redirect.bilan']!, { computed: s['world.w03.name']!, lived: s['world.w10.name']! }));
});

test('test_path_extinction_to_causes_to_extinction_bilan_and_replay', async ({ page }) => {
  const s = strings('en');
  await boot(page, seedJson({ lang: 'en', phase: 'fastforward', line: LINES.w07 }));
  await advanceUntil(page, '[data-testid="causes-edition"]'); // fast-forward, silence compris
  expect(await page.locator(STREET).count()).toBe(0);
  // trois éditions, puis le bouton à 40 s de causes ; jamais avant
  await advance(page, CAUSES_MS - 4_000);
  await expect(page.getByTestId('causes-replay')).toHaveCount(0);
  await advance(page, 4_000 + 1_000);
  await expect(page.getByTestId('causes-replay')).toHaveCount(1);
  await page.getByTestId('causes-replay').click();
  await expect(page.getByTestId('bilan-page')).toHaveCount(1);
  expect((await readSave(page))!['phase']).toBe('bilan');
  // extinction : pas de fiche ni de dossier, « Les autres » d'abord (la courbe est retirée du bilan)
  expect(await dataPage(page)).toBe('others');
  await expect(page.locator('[data-page-title]')).toHaveText(s['bilan.others.title']!);
  await expect(page.getByTestId('bilan-world-redirect')).toHaveCount(0);
  await page.getByTestId('bilan-replay').click();
  await expect(page.getByTestId('warning-continue')).toHaveCount(1);
});

test('test_path_resume_to_bilan_from_seeded_save', async ({ page }) => {
  // actes de `actsOfProfile('Zéro nom', { audition: 'none' })` : copie figée, l'égalité est tenue par `screens_path_fixture_test.ts`
  const acts = JSON.parse(readFileSync('tests/fixtures/e2e/zero-name-acts.json', 'utf8')) as SeedActs[];
  await boot(page, seedJson({ lang: 'fr', phase: 'bilan', line: LINES.w10, acts }));
  await expect(page.getByTestId('bilan-page')).toHaveCount(1);
  expect(await page.locator(STREET).count()).toBe(0);
  const save = await readSave(page);
  expect(save).toMatchObject({ phase: 'bilan' });
  expect(save!['acts']).toHaveLength(acts.length);
  // semaine finie : fiche d'abord, avec le journal des sept jours et ce qu'on portait
  expect(await dataPage(page)).toBe('sheet');
  await expect(page.locator('[data-page-title]')).toHaveText(strings('fr')['bilan.sheet.title']!);
  expect(await page.getByTestId('bilan-page').locator('li').count()).toBeGreaterThanOrEqual(14);
});

/** Corps de personnages livrés ? Sans eux la rue réelle n'a pas de repli et affiche son erreur nommée (02a, étape 6). */
const scene = JSON.parse(readFileSync('src/street/data/w10.scene.json', 'utf8')) as { npcPlaces: Record<string, { kind: string; bodyId: string }>; characters: { crowdBodies: { v: string[] } } };
const REQUIRED = ['player', ...Object.values(scene.npcPlaces).filter((p) => p.kind === 'person').map((p) => p.bodyId), scene.characters.crowdBodies.v[0]!];
const MISSING = REQUIRED.filter((id) => !existsSync(`public/worlds/w10/characters/char.${id}.glb`));
const hasRealStreet = MISSING.length === 0;

test('test_path_real_street_is_skipped_naming_02a', async ({ page }) => {
  test.skip(!hasRealStreet, `plan 02a : la rue réelle attend ses corps (étape 6), manquants : ${MISSING.join(', ')}`);
  await boot(page, seedJson({ lang: 'en', phase: 'street', line: LINES.w10 }));
  await expect(page.locator(STREET)).toHaveCount(1);
  await expect(page.locator('[data-ui="street-error"]')).toHaveCount(0);
});
