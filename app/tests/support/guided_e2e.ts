import { expect, type Page } from '@playwright/test';
import { LINES } from './e2e';
import { SEL_ORDER } from '../../src/questionnaire/grid';

/**
 * Aides e2e de la rue guidée [rue guidée T15 J1-J2, déplacées en T15 J3-J7] : `lineWith` (ligne de réponses) et `playGuided` (le parcours
 * au clic et au clavier). Corps inchangés depuis `street_guided_j1j2_test.ts` ; seuls les tests e2e l'importent.
 */
const street = (page: Page) => page.locator('[data-ui="street"]');

/** Ligne de réponses complète : celle de w10, une lettre remplacée par question (`Q11`...), en ordre SEL. */
export function lineWith(over: Readonly<Record<string, string>>): string {
  const letters = [...LINES.w10];
  for (const [key, letter] of Object.entries(over)) {
    const at = (SEL_ORDER as readonly string[]).indexOf(key);
    if (at < 0) throw new Error(`lineWith : question inconnue « ${key} »`);
    letters[at] = letter;
  }
  return letters.join('');
}

export interface Hooks {
  /** Chaque fois qu'un temps passif ou autre est vu, avant le geste qui le quitte ; `seen` : l'état lu dans le même aller-retour que le temps. */
  readonly onBeat?: (beat: string, scene: string, seen: GuidedState) => Promise<void>;
  /** Une fois par scène, quand la scène devient la scène présente (la caméra a eu le temps de se poser). */
  readonly onScene?: (sceneId: string) => Promise<void>;
  /** À chaque carte du jour, avant « Continuer » (une fois par jour). */
  readonly onCard?: (day: number) => Promise<void>;
  /**
   * Jusqu'où jouer : `2` (défaut), la fin du J2 (fin de démonstration, ou carte du J3) ; `7`, toute la semaine : rend la main sur l'issue de
   * l'audition (temps `outcome`, non joué) ou sur la fin anticipée (temps `end`, arrestation de nuit) ; une fin de démonstration y est une faute.
   */
  readonly through?: 2 | 7;
}
export const PASSIVE = new Set(['walk', 'wait', 'night']);
const ADVANCING = new Set(['card', 'line', 'right', 'recap']);

/**
 * Clic DOM sur l'élément, en UN aller-retour (`page.evaluate`) ; rend faux si l'élément n'est pas là. Chaque commande du protocole attend le fil
 * principal, que le WebGL logiciel tient une image entière (0,5 à 0,9 s par image à 1280x720 sous une charge de 4, mesuré en T15 J3-J7) : un
 * localisateur coûte plusieurs allers-retours, et attendre un bouton absent coûte son délai entier. Le recouvrement de « Continuer » est jugé
 * ailleurs (`street_guided_continue_test.ts`, vrai clic).
 */
async function press(page: Page, selector: string): Promise<boolean> {
  const r = await page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el === null) return { ok: false, covered: null };
    // Comme un vrai clic : le bouton est amené dans la vue, puis le point visé (son centre) doit être le bouton ou l'un de ses descendants.
    // Un recouvrement ici est le clic perdu de la joueuse [retours Cynthia 2026-11-08 : le relevé du soir couvrait « Continuer »].
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Le point visé est le centre de la part VISIBLE du bouton : un bouton plus haut que sa fenêtre de défilement (le groupe d'options en petite fenêtre,
    // 640x360 : 78 px de fenêtre pour des options de 133 à 178 px) garde son centre hors de la fenêtre, et un vrai clic vise ce qu'on voit.
    const b = el.getBoundingClientRect();
    let x0 = Math.max(b.left, 0); let y0 = Math.max(b.top, 0); let x1 = Math.min(b.right, window.innerWidth); let y1 = Math.min(b.bottom, window.innerHeight);
    for (let a: HTMLElement | null = el.parentElement; a !== null; a = a.parentElement) {
      const o = getComputedStyle(a);
      if (o.overflowY === 'visible' && o.overflowX === 'visible') continue;
      const r = a.getBoundingClientRect(); x0 = Math.max(x0, r.left); y0 = Math.max(y0, r.top); x1 = Math.min(x1, r.right); y1 = Math.min(y1, r.bottom);
    }
    const hit = x1 > x0 && y1 > y0 ? document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2) : null;
    if (hit === null || (hit !== el && !el.contains(hit))) {
      const name = (e: Element | null): string => e === null ? 'rien (hors de la fenêtre)' : `${e.tagName.toLowerCase()}${e.getAttribute('data-ui') === null ? '' : `[data-ui="${e.getAttribute('data-ui')}"]`}${typeof e.className === 'string' && e.className !== '' ? `.${e.className.trim().split(/\s+/).join('.')}` : ''}`;
      const owner = hit?.closest('[data-ui]') ?? null;
      return { ok: false, covered: `${name(hit)}${owner !== null && owner !== hit ? ` dans ${name(owner)}` : ''}` };
    }
    el.click();
    return { ok: true, covered: null };
  }, selector);
  if (r.covered !== null) throw new Error(`playGuided : « ${selector} » recouvert au centre par ${r.covered} (le vrai clic de la joueuse y tomberait)`);
  return r.ok;
}

export interface GuidedState { readonly beat: string; readonly scene: string; readonly day: string; readonly confirm: boolean; readonly refusal: boolean; readonly skip: boolean }

/** L'état lu par le parcours, en un aller-retour. */
export async function stateOf(page: Page): Promise<GuidedState> {
  return page.evaluate(() => {
    const h = document.querySelector<HTMLElement>('[data-ui="street"]');
    if (h === null) return { beat: '', scene: '', day: '', confirm: false, refusal: false, skip: false };
    return {
      beat: h.dataset['beat'] ?? '', scene: h.dataset['scene'] ?? '', day: h.dataset['day'] ?? '',
      confirm: h.querySelector('[data-ui="confirm"]') !== null, refusal: h.querySelector('[data-ui="refusal"]') !== null,
      skip: h.querySelector('[data-ui="skip"]') !== null,
    };
  });
}

/** Joue le choix ouvert : l'option nommée par `picks` (clé = id du groupe), sinon la première qui passe. Lève si l'option nommée est refusée. */
async function chooseHere(page: Page, picks: Readonly<Record<string, string>>): Promise<void> {
  await page.locator('[data-choice]').first().waitFor({ state: 'attached' });
  const { id, options } = await page.evaluate(() => {
    const g = document.querySelector('[data-choice]')!;
    return { id: g.getAttribute('data-choice')!, options: [...g.querySelectorAll('[data-option]')].map((e) => e.getAttribute('data-option')!) };
  });
  const forced = picks[id];
  if (forced !== undefined && !options.includes(forced)) throw new Error(`playGuided : « ${forced} » n'est pas offert à « ${id} » (${options.join(', ')})`);
  for (const opt of forced === undefined ? options : [forced]) {
    const before = await stateOf(page);                              // lu AVANT le geste : un choix qui passe d'un geste ne laisse pas la scène suivante passer pour celle-ci
    if (!(await press(page, `[data-choice="${id}"] [data-option="${opt}"]`))) throw new Error(`playGuided : « ${id} / ${opt} » absent de l'écran`);
    let confirmed = false;
    for (let i = 0; i < 80; i++) {                                   // 80 lectures, 250 ms entre deux : 80 x (aller-retour + 250 ms), pas un plafond fixe de 20 s
      const s = await stateOf(page);
      if (s.beat !== 'choice' || s.scene !== before.scene) return;
      if (s.refusal) break;                                           // option refusée : la suivante
      if (s.confirm && !confirmed) { confirmed = true; await press(page, '[data-ui="confirm"]'); continue; }
      if (confirmed) await page.keyboard.press('Escape');            // une séquence jouée se passe ; sans séquence, la touche n'a aucun effet
      await page.waitForTimeout(250);
    }
    if (forced !== undefined) throw new Error(`playGuided : « ${id} / ${forced} » n'a pas été accepté`);
  }
  throw new Error(`playGuided : aucune option de « ${id} » n'a été acceptée`);
}

/**
 * Joue la rue guidée jusqu'à la fin du J2 (fin de démonstration, ou carte du J3 quand la semaine continue), ou toute la semaine (`hooks.through`),
 * au clic et au clavier. `picks` : option choisie par id de groupe (id de scène narrative
 * ou de choix à prix) ; ailleurs la première option qui passe. Rend la suite des `data-scene` vues, sans doublon consécutif.
 */
export async function playGuided(page: Page, picks: Readonly<Record<string, string>> = {}, hooks: Hooks = {}): Promise<string[]> {
  await expect(street(page)).toHaveAttribute('data-mode', 'guided');
  const week = hooks.through === 7;
  const visited: string[] = [];
  const carded = new Set<string>();
  for (let guard = 0; guard < (week ? 3000 : 600); guard++) {
    const seen = await stateOf(page);
    const { beat, scene, day } = seen;
    if (scene !== '' && visited.at(-1) !== scene) {
      visited.push(scene);
      if (hooks.onScene !== undefined) await hooks.onScene(scene);
    }
    if (hooks.onBeat !== undefined) await hooks.onBeat(beat, scene, seen);
    if (beat === 'demoEnd') { if (week) throw new Error(`playGuided : fin de démonstration au J${day}, la semaine devait aller au J7`); return visited; }
    if (!week && beat === 'card' && day === '3') return visited;   // le J3 commence : le parcours J1-J2 est fini
    if (week && (beat === 'outcome' || beat === 'end')) return visited;
    if (week && beat === '') {                             // la rue est déjà démontée : le temps `end` a mené au bilan entre deux lectures
      if ((await page.locator('[data-testid="bilan-page"]').count()) > 0) return visited;
      await page.waitForTimeout(250);
      continue;
    }   // l'issue de l'audition, ou la fin anticipée : la suite est au test
    if (beat === 'card' && hooks.onCard !== undefined && !carded.has(day)) { carded.add(day); await hooks.onCard(Number(day)); }
    if (beat === 'choice') { await chooseHere(page, picks); continue; }
    if (ADVANCING.has(beat)) {
      if (!(await press(page, '[data-ui="continue"]'))) await page.waitForTimeout(250);   // le temps a changé entre la lecture et le geste : relire
      continue;
    }
    if (PASSIVE.has(beat)) {
      // le temps peut finir de lui-même entre la lecture et le geste : le bouton n'est alors plus là, c'est sans conséquence (relu au tour suivant,
      // sans attendre deux secondes un bouton qui ne viendra plus)
      if (!(await press(page, '[data-ui="skip"]'))) await page.waitForTimeout(250);   // même pause qu'en ADVANCING : la garde ne fond pas sur un temps sans « Passer »
      continue;
    }
    throw new Error(`playGuided : temps inconnu « ${beat} »`);
  }
  throw new Error(`playGuided : la démonstration ne finit pas en ${week ? 3000 : 600} temps`);
}
