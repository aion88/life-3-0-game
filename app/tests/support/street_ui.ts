/** Aides des tests de l'interface de la rue : locale d'essai et lecture du DOM visible [plan 02a T11]. */
import { createI18n } from '../../src/i18n/i18n';
import type { I18n, StringTable } from '../../src/i18n/i18n';
import frJson from '../../src/data/strings/fr.json';
import enJson from '../../src/data/strings/en.json';
import { loadMeta } from './street';

export const FR = frJson as StringTable;
export const EN = enJson as StringTable;

/** Entoure une chaîne des marqueurs de la locale d'essai : une chaîne en dur ressort sans eux. */
export const pseudo = (s: string): string => `[!!${s}!!]`;

/** Locale d'essai : chaque texte de la langue demandée est entouré de `[!!` et `!!]` ; mode dev, toute anomalie lève. */
export function pseudoI18n(lang: 'fr' | 'en' = 'fr'): I18n {
  const wrap = (t: StringTable): StringTable => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, pseudo(v)]));
  return createI18n({ fr: wrap(FR), en: wrap(EN) }, loadMeta(), lang, { mode: 'dev', report: () => undefined });
}

/** Vraie langue, sans marqueurs. */
export function realI18n(lang: 'fr' | 'en'): I18n {
  return createI18n({ fr: FR, en: EN }, loadMeta(), lang, { mode: 'dev', report: () => undefined });
}

const hidden = (e: Element): boolean => e.closest('[hidden]') !== null;

/** Éléments visibles (hors sous-arbre `hidden`) sous `root`, `root` exclu. */
export function visibleElements(root: Element): Element[] {
  return [...root.querySelectorAll('*')].filter((e) => !hidden(e));
}

// Les moitiés de la ligne de droit sont enveloppées par le test lui-même (`pseudo`) : ce balayage ne prouve donc pas que l'appelant traduit.
/** Chaque nœud texte non vide des éléments visibles de `root`, hors éléments qui satisfont `exclude`. */
export function visibleTexts(root: Element, exclude = ''): string[] {
  const out: string[] = [];
  const walk = (n: Node): void => {
    if (n.nodeType === 3) { const t = (n.textContent ?? '').trim(); if (t !== '') out.push(t); return; }
    if (n.nodeType !== 1) return;
    const e = n as Element;
    if (e.hasAttribute('hidden')) return;
    if (exclude !== '' && e.matches(exclude)) return;
    e.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out;
}
