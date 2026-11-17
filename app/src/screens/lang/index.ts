/**
 * Premier écran [GDD 01 §3.2 étape 0 ; plan 03 T3]. Partie neuve : deux choix de langue, chacun dans sa langue ; pose `save.lang` et `i18n`,
 * puis ouvre l'avertissement. Partie en cours (phase autre que `new`) : « Continuer » reprend là où la sauvegarde le dit, « Nouvelle partie »
 * demande une confirmation en un clic, efface la partie et montre les langues [demande Cynthia 2026-11-03].
 */
import type { Screen, ScreenFactory } from '../../app/shell';
import { initialPayload, initialScreen } from '../../app/initial';
import { createFrame, type Frame } from '../../ui/frame';
import { createLangSwitch } from '../../ui/components/langSwitch';
import { createActionButton } from '../../ui/components/c';
import { resetDraft } from '../draft';
import { createContactLink } from '../feedback';
import { clearShortProgress } from '../../save/shortProgress';
import { shortMode } from '../../worlds/routing';
import { mountSoberPage } from '../sober';
import '../../ui/font';
import '../../ui/tokens.css';
import '../../ui/worlds.css';
import './landing.css';
import { createResources } from './resources';
import type { EnglishData } from '../../atlas/model';

export const langScreen: ScreenFactory<'lang'> = (ctx) => {
  let frame: Frame | null = null;
  let atlas: Screen | null = null;
  let gone = false;
  const t = (k: string): string => ctx.i18n.t(k);
  const button = (key: string, ui: string): HTMLButtonElement => {
    const b = createActionButton(t(`resume.${key}`));
    b.dataset['ui'] = `resume-${ui}`;
    return b;
  };

  const mountAtlas = async (host: HTMLElement): Promise<void> => {
    const lang = ctx.i18n.lang();
    const [{ createAtlasScreen }, { parseAtlas }, { buildAtlas }, { default: raw }, english] = await Promise.all([
      import('../atlas/index'), import('../../atlas/schema'), import('../../atlas/model'), import('../../atlas/data.json'),
      lang === 'en' ? import('../../atlas/data.en.json').then((m) => m.default as unknown as EnglishData) : Promise.resolve(undefined),
    ]);
    if (gone || !host.isConnected) return;
    atlas?.unmount();
    atlas = createAtlasScreen(buildAtlas(parseAtlas(raw), english), { lang });
    await atlas.mount(host);
  };

  const decorate = (main: HTMLElement): void => {
    if (!shortMode(location.search)) return;
    main.classList.add('life-entry'); const en = ctx.i18n.lang() === 'en';
    const panel = document.createElement('section'); panel.className = 'life-entry-content';
    const actions = document.createElement('div'); actions.className = 'life-entry-actions';
    actions.append(...Array.from(main.childNodes));
    const intro = document.createElement('div'); intro.className = 'life-entry-intro';
    const heading = document.createElement('h2'); heading.textContent = en ? 'Twelve possible futures. One life to feel.' : 'Douze futurs possibles. Une vie à ressentir.';
    const description = document.createElement('p');
    // Book context: https://www.penguinrandomhouse.com/books/530584/life-30-by-max-tegmark/9781101970317/
    description.textContent = en ? 'In Life 3.0, MIT physicist Max Tegmark explores the possible futures of artificial intelligence and the place we want to keep in them. This independent game lets you live them: meet people, choose, decide, and see how today’s choices can shape your everyday life tomorrow.' : 'Dans Life 3.0, Max Tegmark, physicien au MIT, explore les futurs possibles de l’intelligence artificielle et la place que nous voulons y garder. Ce jeu indépendant te propose de les vivre : rencontre, choisis, décide, et découvre comment les choix d’aujourd’hui peuvent façonner ton quotidien de demain.';
    const play = document.createElement('p'); play.textContent = en ? 'Your choices draw a future. Step into its places, meet its people and live with the consequences.' : 'Tes choix dessinent un futur. Entre dans ses décors, rencontre ses personnages et vis les conséquences.';
    intro.append(heading, description, play);
    const contact = createContactLink(ctx.i18n, 'life-entry-contact');
    const resourcesLink=document.createElement('a');resourcesLink.className='life-entry-resources-link';resourcesLink.href='#ressources';resourcesLink.textContent=en?'Explore the resources':'Explorer les ressources';
    resourcesLink.addEventListener('click',event=>{event.preventDefault();main.querySelector('#ressources')?.scrollIntoView({behavior:'instant',block:'start'});});
    // Accueil centré : « Jouer » d'abord (au-dessus du pli), puis la présentation, puis contact et ressources.
    const links = document.createElement('div'); links.className = 'life-entry-links'; links.append(contact, resourcesLink); panel.append(actions, intro, links);
    const picture = document.createElement('picture'); picture.className = 'life-entry-poster';
    const image = document.createElement('img'); image.src = `${import.meta.env.BASE_URL}illustrated/poster-horizontal.jpg`;
    image.alt = en ? 'Life 3.0: a silhouette facing twelve possible futures, two of them Game Over screens.' : 'Life 3.0 : une silhouette face à douze futurs possibles, dont deux écrans Game Over.';
    image.fetchPriority = 'high'; image.width = 1672; image.height = 941; picture.append(image);
    const credit = document.createElement('p'); credit.className = 'life-entry-credit';
    credit.textContent = en ? 'An independent game by Cynthia Ortu · Inspired by Max Tegmark’s essay Life 3.0.' : 'Un jeu indépendant de Cynthia Ortu · Inspiré de l’essai Life 3.0 de Max Tegmark.';
    // L'Atlas est posé sous les boutons, dans la page : il suffit de défiler [demande Cynthia 2026-11-14]. Les ressources ferment la page.
    const atlasHost = document.createElement('section'); atlasHost.className = 'life-entry-atlas'; atlasHost.dataset['ui'] = 'home-atlas';
    main.replaceChildren(picture, panel, credit, atlasHost, createResources(document));
    void mountAtlas(atlasHost);
  };

  const languages = (main: HTMLElement): void => {
    if (shortMode(location.search)) {
      const title = document.createElement('h1'); title.className = 'c-sober-title life-entry-title'; title.textContent = 'Life 3.0';
      const edition = document.createElement('p'); edition.className = 'life-entry-edition'; edition.textContent = 'Histoire courte · Short story';
      // Deux langues, chacune dans la sienne [demande Cynthia 2026-11-14 : « on le sort en anglais aussi »].
      const play = (lang: 'fr' | 'en', label: string): HTMLButtonElement => {
        const start = createActionButton(label); start.dataset['lang'] = lang; start.lang = lang;
        start.addEventListener('click', () => { ctx.i18n.setLang(lang); document.documentElement.lang = lang; ctx.save.update({ lang }); void ctx.navigate('warning', undefined); });
        return start;
      };
      const starts = [play('fr', 'Jouer'), play('en', 'Play in English')];
      const ordered = ctx.i18n.lang() === 'en' ? starts.reverse() : starts;
      ordered[1]!.classList.add('life-btn--outline');   // un seul bouton plein par écran : la langue détectée, l'autre en contour
      main.replaceChildren(title, edition, ...ordered); decorate(main);
      return;
    }
    const sw = createLangSwitch(ctx.i18n, (lang) => {
      ctx.save.update({ lang });
      void ctx.navigate('warning', undefined);
    });
    sw.el.classList.add('c-sober-row');
    sw.el.querySelectorAll('button').forEach((b) => b.classList.add('c-sober-pill'));
    main.replaceChildren(sw.el);
  };

  const resume = (main: HTMLElement, confirming: boolean): void => {
    const h = document.createElement('h1');
    h.className = 'c-sober-title';
    h.textContent = t('resume.title');
    const row = document.createElement('div');
    row.className = 'c-sober-row';
    if (!confirming) {
      const go = button('continue', 'continue');
      go.addEventListener('click', () => {
        const data = ctx.save.load().data;
        const id = initialScreen(data, ctx.core.questionnaire);
        // `data-ready` garde son sens d'avant la reprise à deux boutons : posé quand l'écran repris est monté, comme au démarrage
        const html = document.documentElement;
        delete html.dataset['ready'];
        const done = (): void => { html.dataset['ready'] = '1'; };
        if (id === 'fastforward') void ctx.navigate(id, initialPayload(data)).then(done);
        else if (id === 'warning' || id === 'questionnaire') void ctx.navigate(id, undefined).then(done);
      });
      const fresh = button('new', 'new'); fresh.classList.add('life-btn--outline');
      fresh.addEventListener('click', () => { resume(main, true); });
      row.append(go, fresh);
    } else {
      const yes = button('confirm', 'confirm'); yes.classList.add('life-btn--outline');   // l'action qui efface n'est jamais le bouton plein
      yes.addEventListener('click', () => { clearShortProgress(); ctx.save.reset(); resetDraft(); languages(main); });
      const no = button('cancel', 'cancel');
      no.addEventListener('click', () => { resume(main, false); });
      row.append(yes, no);
    }
    main.replaceChildren(h, row); decorate(main);
    main.querySelector<HTMLButtonElement>('button')?.focus();
  };

  const screen: Screen = {
    mount(root) {
      if (shortMode(location.search)) {
        // Partie neuve : la langue détectée du navigateur habille l'accueil, jusqu'au choix. Partie reprise : la langue enregistrée.
        const data = ctx.save.load().data; const lang = data.phase === 'new' ? ctx.i18n.lang() : data.lang === 'en' ? 'en' : 'fr';
        ctx.i18n.setLang(lang); document.documentElement.lang = lang;
      }
      frame = createFrame(root);
      const main = document.createElement('main');
      if (ctx.save.load().data.phase === 'new') languages(main);
      else resume(main, false);
      mountSoberPage(frame, main);
    },
    unmount() { gone = true; atlas?.unmount(); atlas = null; frame?.dispose(); frame = null; },
  };
  return screen;
};
