import { expect, test, type Page } from '@playwright/test';
import { openCapture, st, STREET_ACTS } from '../support/street_capture';

/**
 * La barrière du poste est pleine pour le joueur, au clavier réel [retour de Cynthia, build 35ed56c : « je passe à travers la barrière et je marche
 * jusqu'au mur »]. Le bras (6,4 m vers l'ouest depuis le poteau x 6, à z -10,46, 0,44 m devant la guérite) n'était dans aucun solide : le joueur le
 * traversait dans l'axe de la file et dans le passage est entre la guérite et le poteau. Voie ouverte (acte `lane`), la barrière logique du moteur
 * n'y est plus : seul le décor arrête. Le passage ouest, sans barrière visible, reste libre (pas de mur invisible).
 */
const queryOf = (project: string): string => (project === 'webgl2' ? 'webgl' : '');
const LANE_OPEN = [...STREET_ACTS, { day: 1, minute: 432, kind: 'lane', id: 'checkpoint', option: 'comply' }];
const ARM_Z = -10.46;                                                              // z du bras : checkpoint.z + booth.depthM / 2 + 2 x barrier.postM

async function holdUntil(page: Page, key: string, done: (p: { x: number; z: number }) => boolean, capMs = 45_000): Promise<{ x: number; z: number }> {
  await page.keyboard.down(key);
  try {
    for (let t = 0; t < capMs; t += 100) {
      await st(page, 'step', 100, { render: false });
      const p = (await st(page, 'state')).player;
      if (done(p)) return p;
    }
    return (await st(page, 'state')).player;
  } finally { await page.keyboard.up(key); }
}

test.describe('rue : barrière du poste', () => {
  for (const [label, x] of [['axe de la file', 0], ['passage est', 5.2]] as const) {
    test(`test_barrier_arm_blocks_the_player_${label.replace(/ /g, '_')}`, async ({ page }, info) => {
      await openCapture(page, { query: queryOf(info.project.name), acts: LANE_OPEN });
      if (x > 0) {                                                                 // la voiture grise ferme le côté est plus haut : on la longe, puis on se décale
        await holdUntil(page, 'ArrowRight', (p) => p.x >= 4.2);
        await holdUntil(page, 'ArrowUp', (p) => p.z <= -9.5);
        await holdUntil(page, 'ArrowRight', (p) => p.x >= x);
        expect((await st(page, 'state')).player.x, 'dans le passage est').toBeGreaterThanOrEqual(x);
      }
      const p = await holdUntil(page, 'ArrowUp', (q) => q.z <= ARM_Z - 0.5, 30_000);   // poussé contre la barrière jusqu'à l'arrêt
      expect(p.z, `${label} : arrêté devant le bras (z ${p.z.toFixed(2)})`).toBeGreaterThan(ARM_Z);
    });
  }
  test('test_west_passage_has_no_invisible_wall', async ({ page }, info) => {
    await openCapture(page, { query: queryOf(info.project.name), acts: LANE_OPEN });
    await holdUntil(page, 'ArrowLeft', (p) => p.x <= -3.5);
    const p = await holdUntil(page, 'ArrowUp', (q) => q.z <= -14.5);
    expect(p.z, 'le passage ouest mène au-delà du poste').toBeLessThanOrEqual(-14.5);
  });
});
