import { expect, test, type Page } from '@playwright/test';
import { openCapture, st } from '../support/street_capture';

/**
 * Flèches de côté dans la rue, au clavier réel [bug Cynthia 2026-11-03 : « dès que j'appuie sur une flèche de côté, je me retrouve à 90 degrés
 * bloqué contre un mur »]. Les touches sont des axes d'écran (gauche = ouest, droite = est, haut = vers le checkpoint) : une flèche de côté
 * DÉPLACE le joueur de côté, la caméra de marche garde la visée de la rue (-z). Elle ne pivote jamais de 90° vers un mur.
 */
const queryOf = (project: string): string => (project === 'webgl2' ? 'webgl' : '');
const MAX_YAW_DEG = 5;

const yawDeg = (d: { x: number; z: number }): number => (Math.atan2(d.x, -d.z) * 180) / Math.PI;   // 0 = visée vers -z (le checkpoint)

async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  try { for (let t = 0; t < ms; t += 100) await st(page, 'step', 100, { render: false }); }
  finally { await page.keyboard.up(key); }
  await st(page, 'step', 100, { render: false });
}

test.describe('rue : flèches de côté', () => {
  for (const [key, sign] of [['ArrowLeft', -1], ['ArrowRight', 1], ['KeyA', -1], ['KeyD', 1]] as const) {
    test(`test_${key}_moves_sideways_and_camera_keeps_street_axis`, async ({ page }, info) => {
      await openCapture(page, { query: queryOf(info.project.name) });
      await hold(page, 'ArrowUp', 1000);                                   // en marche dans la rue, caméra derrière
      const p0 = (await st(page, 'state')).player, yaw0 = yawDeg(await st(page, 'cameraDir'));
      expect(Math.abs(yaw0), 'avant : la caméra vise la rue').toBeLessThanOrEqual(MAX_YAW_DEG);
      await hold(page, key, 600);
      const p1 = (await st(page, 'state')).player, yaw1 = yawDeg(await st(page, 'cameraDir'));
      expect(sign * (p1.x - p0.x), `${key} : le joueur se déplace de côté`).toBeGreaterThan(0.5);
      expect(Math.abs(p1.z - p0.z), `${key} : sans avancer ni reculer`).toBeLessThan(0.05);
      expect(Math.abs(yaw1), `${key} : la caméra ne pivote pas vers le mur (lacet ${yaw1.toFixed(1)}°)`).toBeLessThanOrEqual(MAX_YAW_DEG);
    });
  }
});
