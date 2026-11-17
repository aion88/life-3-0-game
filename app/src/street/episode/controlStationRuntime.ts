/** Integration groundwork only: the control is a chapter, not a completed w10 world.
 * Public routing deliberately continues to use mountEpisode until the embodied sequel exists.
 */
import type { AppContext } from '../../app/shell';
import type { RunResult } from '../../shared/types';
import type { ControlStationOutcome } from '../../worlds/controlStationEpisode';
import { explorationProgressKey } from '../../worlds/exploration';
import { lifeSheet } from '../../worlds/lifeSheet';

export interface ControlStationCheckpoint {
  version: 1;
  chapter: 'control';
  outcome: ControlStationOutcome;
}

/** Existing short-progress clearing already recognizes this prefix and terminal seed.
 * The additional `control` segment keeps all historical v2 choice lists untouched.
 */
export function controlStationProgressKey(ctx: AppContext, run: RunResult): string {
  assertControlStationRun(run);
  return explorationProgressKey(ctx, `aftermath.episode.1984.v2.control.${run.seed}`);
}

function assertControlStationRun(run: RunResult): void {
  if (run.outcome.kind !== 'arrival' || run.outcome.computedWorld !== 'w10') {
    throw new Error('Le contrôle appartient uniquement au parcours 1984.');
  }
}

/** Only completed, internally consistent chapter outcomes can be resumed.
 * No animation position, unseen lunch, or historical brother-story choice is inferred.
 */
export function restoreControlStationCheckpoint(raw: string | null): ControlStationCheckpoint | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const checkpoint = value as Partial<ControlStationCheckpoint>;
    const outcome = checkpoint.outcome;
    if (checkpoint.version !== 1 || checkpoint.chapter !== 'control' || !outcome
      || !['passed', 'returned'].includes(outcome.route)
      || outcome.guarantorAdded !== (outcome.route === 'passed')
      || outcome.restrictionRemains !== true) return null;
    return { version: 1, chapter: 'control', outcome: { route: outcome.route, guarantorAdded: outcome.guarantorAdded, restrictionRemains: true } };
  } catch { return null; }
}

export function saveControlStationCheckpoint(storage: Pick<Storage, 'setItem'> | null, key: string, outcome: ControlStationOutcome): boolean {
  const serialized = JSON.stringify({ version: 1, chapter: 'control', outcome });
  if (!restoreControlStationCheckpoint(serialized)) return false;
  try { if (!storage) return false; storage.setItem(key, serialized); return true; } catch { return false; }
}

/** Review of the chapter actually played, not a world-completion screen. */
export function controlStationChapterReport(doc: Document, run: RunResult, outcome: ControlStationOutcome, arrivalStep: number): HTMLElement {
  assertControlStationRun(run);
  if (!restoreControlStationCheckpoint(JSON.stringify({ version: 1, chapter: 'control', outcome }))) {
    throw new Error('Résultat du contrôle incohérent.');
  }
  const passed = outcome.route === 'passed';
  return lifeSheet(doc, run, {
    world: '1984 · Le contrôle',
    outcome: passed ? 'Passage franchi · trajet encore en cours' : 'Contrôle quitté · trajet abandonné',
    mission: 'Rejoindre tes parents pour déjeuner. Ce relevé s’arrête au contrôle.',
    arrivalStep,
    moments: [{
      title: passed ? 'Demander une garantie à maman' : 'Repartir sans garantie',
      text: passed ? 'Elle a accepté. Son nom est enregistré pour ce trajet.' : 'Tu as quitté le contrôle sans ajouter de proche au dossier.',
    }],
    consequences: [
      { id: 'control-access', kind: 'access', label: passed ? 'Ce trajet est autorisé' : 'Passage toujours refusé', detail: passed ? 'Tu as franchi la barrière. Le repas n’a pas encore eu lieu dans cette scène.' : 'Tu es reparti vers la rue.' },
      { id: 'control-guarantor', kind: 'relationship', label: passed ? 'Maman est garante' : 'Aucun garant ajouté', detail: passed ? 'Sa garantie est enregistrée pour ce trajet ; aucune autre sanction n’est annoncée.' : 'Aucune demande de garantie familiale n’a été envoyée.' },
      { id: 'control-restriction', kind: 'access', label: 'Restriction toujours présente', detail: 'L’association automatique au rassemblement n’a pas été corrigée.' },
    ],
  });
}
