/**
 * Écran SOURCES & HONESTY : quatre étiquettes et leur légende, huit points de contenu, le tableau du monde de l'histoire, les sept
 * hypothèses du jeu, la ligne des mondes rares et les parts d'arrivée [GDD 06 §3.8 ; plan 03 T13 ; R-03.27 (2)].
 * Il reçoit `{from, input?}` : la partie se recalcule des réponses sauvées (`runFastForward`), comme au fast-forward. Il ne lit jamais
 * l'année de rupture ni l'année d'extinction projetée [B-V10, R-03.27 (1)] : la version adoucie ne change donc rien ici.
 * Chaque texte est une clé i18n ; aucun chiffre n'est écrit en dur, les pourcentages viennent de `sharePercent`.
 */
import type { Screen, ScreenFactory } from '../../app/shell';
import { buildSources, SOURCE_LABELS } from '../../bilan/sources';
import { sharePercent } from '../../bilan/share';
import { loadBilanCommon } from '../../data/bilanLoad';
import type { WorldData } from '../../data/schema/world';
import { runFastForward } from '../../fastforward/run';
import type { Answers } from '../../shared/types';
import { createFrame, type Frame } from '../../ui/frame';
import { loadFastForwardData } from '../data';
import { mountSoberPage } from '../sober';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls !== undefined) e.className = cls;
  return e;
};

export function createSourcesScreen(): ScreenFactory<'sources'> {
  return (ctx, { from, input }) => {
    let frame: Frame | null = null;
    const screen: Screen = {
      async mount(root) {
        const t = ctx.i18n.t.bind(ctx.i18n);
        const lang = ctx.i18n.lang();
        const common = loadBilanCommon();
        const saved = ctx.save.load().data;
        const run = runFastForward(ctx.core, loadFastForwardData().headlines, saved.answers as Answers, saved.softened === true);
        const world = run.outcome.kind === 'extinction' ? run.outcome.world : run.outcome.computedWorld;
        const computedFile: WorldData | null = run.outcome.kind === 'arrival' && ctx.worlds.available().includes(world as never)
          ? await ctx.worlds.load(run.outcome.computedWorld) : null;
        const s = buildSources(run, { core: ctx.core, common, computedFile });

        frame = createFrame(root);
        const main = el('main');
        const back = el('button', t('sources.back'), 'c-sober-pill c-sober-back');
        back.type = 'button';
        back.dataset['testid'] = 'sources-back';
        // Une seule source de l'entrée du bilan : celle que T12 envoie [R-03.28]. Sans elle, retour à la langue.
        back.addEventListener('click', () => {
          if (from === 'bilan' && input !== undefined) void ctx.navigate('bilan', { input });
          else void ctx.navigate('lang', undefined);
        });
        main.append(back, el('h1', t('sources.title'), 'c-sober-title'));

        // 1. Les quatre étiquettes et leur légende.
        const legend = el('dl', undefined, 'c-card c-sober-terms c-sober-left');
        for (const l of SOURCE_LABELS) {
          const dt = el('dt', t(`sources.label.${l}`));
          dt.dataset['label'] = l;
          legend.append(dt, el('dd', t(`sources.legend.${l}`)));
        }
        main.append(legend);

        // 2. Le monde de l'histoire : son tableau, ou la ligne « absent de cette version ».
        const worldSec = el('section', undefined, 'c-card c-sober-stack c-sober-left');
        worldSec.append(el('h2', t('sources.worlds.title'), 'c-sober-heading'), el('p', t(`world.${s.world}.name`), 'c-sober-text'));
        if (s.worldRows === null) worldSec.append(el('p', t('sources.worlds.none'), 'c-sober-hint'));
        else {
          const ul = el('ul', undefined, 'c-sober-list');
          for (const r of s.worldRows) {
            const li = el('li');
            li.dataset['testid'] = 'sources-world-row';
            li.dataset['label'] = r.label;
            li.append(el('strong', t(`sources.label.${r.label}`)), document.createTextNode(' '), el('span', t(r.textKey)));
            ul.append(li);
          }
          worldSec.append(ul);
        }
        main.append(worldSec);

        // 3. Les huit points de contenu.
        const points = el('section', undefined, 'c-sober-stack c-sober-left');
        for (const id of common.contentPoints) {
          const a = el('article', undefined, 'c-card c-sober-stack');
          a.dataset['testid'] = 'sources-point';
          a.dataset['point'] = id;
          a.append(el('h2', t(`sources.point.${id}.title`), 'c-sober-heading'), el('p', t(`sources.point.${id}.body`), 'c-sober-text'));
          points.append(a);
        }
        main.append(points);

        // 4. Les sept hypothèses, par intitulé et libellé, jamais par clé ni par lettre.
        const hyp = el('section', undefined, 'c-card c-sober-stack c-sober-left');
        hyp.append(el('h2', t('sources.hypotheses.title'), 'c-sober-heading'));
        const hl = el('ul', undefined, 'c-sober-list');
        for (const h of s.hypotheses) {
          const li = el('li');
          li.dataset['testid'] = 'sources-hypothesis';
          li.append(el('strong', t(`q.${h.question}.title`)), document.createTextNode(' '), el('span', t(`q.${h.question}.${h.answer}.label`)));
          hl.append(li);
        }
        hyp.append(hl);
        main.append(hyp);

        // 5. Les mondes d'arrivée : parts, puis la ligne des mondes rares.
        const shares = el('section', undefined, 'c-card c-sober-stack c-sober-left');
        shares.append(el('h2', t('sources.shares.title'), 'c-sober-heading'));
        const sl = el('ul', undefined, 'c-sober-list');
        for (const r of s.shares.rows) {
          const li = el('li', `${t(`world.${r.world}.name`)} ${sharePercent(r.count, s.shares.total, lang)}`);
          li.dataset['testid'] = 'sources-share-row';
          li.dataset['world'] = r.world;
          sl.append(li);
        }
        shares.append(sl);
        const gate = s.shares.rows.find((r) => r.world === 'w04');
        const zoo = s.shares.rows.find((r) => r.world === 'w09');
        if (gate !== undefined && zoo !== undefined && zoo.count > 0) {
          shares.append(el('p', t(s.rareLineKey, { gatekeeper: sharePercent(gate.count, s.shares.total, lang), oneIn: String(Math.round(s.shares.total / zoo.count)) })));
        }
        main.append(shares);

        // 6. Les notes.
        const notes = el('section', undefined, 'c-sober-stack c-sober-left');
        for (const k of s.noteKeys) notes.append(el('p', t(k), 'c-sober-hint'));
        main.append(notes);

        mountSoberPage(frame, main);
      },
      unmount() { frame?.dispose(); frame = null; },
    };
    return screen;
  };
}

export const sourcesScreen: ScreenFactory<'sources'> = createSourcesScreen();
