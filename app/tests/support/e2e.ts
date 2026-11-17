/**
 * Aides des parcours Playwright du plan 03 [T15, R-03.25 c] : un écrivain. Seuls les tests e2e l'importent.
 * Sauvegarde amorcée, réponses d'une ligne en ordre d'AFFICHAGE, lecture de la sauvegarde, horloge accélérée.
 */
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { canonicalJson } from '../../src/shared/canonical';
import { fnv1a32 } from '../../src/shared/rng';
import { SEL_ORDER } from '../../src/questionnaire/grid';

export const SAVE_KEY = 'aiaftermath.v2.save';

const questionnaireRaw: unknown = JSON.parse(readFileSync('src/data/questionnaire.json', 'utf8'));
const questions = (questionnaireRaw as { questions: { key: string; order: number }[] }).questions;
export const CONTENT_HASH = fnv1a32(canonicalJson(questionnaireRaw)).toString(16).padStart(8, '0');

/** Lignes du plan 01 (w10 non redirigé, redirigée vers w10, extinction w07). */
export const LINES = { w10: 'ACBACBACAAD', redirected: 'AAAAAAAAAAA', w07: 'CBCCBDBACCD' } as const;

/** Réponses d'une ligne en ordre SEL (une lettre par question, `SEL_ORDER`), par clé de question. Importer `answers.ts` tirerait les JSON de `src` hors de Vite. */
export function answersOfLine(line: string): Record<string, string> {
  if (line.length !== SEL_ORDER.length) throw new Error(`ligne de ${line.length} lettres, ${SEL_ORDER.length} attendues`);
  return Object.fromEntries(SEL_ORDER.map((k, i) => [k, line[i]!]));
}

/** Les onze réponses d'une ligne en ordre d'AFFICHAGE : la ligne est en ordre SEL, l'écran suit `order` [R-03.25 c]. */
export function displayLetters(line: string): string[] {
  const byKey = answersOfLine(line);
  return [...questions].sort((a, b) => a.order - b.order).map((q) => byKey[q.key]!);
}

export interface SeedActs { readonly day: number; readonly minute: number; readonly kind: string; readonly id: string; readonly option: string | null }
export interface SeedOpts { readonly lang?: 'fr' | 'en'; readonly phase?: 'new' | 'questionnaire' | 'fastforward' | 'street' | 'bilan'; readonly line?: string; readonly acts?: readonly SeedActs[] }

/** Sauvegarde valide du format v1 ; sans `line`, aucune réponse. */
export function seedJson(o: SeedOpts = {}): string {
  return JSON.stringify({
    v: 1, rev: 3, contentHash: CONTENT_HASH, lang: o.lang ?? 'en', softened: null, phase: o.phase ?? 'new',
    answers: o.line === undefined ? {} : answersOfLine(o.line), acts: o.acts ?? [],
  });
}

/** Pose la sauvegarde avant le premier script de la page, sans écraser ce qu'une page rechargée a déjà écrit. */
export async function seedSave(page: Page, json: string): Promise<void> {
  await page.addInitScript(([k, v]) => { if (localStorage.getItem(k!) === null) localStorage.setItem(k!, v!); }, [SAVE_KEY, json]);
}

export const readSave = async (page: Page): Promise<Record<string, unknown> | null> => {
  const raw = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  return raw === null ? null : JSON.parse(raw) as Record<string, unknown>;
};

/** Horloge de la page accélérée : le temps de l'écran ne suit que les images, donc l'horloge de Playwright le conduit [R-03.9]. */
export async function installClock(page: Page): Promise<void> { await page.clock.install(); }
export async function advance(page: Page, ms: number): Promise<void> { await page.clock.runFor(ms); }

/**
 * Une sauvegarde en cours ouvre « Continuer » et « Nouvelle partie » au premier écran [demande Cynthia 2026-11-03] : à appeler après
 * `data-ready`, clique « Continuer » s'il est là (l'écran de reprise est monté avant `data-ready`) puis attend l'écran repris ; ne fait rien sinon.
 */
export async function continueIfAsked(page: Page): Promise<void> {
  const go = page.locator('[data-ui="resume-continue"]');
  if (await go.count() === 0) return;
  await go.click();                                              // le clic retire `data-ready`, l'écran repris le repose une fois monté
  await page.waitForSelector('html[data-ready="1"]');
}
