import { expect, test } from '@playwright/test';
import { openCapture, settle, st, STREET_ACTS } from '../support/street_capture';

/**
 * Au départ, la caméra voit la rue [retour Cynthia 2026-11-04 : « quand je rentre l'adresse, ça me remet contre le mur »]. La sauvegarde ne porte
 * aucune position : une partie neuve part du logement, une reprise de l'entrée de la rue ou du lieu sauvé. Dans chaque cas, après stabilisation :
 * la vue regarde la rue (vers -z, le poste), aucun décor du quartier à moins de 2 m devant le buste dans l'axe de la caméra, aucun décor entre la
 * caméra et le joueur.
 */
const queryOf = (project: string): string => (project === 'webgl2' ? 'webgl' : '');
const MIN_CLEAR_M = 2;
const LANE = [...STREET_ACTS, { day: 1, minute: 440, kind: 'lane', id: 'checkpoint', option: 'comply' }];
const STARTS = [
  ['nouvelle_partie', []],
  ['reprise_dans_la_rue', STREET_ACTS],
  ['reprise_apres_le_poste', LANE],
  ['reprise_au_logement_le_soir', [...LANE, { day: 1, minute: 1000, kind: 'enter', id: 'home', option: null }]],
] as const;

test.describe('rue : vue de départ', () => {
  for (const [label, acts] of STARTS) {
    test(`test_spawn_camera_sees_the_street_${label}`, async ({ page }, info) => {
      await openCapture(page, { lang: 'fr', query: queryOf(info.project.name), acts });
      await settle(page, 1500);
      const dir = await st(page, 'cameraDir'), clear = await st(page, 'forwardClearance'), occ = await st(page, 'cameraOccluders');
      const at = JSON.stringify((await st(page, 'state')).player);
      expect(dir.z, `${label} ${at} : la vue regarde la rue, vers le poste`).toBeLessThan(-0.9);
      expect(clear?.m ?? Infinity, `${label} ${at} : décor ${clear?.name ?? ''} devant le joueur`).toBeGreaterThanOrEqual(MIN_CLEAR_M);
      expect(occ, `${label} ${at} : décor entre la caméra et le joueur`).toEqual([]);
    });
  }
});
