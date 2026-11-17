import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { seedJson, seedSave, continueIfAsked } from '../support/e2e';
import { lineWith, PASSIVE, playGuided, stateOf } from '../support/guided_e2e';
import { CAPTURE_URL, decodeInBrowser } from '../support/street_capture';
import { luminanceStats, type Crop, type Rgba } from '../../src/engine/view/caps';

/**
 * Rue guidée, parcours J1-J2 de bout en bout [rue guidée T15 ; spec §9.2, §9.5, §9.6, §11.5]. Deux chemins qui divergent (silence et détour,
 * rire et ligne droite), tout au clavier ou au clic selon le geste, headless. Le dernier test passe sur le build de CAPTURE en rue guidée (sans
 * `?rue=libre`) et juge qu'aucun corps de scène n'est un aplat sombre vu d'en haut ; ses captures vont sous `production/qa/evidence/street/2026-11-04-guidee/`.
 */
test.use({ locale: 'fr-FR' });
test.setTimeout(240_000);

/** Chaînes FR lues du disque : l'import JSON direct ne passe pas sous Playwright (`needs an import attribute`). */
const FR = JSON.parse(readFileSync('src/data/strings/fr.json', 'utf8')) as Record<string, string>;
/** Fin de démonstration livrée (`street.guided.endOfDemo`), lue du disque : après le J2, la carte du J3 ou la fin de démo selon `afterDay` [J3-J7 T6]. */
const END_OF_DEMO = (JSON.parse(readFileSync('src/data/worlds/w10.json', 'utf8')) as { street: { guided: { endOfDemo: { afterDay: number } | null } } }).street.guided.endOfDemo;
const DEMO_ENDS_AFTER_J2 = END_OF_DEMO !== null && END_OF_DEMO.afterDay <= 2;
const EVIDENCE = '../production/qa/evidence/street/2026-11-04-guidee';
/** Les parcours n'éprouvent pas le rendu : une petite fenêtre, car le WebGL logiciel rend une image en plusieurs secondes et chaque geste attend le fil principal. */
const SMALL = { width: 640, height: 360 };
const street = (page: Page) => page.locator('[data-ui="street"]');

/** Après le J2 : la carte du J3 si la démonstration continue, sinon la carte de fin de démo (selon `afterDay`, lu du monde livré). */
async function expectAfterJ2(page: Page): Promise<void> {
  if (DEMO_ENDS_AFTER_J2) { await expect(page.locator('[data-ui="demo-end"]')).toBeVisible(); return; }
  await expect(street(page)).toHaveAttribute('data-beat', 'card');
  await expect(street(page)).toHaveAttribute('data-day', '3');
}

async function open(page: Page, line: string, base = '', size = SMALL): Promise<void> {
  await page.setViewportSize(size);
  await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line }));
  await page.goto(base === '' ? '/?episode=semaine' : base);
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
}

test.describe('rue guidée : parcours J1-J2', () => {
  test('test_path_silence_detour_j1_j2_reaches_demo_end', async ({ page }) => {
    await open(page, lineWith({ Q11: 'C' }));
    const recaps: { items: number; chainA: string }[] = [];
    await playGuided(page, { 'j1.roux': 'silent', 'j1.street': 'nadia', 'checkpoint.j1': 'comply', 'j2.component': 'hide' }, {
      // le relevé n'existe qu'à son temps : il se lit là, avant « Continuer »
      onBeat: async (beat) => {
        if (beat !== 'recap') return;
        recaps.push({
          items: await page.locator('[data-ui="recap"] li').count(),
          chainA: await page.locator('[data-ui="recap-2026"] [data-chain="A"]').first().innerText().catch(() => ''),
        });
      },
    });
    expect(recaps).toHaveLength(2);                                  // J1 puis J2
    expect(recaps[0]!.items).toBeGreaterThan(0);
    expect(recaps[0]!.chainA).toContain(FR['q.Q11.title']!);          // titre de Q11, « Les caméras du marché »
    expect(recaps[0]!.chainA).toContain(FR['w10.chain.A.link.C']!);   // la réponse C de Q11 ancre le maillon
    await expect(page.locator('body')).not.toContainText(/Rejouer|Recommencer depuis lundi/);
    await expectAfterJ2(page);
  });

  test('test_path_laugh_straight_j1_j2', async ({ page }) => {
    await open(page, lineWith({ Q11: 'A' }));
    const visited = await playGuided(page, { 'j1.roux': 'laugh', 'j1.street': 'straight', 'checkpoint.j1': 'courtesy', 'j2.component': 'keep' });
    expect(visited).toContain('j1.registre');
    expect(visited).not.toContain('j1.registre.late');
    expect(visited).toContain('j2.agent');
    await expectAfterJ2(page);
  });

  test('test_no_passive_wait_over_3s_without_skip', async ({ page }) => {   // spec §9.6
    await open(page, lineWith({ Q11: 'C' }));
    const waits: string[] = [];
    await playGuided(page, {}, {
      onBeat: async (beat, at, seen) => {
        if (!PASSIVE.has(beat)) return;
        waits.push(beat);
        // « Passer » est posé dans le même rendu que le temps passif (`showBeat`, puis `data-beat`) : il est lu dans le même aller-retour que le
        // temps, sans délai du protocole (une commande attend le fil principal, qu'une image de WebGL logiciel tient plusieurs secondes sous charge).
        if (seen.skip) return;
        // sinon : 3 s au plus. Un temps qui a fini de lui-même entre la lecture et ce contrôle ne compte pas. La scène est
        // comparée aussi : deux temps passifs de même nom dans deux scènes successives ne passent pas sans contrôle [revue T15]
        await expect.poll(async () => {
          const s = await stateOf(page);
          return s.skip || s.beat !== beat || s.scene !== at;
        }, { timeout: 3000 }).toBe(true);
      },
    });
    expect(new Set(waits)).toEqual(new Set(['walk', 'wait', 'night']));
  });

  test('test_scene_bodies_readable_from_above', async ({ page }) => {
    test.setTimeout(900_000);                                         // WebGL logiciel : plusieurs secondes par geste à cette taille
    // build de CAPTURE, rue guidée (sans `?rue=libre`) : `window.__guided.bodyRects()` donne le rectangle projeté de chaque corps de scène
    mkdirSync(EVIDENCE, { recursive: true });
    await open(page, lineWith({ Q11: 'C' }), CAPTURE_URL + '?episode=semaine', { width: 960, height: 540 });
    let shots = 0;
    const stats: string[] = [];
    await playGuided(page, {}, {
      onScene: async (sceneId) => {
        await page.waitForTimeout(2500);                              // la caméra amortie se pose sur la scène
        const png = await page.screenshot({ path: `${EVIDENCE}/${sceneId}.png` });
        const img = await decodeInBrowser(page, png);
        const rects = await page.evaluate(() => (window as unknown as { __guided: { bodyRects(): { id: string; x: number; y: number; w: number; h: number }[] } }).__guided.bodyRects());
        expect(rects.length, `${sceneId} : au moins la joueuse`).toBeGreaterThanOrEqual(1);
        for (const r of rects) {
          const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
          const crop: Crop = { x, y, w: Math.min(img.width, Math.ceil(r.x + r.w)) - x, h: Math.min(img.height, Math.ceil(r.y + r.h)) - y };
          if (crop.w < 1 || crop.h < 1) continue;                      // hors cadre : rien à juger
          const st = luminanceStats(img, noMask(img), crop);
          stats.push(`${sceneId} ${r.id} meanY=${st.meanY.toFixed(3)} <0.03=${st.ltBlack003.toFixed(3)}`);
          expect.soft(st.meanY, `${sceneId} / ${r.id}`).toBeGreaterThanOrEqual(0.08);        // seuils de checkLuminance, caps.ts:164
          expect.soft(st.ltBlack003, `${sceneId} / ${r.id}`).toBeLessThanOrEqual(0.6);        // caps.ts:167
        }
        shots++;
      },
    });
    console.log(stats.join('\n'));
    expect(shots).toBeGreaterThanOrEqual(7);   // 4 scènes au J1 + 5 au J2 sur le chemin par défaut, au moins 7 même si `refuse`
  });
});

/** Masque sans émissif : aucun pixel n'est exempté du plafond de hautes lumières (ici seuls les creux de luminance comptent). */
function noMask(img: Rgba): Rgba { return { data: new Uint8ClampedArray(img.width * img.height * 4), width: img.width, height: img.height }; }
