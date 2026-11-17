/**
 * Choix à prix, porte de midi, porte du J2, le monde vient [GDD 05 §3.4 ; bible w10 §5.0, §7.3, §8.1 ; R-C3, R-C4, R-C5, D138 ; plan 02b T4].
 * Pur : aucun JSON, aucune horloge. Désigner dit le prix et n'écrit rien ; confirmer écrit UN acte puis ferme le choix, sans retour.
 * Les ids de choix et de jalons sont le vocabulaire du jeu ; leurs jours, heures et options sont des DONNÉES de `street`.
 */
import type { ActRecord, GameClock } from '../../shared/types/street';
import { ledgerRemaining } from '../../shared/ledger';
import { sleepMaxRemaining, type IntegrityConfig } from '../../survival';
import type { ChoiceData, ChoiceOptionData, JalonData } from '../../data/schema/street';
import { lanesOpen } from './checkpoint';
import { JALON_OPTION } from './schedule';
import { buildLedger } from './words';
import type { PriceLine, StreetContext, StreetState } from './types';

/** Porte de midi : en attente à `moments.noonMinute`, au logement, sans checkpoint passé, un jour de Registre ouvert [R-C5 ; bible w10 §5.0]. */
export const DOOR_NOON = 'door.noon';
/** Options de la porte de midi qui forcent la voie `comply` du checkpoint [R-02b.52 (2)]. */
export const DOOR_FORCING: ReadonlySet<string> = new Set(['go', 'refuse']);
/** Préfixe des choix de checkpoint : ils s'écrivent en acte `lane`, jamais en acte `choice`, pour que `laneOutcome` et `buildLedger` les lisent. */
export const CHECKPOINT_PREFIX = 'checkpoint.';
/** Id de l'acte `lane` du checkpoint. */
const CHECKPOINT_LANE = 'checkpoint';
/** Choix de la nuit : le prix de « dormir » n'est pas un choix de `street.choices`, c'est une ligne de prix du moment. */
const SLEEP_CHOICE = 'sleep';
const SLEEP_PRICE_KEY = 'w10.price.sleep.keepWords';

/** Verdict de la sortie du logement : `blockedBy` nomme le choix à confirmer d'abord [D138]. */
export type ExitCheck = { readonly ok: true } | { readonly ok: false; readonly blockedBy: string };

function choiceOf(ctx: StreetContext, choiceId: string): ChoiceData {
  const c = ctx.street.choices.find((x) => x.id === choiceId);
  if (!c) throw new Error(`unknown choice: ${choiceId}`);
  return c;
}

function optionOf(c: ChoiceData, optionId: string): ChoiceOptionData {
  const o = c.options.find((x) => x.id === optionId);
  if (!o) throw new Error(`unknown option: ${c.id}/${optionId}`);
  return o;
}

/** Clé de fermeture d'un choix : un seul passage par jour [GDD 05 §3.4]. */
function closeKey(day: number, id: string): string { return `${day}.${id}`; }

function isClosed(s: StreetState, id: string): boolean { return closeKey(s.day, id) in s.confirmed; }

/** Le checkpoint du jour est passé : un acte `lane checkpoint` existe pour `s.day`. */
function checkpointPassed(s: StreetState): boolean {
  return s.acts.some((a) => a.day === s.day && a.kind === 'lane' && a.id === CHECKPOINT_LANE);
}

/**
 * Désigne une option : dit son prix et ne change rien d'autre que `phase` et `designated`. Désigner une autre option avant de confirmer
 * est libre. Lève si le choix est inconnu, fermé, ouvert un autre jour, ou si l'option est inconnue.
 */
export function designate(s: StreetState, ctx: StreetContext, choiceId: string, optionId: string): { readonly state: StreetState; readonly price: PriceLine } {
  const c = choiceOf(ctx, choiceId);
  const o = optionOf(c, optionId);
  if (!c.days.includes(s.day)) throw new Error(`choice not open on day ${s.day}: ${choiceId} (days ${c.days.join(',')})`);   // [R-02b.64]
  if (isClosed(s, choiceId)) throw new Error(`choice closed: ${choiceId}`);
  const price: PriceLine = { choiceId, optionId, textKey: o.priceLineKey ?? '', isRefusal: o.isRefusal, inventoryParams: {} };
  return { state: { ...s, phase: 'designated', designated: { choiceId, optionId } }, price };
}

/**
 * Confirme l'option désignée : rend UN acte à réduire ; ne ferme rien lui-même [R-02b.65]. Sans désignation, ne fait rien (`act: null`, état rendu tel quel).
 * Un choix de checkpoint s'écrit `lane` / `checkpoint` / option ; tout autre s'écrit `choice` / id du choix / option.
 */
export function confirm(s: StreetState, ctx: StreetContext, at: GameClock): { readonly state: StreetState; readonly act: ActRecord | null } {
  const d = s.designated;
  if (d === null) return { state: s, act: null };
  choiceOf(ctx, d.choiceId);
  const act: ActRecord = d.choiceId.startsWith(CHECKPOINT_PREFIX)
    ? { day: at.day, minute: at.minute, kind: 'lane', id: CHECKPOINT_LANE, option: d.optionId }
    : { day: at.day, minute: at.minute, kind: 'choice', id: d.choiceId, option: d.optionId };
  // Seul `reduceAct` change l'état : ni `acts` ni `confirmed` ici [R-02b.65].
  const state: StreetState = { ...s, phase: 'confirmed', designated: null };
  return { state, act };
}

/** Ce que la règle d'un jalon dû lit : le jour, la minute, le lieu, et l'option confirmée d'un choix du jour (`undefined` si aucune). */
export interface JalonAt {
  readonly day: number; readonly minute: number; readonly location: StreetState['location'];
  readonly picked: (choiceId: string) => string | undefined;
}

/**
 * Le jalon serait dû à `at`, fermeture mise à part : le jour, l'heure (ou l'attente) et la condition sur un choix sont réunis. SEULE règle
 * du jalon dû : lue par `pendingChoices` et par la preuve (`walkDay`, `validate/guided.ts`), qui n'y passe que ce qu'un chemin porte [N7].
 */
export function jalonDue(j: JalonData, at: JalonAt): boolean {
  if (j.day !== at.day) return false;
  if (j.atMinute !== null && at.minute < j.atMinute) return false;
  if (j.waitsFor === 'exitBuilding' && at.location === 'home') return false;     // attend la sortie de l'immeuble
  if (j.waitsFor === 'door' && at.location !== 'home') return false;             // attend à la porte
  if (j.requires !== null) {
    const picked = at.picked(j.requires.choiceId);
    if (picked === undefined || !j.requires.options.includes(picked)) return false;
  }
  return true;
}

/** Le jalon est dû et n'est pas encore fermé. */
function jalonPending(s: StreetState, j: JalonData): boolean {
  if (isClosed(s, j.id)) return false;
  return jalonDue(j, { day: s.day, minute: s.clock.minute, location: s.location, picked: (id) => s.confirmed[closeKey(s.day, id)] });
}

/**
 * Ce qui attend la joueuse : la porte de midi [R-C5], les choix qui retiennent à la porte du logement tant qu'ils ne sont pas confirmés
 * [D138] et les jalons du monde dus [R-C4]. Ordre : choix de `street.choices`, puis jalons de `street.jalons`.
 */
export function pendingChoices(s: StreetState, ctx: StreetContext): readonly string[] {
  const out: string[] = [];
  const { noonMinute } = ctx.street.moments;
  for (const c of ctx.street.choices) {
    if (isClosed(s, c.id)) continue;
    if (c.id === DOOR_NOON) {
      if (s.location === 'home' && s.clock.minute >= noonMinute && !ctx.street.registre.closedDays.includes(s.day) && !checkpointPassed(s)) out.push(c.id);
    } else if (c.blocksExit && c.days.includes(s.day) && s.location === 'home') {
      out.push(c.id);
    }
  }
  for (const j of ctx.street.jalons) if (jalonPending(s, j)) out.push(j.id);
  return out;
}

/** Peut-on sortir du logement ? Non tant qu'un choix qui retient (`blocksExit`) du jour n'est pas confirmé : aucun défaut silencieux [D138]. */
export function canExit(s: StreetState, ctx: StreetContext): ExitCheck {
  if (s.location !== 'home') return { ok: true };
  const blocking = ctx.street.choices.find((c) => c.blocksExit && c.days.includes(s.day) && !isClosed(s, c.id));
  return blocking ? { ok: false, blockedBy: blocking.id } : { ok: true };
}

/**
 * Ligne de prix de « dormir » : non nulle seulement s'il reste PLUS de `maxRemaining` mots contre la base du jour [bible w10 §7.2, §7.3].
 * Le restant est celui du relevé (`buildLedger`), jamais un second compteur. Après `lastNight`, le dossier est clos (`closeNight` ne lit
 * plus aucun mot) : la ligne serait fausse, elle est nulle [revue N6 M-3].
 */
export function sleepPriceLine(s: StreetState, ctx: StreetContext): PriceLine | null {
  const cfg = ctx.world.survival as unknown as IntegrityConfig;
  if (s.day > cfg.lastNight) return null;
  const remaining = ledgerRemaining(buildLedger(s.day, s.acts, ctx));
  if (remaining <= sleepMaxRemaining(cfg, s.day)) return null;
  return { choiceId: SLEEP_CHOICE, optionId: SLEEP_CHOICE, textKey: SLEEP_PRICE_KEY, isRefusal: false, inventoryParams: {} };
}

/**
 * Options d'un choix que `reduceAct` accepterait maintenant. Checkpoint du jour : voies filtrées par `lanesOpen`, bons suffisants, composant
 * sur soi (la porte de midi « go » ou « refuse » force `comply`, donc rien n'est filtré) ; vide hors de la rue ou voie déjà passée.
 * Jalon : `go` s'il est dû. Autre choix : toutes ses options s'il est ouvert, vide sinon ou si inconnu.
 */
export function availableOptions(s: StreetState, ctx: StreetContext, choiceId: string): readonly string[] {
  const c = ctx.street.choices.find((x) => x.id === choiceId);
  if (c === undefined) return ctx.street.jalons.some((j) => j.id === choiceId) && pendingChoices(s, ctx).includes(choiceId) ? [JALON_OPTION] : [];
  if (isClosed(s, choiceId)) return [];
  if (choiceId.startsWith(CHECKPOINT_PREFIX)) {
    if (choiceId !== `${CHECKPOINT_PREFIX}j${s.day}` || !c.days.includes(s.day) || s.location !== 'street' || checkpointPassed(s)) return [];
    if (DOOR_FORCING.has(s.confirmed[closeKey(s.day, DOOR_NOON)] ?? '')) return c.options.map((o) => o.id);
    const open = lanesOpen(s, ctx);
    const price = ctx.street.checkpoint.bonsPrice[s.flags.gateClosed === true ? 'closedGate' : 'normal'];
    return c.options.map((o) => o.id).filter((id) => {
      if (id === 'courtesy') return open.includes('courtesy');
      if (id === 'buy:component') return s.kit['component'] === 'kept';
      if (id === 'buy:bons') return s.bons >= price;
      return true;
    });
  }
  const gated = choiceId === DOOR_NOON;
  const isOpen = gated ? pendingChoices(s, ctx).includes(choiceId) : c.days.includes(s.day);
  return isOpen ? c.options.map((o) => o.id) : [];
}
