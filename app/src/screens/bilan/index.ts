import { shortMode } from '../../worlds/routing';
import { createContactLink } from '../feedback';
import { exploration, openExploration, explorationReturn } from '../../worlds/exploration';
/**
 * Écran du bilan [GDD 06 §3.3, §3.9, §3.12 ; D141 ; plan 03 T12 ; R-03.8, R-03.18, R-03.27].
 * Une pièce par page (B-R3) : fiche, dossier du monde vécu, chaînes de la semaine (rue guidée), « Les autres » (avec la bascule et les années, la courbe dessinée est retirée), remontée, droits ;
 * navigation sans numéro.
 * `buildBilan` est appelé UNE fois ; la bascule adoucie rend la page à nouveau sur la même donnée, les deux années passent par `shownYears` [B-V10].
 * Écrit la phase `bilan` à l'ouverture [R-03.8]. Le monde calculé n'est chargé que si la build le porte [R-03.18].
 */
import type { Screen, ScreenFactory } from '../../app/shell';
import { buildBilan, shownYears } from '../../bilan/build';
import { weekChains, type WeekChains } from '../../bilan/chains';
import { otherLineText, traceText } from '../../bilan/others';
import { rightHalves } from '../../bilan/rights';
import { loadBilanCommon } from '../../data/bilanLoad';
import type { WorldData } from '../../data/schema/world';
import type { BilanData } from '../../shared/types/bilan';
import { createFrame, type Frame } from '../../ui/frame';
import { createActionButton } from '../../ui/components/c';
import { createPageNav } from '../../ui/components/pageNav';
import { createSoftToggle } from '../../ui/components/softToggle';
import { loadUi } from '../../data/ui/load';
import { createUiEvents, type UiEvents } from '../../ui/events';
import { createInstantAnimator, motionFor, reducedMotionOf, webAnimator, type Animator } from '../../ui/motion';
import { prefersReducedMotion } from '../../ui/backdrop';
import { shareImage } from './shareImage';
import { createSheetBlocks } from './sheetC';
import '../../ui/font';
import '../../ui/tokens.css';
import '../../ui/chambreScope.css';

type PageId = 'sheet' | 'dossier' | 'chains' | 'others' | 'traceback' | 'rights';
type T = (key: string, params?: Record<string, string | number>) => string;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
const list = (items: readonly string[], testid?: string): HTMLUListElement => {
  const ul = el('ul');
  if (testid !== undefined) ul.dataset['testid'] = testid;
  for (const s of items) ul.append(el('li', s));
  return ul;
};

/** `{noms}` : les noms traduits, joints par « , » et `street.recap.names.and` avant le dernier ; `street.recap.names.none` sans nom (règle du relevé du soir). */
function namesText(t: T, keys: readonly string[]): string {
  const names = keys.map((k) => t(k));
  if (names.length === 0) return t('street.recap.names.none');
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} ${t('street.recap.names.and')} ${names[names.length - 1]!}`;
}

/**
 * Pages présentes pour cette donnée, dans l'ordre de lecture ; la fiche d'abord. `chains` : lecture de la rue guidée (hors `BilanData`,
 * décision 12), page montée après le dossier si elle porte au moins une chaîne ouverte, ou la ligne d'une arrestation anticipée (arrêté sans
 * aucun maillon franchi, on lit quand même la nuit de l'arrestation).
 */
export function pagesOf(data: BilanData, chains: WeekChains | null = null): readonly PageId[] {
  const pages: PageId[] = [];
  if (data.sheet !== null) pages.push('sheet');
  if (data.dossier !== null) pages.push('dossier');
  if (chains !== null && (chains.chains.length > 0 || chains.arrestedLineKey !== null)) pages.push('chains');
  pages.push('others', 'traceback');
  if (data.rights !== null) pages.push('rights');
  return pages;
}

/** Dépendances injectables : mouvement réduit, animateur et bus d'événements d'interface (spec C §4, §5). */
export interface BilanDeps { readonly reducedMotion?: boolean; readonly animator?: Animator; readonly events?: UiEvents }

export function createBilanScreen(deps: BilanDeps = {}): ScreenFactory<'bilan'> {
  return (ctx, { input }) => {
    let frame: Frame | null = null;
    let busy = false;
    let explorer: { dispose(): void } | null = null;
    const screen: Screen = {
      async mount(root) {
        const i18n = ctx.i18n;
        const t: T = (k, p) => i18n.t(k, p);
        if (!exploration(ctx) && ctx.save.load().data.phase !== 'bilan') ctx.save.update({ phase: 'bilan' });

        const out = input.run.outcome;
        const wanted = out.kind === 'arrival' && input.entry !== 'extinction' ? out : null;
        const available = ctx.worlds.available();
        const lived: WorldData | null = wanted !== null && available.includes(wanted.livedWorld) ? await ctx.worlds.load(wanted.livedWorld) : null;
        let computedFile: WorldData | null = null;
        if (wanted !== null) {
          if (wanted.computedWorld === wanted.livedWorld) computedFile = lived;
          else if (available.includes(wanted.computedWorld)) computedFile = await ctx.worlds.load(wanted.computedWorld);
        }
        const base = buildBilan(input, { core: ctx.core, common: loadBilanCommon(), lived, computedFile, has: (k) => i18n.has(k) });
        const guided = lived?.street.guided ?? null;
        const chains = guided === null || lived === null ? null : weekChains(input, guided, lived.street.clock, input.run.answers);
        let softened = base.softened;
        const view = (): BilanData => ({ ...base, softened });
        const shareDims = ((): { width: number; height: number } | null => {
          const b = lived?.bilan;
          const s = b !== undefined && 'share' in b ? b.share : null;
          return s !== null && s.width !== null && s.height !== null && base.entry !== 'extinction' ? { width: s.width, height: s.height } : null;
        })();
        let shareNames = false;

        frame = createFrame(root);
        // Écran de document sur crème pleine page (maquette C) : les bandes 2,39:1 du cadre, faites pour la rue et le mur, ne le recouvrent pas.
        frame.stage.parentElement?.querySelectorAll<HTMLElement>('[data-band]').forEach((b) => { b.hidden = true; });
        const main = el('main');
        main.className = shortMode(location.search) ? 'c-bilan chambre' : 'c-bilan';   // chemin public : noir chaud ; ?parcours=ancien garde la crème
        const top = el('div');
        top.className = 'c-bilan-top c-sober';
        const slot = el('section');
        slot.className = 'c-bilan-page';
        slot.dataset['testid'] = 'bilan-page';
        const bottom = el('div');
        bottom.className = 'c-bilan-actions';
        const bar = el('div');
        bar.className = 'c-bilan-bar c-sober';
        bar.append(bottom);
        if (shortMode(location.search)) main.append(top, slot, bar); else main.append(bar, top, slot);   // chambre : l'ordre de lecture et de tabulation suit l'ordre affiché (page, puis actions)
        frame.stage.append(main);

        const worldName = (id: string): string => t(`world.${id}.name`);
        const pageHead = (title: string, label: string, id: PageId): HTMLElement => {
          const h = el('header');
          h.className = 'c-bilan-head c-sober';
          const h2 = el('h2', title); h2.dataset['pageTitle'] = 'true'; h2.className = 'c-bilan-title';
          const p = el('p', label); p.dataset['pageLabel'] = 'true'; p.className = 'c-bilan-label'; p.hidden = label === title;   // chambre : pas de libellé qui répète le titre
          h.append(h2, p);
          slot.dataset['page'] = id;
          return h;
        };
        const prefix = base.worldBlockId?.split('.')[0] ?? null;

        /** Intitulé (clé propre à la page) et libellé (`bilan.page.<page>.label`) de chaque page [B-V5] : jamais un numéro. */
        const heads = (id: PageId): { title: string; label: string } => {
          const title: Record<PageId, string> = {
            sheet: 'bilan.sheet.title', dossier: `${prefix}.bilan.file.title`, chains: 'bilan.chains.title',
            others: 'bilan.others.title', traceback: 'bilan.traceback.title', rights: 'bilan.rights.title',
          };
          return { title: t(title[id]), label: t(`bilan.page.${id}.label`) };
        };
        /** Un seul libellé par onglet : `bilan.page.<page>.label` (spec C §3.4). L'intitulé de la page est le titre de son en-tête. */
        const labelOf = (id: PageId): string => heads(id).label;

        /** Ce que disait la page de la courbe, sans le dessin : la bascule, l'année de rupture ou d'extinction, la porte la plus proche. Posé en tête de « Les autres ». */
        const futureLines = (d: BilanData): HTMLElement[] => {
        const out: HTMLElement[] = [];
        const c = d.curve;
        const b = c.bascule;
        const lines: string[] = [];
        const to = c.withEcho?.toWorld;
        if (b.case === 'a' && to !== null && to !== undefined && b.yearWith !== null) {
          lines.push(t('bilan.bascule.toward', { world: worldName(to), year: b.yearWith }));
          if (b.shiftYears !== null && b.shiftYears !== 0) lines.push(i18n.tPlural(`bilan.bascule.${b.direction}`, Math.abs(b.shiftYears), { n: Math.abs(b.shiftYears) }));
        } else if (b.case === 'b') {
          if (to !== null && to !== undefined && b.yearWith !== null) lines.push(t('bilan.bascule.toward', { world: worldName(to), year: b.yearWith }));
          lines.push(t('bilan.bascule.b'));
        } else if (b.case === 'd' || b.case === 'e') lines.push(t(`bilan.bascule.${b.case}`));
        else if (b.case === 'c' && prefix !== null && i18n.has(`${prefix}.bilan.bascule.hold`)) lines.push(t(`${prefix}.bilan.bascule.hold`));
        for (const l of lines) out.push(el('p', l));
        // B-V10 : `shownYears` est le seul lecteur des deux années.
        const { rupture: ruptureShown, projected: extinctionShown } = shownYears(d);
        if (d.entry === 'extinction') {
          const y = el('p');
          y.dataset['year'] = 'rupture';
          y.textContent = ruptureShown !== null ? String(ruptureShown) : t('bilan.curve.yearHidden');
          out.push(y);
        }
        if (extinctionShown !== null) out.push(el('p', t('bilan.curve.extinctionYear', { year: extinctionShown })));
        out.push(el('p', c.gate === null ? t('bilan.curve.noGate') : `${t('bilan.curve.gate')} : ${t(`bilan.curve.var.${c.gate.var}`)}`));
        return out;
        };

        const renderers: Record<PageId, (d: BilanData) => HTMLElement[]> = {
          sheet(d) {
            const wrap = el('div');
            wrap.className = 'c-bilan-sheet';
            wrap.append(...createSheetBlocks(d.sheet!, i18n));
            return [wrap];
          },
          dossier(d) {
            const b = d.dossier!;
            const k = (s: string): string => `${prefix}.bilan.${s}`;
            const out: HTMLElement[] = [list(b.names.length === 0 ? [t(k('file.namesNone'))] : b.names.map((n) => t(n.personKey)), 'dossier-names')];
            out.push(el('p', b.answer === null ? t(k('file.noAnswer')) : t(k(`audition.${b.answer}`))));
            out.push(el('p', b.flaggedCount > 0 ? t(k('file.flagged'), { n: b.flaggedCount }) : t(k('file.noneFlagged'))));
            out.push(list(b.files.map((f) => `${t(f.lineKey)} (${t(k(`file.outcome.${f.outcome}`))})`), 'dossier-files'));
            const firstName = b.names[0] !== undefined ? t(b.names[0].personKey) : '';
            out.push(list(b.mentions.map((m) => t(k(`mention.${m}`), m === 'savedByName' ? { name: firstName } : {})), 'dossier-mentions'));
            return out;
          },
          chains() {
            const w = chains!;
            const wrap = el('div');
            wrap.className = 'c-bilan-chains';
            wrap.dataset['ui'] = 'bilan-chains';
            const dateOf = (day: number): string => { const c = lived?.calendar.find((x) => x.day === day); return c === undefined ? '' : t(c.dateKey); };
            if (w.arrestedNight !== null && w.arrestedLineKey !== null) {
              const p = el('p', t(w.arrestedLineKey, { jour: dateOf(w.arrestedNight) }));
              p.className = 'c-bilan-chains-arrested';
              p.dataset['ui'] = 'bilan-chains-arrested';
              wrap.append(p);
            }
            const noms = namesText(t, w.names);
            for (const c of w.chains) {
              const box = el('section');
              box.className = 'c-bilan-chain';
              box.dataset['chain'] = c.chainId;
              const h = el('h3', t(c.titleKey));
              h.className = 'c-bilan-chain-title';
              const ol = el('ol');
              ol.className = 'c-bilan-chain-links';
              for (const it of c.items) {
                const li = el('li');
                const when = el('p', dateOf(it.day));
                when.className = 'c-bilan-chain-day';
                li.append(when, el('p', t(it.recapKey, { noms })));
                if (it.speech === 'said') li.append(el('p', t('street.recap.said', { text: t(it.saidKey!) })));
                ol.append(li);
              }
              box.append(h, ol, el('p', t(`q.${c.questionKey}.title`)));
              if (c.linkKey !== null) box.append(el('p', t(c.linkKey)));
              const fact = el('p', t(c.fact.key));
              fact.className = 'c-bilan-chain-fact';
              const source = el('p', t(c.fact.sourceKey));   // la ligne lisible ; `fact.source` (chemin interne) n'est jamais montrée
              source.className = 'c-bilan-chain-source';
              box.append(fact, source);
              wrap.append(box);
            }
            return [wrap];
          },
          others(d) {
            return [...futureLines(d), d.others.locked ? el('p', t('bilan.others.locked')) : list(d.others.lines.map((l) => otherLineText(i18n, l)), 'others-lines')];
          },
          traceback(d) { return [list(d.traceback.map((l) => traceText(i18n, l).text), 'traceback-lines')]; },
          rights(d) { return [list(d.rights!.map((r) => { const h = rightHalves(i18n, r); return `${h.first} · ${h.second}`; }), 'rights-lines')]; },
        };

        const pages = pagesOf(base, chains);
        const renderPage = (i: number): void => {
          const id = pages[i]!;
          const d = view();
          const h = heads(id);
          slot.replaceChildren(pageHead(h.title, h.label, id), ...renderers[id](d));
        };
        // Changement de page voulu par la joueuse : `ui.page` puis glissement et fondu (fondu seul en mouvement réduit, I-9). Ni le premier rendu ni la bascule douce n'en jouent.
        const reduced = reducedMotionOf(deps.reducedMotion ?? (prefersReducedMotion() || undefined));
        const animator = deps.animator ?? (typeof Element.prototype.animate === 'function' ? webAnimator : createInstantAnimator());
        const events = deps.events ?? createUiEvents();
        const onPage = (i: number): void => {
          renderPage(i);
          events.emit('ui.page');
          const spec = motionFor('pageChange', reduced, loadUi().timing);
          if (spec) void animator.play(slot, spec);
        };
        const nav = createPageNav(pages.map(labelOf), onPage);
        nav.el.setAttribute('aria-label', t('bilan.nav.label'));

        const toggle = createSoftToggle({ pressed: softened, onToggle(next) { softened = next; renderPage(nav.index()); } });
        toggle.el.append(t('bilan.soft.label'));
        bar.prepend(toggle.el);
        top.append(nav.el);

        const button = (id: string, label: string, go: () => void, main = false): HTMLButtonElement => {
          const b = main ? createActionButton(label, id) : el('button', label);
          if (!main) { b.type = 'button'; b.dataset['testid'] = id; b.className = 'c-pill c-pill--creme c-bilan-action'; }
          b.addEventListener('click', go);
          bottom.append(b);
          return b;
        };
        button('bilan-sources', t('bilan.btn.sources'), () => { void ctx.navigate('sources', { from: 'bilan', input }); });
        if (shareDims !== null) {
          button('bilan-image', t('bilan.btn.image'), () => {
            if (busy) return;
            busy = true;
            void shareImage(view(), i18n, { ...shareDims, names: shareNames }).finally(() => { busy = false; });
          });
          if (base.dossier !== null && base.dossier.names.length > 0) {
            const label = el('label');
            label.className = 'c-bilan-share-names';
            const box = el('input');
            box.type = 'checkbox';
            box.dataset['testid'] = 'bilan-share-names';
            box.addEventListener('change', () => { shareNames = box.checked; });
            label.append(box, t('bilan.share.names'));
            bottom.append(label);
          }
        }
        if (shortMode(typeof location === 'undefined' ? '' : location.search)) button('bilan-explore', t('bilan.btn.explore'), () => { explorer?.dispose(); explorer = openExploration(root, ctx, input.run); });
        if (shortMode(typeof location === 'undefined' ? '' : location.search)) {
          button('bilan-atlas', t('atlas.open'), () => { void ctx.navigate('atlas', { arrival: out.kind === 'arrival' ? out.livedWorld : out.world, back: { id: 'bilan', input } }); });
          bottom.append(createContactLink(i18n, 'c-pill c-pill--creme c-bilan-action'));
        }
        explorationReturn(ctx, bottom);
        button('bilan-replay', t('bilan.btn.replay'), () => { void ctx.navigate('warning', undefined); }, true);
        renderPage(0);
      },
      unmount() { explorer?.dispose(); frame?.dispose(); frame = null; },
    };
    return screen;
  };
}

export const bilanScreen: ScreenFactory<'bilan'> = createBilanScreen();
