import { expect, test, type Page } from '@playwright/test';
import { readSave } from '../support/e2e';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Séquence jouée dans le runtime VIVANT [retour de Cynthia, playtest 2026-11-03 : « Contourner le poste : il ne se passe rien »]. Un choix confirmé
 * au checkpoint se joue : le joueur perd la main, marche seul vers sa cible, une ligne de narration s'affiche, le segment en attente de la barre
 * Dossier pulse ; l'acte n'est écrit qu'à la fin ; un clic passe la séquence. `SEQ_SHOTS=<dossier>` écrit une capture en milieu de séquence.
 */
const BYPASS_LINES = /Personne\. La file|quelque chose a tourné la tête|Deux hommes au bout de la cour/;
const state = (page: Page) => st(page, 'state');
const press = (page: Page, selector: string): Promise<void> => page.locator(selector).evaluate((e) => { (e as HTMLElement).click(); });
const acts = async (page: Page): Promise<unknown[]> => ((await readSave(page))!['acts'] as unknown[]);
const moved = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

async function toCheckpoint(page: Page, project: string): Promise<void> {
  await openCapture(page, { lang: 'fr', viewport: { width: 1920, height: 1080 }, query: project === 'webgl2' ? 'webgl' : '' });
  await page.keyboard.down('KeyW');
  try { for (let t = 0; t < 60_000; t += 500) { await st(page, 'step', 500, { render: false }); if ((await state(page)).player.z <= -4.8) break; } } finally { await page.keyboard.up('KeyW'); }
  await page.waitForSelector('[data-choice="checkpoint.j1"]', { state: 'attached' });
  await st(page, 'step', 1000, { render: false });
}

test('test_bypass_plays_a_sequence_then_applies_the_act_and_a_click_skips_it', async ({ page }, info) => {
  test.setTimeout(240_000);
  await toCheckpoint(page, info.project.name);
  await press(page, '[data-choice="checkpoint.j1"] [data-option="bypass"]');
  const before = await acts(page);
  const start = (await state(page)).player;
  await press(page, '[data-ui="confirm"]');

  // milieu de séquence : le joueur a marché, la narration est dite, le panneau est retiré, la barre pulse, AUCUN acte n'est encore écrit
  await st(page, 'step', 2500, { render: false });
  await settle(page, 0);
  const mid = (await state(page)).player;
  expect(moved(start, mid), 'le joueur a marché seul').toBeGreaterThan(1.5);
  expect((await acts(page)).length, "l'acte n'est appliqué qu'à la fin de la séquence").toBe(before.length);
  const line = page.locator('[data-ui="narration"]');
  await expect(line).toBeVisible();
  await expect(line).toContainText(BYPASS_LINES);                      // la ligne du tirage joué : libre, nacelle ou patrouille [GDD §0.3]
  await expect(page.locator('[data-ui="choices"]')).toHaveCount(0);
  await expect(page.locator('[data-ui="sequence-skip"]')).toBeVisible();   // « un clic passe la scène » pendant toute la séquence
  const free = /Personne/.test((await line.textContent()) ?? '');
  if (free) await expect(page.locator('[data-ui="dossier"]')).not.toHaveAttribute('data-pulse', /.*/);   // effet nul : aucune pulsation
  else await expect(page.locator('[data-ui="dossier"]')).toHaveAttribute('data-pulse', 'down');
  if (process.env['SEQ_SHOTS']) await page.screenshot({ path: `${process.env['SEQ_SHOTS']}/sequence-mid.png` });

  // l'entrée est verrouillée : une touche de marche ne détourne pas le personnage, elle ne le fait pas non plus avancer après coup
  await page.keyboard.down('KeyS');
  await st(page, 'step', 300, { render: false });
  await page.keyboard.up('KeyS');
  expect((await acts(page)).length).toBe(before.length);

  // un clic passe la séquence : l'état final est posé, puis l'acte est écrit
  await page.mouse.click(960, 300);
  await st(page, 'step', 100, { render: false });
  const after = await acts(page);
  expect(after.length, 'le clic applique l acte une fois').toBe(before.length + 1);
  expect(after.at(-1)).toMatchObject({ kind: 'lane', id: 'checkpoint', option: 'bypass' });
  const end = (await state(page)).player;
  expect(end.x, 'cible : la porte de cour, côté ouest').toBeLessThan(-6);
  await expect(line).toContainText(BYPASS_LINES);                      // la ligne reste après l'acte
  await expect(page.locator('[data-ui="sequence-skip"]')).toHaveCount(0);
  await st(page, 'step', 3000, { render: false });
  expect((await acts(page)).length, "l'acte n'est pas rejoué").toBe(before.length + 1);

  // la marche libre est rendue : W déplace de nouveau le joueur
  const free0 = (await state(page)).player;
  await page.keyboard.down('KeyD');
  await st(page, 'step', 1000, { render: false });
  await page.keyboard.up('KeyD');
  expect(moved(free0, (await state(page)).player), 'la marche libre reprend').toBeGreaterThan(0.5);
});

test('test_bypass_sequence_ends_by_itself_and_applies_the_act_once', async ({ page }, info) => {
  test.setTimeout(240_000);
  await toCheckpoint(page, info.project.name);
  await press(page, '[data-choice="checkpoint.j1"] [data-option="bypass"]');
  const before = (await acts(page)).length;
  await press(page, '[data-ui="confirm"]');
  await st(page, 'step', 4800, { render: false });
  const atDoor = (await state(page)).player;
  expect(moved(atDoor, { x: -6.5, z: -8.0 }), `à 4,8 s la joueuse est arrivée à pied devant la porte W1, en (${atDoor.x.toFixed(2)} ; ${atDoor.z.toFixed(2)})`).toBeLessThanOrEqual(0.3);
  expect((await acts(page)).length, 'pas encore fini à 4,8 s (durée 7 s)').toBe(before);
  await st(page, 'step', 3300, { render: false });                    // 8,1 s : même la variante la plus longue (patrouille, 7,8 s) est finie
  const out = (await state(page)).player;
  expect(moved(out, { x: -6.5, z: -16.0 }), `fini : de l'autre côté du poste, devant W2, en (${out.x.toFixed(2)} ; ${out.z.toFixed(2)})`).toBeLessThanOrEqual(0.3);
  expect((await acts(page)).length, 'fini : un acte').toBe(before + 1);
});

/**
 * Position EN PLEINE MARCHE, sans clic ni saut : à chaque jalon, la joueuse est là où la marche l'a menée (pas téléportée par une fin ou un passage).
 * `at` : instant après la confirmation (ms), le point attendu et la tolérance (m). Les points sont les ancres de `w10.sequences.json`.
 */
const WALKS = {
  comply: { line: /Quatorze mots|Les doigts trouvent le composant/, marks: [{ atMs: 2200, x: 3.3, z: -10.0, tol: 0.5 }, { atMs: 5600, x: 5.2, z: -11.4, tol: 0.7 }], end: { x: 5.2, z: -12.4 } },
  refuse: { line: /Tu sors de la file/, marks: [{ atMs: 1500, x: -2.1, z: -4.1, tol: 0.7 }], end: { x: -4.5, z: -3.0 } },
} as const;
for (const [option, w] of Object.entries(WALKS)) {
  test(`test_${option}_plays_its_own_sequence_before_the_act`, async ({ page }, info) => {
    test.setTimeout(240_000);
    await toCheckpoint(page, info.project.name);
    await press(page, `[data-choice="checkpoint.j1"] [data-option="${option}"]`);
    const before = (await acts(page)).length, start = (await state(page)).player;
    await press(page, '[data-ui="confirm"]');
    expect(await page.locator('[data-ui="street"], body').first().evaluate((e) => !!e.closest('[data-sequencing="true"]') || !!document.querySelector('[data-sequencing="true"]')), `${option} : curseur masqué pendant la séquence`).toBe(true);
    let t = 0;
    for (const m of w.marks) {
      await st(page, 'step', m.atMs - t, { render: false }); t = m.atMs;
      if (process.env['SEQ_SHOTS']) { await st(page, 'step', 50, { render: true }); await page.screenshot({ path: `${process.env['SEQ_SHOTS']}/${option}-${m.atMs}.png` }); t += 50; }
      const p = (await state(page)).player;
      expect(moved(p, { x: m.x, z: m.z }), `${option} à ${m.atMs} ms : en marche vers (${m.x} ; ${m.z}), en (${p.x.toFixed(2)} ; ${p.z.toFixed(2)})`).toBeLessThanOrEqual(m.tol);
      expect((await acts(page)).length, `${option} : pas d'acte avant la fin`).toBe(before);
    }
    expect(moved(start, (await state(page)).player) > 1, `${option} : le personnage marche seul`).toBe(true);
    await expect(page.locator('[data-ui="narration"]')).toContainText(w.line);
    await st(page, 'step', 7000 - t, { render: false });
    const end = (await state(page)).player;
    expect(moved(end, w.end), `${option} : fini sur la cible, en (${end.x.toFixed(2)} ; ${end.z.toFixed(2)})`).toBeLessThanOrEqual(0.3);
    expect((await acts(page)).length, `${option} : l'acte vient après`).toBe(before + 1);
  });
}
