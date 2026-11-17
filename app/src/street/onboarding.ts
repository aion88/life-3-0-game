/**
 * Accueil du J1 et ligne d'objectif du jour [design/gdd/2026-11-03-playtest-enjeu-onboarding.md §1 A, §3 A ; bible w10 §6, §8.1, §8.2].
 * Données : `data/w10.onboarding.json` (aucun texte ici, des clés). Pur : ni DOM, ni horloge, ni hasard.
 * Le chargeur vérifie la donnée contre le bloc `street` du monde : un rendez-vous est une micro-situation ouverte ce jour-là,
 * un objet allumé est un objet présenté, une première apparition vise un choix qui existe.
 */
import { z } from 'zod';
import type { StreetData } from '../data/schema/street';
import type { DayIndex } from '../shared/types/street';
import { WEEK_STEPS } from '../engine/week';

/** Qui parle : le Service de courtoisie (vouvoiement) ou le narrateur (deuxième personne). */
export type WelcomeVoice = 'regime' | 'narrator';
/** Une ligne d'accueil : sa clé, sa voix, l'objet qui s'allume pendant qu'elle passe (`null` : aucun). */
export interface WelcomeLine { readonly key: string; readonly voice: WelcomeVoice; readonly lit: string | null }
export interface FirstSight extends WelcomeLine { readonly choiceId: string }
export interface Objective { readonly day: DayIndex; readonly rendezVous: string | null; readonly source: string }
export interface Onboarding {
  readonly welcome: { readonly day: DayIndex; readonly kit: readonly string[]; readonly lines: readonly WelcomeLine[] };
  readonly firstSight: readonly FirstSight[];
  readonly objectives: readonly Objective[];
}

const key = z.string().regex(/^[A-Za-z0-9]+(\.[A-Za-z0-9_-]+)+$/);
const day = z.number().int().min(1).max(WEEK_STEPS);
const line = { key, voice: z.enum(['regime', 'narrator']), lit: z.string().min(1).nullable() };
const schema = z.strictObject({
  source: z.string().min(1),
  welcome: z.strictObject({ day, kit: z.array(z.string().min(1)).min(1), lines: z.array(z.strictObject(line)).min(1) }),
  firstSight: z.array(z.strictObject({ choiceId: z.string().min(1), ...line })),
  objectives: z.array(z.strictObject({ day, rendezVous: z.string().min(1).nullable(), source: z.string().min(1) })),
});

/** Lit et vérifie la donnée d'accueil ; lève une `Error` qui nomme la valeur fautive. */
export function parseOnboarding(raw: unknown, street: StreetData): Onboarding {
  const r = schema.safeParse(raw);
  if (!r.success) throw new Error(`onboarding : ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')}`);
  const d = r.data;
  for (const l of d.welcome.lines) if (l.lit !== null && !d.welcome.kit.includes(l.lit)) throw new Error(`onboarding : objet allumé hors du kit présenté : ${l.lit}`);
  const days = d.objectives.map((o) => o.day);
  for (let n = 1; n <= WEEK_STEPS; n++) if (days.filter((x) => x === n).length !== 1) throw new Error(`onboarding : un objectif par jour, de 1 à ${WEEK_STEPS} (jour ${n})`);
  for (const o of d.objectives) {
    if (o.rendezVous === null) continue;
    const c = street.choices.find((x) => x.id === o.rendezVous);
    if (c === undefined || !c.days.includes(o.day as DayIndex)) throw new Error(`onboarding : rendez-vous ${o.rendezVous} non ouvert le J${o.day}`);
  }
  for (const f of d.firstSight) if (!street.choices.some((x) => x.id === f.choiceId)) throw new Error(`onboarding : première apparition d'un choix inconnu : ${f.choiceId}`);
  return d as Onboarding;
}

/** Les objets présentés par l'accueil, dans l'ordre de lecture de la bible (§6). */
export const welcomeKit = (o: Onboarding): readonly string[] => o.welcome.kit;

/** L'accueil passe au réveil du jour d'accueil, sur une partie qui n'a encore rien joué (une reprise ne le rejoue pas). */
export const welcomeDue = (o: Onboarding, today: DayIndex | number, actsCount: number): boolean => today === o.welcome.day && actsCount === 0;

/** Clé de la ligne d'objectif du jour. */
export const objectiveKey = (d: DayIndex | number): string => `w10.goal.${d}`;

/** La ligne de première apparition due : son choix est présenté, il n'a jamais été joué, et elle n'a pas déjà été dite dans la séance. */
export function firstSightDue(o: Onboarding, shownIds: readonly string[], acts: readonly { readonly id: string }[], seen: ReadonlySet<string>): FirstSight | null {
  return o.firstSight.find((f) => shownIds.includes(f.choiceId) && !seen.has(f.choiceId) && !acts.some((a) => a.id === f.choiceId)) ?? null;
}

/** Clé de la ligne d'arrivée d'un groupe de choix : `w10.arrive.<lieu>`, le suffixe de jour retiré (`checkpoint.j3` donne `checkpoint`). */
export const arrivalKey = (id: string): string => `w10.arrive.${id.replace(/\.j\d+$/, '')}`;

/**
 * La ligne d'arrivée due quand des groupes s'ouvrent : celle du premier groupe NOUVEAU (absent de `before`) qui en a une, `null` sinon
 * [retour de playtest 2026-11-03 : « on devrait me dire : tu arrives à un point de contrôle pour tel truc »].
 */
export function arrivalDue(before: readonly string[], now: readonly string[], has: (key: string) => boolean): string | null {
  for (const id of now) if (!before.includes(id) && has(arrivalKey(id))) return arrivalKey(id);
  return null;
}
