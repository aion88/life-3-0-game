/**
 * Fiche de vie, habillage C [plan UI-C T10 ; spec C §3.4 ; rulings GD 1, 2, 3g, 3h, 3i]. Voix sobre : aucune rotation, aucun jus, aucun événement d'interface.
 * Aucun texte ici, que des clés `i18n`. Aucune couleur : les classes de `bilan.css` lisent les jetons posés par `applyTheme`.
 * Jours et cartes du kit ont un balisage qui ne dépend ni du contenu du jour ni de l'état de l'objet : la couleur ne juge rien [GD 1, GD 3g].
 */
import type { ArrivalWorldId, WorldId } from '../../shared/types/world';
import type { BilanSheet, DayLine, KitRow } from '../../shared/types/bilan';
import type { I18n } from '../../i18n/i18n';
import { createEye, createPill } from '../../ui/components/c';
import './bilan.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
/** Espace insécable avant « : ; ? ! » : le signe ne passe jamais seul à la ligne. Au rendu seulement, la chaîne de la langue ne change pas. */
export const frenchSpaces = (text: string): string => text.replace(/[ \t]+([:;?!])/g, '\u00A0$1');
/** Texte d'une clé, prêt à l'affichage. */
const tx = (i18n: I18n, key: string, params?: Record<string, string | number>): string => frenchSpaces(i18n.t(key, params));
const tid = <T extends HTMLElement>(e: T, id: string): T => { e.dataset['testid'] = id; return e; };

/** Monde calculé (toujours nommé) et monde vécu (seulement s'il en diffère) [P-2 tranché, GDD 06 l. 124]. */
export function worldNames(sheet: BilanSheet): { readonly computed: WorldId; readonly lived: ArrivalWorldId | null } {
  return { computed: sheet.computedWorld, lived: sheet.livedWorld !== sheet.computedWorld ? sheet.livedWorld : null };
}

/**
 * Teintes de calendrier [ruling GD 1, variante « sept teintes de calendrier fixes » ; option A de Cynthia, 2026-11-08] : la teinte d'une pastille
 * dépend de la place du jour dans la semaine, celle d'une carte du kit de sa place dans le kit, jamais de ce qui s'y est passé ni de l'état de l'objet.
 * Deux parties aux choix opposés ont donc la même rangée au pixel près. Ordre repris de la maquette `c/bilan.png`.
 */
export const DAY_TONES = ['menthe', 'soleil', 'rose', 'ciel'] as const;
export const KIT_TONES = ['ciel', 'soleil', 'rose', 'menthe'] as const;
export const dayTone = (day: number): (typeof DAY_TONES)[number] => DAY_TONES[(Math.max(1, day) - 1) % DAY_TONES.length]!;
export const kitTone = (slot: number): (typeof KIT_TONES)[number] => KIT_TONES[slot % KIT_TONES.length]!;

/** Une pastille ronde par jour vécu, à la teinte de calendrier du jour ; la date puis la ligne du jour sous la pastille. */
export function createDaysRow(days: readonly DayLine[], i18n: I18n): HTMLElement {
  const row = tid(el('ul', 'c-days'), 'bilan-days-row');
  for (const d of days) {
    const li = el('li', 'c-day');
    li.dataset['day'] = 'true';
    const pill = el('span', 'c-day-pill');
    pill.dataset['dayPill'] = 'true';
    pill.dataset['tone'] = dayTone(d.day);
    pill.setAttribute('aria-hidden', 'true');
    pill.append(el('span', 'c-day-pill__core'));
    const date = el('span', 'c-day-date', tx(i18n, d.dateKey));
    date.dataset['dayDate'] = 'true';
    const line = el('span', 'c-day-line', tx(i18n, d.textKey));
    line.dataset['dayLine'] = 'true';
    li.append(pill, date, line);
    row.append(li);
  }
  return row;
}

/** Les cartes du kit : toutes blanches, l'icône à la teinte de sa place, l'état dans une pastille lavande la même pour tous ; la carte grandit, le texte ne rétrécit jamais [P-15]. */
export function createKitCards(rows: readonly KitRow[], i18n: I18n): HTMLElement {
  const list = tid(el('ul', 'c-kit'), 'bilan-kit-row');
  rows.forEach((r, slot) => {
    const li = el('li', 'c-kit-card');
    li.dataset['kitCard'] = 'true';
    const icon = el('span', 'c-kit-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.dataset['tone'] = kitTone(slot);
    const state = createPill(tx(i18n, r.stateKey), 'lavande');
    state.classList.add('c-kit-state');
    state.dataset['kitState'] = 'true';
    li.append(icon, el('span', 'c-kit-label', tx(i18n, r.labelKey)), state);
    list.append(li);
  });
  return list;
}

/** Colonne de gauche : monde atteint (carte ciel), fin (carte encre), message du dernier relevé dans le bloc w10 ; colonne de droite : jours et kit. */
export function createSheetBlocks(s: BilanSheet, i18n: I18n): HTMLElement[] {
  const names = worldNames(s);
  const world = tid(el('section', 'c-card c-world c-sober'), 'bilan-world');
  world.append(el('p', 'c-world-eyebrow', tx(i18n, 'bilan.sheet.world')));
  const worldName = tx(i18n, `world.${names.computed}.name`);
  const nameEl = tid(el('p', 'c-world-name', worldName), 'bilan-world-name');
  // Le nom est affiché en entier à 150 px quand il tient ; sinon la taille suit le plus long mot (nombre de lettres, lu par la feuille) [spec §2 : jamais de coupe en plein mot].
  nameEl.style.setProperty('--word-chars', String(Math.max(1, ...worldName.split(' ').map((w) => w.length))));
  world.append(nameEl);
  world.append(tid(el('p', 'c-world-clear', tx(i18n, `world.${names.computed}.clear`)), 'bilan-world-clear'));
  if (names.lived !== null) {
    world.append(tid(el('p', 'c-world-redirect', tx(i18n, 'redirect.bilan', { lived: tx(i18n, `world.${names.lived}.name`), computed: tx(i18n, `world.${names.computed}.name`) })), 'bilan-world-redirect'));
  }
  const left = el('div', 'c-bilan-left');
  left.append(world);
  if (s.fate.length > 0) {
    const fate = tid(el('section', 'c-card c-card--ink c-fate c-sober'), 'bilan-fate');
    fate.append(el('h3', 'c-fate-eyebrow', tx(i18n, 'bilan.sheet.fate')));
    const ul = tid(el('ul', 'c-fate-lines'), 'sheet-fate');
    for (const f of s.fate) ul.append(el('li', 'c-fate-line', tx(i18n, f.textKey)));
    fate.append(ul);
    left.append(fate);
  }
  if (s.lastMessage !== null) {
    const block = tid(el('section', 'c-w10-block'), 'bilan-w10-block');
    const msg = tid(el('p', 'c-message'), 'bilan-message');
    msg.append(createEye({ pupil: true, sizePx: 24 }).el, tx(i18n, `w10.msg.${s.lastMessage}`));
    block.append(msg);
    left.append(block);
  }
  const right = el('div', 'c-bilan-right c-sober');
  if (s.days.length > 0) right.append(el('h3', 'c-sec c-sec--days', tx(i18n, 'bilan.sheet.days')), createDaysRow(s.days, i18n));   // aucun jour vécu : ni titre ni emplacement vide
  right.append(el('h3', 'c-sec c-sec--kit', tx(i18n, 'bilan.sheet.kit')), createKitCards(s.kit, i18n));
  return [left, right];
}
