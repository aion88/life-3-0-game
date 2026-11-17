import type { Catalogue } from './catalogue';
import type { EngineConfig } from './engine';
import type { Questionnaire } from './questionnaire';
import type { BuildConfig } from './build';

/** Les données centrales, chargées d'emblée [plan 00 « Données »]. */
export interface CoreData {
  readonly catalogue: Catalogue;
  readonly engine: EngineConfig;
  readonly questionnaire: Questionnaire;
  readonly build: BuildConfig;
  /** = contentHashOf(questionnaireRaw), et seulement lui : corriger une chaîne ou un monde n'efface pas les réponses sauvées. */
  readonly contentHash: string;
}
