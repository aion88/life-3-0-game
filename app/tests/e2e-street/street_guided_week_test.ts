import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { LINES, seedJson, seedSave, continueIfAsked, type SeedActs } from '../support/e2e';
import { lineWith, PASSIVE, playGuided, stateOf } from '../support/guided_e2e';
import { SILENT_PICKS } from '../support/guided_paths';

/**
 * Rue guidée, la semaine de bout en bout [plan rue guidée J3-J7, T15 ; conception 2026-11-05 §7]. Build de production, headless, au clic et au
 * clavier : un chemin nommé jusqu'à l'audition, son issue, le relevé du dernier soir et le bilan ; un chemin à 0 mot ; une partie sauvegardée
 * arrêtée la nuit 4 qui rouvre sur le bilan ; aucun temps passif de plus de 3 s sans « Passer », jours 3 à 7 compris. Captures (une carte par
 * jour, les chaînes du bilan) sous `production/qa/evidence/street/2026-11-05-semaine/`, jamais ouvertes.
 */
test.use({ locale: 'fr-FR' });
// Budget : mesuré seul à 108 s (chemin nommé), 102 s et 78 s (les deux autres semaines) sous une charge de 7 à 10, en 640x360 ; le
// J1-J2 garde 240 s pour 42 s mesurées. Sous les charges de 36 à 66 vues pendant la tranche, une image coûte 7 à 13 fois plus.
test.setTimeout(600_000);

/** Chaînes FR lues du disque : l'import JSON direct ne passe pas sous Playwright (`needs an import attribute`). */
const FR = JSON.parse(readFileSync('src/data/strings/fr.json', 'utf8')) as Record<string, string>;
/** Partie du plan 02a arrêtée la nuit 4 (profil « Bavard »), actes de marche libre : rejouée par `replay(acts, ctxW10())`, `ended` au J4, 0 refus [mesuré, T15]. */
const ARRESTED_NIGHT4 = JSON.parse(readFileSync('tests/e2e-street/arrested-night4.json', 'utf8')) as SeedActs[];
const EVIDENCE = '../production/qa/evidence/street/2026-11-05-semaine';
/** Les parcours n'éprouvent pas le rendu : une petite fenêtre, car le WebGL logiciel rend une image en plusieurs secondes et chaque geste attend le fil principal. */
const SMALL = { width: 640, height: 360 };

/** Le chemin nommé du brief T15 : trois noms (Nadia au J3, la fille au J4, Marlène au J5), audition `all`. Issue `arrestedAudition` sur le metteur en scène [mesuré, T15]. */
const NAMED = { 'j3.marlene': 'name', 'j3.who': 'nadia', 'j4.neighbour': 'name', 'j4.who': 'fille', 'j5.bruno': 'name', 'j5.who': 'marlene', 'audition.j7': 'all' };
/** Chemin à 0 mot : `SILENT_PICKS` (`tests/support/guided_paths.ts`), qui dit comment il a été relevé et pourquoi il est arrêté la nuit 4. */
const SILENT = SILENT_PICKS;

/** La ligne d'arrestation du bilan pour la nuit `day` : `w10.end.arrestedNight`, `{jour}` = la date du jour (`w10.day.N.date`). */
const arrestedLine = (day: number): string => FR['w10.end.arrestedNight']!.replace('{jour}', FR[`w10.day.${day}.date`]!);

async function open(page: Page, seed: string): Promise<void> {
  await page.setViewportSize(SMALL);
  await seedSave(page, seed);
  await page.goto('/?episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
}

/** Le bilan est ouvert sur sa première page : la page « Les chaînes » se choisit dans la navigation des pages. */
async function toChains(page: Page): Promise<void> {
  await expect(page.getByTestId('bilan-page')).toBeVisible();
  await page.locator('[data-ui="page-nav"] button', { hasText: FR['bilan.page.chains.label']! }).click();
  await expect(page.getByTestId('bilan-page')).toHaveAttribute('data-page', 'chains');
}

/** Capture du bilan : écran de document, sans rue 3D ; une fenêtre haute pour que les chaînes tiennent (en 640x360, seule la navigation se voit). */
async function shotBilan(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 960, height: 1600 });
  // le changement de page glisse et fond : la capture attend la fin des animations, sinon le texte est pris à mi-fondu
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await page.screenshot({ path: `${EVIDENCE}/${name}.png`, fullPage: true });
}

const shotPerDay = (page: Page) => async (day: number): Promise<void> => {
  mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: `${EVIDENCE}/j${day}-carte.png` });
};

test.describe('rue guidée : la semaine', () => {
  // ROUGE CONNU (défaut de l'ancien mode semaine) : à 640x360, le message du soir (evening.ts:58, p.c-sticker) recouvre le bouton « Voir ta semaine » (recap-week) ; le clic est refusé. Capture : production/qa/evidence/mondes/dette/week-recap.png.
  test('test_week_named_path_reaches_bilan_with_chains', async ({ page }) => {
    await open(page, seedJson({ lang: 'fr', phase: 'street', line: lineWith({ Q11: 'C', Q04: 'A', Q05: 'C', Q16: 'B' }) }));
    const days: number[] = [];
    await playGuided(page, NAMED, { through: 7, onCard: async (day) => { days.push(day); await shotPerDay(page)(day); } });
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    await expect(page.locator('[data-ui="outcome"]')).toBeVisible();
    await expect(page.locator('[data-ui="outcome"]')).toHaveAttribute('data-end', 'arrestedAudition');
    await page.locator('[data-ui="outcome"] button').click();
    await expect(page.locator('[data-ui="recap"] ol')).toContainText(/Nadia/);
    await page.locator('[data-ui="recap-week"]').click();   // « Voir ta semaine »
    await toChains(page);
    await expect(page.locator('[data-ui="bilan-chains"] [data-chain]')).toHaveCount(4);
    await expect(page.locator('body')).not.toContainText(/Rejouer|n'est pas encore écrit/);
    await shotBilan(page, 'bilan-chaines-chemin-nomme');
  });

  test('test_week_silent_path_reaches_bilan', async ({ page }) => {
    // Écart au brief, mesuré : le chemin à 0 mot est arrêté dans la nuit, sans audition (la nuit 4 dans le navigateur, voir `SILENT`). Il va
    // donc au bilan par la fin anticipée : ni issue ni relevé du dernier soir, la ligne d'arrestation du jeudi en tête des chaînes, aucune
    // carte de fin de démonstration.
    await open(page, seedJson({ lang: 'fr', phase: 'street', line: LINES.w10 }));
    const beats = new Set<string>();
    await playGuided(page, SILENT, { through: 7, onBeat: async (beat) => { beats.add(beat); } });
    expect(beats.has('outcome')).toBe(false);
    await toChains(page);
    await expect(page.locator('[data-ui="bilan-chains-arrested"]')).toHaveText(arrestedLine(4));
    await expect(page.locator('[data-ui="demo-end"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Rejouer|n'est pas encore écrit/);
  });

  test('test_saved_arrest_night4_opens_bilan', async ({ page }) => {   // Review Focus 4, vraies données
    // la ligne de w10 (le brief n'en pose pas) : une sauvegarde de rue porte toujours ses réponses
    await open(page, seedJson({ lang: 'fr', phase: 'street', line: LINES.w10, acts: ARRESTED_NIGHT4 }));
    await toChains(page);
    await expect(page.locator('[data-ui="bilan-chains"]')).toContainText(FR['w10.day.4.date']!);
    await expect(page.locator('[data-ui="bilan-chains-arrested"]')).toHaveText(arrestedLine(4));
    await expect(page.locator('[data-ui="demo-end"]')).toHaveCount(0);
    await shotBilan(page, 'bilan-chaines-arrete-nuit-4');
  });

  test('test_no_passive_wait_over_3s_without_skip_week', async ({ page }) => {   // spec §9.6, jours 1 à 7
    await open(page, seedJson({ lang: 'fr', phase: 'street', line: lineWith({ Q11: 'C' }) }));
    const waits = new Set<string>();
    const daysSeen = new Set<string>();
    await playGuided(page, {}, {
      through: 7,
      onBeat: async (beat, at, seen) => {
        if (!PASSIVE.has(beat)) return;
        waits.add(beat); daysSeen.add(seen.day);
        // « Passer » est posé dans le même rendu que le temps passif : lu dans le même aller-retour que le temps (motif du test J1-J2)
        if (seen.skip) return;
        await expect.poll(async () => {
          const s = await stateOf(page);
          return s.skip || s.beat !== beat || s.scene !== at;
        }, { timeout: 3000 }).toBe(true);
      },
    });
    expect(waits).toEqual(new Set(['walk', 'wait', 'night']));
    expect([...daysSeen].sort()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    await expect(page.locator('[data-ui="outcome"]')).toBeVisible();   // chemin par défaut : il va à l'audition [mesuré, T15]
  });
});
