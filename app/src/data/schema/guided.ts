/**
 * Journées guidées de la rue [spec rue guidée J1-J2, T1] : scènes, choix (narratifs ou à prix du moteur), chaînes, modes de parole.
 * Schéma strict puis contrôles croisés contre le bloc `street` (choix, jalons, horloge) ; toute erreur est une `Error` qui nomme la valeur.
 * Les valeurs vivent dans le JSON du monde (`street.guided`), jamais dans le moteur. Aucun texte ici : seulement des clés i18n.
 */
import { z } from 'zod';
import { RIGHT_IDS, type DayIndex, type RightId } from '../../shared/types/street';
import type { StreetData } from './street';

export type Voice = 'regime' | 'narrator' | 'person' | 'me';   // 'me' : la réplique du joueur (`replyKey`)
export interface BeatLine { readonly voice: Voice; readonly key: string; readonly lit: string | null }   // lit : objet du kit allumé
/** S1 : réplique choisie par la variante d'un maillon d'un jour antérieur, ou du même jour plus tôt. `null` = pas de réplique. */
export interface LinkedBeat {
  readonly voice: Voice; readonly lit: string | null;
  readonly byLink: { readonly link: string; readonly keys: Readonly<Record<string, string | null>>; readonly otherwise: string | null };
}
export type SceneBeat = BeatLine | LinkedBeat;
export const isLinkedBeat = (b: SceneBeat): b is LinkedBeat => 'byLink' in b;
export interface SceneActor { readonly id: string; readonly bodyId: string; readonly nameKey: string; readonly actionKey: string; readonly clip: 'idle' | 'talk' | 'walk' | 'queue' }
/** `words` : coût en mots de l'option, entier >= 0, affiché avant confirmation. */
export interface NarrativeOption { readonly id: string; readonly labelKey: string; readonly words: number; readonly next: string; readonly replyKey: string | null }
export type SceneAsk =
  | { readonly kind: 'narrative'; readonly promptKey: string; readonly options: readonly NarrativeOption[] }
  | { readonly kind: 'priced'; readonly choiceId: string; readonly next: Readonly<Record<string, string>>;   // option du moteur -> scène suivante
      readonly ifUnavailable: string | null }   // suite quand le choix n'est pas ouvert ; `null` = jamais indisponible
  | { readonly kind: 'none'; readonly next: string }
  /** S2 : aucun bouton, aucun mot ; la suite dépend de la variante du maillon `link`. */
  | { readonly kind: 'route'; readonly link: string; readonly next: Readonly<Record<string, string>>; readonly otherwise: string };
/** Actes de lieu posés à l'arrivée (ids du moteur, `onExit`/`onEnter`). */
export interface TransitAct { readonly kind: 'exit' | 'enter'; readonly id: 'home' | 'registre' }
export interface SceneSpec {
  readonly id: string; readonly day: DayIndex; readonly stage: string; readonly place: string;
  readonly anchorMinute: number; readonly costMin: number;
  readonly late: { readonly afterMinute: number; readonly next: string; readonly lineKey: string } | null;
  readonly actor: SceneActor | null; readonly beats: readonly SceneBeat[]; readonly ask: SceneAsk;
  readonly transit: readonly TransitAct[]; readonly waitKind: 'none' | 'queue';
}
export type LinkAt =
  | { readonly kind: 'scene'; readonly id: string }
  | { readonly kind: 'choice'; readonly id: string }          // acte à prix `choice`
  | { readonly kind: 'lane'; readonly id: string }            // acte `lane checkpoint`, id = choix `checkpoint.jN`
  | { readonly kind: 'night'; readonly day: DayIndex; readonly from: string };   // variante = celle du maillon `from`
/** `personKey` nul : aucun nom ne s'affiche (le geste n'a pas d'interlocuteur) ; une chaîne qui n'a pas de personne ne met pas de phrase à sa place. */
export interface LinkVariant {
  readonly recapKey: string; readonly personKey: string | null; readonly saidKey: string | null;
  /** `{noms}` : clé du nom donné par cette variante ; défaut null. */
  readonly nameKey: string | null;
}
export interface ChainLink { readonly id: string; readonly day: DayIndex; readonly at: LinkAt; readonly absent: LinkVariant; readonly variants: Readonly<Record<string, LinkVariant>> }
export interface ChainSpec {
  readonly id: string; readonly titleKey: string; readonly crosses: readonly string[];
  readonly question: { readonly key: string; readonly linkKeys: Readonly<Record<string, string>> };
  /** `source` : provenance interne (recherche, bible), jamais montrée ; `sourceKey` : la ligne de source lisible, montrée au joueur sous le fait. */
  readonly fact: {
    readonly key: string; readonly source: string; readonly sourceKey: string;
    /** Écran où le fait est montré : le relevé du jour `day` (jour joué) ou la carte de montage du jour `day` ; `null` = comportement actuel. */
    readonly shownOn: { readonly on: 'recap' | 'card'; readonly day: DayIndex } | null;
  };
  readonly links: readonly ChainLink[]; readonly lastDay: DayIndex;
  /** Jour où la chaîne doit être ouverte sur tout chemin ; `null` = jour de son premier maillon. */
  readonly opensBy: DayIndex | null;
}
/** Posture de parole d'un jour [bible §7.2, §7.5] ; déplacée depuis `validate/guided.ts`, ré-exportée là-bas. */
export type SpeechModeId = 'muet' | 'couloir' | 'bavard';
/**
 * Jour de montage [semaine condensée] : une carte, des étapes jouées à la place de la joueuse.
 * `lines` : lignes S1 sous le titre ; au plus 4 - 2 - (fait sur cette carte ? 1 : 0), la posture et la fin comptent (décision 5).
 */
export interface MontageSpec {
  readonly lines: readonly SceneBeat[];
  readonly postureKeys: Readonly<Record<SpeechModeId, string>>;
  /** D2 : `inherit` = la posture du dernier jour joué. */
  readonly posture: 'inherit' | SpeechModeId;
  /** Étapes présentées à la joueuse DANS la carte, en ordre de jeu (id de scène). */
  readonly asks: readonly string[];
  /** Option jouée à la place de la joueuse, par posture, par étape (id de scène ; une étape `priced` prend l'option du choix). */
  readonly picks: Readonly<Record<SpeechModeId, Readonly<Record<string, string>>>>;
  /** Mots du jour par posture, options de carte par défaut : sommes épinglées, lues par `guided.montagePostureWords`. */
  readonly expectedWords: Readonly<Record<SpeechModeId, number>>;
  /** Option de carte par défaut de chaque posture. */
  readonly cardDefaults: Readonly<Record<SpeechModeId, Readonly<Record<string, string>>>>;
}
/** S3 : `right` = le droit du jour ; défaut null. `kind` `montage` exige `montage` ; `played` l'interdit. */
export interface GuidedDay {
  readonly day: DayIndex; readonly first: string; readonly goalKey: string; readonly right: RightId | null;
  readonly kind: 'played' | 'montage'; readonly montage: MontageSpec | null;
}
export interface GuidedEnding {
  /** Par `endId` du moteur (`state.ts` : `arrestedAudition`, `released`, `recruited`) : ligne du régime, lignes du narrateur par nombre de noms ('0', '1', '2' = deux ou plus), absentes = rien. */
  readonly outcomes: Readonly<Record<string, { readonly regimeKey: string; readonly narratorKeys: Readonly<Record<string, string>> }>>;
  readonly arrestedNightKey: string;   // « Le reste de la semaine n'a pas eu lieu. Tu as été arrêté dans la nuit de {jour}. »
  readonly weekButtonKey: string;      // « Voir ta semaine »
}
export interface SpeechMode { readonly muet: number; readonly couloir: readonly [number, number]; readonly bavard: number }
/** Postures atteintes par un total de mots (corps de l'ancien `modeReached`, inchangé). */
export function modesOf(m: SpeechMode, words: number): readonly SpeechModeId[] {
  return SPEECH_MODE_IDS.filter((id) => (id === 'muet' ? words <= m.muet : id === 'couloir' ? m.couloir[0] <= words && words <= m.couloir[1] : words >= m.bavard));
}
const SPEECH_MODE_IDS: readonly SpeechModeId[] = ['muet', 'couloir', 'bavard'];
export interface GuidedData {
  readonly days: readonly GuidedDay[];
  readonly scenes: readonly SceneSpec[]; readonly chains: readonly ChainSpec[];
  readonly endOfDemo: { readonly afterDay: DayIndex; readonly titleKey: string; readonly lineKey: string } | null;
  /** Totaux de mots du jour par mode de parole [bible §7.2, §7.5] : muet = au plus `muet` ; couloir = dans `[couloir[0], couloir[1]]` ; bavard = au moins `bavard`. */
  readonly speechModes: Readonly<Record<number, SpeechMode>>;
  readonly ending: GuidedEnding | null;
  /** Maillons des étapes non présentées d'un jour de montage, par id de chaîne : lus et posés hors de la chaîne ; défaut `{}`. */
  readonly setAsideLinks: Readonly<Record<string, readonly ChainLink[]>>;
  /** Plafond de maillons montrés au relevé ; `null` = pas de plafond. */
  readonly recapMaxLinks: number | null;
}

/** `next` qui clôt le jour. */
export const NIGHT = 'night';

const nonEmpty = z.string().min(1);
const idKey = z.string().regex(/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/);
const dayIndex = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]);
const minute = z.number().int().min(0).max(1440);
const wordCount = z.number().int().min(0).max(1000);

const beatSchema = z.strictObject({ voice: z.enum(['regime', 'narrator', 'person', 'me']), key: nonEmpty, lit: nonEmpty.nullable() });
const linkedBeatSchema = z.strictObject({
  voice: z.enum(['regime', 'narrator', 'person', 'me']), lit: nonEmpty.nullable(),
  byLink: z.strictObject({ link: idKey, keys: z.record(nonEmpty, nonEmpty.nullable()), otherwise: nonEmpty.nullable() }),
});
const actorSchema = z.strictObject({ id: idKey, bodyId: nonEmpty, nameKey: nonEmpty, actionKey: nonEmpty, clip: z.enum(['idle', 'talk', 'walk', 'queue']) });
const optionSchema = z.strictObject({ id: idKey, labelKey: nonEmpty, words: wordCount, next: nonEmpty, replyKey: nonEmpty.nullable() });
const askSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('narrative'), promptKey: nonEmpty,
    options: z.array(optionSchema).min(2, { error: '2 ou 3 options attendues' }).max(3, { error: '2 ou 3 options attendues' }),
  }),
  z.strictObject({ kind: z.literal('priced'), choiceId: idKey, next: z.record(nonEmpty, nonEmpty), ifUnavailable: nonEmpty.nullable() }),
  z.strictObject({ kind: z.literal('none'), next: nonEmpty }),
  z.strictObject({ kind: z.literal('route'), link: idKey, next: z.record(nonEmpty, nonEmpty), otherwise: nonEmpty }),
]);
const sceneSchema = z.strictObject({
  id: idKey, day: dayIndex, stage: nonEmpty, place: nonEmpty, anchorMinute: minute, costMin: z.number().int().min(0).max(1440),
  late: z.strictObject({ afterMinute: minute, next: nonEmpty, lineKey: nonEmpty }).nullable(),
  actor: actorSchema.nullable(), beats: z.array(z.union([beatSchema, linkedBeatSchema])), ask: askSchema,
  transit: z.array(z.strictObject({ kind: z.enum(['exit', 'enter']), id: z.enum(['home', 'registre']) })),
  waitKind: z.enum(['none', 'queue']),
});
const variantSchema = z.strictObject({ recapKey: nonEmpty, personKey: nonEmpty.nullable(), saidKey: nonEmpty.nullable(), nameKey: nonEmpty.nullable().default(null) });
const linkSchema = z.strictObject({
  id: idKey, day: dayIndex,
  at: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('scene'), id: idKey }),
    z.strictObject({ kind: z.literal('choice'), id: idKey }),
    z.strictObject({ kind: z.literal('lane'), id: idKey }),
    z.strictObject({ kind: z.literal('night'), day: dayIndex, from: idKey }),
  ]),
  absent: variantSchema, variants: z.record(nonEmpty, variantSchema),
});
const chainSchema = z.strictObject({
  id: idKey, titleKey: nonEmpty, crosses: z.array(idKey),
  question: z.strictObject({ key: nonEmpty, linkKeys: z.record(nonEmpty, nonEmpty) }),
  fact: z.strictObject({
    key: nonEmpty, source: nonEmpty, sourceKey: nonEmpty,
    shownOn: z.strictObject({ on: z.enum(['recap', 'card']), day: dayIndex }).nullable().default(null),
  }),
  links: z.array(linkSchema).min(1), lastDay: dayIndex, opensBy: dayIndex.nullable().default(null),
});
const modeRecord = <T extends z.ZodType>(v: T) => z.strictObject({ muet: v, couloir: v, bavard: v });
const montageSchema = z.strictObject({
  lines: z.array(z.union([beatSchema, linkedBeatSchema])),
  postureKeys: modeRecord(nonEmpty),
  posture: z.enum(['inherit', 'muet', 'couloir', 'bavard']).default('inherit'),
  asks: z.array(idKey),
  picks: modeRecord(z.record(nonEmpty, nonEmpty)),
  expectedWords: modeRecord(wordCount),
  cardDefaults: modeRecord(z.record(nonEmpty, nonEmpty)),
});
const rightSchema = z.string().refine((v) => (RIGHT_IDS as readonly string[]).includes(v), { error: (i) => `right « ${String(i.input)} » n'est pas un des droits (${RIGHT_IDS.join(', ')})` });
const endingSchema = z.strictObject({
  outcomes: z.record(nonEmpty, z.strictObject({ regimeKey: nonEmpty, narratorKeys: z.record(nonEmpty, nonEmpty) })),
  arrestedNightKey: nonEmpty, weekButtonKey: nonEmpty,
});
const guidedSchema = z.strictObject({
  days: z.array(z.strictObject({ day: dayIndex, first: idKey, goalKey: nonEmpty, right: rightSchema.nullable().default(null),
    kind: z.enum(['played', 'montage']).default('played'), montage: montageSchema.nullable().default(null),
  })).min(1),
  scenes: z.array(sceneSchema).min(1), chains: z.array(chainSchema),
  endOfDemo: z.strictObject({ afterDay: dayIndex, titleKey: nonEmpty, lineKey: nonEmpty }).nullable(),
  speechModes: z.record(z.string().regex(/^[1-7]$/), z.strictObject({ muet: wordCount, couloir: z.tuple([wordCount, wordCount]), bavard: wordCount })),
  ending: endingSchema.nullable().default(null),
  setAsideLinks: z.record(nonEmpty, z.array(linkSchema)).default({}),
  recapMaxLinks: z.number().int().min(1).nullable().default(null),
});

const fail = (path: string, message: string): never => { throw new Error(`guided : ${path} : ${message}`); };

/** Les ids de scène vers lesquels `scene` peut mener, avec le chemin de chaque référence. */
function successorsOf(scene: SceneSpec): readonly { readonly path: string; readonly to: string }[] {
  const out: { path: string; to: string }[] = [];
  const a = scene.ask;
  if (a.kind === 'none') out.push({ path: 'ask.next', to: a.next });
  if (a.kind === 'route') {
    Object.entries(a.next).forEach(([key, to]) => out.push({ path: `ask.next.${key}`, to }));
    out.push({ path: 'ask.otherwise', to: a.otherwise });
  }
  if (a.kind === 'narrative') a.options.forEach((o) => out.push({ path: `ask.options.${o.id}.next`, to: o.next }));
  if (a.kind === 'priced') {
    Object.entries(a.next).forEach(([opt, to]) => out.push({ path: `ask.next.${opt}`, to }));
    if (a.ifUnavailable !== null) out.push({ path: 'ask.ifUnavailable', to: a.ifUnavailable });
  }
  if (scene.late !== null) out.push({ path: 'late.next', to: scene.late.next });
  return out;
}

/** Jalon d'un choix à prix : une seule option `go` (convention de `choiceViews`, `street/runtime.ts`). */
const JALON_OPTION = 'go';
/** `endId` de fin de semaine du moteur (`state.ts` : `auditionEnd`). */
const ENDING_IDS: readonly string[] = ['arrestedAudition', 'released', 'recruited'];
/** Nombre de noms de la fin : '2' = deux ou plus. */
const NAME_COUNTS: readonly string[] = ['0', '1', '2'];

/**
 * Valide les journées guidées d'un monde contre son bloc `street`. Lève une `Error` qui nomme la valeur fautive ;
 * rend les données typées sinon.
 */
export function parseGuided(raw: unknown, street: Omit<StreetData, 'guided'>): GuidedData {
  const r = guidedSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0]!;
    return fail(i.path.join('.') || '(racine)', i.message);
  }
  const g = r.data as unknown as GuidedData;
  const byId = new Map<string, SceneSpec>();
  g.scenes.forEach((s) => { if (byId.has(s.id)) fail(`scenes.${s.id}`, 'scène en double'); byId.set(s.id, s); });

  for (const d of g.days) {
    const first = byId.get(d.first);
    if (first === undefined || first.day !== d.day) fail(`days.${d.day}.first`, `la première scène ${d.first} n'est pas une scène du jour ${d.day}`);
    if (g.days.filter((x) => x.day === d.day).length > 1) fail(`days.${d.day}`, 'jour en double');
    const mode = g.speechModes[d.day];
    if (mode === undefined) fail('speechModes', `aucune entrée pour le jour ${d.day}`);
  }
  for (const [day, m] of Object.entries(g.speechModes)) {
    if (!(m.muet < m.couloir[0] && m.couloir[0] <= m.couloir[1] && m.couloir[1] < m.bavard)) {
      fail(`speechModes.${day}`, `muet < couloir[0] <= couloir[1] < bavard attendu (couloir ${m.couloir[0]}..${m.couloir[1]}, muet ${m.muet}, bavard ${m.bavard})`);
    }
  }

  const { dayStartMinute, dayEndMinute } = street.clock;
  for (const s of g.scenes) {
    if (s.anchorMinute < dayStartMinute || s.anchorMinute > dayEndMinute) {
      fail(`scenes.${s.id}.anchorMinute`, `${s.anchorMinute} hors de l'horloge [${dayStartMinute}, ${dayEndMinute}]`);
    }
    if (s.late !== null && (s.late.afterMinute < dayStartMinute || s.late.afterMinute > dayEndMinute)) {
      fail(`scenes.${s.id}.late.afterMinute`, `${s.late.afterMinute} hors de l'horloge [${dayStartMinute}, ${dayEndMinute}]`);
    }
  }

  for (const s of g.scenes) {
    const a = s.ask;
    if (a.kind === 'narrative') {
      if (!a.options.some((o) => o.words === 0)) fail(`scenes.${s.id}.ask`, `scène ${s.id} : un choix narratif a au moins une option à 0 mot (se taire)`);
      if (new Set(a.options.map((o) => o.id)).size !== a.options.length) fail(`scenes.${s.id}.ask.options`, 'id d\'option en double');
    }
    if (a.kind === 'priced') {
      const choice = street.choices.find((c) => c.id === a.choiceId);
      const jalon = street.jalons.find((j) => j.id === a.choiceId);
      let optionIds: readonly string[];
      if (choice !== undefined) {
        const open = choice.day !== null ? choice.day === s.day : choice.days.includes(s.day);
        if (!open) fail(`scenes.${s.id}.ask.choiceId`, `le choix ${a.choiceId} n'est pas ouvert le jour ${s.day}`);
        optionIds = choice.options.map((o) => o.id);
      } else if (jalon !== undefined) {
        if (jalon.day !== s.day) fail(`scenes.${s.id}.ask.choiceId`, `le jalon ${a.choiceId} n'est pas du jour ${s.day}`);
        optionIds = [JALON_OPTION];
      } else {
        return fail(`scenes.${s.id}.ask.choiceId`, `${a.choiceId} n'est ni un choix ni un jalon de la rue`);
      }
      for (const o of optionIds) if (!(o in a.next)) fail(`scenes.${s.id}.ask.next`, `choix ${a.choiceId} : l'option « ${o} » n'a pas de scène suivante`);
      for (const o of Object.keys(a.next)) if (!optionIds.includes(o)) fail(`scenes.${s.id}.ask.next`, `choix ${a.choiceId} : l'option « ${o} » n'existe pas dans le moteur`);
    }
    for (const { path, to } of successorsOf(s)) {
      if (to === NIGHT) continue;
      const target = byId.get(to);
      if (target === undefined || target.day !== s.day) fail(`scenes.${s.id}.${path}`, `« ${to} » n'est ni une scène du jour ${s.day} ni « ${NIGHT} »`);
      else if (target.anchorMinute < s.anchorMinute) fail(`scenes.${s.id}.${path}`, `anchorMinute de ${to} (${target.anchorMinute}) avant celle de ${s.id} (${s.anchorMinute})`);
    }
  }

  /** Options qu'une scène offre à la joueuse ou à l'auto-jeu : options narratives, ou options du choix / `go` du jalon / voies du contrôle (`next`). */
  const stepOptions = (s: SceneSpec): readonly string[] => s.ask.kind === 'narrative' ? s.ask.options.map((o) => o.id) : s.ask.kind === 'priced' ? Object.keys(s.ask.next) : [];
  const dayById = new Map(g.days.map((d) => [d.day, d] as const));
  for (const d of g.days) {
    const m = d.montage;
    if ((d.kind === 'montage') !== (m !== null)) fail(`days.${d.day}.montage`, d.kind === 'montage' ? 'un jour de montage exige un `montage`' : 'un jour joué n\'a pas de `montage`');
    if (m === null) continue;
    const factsHere = g.chains.filter((c) => c.fact.shownOn?.on === 'card' && c.fact.shownOn.day === d.day).length;
    if (m.lines.length + 2 + factsHere > 4) fail(`days.${d.day}.montage.lines`, `la carte a au plus 4 lignes : ${m.lines.length} S1 + posture + fin${factsHere > 0 ? ` + ${factsHere} fait` : ''} = ${m.lines.length + 2 + factsHere}`);
    for (const id of m.asks) {
      const s = byId.get(id);
      if (s === undefined || s.day !== d.day) fail(`days.${d.day}.montage.asks`, `« ${id} » n'est pas une scène du jour ${d.day}`);
    }
    for (const mode of SPEECH_MODE_IDS) for (const [step, option] of Object.entries(m.picks[mode])) {
      const s = byId.get(step);
      if (s === undefined || s.day !== d.day) fail(`days.${d.day}.montage.picks.${mode}`, `« ${step} » n'est pas une scène du jour ${d.day}`);
      else if (!stepOptions(s).includes(option)) fail(`days.${d.day}.montage.picks.${mode}`, `${step} : « ${option} » n'est pas une de ses options (${stepOptions(s).join(', ') || 'aucune'})`);
    }
  }
  for (const c of g.chains) {
    const so = c.fact.shownOn;
    if (so === null) continue;
    const d = dayById.get(so.day);
    if (d === undefined || (so.on === 'recap' ? d.kind !== 'played' : d.kind !== 'montage')) {
      fail(`chains.${c.id}.fact.shownOn`, `shownOn ${so.on} jour ${so.day} : ${so.on === 'recap' ? 'le relevé exige un jour joué' : 'la carte exige un jour de montage'}`);
    }
  }

  const choiceIds = new Set([...street.choices.map((c) => c.id), ...street.jalons.map((j) => j.id)]);
  const linkById = new Map<string, { readonly link: ChainLink; readonly chain: ChainSpec }>();
  for (const c of g.chains) {
    const ids = new Set<string>();
    for (const l of c.links) {
      if (linkById.has(l.id)) fail(`chains.${c.id}.links.${l.id}`, `maillon ${l.id} en double (ids de maillon uniques sur toutes les chaînes)`);
      const at = l.at;
      if (at.kind === 'scene' && byId.get(at.id)?.day !== l.day) fail(`chains.${c.id}.links.${l.id}`, `maillon ${l.id} : ${at.id} n'est pas une scène du jour ${l.day}`);
      if ((at.kind === 'choice' || at.kind === 'lane') && !choiceIds.has(at.id)) fail(`chains.${c.id}.links.${l.id}`, `maillon ${l.id} : ${at.id} n'est pas un choix de la rue`);
      if (at.kind === 'night') {
        if (l.day !== at.day + 1) fail(`chains.${c.id}.links.${l.id}.day`, `maillon ${l.id} : day ${l.day} doit être at.day + 1 = ${at.day + 1}`);
        if (!ids.has(at.from)) fail(`chains.${c.id}.links.${l.id}.at.from`, `maillon ${l.id} : ${at.from} n'est pas un maillon précédent de la chaîne`);
      }
      ids.add(l.id);
      linkById.set(l.id, { link: l, chain: c });
      // Un maillon dont l'étape est dans un jour de montage sans être présentée n'est jamais joué par la joueuse : il part en `setAsideLinks`.
      const dayMontage = dayById.get(l.day)?.montage ?? null;
      if (dayMontage !== null && at.kind !== 'night') {
        const step = at.kind === 'scene' ? byId.get(at.id) : g.scenes.find((x) => x.day === l.day && x.ask.kind === 'priced' && x.ask.choiceId === at.id);
        const asked = dayMontage.asks.map((a) => byId.get(a)).filter((a): a is SceneSpec => a !== undefined);
        const firstAsk = Math.min(...asked.map((a) => a.anchorMinute));
        const isJalonTail = step !== undefined && step.ask.kind === 'priced' && street.jalons.some((j) => j.id === (step.ask as { choiceId: string }).choiceId)
          && asked.length > 0 && step.anchorMinute >= firstAsk;   // B-2 : suite sans choix d'une étape présentée (jalon à option unique)
        if (step === undefined || (!dayMontage.asks.includes(step.id) && !isJalonTail)) {
          fail(`chains.${c.id}.links.${l.id}`, `guided.linkHidden : maillon ${l.id} sur ${step?.id ?? at.id}, étape non présentée du jour de montage ${l.day} (caché : à ranger dans setAsideLinks)`);
        }
      }
    }
    const firstDay = c.links[0]!.day;
    if (c.opensBy !== null && c.opensBy < firstDay) fail(`chains.${c.id}.opensBy`, `opensBy ${c.opensBy} avant le premier maillon (jour ${firstDay})`);
  }

  for (const [chainId, links] of Object.entries(g.setAsideLinks)) {
    if (!g.chains.some((c) => c.id === chainId)) fail(`setAsideLinks.${chainId}`, `« ${chainId} » n'est pas une chaîne`);
    for (const l of links) {
      if (linkById.has(l.id)) fail(`setAsideLinks.${chainId}.${l.id}`, `maillon ${l.id} en double (ids de maillon uniques, rangés compris)`);
      linkById.set(l.id, { link: l, chain: g.chains.find((c) => c.id === chainId)! });
    }
  }

  /** Options qu'un maillon offre (même règle que `linkOptions` du validateur). */
  const optionsOf = (l: ChainLink, c: ChainSpec): readonly string[] => {
    const at = l.at;
    if (at.kind === 'scene') { const a = byId.get(at.id)?.ask; return a?.kind === 'narrative' ? a.options.map((o) => o.id) : []; }
    if (at.kind === 'night') { const from = c.links.find((x) => x.id === at.from); return from === undefined ? [] : optionsOf(from, c); }
    const choice = street.choices.find((x) => x.id === at.id);
    if (choice !== undefined) return choice.options.map((o) => o.id);
    return street.jalons.some((j) => j.id === at.id) ? [JALON_OPTION] : [];
  };
  /** Minute où l'acte du maillon tombe dans son jour ; un maillon de nuit tombe au matin (-1). `null` : aucune scène ne le porte. */
  const minuteOf = (l: ChainLink): number | null => {
    const at = l.at;
    if (at.kind === 'night') return -1;
    if (at.kind === 'scene') return byId.get(at.id)?.anchorMinute ?? null;
    return g.scenes.find((x) => x.day === l.day && x.ask.kind === 'priced' && x.ask.choiceId === at.id)?.anchorMinute ?? null;
  };
  /** Contrôle qu'une scène peut lire la variante du maillon `linkId` avec ces clés. */
  const checkLinkRead = (s: SceneSpec, where: string, linkId: string, keys: readonly string[]): void => {
    const hit = linkById.get(linkId);
    if (hit === undefined) return fail(`scenes.${s.id}.${where}`, `maillon ${linkId} inconnu`);
    const { link, chain } = hit;
    const earlier = link.day < s.day || (link.day === s.day && (minuteOf(link) ?? Infinity) < s.anchorMinute);
    if (!earlier) fail(`scenes.${s.id}.${where}`, `le maillon ${linkId} (jour ${link.day}) n'est pas antérieur à la scène ${s.id} (jour ${s.day}, minute ${s.anchorMinute})`);
    const options = optionsOf(link, chain);
    for (const k of keys) if (!options.includes(k)) fail(`scenes.${s.id}.${where}`, `maillon ${linkId} : « ${k} » n'est pas une de ses options (${options.join(', ') || 'aucune'})`);
  };
  for (const s of g.scenes) {
    s.beats.forEach((b, i) => { if (isLinkedBeat(b)) checkLinkRead(s, `beats.${i}.byLink`, b.byLink.link, Object.keys(b.byLink.keys)); });
    if (s.ask.kind === 'route') checkLinkRead(s, 'ask', s.ask.link, Object.keys(s.ask.next));
  }

  if (g.ending !== null) {
    for (const [endId, o] of Object.entries(g.ending.outcomes)) {
      if (!ENDING_IDS.includes(endId)) fail(`ending.outcomes.${endId}`, `endId « ${endId} » inconnu (${ENDING_IDS.join(', ')})`);
      for (const k of Object.keys(o.narratorKeys)) if (!NAME_COUNTS.includes(k)) fail(`ending.outcomes.${endId}.narratorKeys`, `« ${k} » n'est pas un nombre de noms (${NAME_COUNTS.join(', ')})`);
    }
  }
  return g;
}
