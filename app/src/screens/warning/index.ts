/**
 * Écran d'avertissement : contenu, bascule d'adoucissement, « Continuer » [GDD 06 §3.9 ; plan 03 T3].
 * Partie neuve (phase `new` ou `questionnaire`) : la bascule écrit `save.softened`.
 * « Rejoue » (phase `fastforward`, `street` ou `bilan`) : elle écrit le brouillon, la sauvegarde ne bouge pas.
 */
import '../../ui/font';
import '../../ui/tokens.css';
import './warning.css';
import type { Screen, ScreenFactory } from '../../app/shell';
import type { SavePhase } from '../../save/save';
import { createFrame, type Frame } from '../../ui/frame';
import { createSoftToggle } from '../../ui/components/softToggle';
import { createActionButton } from '../../ui/components/c';
import { getDraft, resetDraft } from '../draft';
import { mountSoberPage } from '../sober';

const REPLAY_PHASES: readonly SavePhase[] = ['fastforward', 'street', 'bilan'];

export const warningScreen: ScreenFactory<'warning'> = (ctx) => {
  let frame: Frame | null = null;
  const screen: Screen = {
    mount(root) {
      const { phase, softened } = ctx.save.load().data;
      const replay = REPLAY_PHASES.includes(phase);
      resetDraft();
      if (replay) getDraft().softened = softened ?? false;
      const t = ctx.i18n.t.bind(ctx.i18n);

      frame = createFrame(root);
      const main = document.createElement('main'); main.classList.add('warning');
      const h = document.createElement('h1');
      h.className = 'c-sober-title';
      h.textContent = t('warning.title');
      const body = document.createElement('p');
      body.className = 'c-card c-sober-text c-sober-left';
      body.textContent = t('warning.body');

      const tg = createSoftToggle({
        pressed: softened ?? false,
        onToggle(next) {
          if (replay) getDraft().softened = next;
          else ctx.save.update({ softened: next });
        },
      });
      tg.el.classList.add('c-sober-toggle');
      tg.el.textContent = t('warning.soft.label');
      const hint = document.createElement('p');
      hint.className = 'c-sober-hint';
      hint.textContent = t('warning.soft.hint');

      const go = createActionButton(t('warning.continue'), 'warning-continue');
      go.addEventListener('click', () => {
        if (!replay) ctx.save.update({ phase: 'questionnaire' });
        void ctx.navigate('questionnaire', undefined);
      });

      const flow=document.createElement('ol');flow.className='play-flow';
      for(const [title,text] of (ctx.i18n.lang()==='en'?[['Choose','A few dilemmas.'],['Enter your future','A mission with 3D characters.'],['See what changes','Your consequences. Other futures.']]:[['Choisis','Quelques dilemmes.'],['Entre dans ton futur','Une mission, des personnages 3D.'],['Vois ce que tu changes','Ton bilan. D’autres futurs.']])){const li=document.createElement('li');const strong=document.createElement('strong');strong.textContent=title!;li.append(strong,text!);flow.append(li);}
      main.append(h, flow, body, tg.el, hint, go);
      mountSoberPage(frame, main);
    },
    unmount() { frame?.dispose(); frame = null; },
  };
  return screen;
};
