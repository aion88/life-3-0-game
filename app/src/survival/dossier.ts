/**
 * Barre « Dossier » [GDD 2026-11-03 §2 option A, décision Cynthia, playtest 2026-11-03] : l'Intégrité de la bible w10 §7, sans un chiffre
 * changé, vue depuis la rue. Pure : aucun DOM, aucune horloge, aucun hasard.
 * La partie pleine est la valeur CONSOLIDÉE (`state.value`, posée par la nuit, D89). La partie « en attente » est ce que la nuit
 * calculerait si le jour finissait maintenant : le MÊME appel `closeNight` sur le relevé du jour, jamais une seconde formule.
 * Au coucher, `closeNight` rend exactement `pending` : la consolidation ne fait que rattraper l'affichage.
 */
import type { IntegrityConfig } from '../data/schema/world';
import type { Milli } from '../shared/milli';
import type { NightLedger, SurvivalState } from '../shared/types/street';
import { closeNight, palierOf, type Palier } from './integrity';

/** Un segment fantôme, en fractions de la barre (0 à 1) : `from` est le bord côté valeur consolidée, `to` l'autre. */
export interface DossierSegment { readonly source: string; readonly from: number; readonly to: number }

export interface DossierView {
  /** Valeur consolidée par la dernière nuit (millièmes). */
  readonly value: Milli;
  /** Valeur que la nuit du jour donnera si rien ne change (millièmes) : `closeNight(...).reading.value`. */
  readonly pending: Milli;
  readonly palier: Palier;
  readonly pendingPalier: Palier;
  /** Fractions de la barre (0 à 1). */
  readonly fill: number;
  readonly pendingFill: number;
  /** Trait « audition » : le seuil d'arrestation du J7, en fraction [bible w10 §7.5]. */
  readonly auditionAt: number;
  /** Seuils de palier, en fractions, du plus haut au plus bas [bible w10 §7.1]. */
  readonly paliers: readonly { readonly id: Palier; readonly at: number }[];
  /** Un segment par geste ou terme du relevé qui va dans le sens de l'écart ; vide quand rien n'est en attente. */
  readonly segments: readonly DossierSegment[];
}

/** Ce que chaque ligne du relevé verse, une source par geste : les termes de la nuit, puis chaque entrée dans l'ordre du relevé. */
function contributions(terms: Readonly<Record<string, Milli>>, ledger: NightLedger): { source: string; delta: number }[] {
  const fixed = Object.entries(terms).filter(([k]) => k !== 'entries').map(([source, delta]) => ({ source, delta: delta as number }));
  const entries = ledger.entries.map((e) => ({ source: e.source, delta: e.delta as number }));
  return [...fixed, ...entries].filter((c) => c.delta !== 0);
}

/**
 * Segments fantômes : l'écart `pending - value` est partagé entre les sources qui vont dans son sens, au prorata de leur poids, en partant
 * de la valeur consolidée. Les sources de sens contraire sont absorbées par l'écart net (elles n'ont rien à montrer en attente).
 */
function segmentsOf(value: number, pending: number, cap: number, parts: readonly { source: string; delta: number }[]): DossierSegment[] {
  const net = pending - value;
  if (net === 0) return [];
  const sign = Math.sign(net);
  const same = parts.filter((p) => Math.sign(p.delta) === sign);
  const total = same.reduce((a, p) => a + Math.abs(p.delta), 0);
  if (total === 0) return [];
  const out: DossierSegment[] = [];
  let at = value;
  same.forEach((p, i) => {
    const next = i === same.length - 1 ? pending : at + (sign * Math.abs(net) * Math.abs(p.delta)) / total;
    out.push({ source: p.source, from: at / cap, to: next / cap });
    at = next;
  });
  return out;
}

/** La vue de la barre pour l'état de survie et le relevé du jour courant (celui que `onSleep` fermera). */
export function dossierView(state: SurvivalState, ledger: NightLedger, cfg: IntegrityConfig): DossierView {
  const { reading } = closeNight(state, ledger, cfg);
  const cap = cfg.cap as number;
  const value = state.value, pending = reading.value;
  return {
    value, pending,
    palier: palierOf(value, cfg), pendingPalier: reading.palier,
    fill: value / cap, pendingFill: pending / cap,
    auditionAt: (cfg.arrest.auditionBelow as number) / cap,
    paliers: cfg.paliers.map((p) => ({ id: p.id, at: (p.from as number) / cap })),
    segments: segmentsOf(value, pending, cap, contributions(reading.terms, ledger)),
  };
}
