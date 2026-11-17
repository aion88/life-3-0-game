/**
 * Sauvegarde localStorage [GDD 05 §3.4 ; GDD 01 §3.3 ; GDD 02 §5 ; plan 00 Task 7].
 * Module pur : le stockage est injecté, aucune horloge, aucun hasard, aucun DOM.
 * Ne garde que des entrées de la joueuse (langue, version adoucie, réponses confirmées, actes confirmés, phase) ;
 * tout état dérivé (vecteurs, jauges, trajectoires) se recalcule par rejeu déterministe [lead-programmer].
 */
import { z } from 'zod';
import { isQuestionKey, type ActRecord, type AnswerKey, type DayIndex, type Lang, type QuestionKey } from '../shared/types';

/** Stockage minimal injecté ; `localStorage` en production, une doublure en test [GDD 05 §3.4]. */
export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Clé unique de la sauvegarde [GDD 05 §3.4]. */
export const SAVE_KEY = 'aiaftermath.v2.save';

/** Phase reprise au rechargement [GDD 01 §3.3 ; GDD 02 §5]. */
export type SavePhase = 'new' | 'questionnaire' | 'fastforward' | 'street' | 'bilan';

/** Contenu de la sauvegarde : des entrées seulement [GDD 05 §3.4]. */
export interface SaveData {
  /** Version de format. */
  readonly v: 1;
  /** Incrémenté à chaque écriture ; garde des deux onglets [PHASE V M8]. */
  readonly rev: number;
  /** Empreinte du questionnaire au moment de l'écriture [GDD 03 §8]. */
  readonly contentHash: string;
  readonly lang: Lang | null;
  readonly softened: boolean | null;
  readonly phase: SavePhase;
  readonly answers: Readonly<Partial<Record<QuestionKey, AnswerKey>>>;
  readonly acts: readonly ActRecord[];
}

/** Issue du chargement ou état dégradé du magasin [GDD 05 §3.4 ; PHASE V M7, M8]. */
export type SaveStatus =
  | 'fresh' | 'restored' | 'unavailable'
  | 'discarded-corrupt' | 'discarded-version' | 'discarded-content' | 'stale-tab';

/** Contrôle des actes relus : `isValidAct` et `baseActKeys` viennent du plan 01, `known` est construit par le plan 02b [PHASE V m19]. */
export interface ActValidation {
  readonly isValidAct: (act: ActRecord, known: ReadonlySet<string>) => boolean;
  readonly known: ReadonlySet<string>;
}

/** Magasin de sauvegarde ; ne lève jamais d'erreur technique à l'appelant [GDD 05 §3.4]. */
export interface SaveStore {
  /** Copie en mémoire et statut ; le stockage n'est lu qu'à la création. */
  load(): { readonly data: SaveData; readonly status: SaveStatus };
  /** Fusionne une modification et écrit tout de suite [GDD 01 §3.3]. */
  update(patch: Partial<Omit<SaveData, 'v' | 'rev' | 'contentHash'>>): void;
  /** Ajoute un acte confirmé, écrit avant que le monde réponde [GDD 05 §3.4]. */
  appendAct(act: ActRecord): void;
  /** Repart d'une partie neuve, en gardant la langue si demandé. */
  reset(opts?: { keepLang?: boolean }): void;
  /** Faux après une écriture qui a levé, un stockage absent ou un `rev` stocké plus récent. */
  persistent(): boolean;
}

const PHASES = ['new', 'questionnaire', 'fastforward', 'street', 'bilan'] as const;
const PATCH_KEYS = ['lang', 'softened', 'phase', 'answers', 'acts'] as const;
const ANSWERS: readonly string[] = ['A', 'B', 'C', 'D'];

const ActSchema = z.strictObject({
  day: z.number().int().min(1).max(7),
  minute: z.number().int().min(0),
  kind: z.string(),
  id: z.string(),
  option: z.string().nullable(),
});

/** Forme exigée d'une sauvegarde relue ; un refus rend `discarded-corrupt` [PHASE V M7]. */
const SaveSchema = z.strictObject({
  v: z.literal(1),
  rev: z.number().int().min(0),
  contentHash: z.string(),
  lang: z.enum(['fr', 'en']).nullable(),
  softened: z.boolean().nullable(),
  phase: z.enum(PHASES),
  answers: z.record(z.string(), z.string()),
  acts: z.array(ActSchema),
});

function fresh(contentHash: string, rev: number): SaveData {
  return { v: 1, rev, contentHash, lang: null, softened: null, phase: 'new', answers: {}, acts: [] };
}

/** `rev` lisible d'une valeur brute, ou null si elle n'est pas une sauvegarde lisible. */
function revOf(raw: string | null): number | null {
  if (raw === null) return null;
  try {
    const x: unknown = JSON.parse(raw);
    if (typeof x === 'object' && x !== null && 'rev' in x && typeof x.rev === 'number' && Number.isFinite(x.rev)) return x.rev;
  } catch { /* contenu illisible : pas de rev à protéger */ }
  return null;
}

interface Loaded { readonly data: SaveData; readonly status: SaveStatus }

function readStored(
  raw: string, contentHash: string,
  isValidAnswer: (q: QuestionKey, a: AnswerKey) => boolean, acts: ActValidation | undefined,
): Loaded {
  const storedRev = revOf(raw) ?? 0;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { data: fresh(contentHash, 0), status: 'discarded-corrupt' }; }
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && 'v' in parsed && parsed.v !== 1) {
    return { data: fresh(contentHash, storedRev), status: 'discarded-version' };
  }
  const shape = SaveSchema.safeParse(parsed);
  if (!shape.success) return { data: fresh(contentHash, storedRev), status: 'discarded-corrupt' };
  const s = shape.data;
  if (s.contentHash !== contentHash) {
    return { data: { ...fresh(contentHash, s.rev), lang: s.lang, softened: s.softened }, status: 'discarded-content' };
  }
  const answers: Partial<Record<QuestionKey, AnswerKey>> = {};
  for (const [q, a] of Object.entries(s.answers)) {
    if (isQuestionKey(q) && ANSWERS.includes(a) && isValidAnswer(q, a as AnswerKey)) answers[q] = a as AnswerKey;
  }
  const all = s.acts.map((a): ActRecord => ({ ...a, day: a.day as DayIndex }));
  const kept = acts === undefined ? all : all.filter((a) => acts.isValidAct(a, acts.known));
  return { data: { ...s, answers, acts: kept }, status: 'restored' };
}

/**
 * Crée le magasin. Lit le stockage en entier une fois, puis ne relit que `rev` avant chaque écriture
 * [GDD 05 §3.4 ; PHASE V M8]. Lecture : JSON invalide, version inconnue, forme refusée, hachage différent,
 * puis réponses et actes filtrés [PHASE V M7, m19].
 */
export function createSaveStore(
  storage: StorageLike | null, contentHash: string,
  isValidAnswer: (q: QuestionKey, a: AnswerKey) => boolean, acts?: ActValidation,
): SaveStore {
  let persistent = storage !== null;
  let loaded: Loaded;
  if (storage === null) {
    loaded = { data: fresh(contentHash, 0), status: 'unavailable' };
  } else {
    // Seul l'accès au stockage est gardé : une erreur des validateurs injectés est un bug, elle remonte.
    let raw: string | null = null;
    let readable = true;
    try { raw = storage.getItem(SAVE_KEY); } catch { readable = false; }
    if (!readable) {
      loaded = { data: fresh(contentHash, 0), status: 'unavailable' };
      persistent = false;
    } else {
      loaded = raw === null ? { data: fresh(contentHash, 0), status: 'fresh' } : readStored(raw, contentHash, isValidAnswer, acts);
    }
  }
  let data = loaded.data;
  let status = loaded.status;

  function degrade(to: SaveStatus): void { persistent = false; status = to; }

  /** Écrit `data` avec `rev + 1` si le stockage est sain et si aucun autre onglet n'a écrit. */
  function persist(): void {
    if (storage === null || !persistent) return;
    let current: string | null;
    try { current = storage.getItem(SAVE_KEY); } catch { degrade('unavailable'); return; }
    const stored = revOf(current);
    if (stored !== null && stored > data.rev) { degrade('stale-tab'); return; }
    const written: SaveData = { ...data, rev: data.rev + 1 };
    const json = JSON.stringify(written);
    try { storage.setItem(SAVE_KEY, json); } catch { degrade('unavailable'); return; }
    data = written;
  }

  /** Refuse (sans rien changer) un état que la relecture rejetterait ; sinon l'applique en mémoire puis l'écrit. */
  function commit(next: SaveData): void {
    if (!SaveSchema.safeParse(next).success) return;
    data = next;
    persist();
  }

  return {
    load: () => ({ data, status }),
    update(patch) {
      const next: Record<string, unknown> = { ...data };
      for (const k of PATCH_KEYS) {
        const v = (patch as Record<string, unknown>)[k];
        if (v !== undefined) next[k] = v;
      }
      commit(next as unknown as SaveData);
    },
    appendAct(act) { commit({ ...data, acts: [...data.acts, act] }); },
    reset(opts) { commit({ ...fresh(contentHash, data.rev), lang: opts?.keepLang === true ? data.lang : null }); },
    persistent: () => persistent,
  };
}
