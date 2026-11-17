// @vitest-environment happy-dom
/**
 * Montage de la rue guidée, fin de semaine [plan rue guidée J3-J7, T6] : l'issue de l'audition a son écran (`[data-ui="outcome"]`), le relevé du
 * dernier jour passe à la fin par son bouton (`recap-week`, « Continuer » masqué), le temps `end` mène au bilan une seule fois, avec l'entrée
 * de la fin (semaine finie ou arrestation de nuit). Mêmes coutures que `street_guided_runtime_test.ts` : aucun GPU, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountGuidedStreet } from '../../../src/street/guidedRuntime';
import { placeSpot } from '../../../src/street/guided/actors';
import type { StreetRuntime } from '../../../src/street/runtime';
import type { StreetContext } from '../../../src/engine/moments/types';
import type { AppContext } from '../../../src/app/shell';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { createI18n, type I18n } from '../../../src/i18n/i18n';
import { fakeApp, testDeps } from '../../support/street_screen';
import { SCENE } from '../../support/street_walk';
import { loadMeta } from '../../support/street';
import { EN, FR } from '../../support/street_ui';
import { ctxArrestNight, ctxDirWeek, directorWeekRaw, w10Street } from '../../support/guided';
import { parseGuided } from '../../../src/data/schema/guided';

const q = (s: string): HTMLElement => { const e = document.body.querySelector<HTMLElement>(s); if (e === null) throw new Error(`absent : ${s}`); return e; };
const has = (s: string): boolean => document.body.querySelector(s) !== null;
const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise((r) => { setTimeout(r, 0); }); };

/** Toute clé `w10.dw.*` de `director-week.json` reçoit un texte d'essai distinct (aucune n'est dans les chaînes du jeu). */
function fixtureKeys(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof v === 'string') { if (v.startsWith('w10.dw.')) out.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => fixtureKeys(x, out));
  else if (v !== null && typeof v === 'object') Object.values(v).forEach((x) => fixtureKeys(x, out));
  return out;
}
/** Titres des questions des chaînes de la fixture (`q.<clé>.title`), lus par le relevé. */
const questionTitles = (): string[] => (directorWeekRaw() as { chains: { question: { key: string } }[] }).chains.map((c) => `q.${c.question.key}.title`);
/** Sans chiffre : un texte d'essai passé en paramètre (`street.ui.goTo`) ne doit pas porter de nombre non déclaré. */
const letters = (k: string): string => k.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!);
const filler = (tag: string): Record<string, string> => Object.fromEntries([...fixtureKeys(directorWeekRaw()), ...questionTitles()].map((k) => [k, `${tag} ${letters(k)}`]));
const weekI18n = (): I18n => createI18n({ fr: { ...FR, ...filler('fr') }, en: { ...EN, ...filler('en') } }, loadMeta(), 'fr', { mode: 'dev', report: () => undefined });

let host: HTMLElement;
const animate = Element.prototype.animate;
beforeEach(() => { payloadCache('w10').clear(); host = document.body.appendChild(document.createElement('div')); (Element.prototype as { animate?: unknown }).animate = undefined; });
afterEach(() => { host.remove(); document.body.replaceChildren(); Element.prototype.animate = animate; });

interface Mounted { readonly rt: StreetRuntime; readonly app: ReturnType<typeof fakeApp>; readonly deps: ReturnType<typeof testDeps>; readonly i18n: I18n }
/** Monte la rue guidée sur le monde de `sctx` (bloc `street` et survie compris) : le chargeur de mondes le sert à la place de w10. */
async function mountWith(sctx: StreetContext): Promise<Mounted> {
  const app = fakeApp([], { guided: true });
  const i18n = weekI18n();
  const worlds = { ...app.ctx.worlds, load: () => Promise.resolve(sctx.world) };
  const ctx = { ...app.ctx, i18n, worlds } as unknown as AppContext;
  const deps = testDeps({ sink: app.save });
  const rt = await mountGuidedStreet(ctx, app.run, host, deps);
  await flush();
  deps.frames.step(16);
  return { rt, app, deps, i18n };
}
const beat = (): string => q('[data-ui="street"]').dataset['beat'] ?? '';

/** Un pas : choix -> première option (et confirmation) ; sinon le bouton de l'issue, Continuer, ou Passer ; puis une image. */
async function stepGame(g: Mounted): Promise<void> {
  if (beat() === 'choice') {
    q('[data-ui="destinations"] [data-option]').click();
    document.body.querySelector<HTMLElement>('[data-ui="confirm"]')?.click();
  } else if (has('[data-ui="outcome-continue"]')) q('[data-ui="outcome-continue"]').click();
  else if (has('[data-ui="continue"]')) q('[data-ui="continue"]').click();
  else if (has('[data-ui="skip"]')) q('[data-ui="skip"]').click();
  if (q('[data-ui="root"]').dataset['sequencing'] === 'true') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
  g.deps.frames.step(16);
  await flush();
}
async function playUntil(g: Mounted, done: () => boolean, max = 3000): Promise<void> {
  for (let i = 0; i < max && !done(); i++) await stepGame(g);
  expect(done()).toBe(true);
}
const ENDING = ctxDirWeek.street.guided!.ending!;

/**
 * `ctxDirWeek` dont les lieux de scène (synthétiques, `street.j1.a`...) deviennent des lieux du plan de w10 : la première scène au logement
 * (`unit.9-D`), les autres au milieu de la rue. Le montage pose les corps à ces lieux ; le metteur en scène et la survie sont ceux de `ctxDirWeek`.
 */
const HOME = 'unit.9-D';
function dirWeekStaged(): StreetContext {
  const raw = directorWeekRaw() as { scenes: { id: string; place: string }[] };
  raw.scenes.forEach((s, i) => { s.place = i === 0 ? HOME : 'street.mid'; });
  const street = { ...ctxDirWeek.street, guided: parseGuided(raw, w10Street) };
  return { ...ctxDirWeek, street, world: { ...ctxDirWeek.world, street } };
}

describe('rue guidée : fin de semaine', () => {
  it('test_outcome_shows_regime_and_narrator', async () => {
    const g = await mountWith(dirWeekStaged());
    await playUntil(g, () => beat() === 'outcome');
    const box = q('[data-ui="outcome"]');
    const o = ENDING.outcomes[box.dataset['end']!]!;
    expect(o).toBeDefined();
    expect(q('[data-ui="outcome-regime"]').textContent).toBe(g.i18n.t(o.regimeKey));
    expect(Object.values(o.narratorKeys).map((k) => g.i18n.t(k))).toContain(q('[data-ui="outcome-narration"]').textContent);
    expect(q('[data-ui="outcome-continue"]').textContent).toBe(g.i18n.t('street.ui.outcome.continue'));
    expect(has('[data-ui="continue"]')).toBe(false);                 // un seul bouton : celui de l'issue
    g.rt.dispose();
  });

  it('test_outcome_is_framed_and_staged_at_home', async () => {
    const g = await mountWith(dirWeekStaged());
    await playUntil(g, () => beat() === 'outcome');
    g.deps.frames.step(16);
    expect(g.rt.player()).toEqual(placeSpot(SCENE, HOME));            // cadré au logement, la joueuse y est [revue T4, mineur]
    g.rt.dispose();
  });

  it('test_outcome_leaves_for_last_recap_with_week_button_only', async () => {
    const g = await mountWith(dirWeekStaged());
    await playUntil(g, () => beat() === 'outcome');
    q('[data-ui="outcome-continue"]').click(); g.deps.frames.step(16); await flush();
    expect(beat()).toBe('recap');
    expect(has('[data-ui="outcome"]')).toBe(false);
    expect(q('[data-ui="recap-week"]').textContent).toBe(g.i18n.t(ENDING.weekButtonKey));
    expect(has('[data-ui="continue"]')).toBe(false);                  // dernier jour : le bouton de la semaine remplace Continuer
    g.rt.dispose();
  });

  it('test_end_navigates_to_bilan_once', async () => {
    const g = await mountWith(dirWeekStaged());
    await playUntil(g, () => has('[data-ui="recap-week"]'));
    expect(g.app.navigate).not.toHaveBeenCalled();
    q('[data-ui="recap-week"]').click();
    g.deps.frames.step(100); g.deps.frames.step(100); await flush();
    expect(beat()).toBe('end');
    const bilan = g.app.navigate.mock.calls.filter((c: unknown[]) => c[0] === 'bilan');
    expect(bilan).toHaveLength(1);
    expect(bilan[0]).toMatchObject(['bilan', { input: { entry: 'weekEnd' } }]);
    expect(has('[data-ui="demo-end"]')).toBe(false);
    g.rt.dispose();
  });

  it('test_early_end_navigates_with_early_entry', async () => {
    const g = await mountWith(ctxArrestNight(2));
    await playUntil(g, () => beat() === 'end');
    g.deps.frames.step(100); await flush();
    const bilan = g.app.navigate.mock.calls.filter((c: unknown[]) => c[0] === 'bilan');
    expect(bilan).toHaveLength(1);
    expect(bilan[0]).toMatchObject(['bilan', { input: { entry: 'earlyEnd' } }]);
    expect(has('[data-ui="demo-end"]')).toBe(false);
    g.rt.dispose();
  });
});
