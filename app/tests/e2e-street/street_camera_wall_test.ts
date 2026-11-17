import { expect, test, type Page } from '@playwright/test';
import { openCapture, st, STREET_ACTS } from '../support/street_capture';

/**
 * La caméra ne passe pas derrière un décor plein, au clavier réel [bug Cynthia 2026-11-03 : « je suis en train de marcher au milieu d'un mur »].
 * Voie du checkpoint ouverte, le joueur contourne le mur de télés par l'ouest puis revient au milieu de la rue, juste après lui : la caméra de
 * marche, 3,5 m derrière en +z, tombait dans le bloc mur de télés et guérite (z -13,4 à -10,6), qui s'interposait plein cadre.
 */
const queryOf = (project: string): string => (project === 'webgl2' ? 'webgl' : '');
const LANE_OPEN = [...STREET_ACTS, { day: 1, minute: 432, kind: 'lane', id: 'checkpoint', option: 'comply' }];

async function holdUntil(page: Page, key: string, done: (p: { x: number; z: number }) => boolean, capMs = 45_000): Promise<void> {
  await page.keyboard.down(key);
  try {
    for (let t = 0; t < capMs; t += 100) {
      await st(page, 'step', 100, { render: false });
      if (done((await st(page, 'state')).player)) return;
    }
    throw new Error(`${key} : position non atteinte en ${capMs} ms de jeu, joueur en ${JSON.stringify((await st(page, "state")).player)}`);
  } finally { await page.keyboard.up(key); }
}

const frozen = (page: Page): Promise<string> => page.evaluate(() => document.querySelector('[data-ui="street-error"]')?.textContent ?? '');

test.describe('rue : caméra et murs', () => {
  /**
   * Marcher au clavier pendant que les choix changent ne fige pas la rue [bug 2026-11-03]. Le focus est dans le panneau (pris à son ouverture, tenu
   * par la touche) ; un choix qui arrive relançait un rendu qui retirait le panneau focalisé, `focusout` rejouait un rendu imbriqué, le retrait
   * extérieur levait et l'image échouait : le joueur restait figé contre ce qui passait pour un mur.
   */
  test('test_walking_while_choices_change_never_freezes_the_street', async ({ page }, info) => {
    await openCapture(page, { query: queryOf(info.project.name), acts: LANE_OPEN });
    await holdUntil(page, 'ArrowLeft', (p) => p.x <= -3.5);                     // le panneau de choix garde le focus qu'il a pris à l'ouverture
    await holdUntil(page, 'ArrowUp', (p) => p.z <= 0);                          // de z 28 vers la file : les choix du jour arrivent et partent en route
    expect(await frozen(page), 'la rue ne s\'arrête pas sur une erreur d\'image').toBe('');
  });

  test('test_camera_never_behind_the_tv_wall_after_passing_it', async ({ page }, info) => {
    await openCapture(page, { query: queryOf(info.project.name), acts: LANE_OPEN });
    await holdUntil(page, 'ArrowLeft', (p) => p.x <= -3.5);                     // couloir ouest, hors du bloc (x > -2,4)
    await holdUntil(page, 'ArrowUp', (p) => p.z <= -14.5);                      // juste au-delà du mur de télés : à moins de 3,5 m (la perche) de lui
    await holdUntil(page, 'ArrowRight', (p) => p.x >= 0);                       // au milieu de la rue, le bloc dans le dos
    await st(page, 'step', 100, { render: false });
    expect(await frozen(page)).toBe('');
    const occluders = await st(page, 'cameraOccluders');
    expect(occluders, `décor entre la caméra et le joueur : ${[...new Set(occluders)].join(', ')}`).toEqual([]);
  });
});
