import { expect, test, type Page } from '@playwright/test';
import { openCapture, st } from '../support/street_capture';

/**
 * Aux poses de file, le joueur est visible [signalé par impl-accueil 2026-11-03 : « en file à mi-rue, la caméra d'observation cadre un mur brun
 * en plein écran »]. La caméra d'observation se tient 6 m derrière et 5 m à l'ouest du joueur : sur un bord du couloir de file elle tombait dans
 * l'étal (x -6,9 à -5,1, z -3,4 à -0,6). À chaque pas du couloir, en observation : buste devant la caméra, dans le cadre utile (entre les
 * bandes 2,39:1) et aucun décor du quartier entre lui et la caméra.
 */
const queryOf = (project: string): string => (project === 'webgl2' ? 'webgl' : '');
const VIEW = { width: 1280, height: 720 };
const LETTERBOX_ASPECT = 2.39;                                                   // `src/street/render/pipeline.ts` (importer ce module chargerait Three.js côté test)
const BAND_Y = VIEW.width / LETTERBOX_ASPECT / VIEW.height;                      // demi-hauteur utile en coordonnées normalisées

async function hold(page: Page, key: string, steps: number): Promise<void> {
  await page.keyboard.down(key);
  try { for (let i = 0; i < steps; i++) await st(page, 'step', 100, { render: false }); } finally { await page.keyboard.up(key); }
}

test.describe('rue : caméra d\'observation', () => {
  for (const [label, key, steps] of [['ouest', 'ArrowLeft', 6], ['axe', null, 0], ['est', 'ArrowRight', 6]] as const) {
    test(`test_player_visible_at_every_queue_pose_${label}`, async ({ page }, info) => {
      await openCapture(page, { query: queryOf(info.project.name), viewport: VIEW });
      if (key !== null) await hold(page, key, steps);                            // bord du couloir de file (|x| <= 1)
      await page.keyboard.down('ArrowUp');
      let seen = 0;
      try {
        for (let i = 0; i < 260; i++) {
          await st(page, 'step', 100, { render: false });
          const s = await st(page, 'state');
          if (s.mode !== 'observation') { if (seen > 0) break; continue; }
          seen++;
          const n = await st(page, 'playerNdc'), occ = [...new Set(await st(page, 'cameraOccluders'))];
          const at = `joueur (${s.player.x.toFixed(2)}, ${s.player.z.toFixed(2)})`;
          expect(n.front, `${at} : devant la caméra`).toBe(true);
          expect(Math.abs(n.x), `${at} : dans le cadre en x`).toBeLessThan(1);
          expect(Math.abs(n.y), `${at} : entre les bandes`).toBeLessThan(BAND_Y);
          expect(occ, `${at} : décor entre la caméra et le joueur`).toEqual([]);
        }
      } finally { await page.keyboard.up('ArrowUp'); }
      expect(seen, 'des poses de file ont été vues').toBeGreaterThan(5);
    });
  }
});
