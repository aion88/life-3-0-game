/**
 * La fiche d'un texte : s'ouvre comme un papier sur l'écran, se ferme au toucher (n'importe où hors d'un lien, croix, Échap).
 * Trois natures, jamais mélangées : le FAIT (étiquette Sourcé : stade au <date de vérification>, citation, phrase, lien source),
 * ce que le fait ne dit pas, puis la LECTURE DU JEU (étiquette Extrapolé : mécanisme et limite de chaque lien).
 */
import type { Labels } from '../../atlas/labels';
import { bigValue, formatDate, jaugeLisible, motsAffiches, quoteLang, STADE_KEY, valeurAffichee } from '../../atlas/model';
import type { AtlasData, Loi } from '../../atlas/schema';
import { el, link, stadeGlyph, stamp, symbol } from './dom';

export interface Sheet { open(id: string): void; openFigure(id: string): void; close(): void; destroy(): void }

const quote = (t: string, L: Labels): string => (t.includes('«') ? t : L.lang === 'en' && quoteLang(t) === 'en' ? `“${t}”` : `« ${t} »`);

/** Une citation de source : jamais traduite, dans sa langue (attribut `lang`), avec l'indication de langue quand elle diffère de celle de l'écran. */
function quoteBlock(parent: HTMLElement, label: string, text: string, L: Labels): void {
  const lang = quoteLang(text);
  const b = el('blockquote', undefined, quote(text, L));
  b.lang = lang;
  parent.append(el('h4', undefined, label), b);
  const tag = L.quoteTag(lang);
  if (tag) parent.append(el('p', 'at-small', tag));
}

function field(parent: HTMLElement, label: string, text: string | null): void {
  if (!text) return;
  parent.append(el('h4', undefined, label), el('p', undefined, text));
}

function reading(data: AtlasData, l: Loi, L: Labels): HTMLElement {
  const g = el('div', 'at-game');
  const h = el('h4');
  h.append(el('span', 'at-tag extra', L.extrapolated), document.createTextNode(L.readingTitle));
  g.append(h, el('p', 'at-nat', L.readingNote));
  const nom = new Map(data.mondes.map((m) => [m.id, m.nom]));
  let any = false;
  for (const k of l.liens) {
    any = true;
    const d = el('div', 'at-lk');
    const kind = k.sens === 'frein' ? 'frein' : k.force;
    const hh = el('div', 'at-lkh');
    hh.append(symbol(kind, 20), el('span', undefined, `${nom.get(k.monde) ?? ''} : ${L.cellWord[kind]}`));
    d.append(hh);
    field(d, L.mechanism, k.mecanisme);
    field(d, L.limit, k.limite);
    g.append(d);
  }
  if (l.levier) {
    any = true;
    const lv = data.leviers.find((x) => x.id === l.levier?.id);
    const d = el('div', 'at-lk');
    d.append(el('div', 'at-lkh', L.leverHeading(lv?.nom ?? '')), el('p', undefined, L.leverActs(L.sens(l.levier.sens))));
    field(d, L.registryWords, l.levier.mots);
    const only = data.mondes.filter((m) => m.leviers.some((x) => x.id === l.levier?.id) && !l.liens.some((k) => k.monde === m.id));
    if (only.length) {
      d.append(el('h4', undefined, L.sameLeverOnly),
        el('p', undefined, only.map((m) => `${m.nom}${m.leviers.find((x) => x.id === l.levier?.id)?.pole ? L.poleOf(L.pole(m.leviers.find((x) => x.id === l.levier?.id)?.pole ?? '')) : ''}`).join(' ; ')));
    } else if (!l.liens.length) d.append(el('p', undefined, L.noWorldOnLever));
    g.append(d);
  }
  if (l.raison_sans_levier) { any = true; g.append(el('div', 'at-lk', `${L.noLeverPrefix}${l.raison_sans_levier}`)); }
  if (l.sans_lien) { any = true; g.append(el('div', 'at-lk', l.sans_lien)); }
  if (!any) g.append(el('p', undefined, L.noLink));
  return g;
}

export function createSheet(host: HTMLElement, data: AtlasData, L: Labels): Sheet {
  const back = el('div', 'at-sheet-back');
  back.hidden = true;
  const paper = el('div', 'at-sheet');
  paper.setAttribute('role', 'dialog');
  paper.setAttribute('aria-modal', 'true');
  back.append(paper);
  host.append(back);
  let lastFocus: HTMLElement | null = null;
  const byId = new Map(data.lois.map((l) => [l.id, l]));
  const figures = new Map([...data.chiffres, ...data.horsdroit].map((c) => [c.id, c]));

  const close = (): void => {
    if (back.hidden) return;
    back.hidden = true;
    lastFocus?.focus?.();
  };

  const open = (id: string): void => {
    const l = byId.get(id);
    if (!l) return;
    lastFocus = document.activeElement as HTMLElement | null;
    paper.replaceChildren();
    const x = el('button', 'at-sheet-close', '×');
    x.type = 'button';
    x.setAttribute('aria-label', L.sheetClose);
    paper.append(x);
    const top = el('div', 'at-top');
    top.append(el('span', `at-jur j-${l.juridiction}`, l.juridiction));
    if (l.nature) top.append(el('span', 'at-nat', l.nature));
    const st = stamp(l.stade_label, `st-${STADE_KEY[l.stade]}`);
    st.prepend(stadeGlyph(l.stade, 12));
    top.append(st);
    const title = el('h3', undefined, l.titre);
    title.id = 'at-sheet-title';
    paper.setAttribute('aria-labelledby', 'at-sheet-title');
    // Le titre officiel est celui du registre, en français : jamais retraduit, et la langue est dite.
    const frTitle = L.frenchTitle && !l.en?.titre;
    if (frTitle) title.lang = 'fr';
    const note = l.stade_note ? ` (${l.stade_note})` : '';
    const when = /^\d{4}-\d{2}-\d{2}$/.test(l.date_stade) ? formatDate(l.date_stade, L) : l.date_stade;
    const stade = el('p', 'at-nat');
    stade.append(el('span', 'at-tag fact', L.sourced), document.createTextNode(L.sheetStageAt(formatDate(l.as_of, L), l.stade_label, note, when)));
    paper.append(top, title);
    if (frTitle) paper.append(el('p', 'at-small', L.frenchTitle));
    paper.append(stade);
    const dl = el('dl');
    const dd = (k: string, v: string | null): void => { if (v) dl.append(el('dt', undefined, k), el('dd', undefined, v)); };
    dd(L.sheetProcedure, l.procedure);
    dd(L.sheetEntry, l.entree_en_vigueur);
    dd(L.sheetApplication, l.application);
    if (l.censure_partielle !== null) dd(L.sheetPartialCensure, l.censure_partielle ? L.sheetYes : L.sheetNo);
    dd(L.sheetExperiment, l.experimentation);
    if (dl.children.length) paper.append(el('h4', undefined, L.sheetDates), dl);
    quoteBlock(paper, L.sheetQuote, l.citation, L);
    if (l.citation_ajoutee) quoteBlock(paper, L.sheetQuoteAdded, l.citation_ajoutee, L);
    field(paper, L.sheetRegistry, l.phrase);
    field(paper, L.doesNotSay, l.limite);
    if (l.verification) {
      // Comment le texte a été lu : une note de méthode, pas ce que le texte dit ni ne dit. Repli fermé.
      const fold = el('details', 'at-verif');
      fold.append(el('summary', undefined, L.sheetVerification), el('p', undefined, l.verification));
      paper.append(fold);
    }
    const links = el('div', 'at-links');
    links.append(link(L.source, l.url));
    l.urls_secondes.forEach((u, i) => links.append(link(l.urls_secondes.length > 1 ? L.sheetOtherSourceN(i + 1) : L.sheetOtherSource, u)));
    if (l.url_suivi) links.append(link(L.sheetFollow, l.url_suivi));
    paper.append(links, el('p', 'at-small', L.sheetChecked(formatDate(l.as_of, L), L.verdict(l.verdict))), reading(data, l, L));
    back.hidden = false;
    back.scrollTop = 0;
    x.focus();
  };

  /** Fiche d'un chiffre (même papier) : valeur, question exacte, échantillon, auteur et date, phrase permise, limite, lien source. */
  const openFigure = (id: string): void => {
    const c = figures.get(id);
    if (!c) return;
    lastFocus = document.activeElement as HTMLElement | null;
    paper.replaceChildren();
    const x = el('button', 'at-sheet-close', '×');
    x.type = 'button';
    x.setAttribute('aria-label', L.sheetClose);
    const { big, rest } = bigValue(c, L);
    const tags = el('div', 'at-top');
    tags.append(el('span', 'at-tag fact', L.sourced));
    if (c.calcule_par_nous || c.jauge?.calcule_par_nous) tags.append(el('span', 'at-tag calc', L.calcByUs));
    const title = el('h3', undefined, c.titre ?? c.libelle_court ?? rest);
    title.id = 'at-sheet-title';
    paper.setAttribute('aria-labelledby', 'at-sheet-title');
    paper.append(x, tags, el('div', 'at-fbig', valeurAffichee(c, L) ?? jaugeLisible(c, L) ?? big), title);
    const mots = motsAffiches(c);
    if (mots) paper.append(el('p', 'at-nat', mots));
    if (c.titre ?? c.libelle_court) paper.append(el('p', 'at-nat', c.jauge?.unite ?? rest));
    field(paper, L.gaugeNote, c.jauge?.note ?? null);
    if (c.en?.question_tr) { field(paper, L.tileQuestionTr, c.en.question_tr); field(paper, L.tileQuestionOrig, quote(c.question, L)); }
    else { field(paper, L.tileQuestion, quote(c.question, L)); if (L.lang === 'fr') field(paper, L.tileQuestionFr, c.question_fr); }
    field(paper, L.tileWho, [c.population, c.effectif ? L.tileSize(c.effectif) : null].filter(Boolean).join(' · '));
    field(paper, L.tileAuthorDate, `${c.auteur} · ${/^\d{4}-\d{2}(-\d{2})?$/.test(c.date_publication) ? formatDate(c.date_publication, L) : c.date_publication}`);
    field(paper, L.sheetRegistry, c.phrase);
    field(paper, L.doesNotSay, c.limite);
    const links = el('div', 'at-links');
    links.append(link(L.source, c.url));
    paper.append(links, el('p', 'at-small', L.figureCheckedOn(formatDate(c.as_of, L), L.verdict(c.verdict))));
    back.hidden = false;
    back.scrollTop = 0;
    x.focus();
  };

  // Se ferme au toucher : n'importe où, sauf sur un lien (qui s'ouvre) et sur le repli « Comment on l'a vérifié » (qui s'ouvre et se lit).
  const onClick = (e: Event): void => { if (!(e.target as HTMLElement).closest('a, details')) close(); };
  const onKey = (e: KeyboardEvent): void => {
    if (back.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {
      const f = [...paper.querySelectorAll<HTMLElement>('a[href],button,summary')];
      const first = f[0], last = f.at(-1);
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  back.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  return { open, openFigure, close, destroy: () => { document.removeEventListener('keydown', onKey); back.remove(); } };
}
