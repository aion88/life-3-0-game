import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Réplique en bulle sur la rue VIVANTE, en français, à 1920 x 1080 et à 960 x 540 [plan UI-C T8 ; I-3, I-8]. On clique les pieds d'une personne
 * (identifiant connu par `peopleFeet`) ; la bulle doit être ancrée À ELLE : son rectangle, lu par identifiant (`personRect(id)`), est celui que la
 * bulle évite, à la marge exacte, et la pointe de la queue dessinée reste hors de ce rectangle. Un panneau de choix est ouvert pendant tout le test
 * (seule sauvegarde de capture), et son interlocuteur (Nadia) est une autre personne : une bulle ancrée au PNJ le plus proche échoue ici.
 * Captures dans `SHOTS_DIR` si posé.
 */
const SHOTS = process.env['SHOTS_DIR'];
type R = { x: number; y: number; w: number; h: number };
const NPCS = ['nadia', 'bruno', 'marlene', 'yusuf', 'berenice'];
const boxOf = (page: Page, sel: string): Promise<R | null> => page.evaluate((s) => { const e = document.querySelector(s); if (e === null) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
const hit = (a: R, b: R): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (r: R, m: number): R => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
const near = (a: number, b: number, tol = 2): boolean => Math.abs(a - b) <= tol;

for (const vp of [{ width: 1920, height: 1080 }, { width: 960, height: 540 }]) {
  test(`test_live_bubble_is_anchored_to_the_clicked_person_${vp.width}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    await openCapture(page, { lang: 'fr', viewport: vp, query: info.project.name === 'webgl2' ? 'webgl' : '' });
    await settle(page, 4000);
    expect(await page.evaluate(() => (document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.8) as HTMLElement).dataset['ui'] ?? ''), 'aucune couche d\'interface ne couvre la rue : les clics atteignent la scène').not.toBe('fx');
    const margin = (24 * vp.width) / 1920;
    // les passants marchent : on attend qu'un passant libre (hors panneau, hors personnage) soit à portée, en bas de l'écran, et on le clique : la réplique est immédiate
    const isFree = (f: { x: number; y: number }): Promise<boolean> => page.evaluate((p) => { const e = document.elementFromPoint(p.x, p.y); return e !== null && e.closest('[data-ui="choices"],[data-ui="bracelet"],[data-ui="narration"],[data-ui="carnet"]') === null; }, f);
    let clicked: string | null = null; let person: R | null = null;
    for (let t = 0; t < 120_000 && clicked === null; t += 250) {
      await st(page, 'step', 250, { render: false }); await st(page, 'step', 0);
      for (const f of (await st(page, 'peopleFeet')).filter((q) => !NPCS.includes(q.id) && q.y > vp.height * 0.8 && q.y < vp.height - 10 && q.x > vp.width * 0.05 && q.x < vp.width * 0.6)) {
        if (!(await isFree(f))) continue;
        await page.mouse.click(f.x, f.y);
        await st(page, 'step', 300, { render: false }); await st(page, 'step', 0);
        if ((await page.locator('[data-ui="bubble"]').count()) === 0) continue;
        person = await st(page, 'personRect', f.id);
        if (person !== null) { clicked = f.id; break; }
        await page.keyboard.press('Escape');
        await st(page, 'step', 300, { render: false }); await st(page, 'step', 0);
      }
    }
    expect(clicked, 'un passant à portée, sa réplique en bulle, son rectangle projeté').not.toBeNull();
    await expect(page.locator('[data-ui="bubble"]')).toHaveCount(1);
    // l'ancre est le rectangle d'une personne qui n'est PAS l'interlocuteur du choix : on cherche, par identifiant, à qui appartient le rectangle projeté par le code
    // (le clic sur un sol encombré peut toucher un voisin du passant visé : l'ancre est alors le voisin, jamais Nadia)
    const anchor = (await page.evaluate(() => (document.querySelector('[data-ui="root"]') as HTMLElement).dataset['speakerRect']))!.split(',').map(Number);
    let owner: string | null = null; let person_: R | null = null;
    for (const f of await st(page, 'peopleFeet')) {
      const r = await st(page, 'personRect', f.id);
      if (r !== null && near(anchor[0]!, r.x) && near(anchor[1]!, r.y) && near(anchor[2]!, r.w) && near(anchor[3]!, r.h)) { owner = f.id; person_ = r; break; }
    }
    expect(owner, `l'ancre ${anchor.join(',')} est le rectangle d'une personne affichée`).not.toBeNull();
    expect(NPCS.includes(owner!), `l'ancre est un passant (${owner}), pas l'interlocuteur du choix`).toBe(false);
    const bubble = (await boxOf(page, '[data-ui="bubble"]'))!;
    const side = (await page.locator('[data-ui="bubble"]').getAttribute('data-side'))!;
    expect(await page.locator('[data-ui="bubble"]').getAttribute('data-placed'), 'sans repli forcé').toBe('ok');
    // 2. la bulle est hors de sa zone gonflée, collée à la marge du côté choisi
    // la bulle est posée en pixels entiers : 1 px de tolérance sur la marge
    expect(hit(grow(person_!, margin - 1), bubble), `bulle hors de la zone interdite (I-3) : côté ${side}, bulle ${JSON.stringify(bubble)}, personne ${owner} ${JSON.stringify(person_)}, marge ${margin}`).toBe(false);
    if (side === 'right') expect(near(bubble.x, person_!.x + person_!.w + margin)).toBe(true);
    else if (side === 'left') expect(near(bubble.x + bubble.w, person_!.x - margin)).toBe(true);
    else expect(near(bubble.y + bubble.h, person_!.y - margin)).toBe(true);
    // 3. la pointe dessinée ne touche pas la personne (la boîte de la queue tournée a sa pointe sur son bord extérieur)
    const tail = (await boxOf(page, '[data-ui="bubble-tail"]'))!;
    if (side === 'right') expect(tail.x, 'pointe à gauche de la bulle, hors de la personne').toBeGreaterThanOrEqual(person_!.x + person_!.w + 1);
    else if (side === 'left') expect(tail.x + tail.w).toBeLessThanOrEqual(person_!.x - 1);
    else expect(tail.y + tail.h).toBeLessThanOrEqual(person_!.y - 1);
    // 4. le panneau d'options évite l'interlocuteur (Nadia), qui n'est pas celle qui parle
    const nadia = await st(page, 'personRect', 'nadia');
    const panel = await boxOf(page, '[data-ui="choices"]');
    if (nadia !== null && panel !== null) expect(hit(grow(nadia, margin), panel), 'panneau hors de la zone interdite de l\'interlocuteur').toBe(false);
    if (SHOTS !== undefined) await page.screenshot({ path: `${SHOTS}/bulle-${vp.width}-${info.project.name}.png` });
  });
}

test('test_live_name_chip_shows_yusuf_name_in_fr', async ({ page }, info) => {
  test.setTimeout(300_000);
  await openCapture(page, { lang: 'fr', viewport: { width: 1920, height: 1080 }, query: info.project.name === 'webgl2' ? 'webgl' : '' });
  await settle(page, 4000);
  for (let i = 0; i < 40 && (await st(page, 'state')).live.clock.minute < 790; i++) await st(page, 'step', 30_000, { render: false });   // Yusuf est là de 13 h à 22 h
  await settle(page, 1000);
  // Yusuf est hors cadre à droite, presque à hauteur du joueur. La caméra de marche garde l'axe de la rue (8fa55ae : une touche de côté déplace
  // de côté, elle ne tourne plus la vue) : on se décale vers l'est, puis on recule pour l'avoir devant soi, pieds dans la zone libre de l'écran.
  // Le recul s'arrête avant le milieu du logement (z 33), où l'on y rentrerait.
  const feetOf = async (): Promise<{ id: string; x: number; y: number } | undefined> => (await st(page, 'peopleFeet')).find((f) => f.id === 'yusuf');
  expect(await feetOf(), 'Yusuf est dans la rue').toBeDefined();
  // La zone se juge à l'arrêt : en marche la focale s'ouvre (35 mm contre 40 mm au repos) et un cadrage pris en marche ment.
  const walk = async (key: string, until: (p: { x: number; z: number }) => boolean): Promise<void> => {
    await page.keyboard.down(key);
    try { for (let i = 0; i < 80 && !until((await st(page, 'state')).player); i++) await st(page, 'step', 100, { render: false }); }
    finally { await page.keyboard.up(key); }
  };
  await walk('KeyD', (p) => p.x >= 5.5);                                          // dans l'axe de Yusuf (x 6)
  await walk('KeyS', (p) => p.z >= 31);                                           // 3 m de recul : il est devant, à plus de 8 m de la caméra
  await st(page, 'step', 0);
  const yusuf = (await feetOf())!;
  expect(yusuf.x > 100 && yusuf.x < 1200 && yusuf.y > 500 && yusuf.y < 1040, `Yusuf est cliquable (${Math.round(yusuf.x)}, ${Math.round(yusuf.y)})`).toBe(true);
  await page.mouse.click(yusuf.x, yusuf.y);
  for (let t = 0; t < 40_000 && (await page.locator('[data-ui="name-chip"]').count()) === 0; t += 1000) { await st(page, 'step', 1000, { render: false }); await st(page, 'step', 0); }
  await expect(page.locator('[data-ui="name-chip"]')).toHaveText('Yusuf Oren');
});
