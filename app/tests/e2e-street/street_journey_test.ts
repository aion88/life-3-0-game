import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readSave, type SeedActs } from '../support/e2e';
import { decodePlate, meanAbsDiff, openCapture, pngSize, shootPng, settle, st } from '../support/street_capture';

/**
 * Parcours de la rue dans le navigateur, sur le build de capture, en pas à pas [plan 02a T13 ; R-02a.20, R-02a.21]. Aucune attente n'est réelle :
 * `__street.step(ms)` avance l'horloge. À chaque étape, l'état du moteur (`street` et `week`) est comparé, en égalité stricte, à celui d'une
 * rediffusion (`replay`) des actes SAUVEGARDÉS : la sauvegarde ne ment pas sur ce que le joueur a vécu.
 * Les écrans d'avant la rue (départ, questionnaire, avance rapide) sont ceux du plan 03 et ont leur propre parcours (`screens_path_test`).
 */
const WEEK = JSON.parse(readFileSync('tests/e2e-street/full-week.json', 'utf8')) as SeedActs[];
const ARRESTED = JSON.parse(readFileSync('tests/e2e-street/arrested-night4.json', 'utf8')) as SeedActs[];
const EVENING_MINUTE = 1050;
const queryOf = (project: string): string => (project === 'webgl2' ? 'webgl' : '');

const savedActs = async (page: Page): Promise<SeedActs[]> => ((await readSave(page))!['acts'] as SeedActs[]);

/** Égalité stricte du moteur vivant et de la rediffusion des actes sauvegardés. */
async function expectReplayEquals(page: Page, label: string): Promise<void> {
  const live = await st(page, 'state');
  const replayed = await st(page, 'replayed', await savedActs(page));
  expect(live.street, `${label} : street`).toEqual(replayed.street);
  expect(live.week, `${label} : week`).toEqual(replayed.week);
}

/** Un geste de bouton sur le panneau de choix. Le panneau déborde du haut de l'écran quand six choix sont ouverts (voir le rapport) : `click()` natif. */
const press = (page: Page, selector: string): Promise<void> => page.locator(selector).evaluate((e) => { (e as HTMLElement).click(); });
/** Désigner (premier geste : aucun acte écrit), puis confirmer (second geste : un acte). */
async function chooseInTwoGestures(page: Page, choice: string, option: string, written: { kind: string; id: string } = { kind: 'choice', id: choice }): Promise<void> {
  const before = (await savedActs(page)).length;
  await press(page, `[data-choice="${choice}"] [data-option="${option}"]`);
  expect((await st(page, 'state')).street['designated'], `${choice} désigné`).toEqual({ choiceId: choice, optionId: option });
  expect((await savedActs(page)).length, `${choice} : désigner n'écrit aucun acte`).toBe(before);
  await press(page, '[data-ui="confirm"]');
  if (choice === 'checkpoint.j1') {
    // séquence jouée : l'acte n'est écrit qu'à la fin de la séquence, jamais au geste de confirmation ; un clic la passe [`street_sequence_live_test.ts`]
    expect((await savedActs(page)).length, `${choice} : la séquence d'abord, l'acte ensuite`).toBe(before);
    await page.mouse.click(960, 300);
  }
  const acts = await savedActs(page);
  expect(acts.length, `${choice} : confirmer écrit un acte`).toBe(before + 1);
  expect(acts.at(-1)).toMatchObject({ ...written, option });
}

/** Tient une touche et fait avancer la rue jusqu'à ce que `done` soit vrai (au plus `capMs` de temps de jeu). */
async function walkUntil(page: Page, key: 'KeyW' | 'KeyS', done: (s: Awaited<ReturnType<typeof state>>) => boolean, capMs = 60_000): Promise<void> {
  await page.keyboard.down(key);
  try {
    for (let t = 0; t < capMs; t += 500) {
      await st(page, 'step', 500, { render: false });
      if (done(await state(page))) return;
    }
    const at = (await state(page)).player;
    throw new Error(`${key} : la condition n'est pas atteinte après ${capMs} ms de jeu, joueuse en (${at.x.toFixed(2)} ; ${at.z.toFixed(2)})`);
  } finally { await page.keyboard.up(key); }
}
const state = (page: Page) => st(page, 'state');

test.describe('rue : parcours', () => {
  test('test_journey_replay_equals_live_state_at_every_step_and_ends_on_the_bilan', async ({ page }, info) => {
    test.setTimeout(300_000);
    await openCapture(page, { query: queryOf(info.project.name), acts: [] });
    await expectReplayEquals(page, 'départ');
    expect((await state(page)).street).toMatchObject({ location: 'home', day: 1 });

    // J1, au logement : deux choix, chacun en deux gestes
    await chooseInTwoGestures(page, 'j1.phone', 'take');
    await expectReplayEquals(page, 'téléphone');
    await chooseInTwoGestures(page, 'j1.component', 'leave');
    await expectReplayEquals(page, 'composant');

    // marche jusqu'à la file : sortie du logement, puis le couloir devant la guérite (x proche de 0)
    await walkUntil(page, 'KeyW', (s) => s.player.z <= -10.0);                    // devant la barrière, qui est pleine
    const afterWalk = await state(page);
    expect(Math.abs(afterWalk.player.x)).toBeLessThanOrEqual(1);                     // dans le couloir de file
    expect(await savedActs(page)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'exit', id: 'home' })]));
    await expectReplayEquals(page, 'marche');

    // acte de voie : le choix du checkpoint, en deux gestes
    await page.waitForSelector('[data-choice="checkpoint.j1"]', { state: 'attached' });
    // l'acte écrit est un acte de voie, pas un choix : le panneau nomme `checkpoint.j1`, le moteur le range en `lane` / `checkpoint`
    await chooseInTwoGestures(page, 'checkpoint.j1', 'comply', { kind: 'lane', id: 'checkpoint' });
    await expectReplayEquals(page, 'voie du checkpoint');

    // retour au logement, puis le soir. Le pylône (x 3, z 20) barre la ligne droite vers le sud : elle se rabat d'abord vers l'ouest
    await page.keyboard.down('KeyW');
    try { await st(page, 'step', 1500, { render: false }); } finally { await page.keyboard.up('KeyW'); }   // « se plier » finit au nord de la barrière, dans le couloir est : le bras baissé barre le retour direct, on contourne le mur d'écrans par le nord
    await page.keyboard.down('KeyA');
    try { await st(page, 'step', 5800, { render: false }); } finally { await page.keyboard.up('KeyA'); }
    await walkUntil(page, 'KeyS', (s) => s.player.z >= 36 && (s.street['location'] as string) === 'home');
    await expectReplayEquals(page, 'retour');
    while ((await state(page)).live.clock.minute < EVENING_MINUTE) await st(page, 'step', 6000, { render: false });
    await st(page, 'step', 500);                                                    // une image rendue : le soir s'affiche
    await expect(page.locator('[data-ui="evening"] li')).toHaveCount(6);            // six lignes du soir
    await expectReplayEquals(page, 'soir');

    // la nuit : l'acte `sleep`, en deux gestes
    const before = (await savedActs(page)).length;
    await press(page, '[data-choice="sleep"] [data-option="sleep"]');
    expect((await savedActs(page)).length, 'dormir désigné : aucun acte').toBe(before);
    await press(page, '[data-ui="confirm"]');
    expect((await savedActs(page)).at(-1)).toMatchObject({ kind: 'sleep', id: 'night' });
    await st(page, 'step', 500);
    expect((await state(page)).street).toMatchObject({ day: 2 });
    await expectReplayEquals(page, 'nuit 1');

    // J2 à J7 : les actes de `full-week.json` (dormir seulement) sont rejoués par le pilote, un jour après l'autre, la parité tenue à chaque nuit
    const rest = WEEK.filter((a) => a.day >= 2);
    for (const a of rest) {
      const r = await st(page, 'act', a);
      expect(r.ok, `acte refusé : ${JSON.stringify(a)}`).toBe(true);
      if (a.kind === 'sleep') { await st(page, 'step', 100, { render: false }); await expectReplayEquals(page, `nuit ${a.day}`); }
    }
    await st(page, 'step', 500);
    await expect(page.getByTestId('bilan-page')).toHaveCount(1);
    expect((await readSave(page))!['phase']).toBe('bilan');
    // la rue a rendu la main : la sauvegarde porte, après les actes vécus du J1, exactement les actes rejoués des jours 2 à 7
    expect((await savedActs(page)).slice(-rest.length)).toEqual(rest);
  });

  test('test_street_ends_early_on_arrest_and_navigates_to_the_bilan_sheet', async ({ page }, info) => {
    // La fin ANTICIPÉE (arrêté à la nuit 4, profil « Bavard » de l'oracle) : la rue rend la main au bilan, qui ouvre sur la fiche, sans les sept jours.
    test.setTimeout(180_000);
    const last = ARRESTED.at(-1)!;
    expect(last).toMatchObject({ day: 4, kind: 'sleep', id: 'night' });
    await openCapture(page, { query: queryOf(info.project.name), acts: ARRESTED.slice(0, -1) });
    await expectReplayEquals(page, 'avant la dernière nuit');
    expect((await state(page)).ended).toBe(false);
    await expect(page.getByTestId('bilan-page')).toHaveCount(0);
    const r = await st(page, 'act', last);                                          // la nuit d'arrestation
    expect(r.ok).toBe(true);
    await st(page, 'step', 500);
    await expect(page.getByTestId('bilan-page')).toHaveCount(1);
    await expect(page.getByTestId('bilan-page')).toHaveAttribute('data-page', 'sheet');
    expect((await readSave(page))!['phase']).toBe('bilan');
    expect(await savedActs(page)).toEqual(ARRESTED);                                // la sauvegarde porte les actes joués, ni plus ni moins
  });
});

test.describe('rue : parité des moteurs de rendu', () => {
  test('test_webgpu_and_webgl2_agree_within_three_levels_on_the_same_pose', async ({ browser, page }, info) => {
    test.skip(info.project.name !== 'webgpu-mac', 'la parité compare WebGPU et WebGL 2 : projet webgpu-mac seulement');
    test.setTimeout(180_000);
    const other = await browser.newPage();
    try {
      const shots: Buffer[] = [];
      for (const [p, q] of [[page, ''], [other, 'webgl']] as const) {
        await openCapture(p, { query: q });
        expect(await st(p, 'backend')).toBe(q === '' ? 'webgpu' : 'webgl2');
        await st(p, 'pose', 'checkpoint-large'); await st(p, 'setLight', 'heureBleue');
        await settle(p);
        shots.push(await shootPng(p));
      }
      const { width, height } = pngSize(shots[0]!);
      const a = await decodePlate(page, shots[0]!, width, height);
      const b = await decodePlate(page, shots[1]!, width, height);
      const diff = meanAbsDiff(a.img, b.img);
      info.annotations.push({ type: 'parity-mean-abs-diff', description: `${diff.toFixed(3)} niveaux sur 255 (seuil 3, supposed, owner technical-artist)` });
      expect(diff).toBeLessThanOrEqual(3);
    } finally { await other.close(); }
  });
});
