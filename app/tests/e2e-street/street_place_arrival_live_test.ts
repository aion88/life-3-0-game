import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Retour de playtest de Cynthia, 2026-11-03, dans la rue VIVANTE en français : « on m'explique pas quel contrôle, où j'arrive »,
 * « on me dit juste : Nadia, le contrôle », « je marche au milieu d'un mur et on m'écrit d'un seul coup le contrôle ».
 * (1) le narrateur dit où l'on est quand un groupe s'ouvre ; (2) l'intitulé d'un groupe est une action ; (3) un choix de lieu ne s'ouvre
 * qu'à portée du lieu et en vue. Captures : `production/qa/evidence/ui/2026-11-03-arrivee/`.
 */
const EVIDENCE = '../production/qa/evidence/ui/2026-11-03-arrivee';
const fr = JSON.parse(readFileSync('src/data/strings/fr.json', 'utf8')) as Record<string, string>;
const press = (page: Page, selector: string): Promise<void> => page.locator(selector).evaluate((e) => { (e as HTMLElement).click(); });
const shot = async (page: Page, name: string): Promise<void> => { mkdirSync(EVIDENCE, { recursive: true }); await page.screenshot({ path: `${EVIDENCE}/${name}.png` }); };
const player = async (page: Page): Promise<{ x: number; z: number }> => (await st(page, 'state')).player;
const open = (page: Page, id: string): Promise<number> => page.locator(`[data-choice="${id}"]`).count();
const SOUTH = 0, EAST = Math.PI / 2, WEST = -Math.PI / 2, NORTH = Math.PI;   // cap de `stepWalk` : 0 face à -z (vers le checkpoint)

/** Ouvre le J1 en français, passe l'accueil, règle les deux gestes du logement : il ne reste que la rue. */
async function streetDayOne(page: Page, vp = { width: 1920, height: 1080 }): Promise<void> {
  await openCapture(page, { lang: 'fr', acts: [], query: '', viewport: vp });
  await settle(page, 0);
  await press(page, '[data-ui="welcome-skip"]');
  await st(page, 'step', 0);
}
async function placeAt(page: Page, x: number, z: number, heading: number): Promise<void> {
  await st(page, 'placeAt', x, z, heading);
  await st(page, 'step', 50, { render: false });
  await st(page, 'step', 0);
}

test('test_live_group_headers_are_actions_at_home', async ({ page }) => {
  test.setTimeout(240_000);
  await streetDayOne(page);
  for (const id of ['j1.phone', 'j1.component']) {
    const name = page.locator(`[data-choice="${id}"] [data-ui="choice-name"]`);
    await expect(name, `${id} : l'intitulé est une action`).toHaveText(fr[`w10.choice.${id}`]!);
    await expect(name).toBeVisible();
  }
  expect(fr['w10.choice.j1.phone']).toBe('Décider du téléphone');
  await shot(page, 'intitules-logement-1920');
});

for (const vp of [{ width: 1920, height: 1080 }, { width: 960, height: 540 }]) {
  test(`test_live_checkpoint_opens_at_the_barrier_not_mid_street_and_the_narrator_says_where_at_${vp.width}`, async ({ page }) => {
    test.setTimeout(240_000);
    await streetDayOne(page, vp);
    for (const [choice, option] of [['j1.phone', 'take'], ['j1.component', 'leave']] as const) {
      await press(page, `[data-choice="${choice}"] [data-option="${option}"]`); await press(page, '[data-ui="confirm"]'); await st(page, 'step', 0);
    }
    let midStreetSeen = false;
    await page.keyboard.down('KeyW');
    try {
      for (let t = 0; t < 60_000; t += 250) {
        await st(page, 'step', 250, { render: false });
        const p = await player(page);
        if (p.z <= 0 && p.z >= -3 && !midStreetSeen) {             // devant l'étal, à mi-rue : là où le contrôle surgissait (zone de 11,5 m)
          midStreetSeen = true;
          await st(page, 'step', 0);
          expect(await open(page, 'checkpoint.j1'), `à mi-rue (z ${p.z.toFixed(1)}), le contrôle ne surgit pas`).toBe(0);
          if (vp.width === 1920) await shot(page, 'mi-rue-sans-controle-1920');
        }
        if (p.z <= -10.0) break;
      }
    } finally { await page.keyboard.up('KeyW'); }
    expect(midStreetSeen, 'la marche passe bien par la mi-rue').toBe(true);
    await settle(page, 1000);
    expect(await open(page, 'checkpoint.j1'), 'à la barrière, le contrôle s\'ouvre').toBe(1);
    const narration = page.locator('[data-ui="narration"] .c-window');
    await expect(narration, 'le narrateur dit où l\'on arrive').toHaveText(fr['w10.arrive.checkpoint']!);
    const band = await page.locator('[data-ui="root"]').evaluate((r) => parseFloat(getComputedStyle(r).getPropertyValue('--s-letterbox-band-px')) || 0);
    const b = (await page.locator('[data-ui="narration"]').boundingBox())!;
    expect(b.y, 'ligne du narrateur sous la bande haute').toBeGreaterThanOrEqual(band);
    expect(b.y + b.height, 'ligne du narrateur au-dessus de la bande basse').toBeLessThanOrEqual(vp.height - band);
    expect(await narration.evaluate((w) => w.clientHeight / parseFloat(getComputedStyle(w).lineHeight)), 'au moins une ligne entière visible').toBeGreaterThanOrEqual(0.95);
    if (vp.width === 960) {
      // à 960, l'objectif cède en dernier recours pour que la narration garde ses deux lignes (T15 fix 1) : coupé, il le dit, par un chevron
      // posé DANS sa carte, pas au pied de Z-gauche (T15 fix 2 : la règle d'ancre de `zones.css` ne nommait pas l'objectif)
      const o = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>('[data-ui="objective"]')!;
        const win = card.querySelector<HTMLElement>('.c-window')!;
        const after = getComputedStyle(card, '::after');
        const r = card.getBoundingClientRect();
        // le chevron est absolu : sa boîte se lit dans celle de son bloc contenant, qui n'est la carte que si elle est positionnée
        const anchored = getComputedStyle(card).position !== 'static';
        const left = parseFloat(after.left), bottom = parseFloat(after.bottom), w = parseFloat(after.width), h = parseFloat(after.height);
        const chevron = { x: r.left + left - w / 2, y: r.bottom - bottom - h, w, h };
        return { cut: win.scrollHeight > win.clientHeight + 0.5, more: card.hasAttribute('data-more'), content: after.content, anchored, card: { x: r.left, y: r.top, w: r.width, h: r.height }, chevron };
      });
      expect(o.cut, 'à 960, au poste, l\'objectif est rogné (sinon ce contrôle ne dit rien)').toBe(true);
      expect(o.more, 'objectif coupé : data-more posé sur sa carte').toBe(true);
      expect(o.content, 'le chevron est dessiné').not.toBe('none');
      expect(o.anchored, 'le chevron s\'ancre à la carte d\'objectif').toBe(true);
      expect(o.chevron.x).toBeGreaterThanOrEqual(o.card.x);
      expect(o.chevron.x + o.chevron.w).toBeLessThanOrEqual(o.card.x + o.card.w);
      expect(o.chevron.y, 'chevron dans la boîte de la carte').toBeGreaterThanOrEqual(o.card.y);
      expect(o.chevron.y + o.chevron.h, 'chevron dans la boîte de la carte').toBeLessThanOrEqual(o.card.y + o.card.h);
    }
    await shot(page, `arrivee-controle-${vp.width}`);
  });
}

test('test_live_place_choices_open_in_view_never_in_the_back', async ({ page }) => {
  test.setTimeout(240_000);
  await streetDayOne(page);
  // le contrôle, à 6,7 m de la barrière, dans la zone : dans le dos ou face au mur, rien ; en vue, il s'ouvre ; se retourner ne le referme pas
  await placeAt(page, 3, -6, NORTH);
  expect(await open(page, 'checkpoint.j1'), 'dans le dos').toBe(0);
  await placeAt(page, 3, -6, EAST);
  expect(await open(page, 'checkpoint.j1'), 'face au mur est').toBe(0);
  await settle(page, 1500);                                                     // la caméra rejoint le cap avant la capture
  expect(await open(page, 'checkpoint.j1'), 'toujours rien face au mur').toBe(0);
  await shot(page, 'face-au-mur-sans-controle-1920');
  await placeAt(page, 3, -6, SOUTH);
  expect(await open(page, 'checkpoint.j1'), 'en vue').toBe(1);
  await placeAt(page, 3, -6, NORTH);
  expect(await open(page, 'checkpoint.j1'), 'déjà ouvert : se retourner ne le fait pas clignoter').toBe(1);
  // l'étal de Nadia (x -6, z -2), à 4 m : dans le dos, rien ; en vue, le groupe et sa ligne
  await placeAt(page, 0, 10, SOUTH);
  expect(await open(page, 'm2.nadia')).toBe(0);
  await placeAt(page, -2, -2, EAST);
  expect(await open(page, 'm2.nadia'), 'l\'étal dans le dos').toBe(0);
  await placeAt(page, -2, -2, WEST);
  expect(await open(page, 'm2.nadia'), 'l\'étal en vue').toBe(1);
  await expect(page.locator('[data-ui="narration"] .c-window')).toHaveText(fr['w10.arrive.m2.nadia']!);
  await expect(page.locator('[data-choice="m2.nadia"] [data-ui="choice-name"]')).toHaveText('Parler à Nadia');
  await settle(page, 500);
  await shot(page, 'arrivee-nadia-1920');
});
