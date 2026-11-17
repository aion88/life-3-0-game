/**
 * Issue de l'audition, rue guidée [plan J3-J7 §5.1, T6] : la ligne du régime, la ligne du narrateur (selon les noms donnés, absente si nulle ; `{noms}` : R2, N7),
 * un seul bouton `street.ui.outcome.continue` qui mène au relevé du dernier jour. Aucun texte en dur : tout passe par `i18n.t`.
 */
import type { I18n } from '../../i18n/i18n';
import { make, onLang, type Part } from './dom';
import { namesOf } from './recap';

/** Ce que l'issue montre : le temps `outcome` du metteur en scène (mêmes champs). `nameKeys` : les noms donnés (R2), lus par `{noms}`. */
export interface OutcomeView { readonly endId: string; readonly regimeKey: string; readonly narratorKey: string | null; readonly nameKeys: readonly string[] }

/** La ligne du narrateur, `{noms}` rempli comme au relevé (`namesOf`, R2) ; `null` sans ligne [N7, spec D86]. */
export function narrationOf(i18n: I18n, v: OutcomeView): string | null {
  return v.narratorKey === null ? null : i18n.t(v.narratorKey, { noms: namesOf(i18n, v.nameKeys) });
}

export interface OutcomeHandle extends Part {
  /** Montre l'issue ; `null` la retire. Le bouton prend le focus à l'ouverture. */
  showOutcome(v: OutcomeView | null): void;
  /** Le bouton de l'issue a été activé ; rend le désabonnement. */
  onContinue(cb: () => void): () => void;
}

/** Nom accessible du dialogue : la ligne du régime (déjà traduite par `i18n`, aucune clé nouvelle, parité FR/EN inchangée). */
const OUTCOME_REGIME_ID = 'outcome-regime';

/** Monte l'issue sous `parent` (le centre de l'écran) ; rien n'est affiché avant `showOutcome`. */
export function mountOutcome(parent: HTMLElement, i18n: I18n): OutcomeHandle {
  const doc = parent.ownerDocument;
  const subs = new Set<() => void>();
  let view: OutcomeView | null = null;
  let box: HTMLElement | null = null;
  const render = (focus: boolean): void => {
    box?.remove(); box = null;
    if (view === null) return;
    box = make(doc, 'section', { 'data-ui': 'outcome', 'data-end': view.endId, role: 'dialog', 'aria-labelledby': OUTCOME_REGIME_ID, class: 'c-outcome' });
    box.appendChild(make(doc, 'p', { 'data-ui': 'outcome-regime', id: OUTCOME_REGIME_ID, class: 'c-outcome-regime' }, i18n.t(view.regimeKey)));
    const line = narrationOf(i18n, view);
    if (line !== null) box.appendChild(make(doc, 'p', { 'data-ui': 'outcome-narration', class: 'c-outcome-narration' }, line));
    const go = box.appendChild(make(doc, 'button', { type: 'button', 'data-ui': 'outcome-continue', class: 'c-outcome-continue' }, i18n.t('street.ui.outcome.continue')));
    go.addEventListener('click', () => { for (const cb of [...subs]) cb(); });
    parent.appendChild(box);
    if (focus) go.focus();
  };
  const off = onLang(i18n, () => { render(false); });
  return {
    showOutcome(v) { view = v; render(true); },
    onContinue(cb) { subs.add(cb); return () => { subs.delete(cb); }; },
    dispose() { off(); subs.clear(); box?.remove(); box = null; view = null; },
  };
}
