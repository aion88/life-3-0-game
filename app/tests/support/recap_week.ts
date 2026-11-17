/** Aides des tests du relevé de la semaine [plan rue guidée J3-J7, T5] : le monde de `recap-week.json`, des états du soir, une langue d'essai qui porte ses clés. */
import recapWeekJson from '../fixtures/guided/recap-week.json';
import { parseGuided } from '../../src/data/schema/guided';
import { createI18n } from '../../src/i18n/i18n';
import type { I18n } from '../../src/i18n/i18n';
import type { ActRecord, DayIndex, RightId } from '../../src/shared/types/street';
import type { StreetContext, StreetState } from '../../src/engine/moments/types';
import { act, ctxW10, loadMeta, withStreet } from './street';
import { sceneAct, stateAt, w10Street } from './guided';
import { EN, FR } from './street_ui';

export const ctxRecapWeek: StreetContext = ctxW10(withStreet((d) => { (d as { guided: unknown }).guided = parseGuided(structuredClone(recapWeekJson), w10Street); }));

/** L'état du soir du jour `day` : les actes `acts` posés, `rights` = droits dits (`${jour}.${moment}`). */
export function stateWith(day: DayIndex, acts: readonly ActRecord[], rights: Readonly<Record<string, RightId>> = {}): StreetState {
  return { ...stateAt(day, 1200), acts, rightLines: rights };
}

export const ACTS_THREE_NAMES: readonly ActRecord[] = [sceneAct(1, 480, 'j1.a', 'theodore'), act(3, 600, 'choice', 'm2.nadia', 'buy'), sceneAct(4, 600, 'j4.a', 'marlene')];
export const ACTS_DECLARE_ONLY: readonly ActRecord[] = [sceneAct(4, 600, 'j4.a', 'declare')];
export const ACTS_NONE: readonly ActRecord[] = [];
export const ACTS_AUDITION: readonly ActRecord[] = [act(7, 1060, 'choice', 'audition.j7', 'none')];

export const FIXTURE_ENDING = (ctxRecapWeek.street.guided!.ending)!;

/** Toute clé `w10.dw.*` de la fixture : un texte d'essai, pour que le rendu des encarts (chaînes, faits) ne lève pas. */
function fixtureKeys(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof v === 'string') { if (v.startsWith('w10.dw.')) out.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => fixtureKeys(x, out));
  else if (v !== null && typeof v === 'object') Object.values(v).forEach((x) => fixtureKeys(x, out));
  return out;
}
const QUESTIONS = (recapWeekJson.chains as readonly { question: { key: string } }[]).map((c) => `q.${c.question.key}.title`);
const FILLER = (tag: string): Record<string, string> => Object.fromEntries([...fixtureKeys(recapWeekJson), ...QUESTIONS].map((k) => [k, `${tag} ${k}`]));
const EXTRA_FR: Record<string, string> = {
  ...FILLER('fr'),
  'w10.dw.name.theodore': 'Théodore', 'w10.dw.name.fille': 'la fille du quatrième', 'w10.dw.name.marlene': 'Marlène', 'w10.dw.name.blank': 'une ligne vide',
  'w10.dw.recap.M4.absent': 'Aujourd’hui, tu n’as nommé personne de plus : {noms}.', 'w10.dw.recap.M4.marlene': 'Tu as nommé Marlène. Le relevé garde : {noms}.',
  'w10.dw.recap.M4.declare': 'Tu as déclaré. Le relevé garde : {noms}.', 'w10.dw.recap.M4.silent': 'Tu t’es tue. Le relevé garde : {noms}.',
  'w10.dw.end.week': 'Voir ta semaine',
};
const EXTRA_EN: Record<string, string> = {
  ...FILLER('en'),
  'w10.dw.name.theodore': 'Theodore', 'w10.dw.name.fille': 'the girl from the fourth floor', 'w10.dw.name.marlene': 'Marlene', 'w10.dw.name.blank': 'a blank line',
  'w10.dw.recap.M4.absent': 'Today you named no one more: {noms}.', 'w10.dw.recap.M4.marlene': 'You named Marlene. The record keeps: {noms}.',
  'w10.dw.recap.M4.declare': 'You declared. The record keeps: {noms}.', 'w10.dw.recap.M4.silent': 'You kept quiet. The record keeps: {noms}.',
  'w10.dw.end.week': 'See your week',
};
/** Vraie langue plus les clés de la fixture (aucune n'est dans les chaînes du jeu). */
export const FR_WEEK = { ...FR, ...EXTRA_FR };
export function weekI18n(lang: 'fr' | 'en'): I18n {
  return createI18n({ fr: FR_WEEK, en: { ...EN, ...EXTRA_EN } }, loadMeta(), lang, { mode: 'dev', report: () => undefined });
}
