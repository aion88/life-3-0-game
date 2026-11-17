/**
 * Écrans provisoires : un par identifiant, remplacés un par un par les plans 02a et 03
 * [plan 00 « Coquille »]. Chacun affiche `stub.<id>` et un bouton `stub-next` ; aucun n'écrit la sauvegarde [PHASE V m17].
 */
import { toMilli } from '../shared/milli';
import { answersOf, type Answers, type BilanInput, type RunResult, type WorldVector } from '../shared/types';
import type { AppContext, Screen, ScreenFactory, ScreenId, ScreenRegistry } from './shell';

/** Résultat de partie provisoire pour les écrans provisoires ; le plan 01 produit le vrai [plan 00 « Coquille »]. */
export function provisionalRun(kind: 'arrival' | 'extinction'): RunResult {
  const mid = toMilli(50);
  const v0: WorldVector = { aiPower: mid, order: mid, abundance: mid, freedom: mid, surveillance: mid, unrest: mid };
  return {
    answers: answersOf({}), push: v0, seed: 0, trajectory: { steps: [v0] },
    outcome: kind === 'arrival'
      ? { kind: 'arrival', computedWorld: 'w10', livedWorld: 'w10', redirected: false, distanceSq: 0, offset: { axes: [] } }
      : { kind: 'extinction', world: 'w07', runStartStep: 0, ruptureStep: 1 },
    headlines: [], softened: false,
  };
}

function bilanInput(entry: BilanInput['entry'], run: RunResult): BilanInput {
  return { entry, run, week: null, survival: null, acts: [] };
}

function stub(id: ScreenId, ctx: AppContext, before: () => Promise<unknown>, next: () => Promise<void>): Screen {
  return {
    async mount(root) {
      await before();
      const box = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = ctx.i18n.t(`stub.${id}`);
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset['testid'] = 'stub-next';
      b.textContent = ctx.i18n.t('stub.next');
      b.addEventListener('click', () => { void next(); });
      box.append(p, b);
      root.append(box);
    },
    unmount() { /* la coquille vide la racine */ },
  };
}

const none = (): Promise<void> => Promise.resolve();

/** Registre provisoire, sans l'écran d'erreur (voir `errorScreen.ts`). */
export function stubScreens(): Omit<ScreenRegistry, 'error'> {
  const lang: ScreenFactory<'lang'> = (ctx) => stub('lang', ctx, none, () => ctx.navigate('warning', undefined));
  const warning: ScreenFactory<'warning'> = (ctx) => stub('warning', ctx, none, () => ctx.navigate('questionnaire', undefined));
  const questionnaire: ScreenFactory<'questionnaire'> = (ctx) =>
    stub('questionnaire', ctx, none, () => ctx.navigate('fastforward', { answers: ctx.save.load().data.answers as Answers }));
  const fastforward: ScreenFactory<'fastforward'> = (ctx) =>
    stub('fastforward', ctx, none, () => ctx.navigate('street', { run: provisionalRun('arrival') }));
  const causes: ScreenFactory<'causes'> = (ctx, p) =>
    stub('causes', ctx, none, () => ctx.navigate('bilan', { input: bilanInput('extinction', p.run) }));
  const street: ScreenFactory<'street'> = (ctx, p) =>
    stub('street', ctx, () => ctx.worlds.load(ctx.core.build.streetWorlds[0]!), () => ctx.navigate('bilan', { input: bilanInput('weekEnd', p.run) }));
  const bilan: ScreenFactory<'bilan'> = (ctx) => stub('bilan', ctx, none, () => ctx.navigate('sources', { from: 'bilan' }));
  const sources: ScreenFactory<'sources'> = (ctx) => stub('sources', ctx, none, () => ctx.navigate('lang', undefined));
  const atlas: ScreenFactory<'atlas'> = (ctx) => stub('atlas', ctx, none, () => ctx.navigate('lang', undefined));
  return { lang, warning, questionnaire, fastforward, causes, street, bilan, sources, atlas };
}
