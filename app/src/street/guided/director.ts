/**
 * Le metteur en scène de la rue guidée [spec rue guidée J1-J2 §4, §11.2, §11.7 ; plan T7] : transforme le graphe des journées guidées en
 * une suite de TEMPS (carte, ligne, choix, marche, attente, droit, relevé, nuit, fin de démo) posés sur le pilote (`StreetDriver`).
 * Pur : ni DOM, ni Three, ni minuterie. Seul le pilote écrit ; les minutes d'entrée et de sortie d'une étape viennent de `schedule.ts`,
 * la même source que la preuve (`pathsOf`) [ruling concordance T4 / T7].
 *
 * Reprise = rejeu : à la construction, la journée est reprise depuis `days[d].first` et chaque étape déjà jouée (acte `scene`, choix
 * rangé dans `street.confirmed`, étape `none` dont la suite est jouée, branche `late` jouée) est passée sans temps ni acte.
 * Le metteur en scène n'appelle JAMAIS `designate`, sauf sur un jour de montage (ruling R-COND.1, plan semaine condensée) : il y pose
 * les choix à prix comme un humain, designate puis confirm ; aucun prix n'y est dit. Sur un jour joué, le panneau désigne (prix dit,
 * D136), le montage T14 relaie [ruling], inchangé.
 *
 * Jour de montage [plan semaine condensée, T2, décisions 2, 5, 13] : un temps `montage` (la carte), puis les étapes jouées à la place de
 * la joueuse dans sa posture (`montage.ts`) sans un temps de scène, par le chemin « reprise = rejeu » (`leave(…, replayed = true)`), jusqu'à
 * la première étape présentée (`asks`, temps `choice` `card: true`), puis la nuit, puis `montageEnd`, puis les droits du jour (`right`).
 */
import { NIGHT, isLinkedBeat, type GuidedData, type SceneSpec, type SpeechModeId, type Voice } from '../../data/schema/guided';
import type { PalierId } from '../../data/schema/world';
import { availableOptions, CHECKPOINT_PREFIX } from '../../engine/moments/choices';
import { marksOf } from '../../engine/moments/marks';
import { givenNameKeys } from '../../engine/moments/recap';
import { enterStep, JALON_OPTION, leaveStep, pendingTransits, resolveBeat, routeNext, type StepLocation } from '../../engine/moments/schedule';
import { EARLY_END_ID } from '../../engine/moments/state';
import type { StreetContext } from '../../engine/moments/types';
import { checkpointWords } from '../../engine/moments/words';
import type { ActResult, StreetDriver } from '../../engine/view/driver';
import type { ActRecord, DayIndex, RightId } from '../../shared/types/street';
import { welcomeDue, type Onboarding } from '../onboarding';
import { montagePick, postureOf } from './montage';
import type { ChoiceView } from '../ui/choicePanel';

export type Beat =
  | { readonly kind: 'card'; readonly day: DayIndex; readonly goalKey: string }
  | { readonly kind: 'line'; readonly voice: Voice; readonly key: string; readonly speaker: string | null; readonly lit: string | null }
  /**
   * `priced` : deux gestes (le panneau désigne, `choose` confirme) ; faux pour une option narrative ou un jalon, un seul geste.
   * `card` : étape présentée sur la carte d'un jour de montage (le runtime garde la carte affichée) ; absent sur un jour joué.
   */
  | { readonly kind: 'choice'; readonly sceneId: string; readonly view: ChoiceView; readonly priced: boolean; readonly card?: true }
  /** Carte d'un jour de montage, ouverte : lignes S1 (`montage.lines` résolues), posture retenue, chaîne dont le fait est sur cette carte. */
  | { readonly kind: 'montage'; readonly day: DayIndex; readonly posture: SpeechModeId; readonly lineKeys: readonly string[]; readonly postureKey: string; readonly factChainId: string | null }
  /** Fin de la carte, après la nuit : message du bracelet (palier du relevé de la nuit) ou arrestation dans la nuit (`ending.arrestedNightKey`). */
  | { readonly kind: 'montageEnd'; readonly day: DayIndex; readonly tail: { readonly kind: 'palier'; readonly palier: PalierId } | { readonly kind: 'arrested'; readonly key: string; readonly day: DayIndex } }
  | { readonly kind: 'walk'; readonly to: string; readonly from: string }
  /** Image seulement : l'état est déjà à `untilMinute` quand le temps paraît. */
  | { readonly kind: 'wait'; readonly label: 'queue' | 'pass'; readonly fromMinute: number; readonly untilMinute: number }
  | { readonly kind: 'right'; readonly right: RightId }
  | { readonly kind: 'night' } | { readonly kind: 'recap'; readonly day: DayIndex } | { readonly kind: 'demoEnd' }
  /** Issue de l'audition [plan J3-J7 §5.1] : `names` = marques dont la variante pose un `nameKey` ; narrateur `narratorKeys[min(names, 2)]`, `null` s'il n'y en a pas. */
  | { readonly kind: 'outcome'; readonly endId: string; readonly names: number; readonly nameKeys: readonly string[]; readonly regimeKey: string; readonly narratorKey: string | null }
  /** Partie finie : le montage appelle `driver.finishDay()` puis navigue au bilan ; `advance` sans effet. `early` : arrêté dans la nuit `endedDay`. */
  | { readonly kind: 'end'; readonly early: boolean; readonly endedDay: DayIndex };

export interface Director {
  current(): Beat;
  /** Continuer (clic, Espace, Entrée) sur une ligne, une carte, une marche, une attente, l'issue, le relevé ou la nuit ; sans effet sur un choix ou une fin. */
  advance(): void;
  /** Choix confirmé : option narrative -> `driver.scene` ; choix de `street.choices` -> `driver.confirm` (désigné par le panneau) ; jalon -> `driver.choose(id, 'go')`. */
  choose(optionId: string): ActResult;
  /** L'étape présentée, `null` hors étape (carte du jour, relevé, nuit, fin). */
  sceneId(): string | null;
}

/** Au-delà, un moment passif reçoit un temps `wait` « Passer » [spec §4.3 : « tout moment passif de plus de 3 s »]. */
const PASSIVE_MS_MAX = 3000;
/** Nom du groupe d'un jalon, comme `choiceViews` (`street/runtime.ts`) quand aucune clé propre n'existe. */
const MILESTONE_KEY = 'street.ui.choices.milestone';
/** Libellé de l'option unique d'un jalon, comme `choiceViews`. */
const JALON_LABEL_KEY = 'street.ui.continue';

interface Item { readonly beat: Beat; then: (() => void) | null }

export function createDirector(d: StreetDriver, g: GuidedData, ob: Onboarding, ctx: StreetContext): Director {
  const street = ctx.street;
  const queue: Item[] = [];
  let presented: SceneSpec | null = null;
  /** Posture du jour de montage en cours, fixée à son ouverture (`startDay`). */
  let posture: SpeechModeId = 'couloir';
  /** Droits nés pendant un jour de montage : rendus après `montageEnd` (décision 13), jamais perdus. */
  const deferred: RightId[] = [];

  const scene = (id: string): SceneSpec => {
    const s = g.scenes.find((x) => x.id === id);
    if (s === undefined) throw new Error(`director : scène inconnue « ${id} »`);
    return s;
  };
  const st = () => d.state().street;
  const live = (): number => d.state().live.clock.minute;
  const location = (): StepLocation => st().location as StepLocation;
  /** Marques franchies à cet instant (même lecture que `marksOf` au relevé) : un maillon du jour plus tôt joué y est, un maillon à venir n'y est pas. */
  const marks = () => marksOf(st().acts, { day: st().day }, g, street.clock);
  /** Le jour courant est un jour de montage. */
  const montageDay = (): boolean => g.days.find((x) => x.day === st().day)?.kind === 'montage';
  const sayRight = (right: RightId): void => { if (montageDay()) deferred.push(right); else push({ kind: 'right', right }); };

  const push = (beat: Beat): void => { queue.push({ beat, then: null }); };
  /** `fn` après le dernier temps en file (au « Continuer » qui le quitte), tout de suite si la file est vide. */
  const after = (fn: () => void): void => {
    const last = queue.at(-1);
    if (last === undefined) { fn(); return; }
    const prev = last.then;
    last.then = prev === null ? fn : () => { prev(); fn(); };
  };

  /** Pose un acte par le pilote ; chaque ligne de droit qu'il ajoute devient un temps `right` [spec §11.7]. */
  const posing = (write: () => ActResult): ActResult => {
    const before = new Set(Object.keys(st().rightLines));
    const r = write();
    if (r.ok) for (const [k, right] of Object.entries(st().rightLines)) if (!before.has(k)) sayRight(right);
    return r;
  };
  const transit = (kind: 'exit' | 'enter', id: string): void => {
    const m = live();
    const r = posing(() => d.act({ day: st().day, minute: m, kind, id, option: null }));
    // Un transit refusé est une faute des données (lieu, ordre des étapes) : elle se montre tout de suite, jamais une marche qui continue.
    if (!r.ok) throw new Error(`director : transit ${kind} ${id} refusé (${r.rejected.reason})`);
  };
  const postTransits = (s: SceneSpec): void => { for (const t of pendingTransits(s, location()).transits) transit(t.kind, t.id); };

  // --- ce qui a déjà été joué ce jour (reprise) -------------------------------------------------------------------------------------

  /** L'option enregistrée de l'étape ce jour : acte `scene` (narratif), `street.confirmed` (choix, jalon, voie effective). */
  const recorded = (s: SceneSpec): string | null => {
    const a = s.ask;
    const day = st().day;
    if (a.kind === 'narrative') return st().acts.find((x) => x.day === day && x.kind === 'scene' && x.id === s.id)?.option ?? null;
    if (a.kind === 'priced') return st().confirmed[`${day}.${a.choiceId}`] ?? null;
    return null;
  };
  const played = (id: string): boolean => {
    if (id === NIGHT) return false;
    const s = scene(id);
    if (recorded(s) !== null) return true;
    if (s.ask.kind === 'none' && played(s.ask.next)) return true;
    if (s.ask.kind === 'route' && [...Object.values(s.ask.next), s.ask.otherwise].some(played)) return true;
    return s.late !== null && played(s.late.next);
  };

  // --- étapes ---------------------------------------------------------------------------------------------------------------------

  const lineOf = (voice: Voice, key: string, speaker: string | null, lit: string | null): Beat => ({ kind: 'line', voice, key, speaker, lit });

  function enter(id: string): void {
    const s = scene(id);
    const opt = recorded(s);
    if (opt !== null) { leave(s, opt, live(), true); return; }
    if (s.ask.kind === 'none' && played(s.ask.next)) { leave(s, null, live(), true); return; }
    if (s.ask.kind === 'route' && played(s.id)) { leave(s, routeNext(s, marks()).branch, live(), true); return; }
    if (s.late !== null && played(s.late.next)) { enter(s.late.next); return; }
    postTransits(s);
    const e = enterStep(g, id, live());
    d.skipTo(e.minute);
    const show = montageDay() ? autoPlay : present;
    if (e.lateLineKey === null) { show(s); return; }
    const ls = scene(e.sceneId);
    postTransits(ls);
    if (!montageDay()) push(lineOf('narrator', e.lateLineKey, null, null));   // jour de montage : aucune ligne de scène
    show(ls);
  }

  /**
   * Jour de montage : l'étape jouée à la place de la joueuse, comme un humain (ruling R-COND.1) ; une étape présentée (`asks`) devient
   * un temps `choice` `card: true` et l'auto-jeu s'arrête jusqu'à `choose`.
   */
  function autoPlay(s: SceneSpec): void {
    const a = s.ask;
    if (a.kind === 'none') { leave(s, null, live(), true); return; }
    if (a.kind === 'route') { leave(s, routeNext(s, marks()).branch, live(), true); return; }
    const v = viewOf(s);
    if (a.kind === 'priced' && v === null) { leave(s, null, live(), true); return; }   // choix fermé : `ifUnavailable`, comme `present`
    const day = st().day;
    const pick = montagePick(g, day, posture, s.id);
    if (pick === 'ask') {
      presented = s;
      push({ kind: 'choice', sceneId: s.id, view: v!.view, priced: v!.priced, card: true });
      return;
    }
    const at = live();
    let r: ActResult;
    if (a.kind === 'narrative') r = posing(() => d.scene(s.id, pick));
    else if (!v!.priced) r = posing(() => d.choose(a.choiceId, pick));   // jalon
    else {
      const des = d.designate(a.choiceId, pick);
      if (!des.ok) throw new Error(`director : montage, ${a.choiceId}=${pick} non désignable (${des.reason})`);
      r = posing(() => d.confirm() ?? refused('choice', a.choiceId, pick, 'outOfOrder'));
    }
    if (!r.ok) throw new Error(`director : montage, ${s.id}=${pick} refusé (${r.rejected.reason})`);
    const effective = a.kind === 'priced' ? st().confirmed[`${day}.${a.choiceId}`] ?? pick : pick;   // voie effective (porte de midi)
    leave(s, effective, at, true);
  }

  /** Options ouvertes à la minute de SÉANCE : le moteur ne date l'état qu'aux actes, un jalon attendu ne viendrait jamais sinon. */
  const open = (choiceId: string): readonly string[] => availableOptions({ ...st(), clock: d.state().live.clock }, ctx, choiceId);

  function viewOf(s: SceneSpec): { readonly view: ChoiceView; readonly priced: boolean } | null {
    const a = s.ask;
    if (a.kind === 'narrative') {
      return { priced: false, view: { id: s.id, labelKey: a.promptKey, blocksExit: false, options: a.options.map((o) => ({ id: o.id, labelKey: o.labelKey, isRefusal: false, words: o.words })) } };
    }
    if (a.kind !== 'priced') return null;
    const ids = open(a.choiceId);
    if (ids.length === 0) return null;
    const c = street.choices.find((x) => x.id === a.choiceId);
    if (c === undefined) {
      return { priced: false, view: { id: a.choiceId, blocksExit: false, priced: false, labelKey: MILESTONE_KEY, options: [{ id: JALON_OPTION, labelKey: JALON_LABEL_KEY, isRefusal: false, words: 0 }] } };
    }
    // Mêmes clés et mêmes prix que `choiceViews` (street/runtime.ts), options filtrées par le moteur.
    const options = c.options.filter((o) => ids.includes(o.id)).map((o) => ({
      id: o.id, isRefusal: o.isRefusal, labelKey: `w10.choice.${c.id}.${o.id.replaceAll(':', '.')}`,
      words: c.id.startsWith(CHECKPOINT_PREFIX) ? checkpointWords(street.checkpoint.forcedWords, o.id) : o.words,
    }));
    return { priced: true, view: { id: c.id, blocksExit: c.blocksExit, labelKey: `w10.choice.${c.id}`, options } };
  }

  /** Présente l'étape : un choix à prix fermé suit `ifUnavailable` sans un seul temps (l'acteur n'apparaît pas) [ruling]. */
  function present(s: SceneSpec): void {
    const v = viewOf(s);
    if (s.ask.kind === 'priced' && v === null) { leave(s, null, live(), false); return; }
    presented = s;
    if (s.actor !== null) push(lineOf('narrator', s.actor.actionKey, null, null));
    const m = s.beats.some(isLinkedBeat) || s.ask.kind === 'route' ? marks() : [];
    for (const b of s.beats) {
      const key = resolveBeat(b, m);   // S1 : `null` = pas de réplique, pas de temps
      if (key !== null) push(lineOf(b.voice, key, b.voice === 'person' ? s.actor?.nameKey ?? null : null, b.lit));
    }
    if (v !== null) { push({ kind: 'choice', sceneId: s.id, view: v.view, priced: v.priced }); return; }
    // S2 : la branche est lue à la présentation (aucun acte ne vient avant la sortie), puis la route sort sans un temps de plus.
    const branch = s.ask.kind === 'route' ? routeNext(s, m).branch : null;
    after(() => leave(s, branch, live(), false));
  }

  /** Sortie de l'étape : attente si le moment est long ou en file, marche si le lieu change, puis l'étape suivante ou la nuit. */
  function leave(s: SceneSpec, option: string | null, actMinute: number, replayed: boolean): void {
    presented = null;   // hors étape jusqu'à la présentation de la suivante
    const l = leaveStep(g, s.id, option, live());
    if (l.next === NIGHT && st().ended !== null) { ending(); return; }   // l'audition a clos la semaine : ni transit, ni horloge, ni nuit
    d.skipTo(l.minute);
    const until = live();
    const long = (until - actMinute) * street.clock.msPerHour / 60 > PASSIVE_MS_MAX;
    if (!replayed && until > actMinute && (s.waitKind === 'queue' || long)) {
      push({ kind: 'wait', label: s.waitKind === 'queue' ? 'queue' : 'pass', fromMinute: actMinute, untilMinute: until });
    }
    if (montageDay()) { if (l.next === NIGHT) montageNight(); else enter(l.next); return; }   // auto-jeu : tout de suite, sans « Continuer »
    if (l.next === NIGHT) { after(night); return; }
    const next = scene(l.next);
    if (!replayed && next.place !== s.place) push({ kind: 'walk', from: s.place, to: next.place });
    after(() => enter(l.next));
  }

  function night(): void {
    presented = null;
    const day = st().day;
    if (location() === 'registre') transit('exit', 'registre');
    if (location() === 'street') transit('enter', 'home');
    d.skipTo(street.moments.eveningMinute);
    push({ kind: 'recap', day });
    after(() => {
      d.sleep();   // la ligne de droit née au réveil se dit au matin, sous la carte (`startDay`)
      push({ kind: 'night' });
      after(startDay);
    });
  }

  /** Nuit d'un jour de montage : sommeil sans relevé, puis la fin de la carte, puis les droits du jour (décision 13), puis le jour suivant. */
  function montageNight(): void {
    presented = null;
    const day = st().day;
    if (location() === 'registre') transit('exit', 'registre');
    if (location() === 'street') transit('enter', 'home');
    d.skipTo(street.moments.eveningMinute);
    const r = d.sleep();
    if (!r.ok) throw new Error(`director : montage, sommeil du jour ${day} refusé (${r.rejected.reason})`);
    const s = st();
    if (s.ended !== null) {
      const key = g.ending?.arrestedNightKey;
      if (key === undefined) throw new Error('director : arrestation de nuit sans guided.ending.arrestedNightKey');
      push({ kind: 'montageEnd', day, tail: { kind: 'arrested', key, day } });
    } else {
      const palier = s.readings.find((x) => x.day === day)?.palier;
      if (palier === undefined) throw new Error(`director : montage, aucun relevé pour la nuit ${day}`);
      push({ kind: 'montageEnd', day, tail: { kind: 'palier', palier } });
    }
    // Décision 13 : les droits dits ce jour, sinon le droit S3 du jour, la même règle que le relevé d'un jour joué (`said ?? days[].right`, `recap.ts`).
    const said = deferred.splice(0);
    const s3 = g.days.find((x) => x.day === day)?.right ?? null;
    for (const right of said.length > 0 ? said : s3 === null ? [] : [s3]) push({ kind: 'right', right });
    after(startDay);
  }

  /** Issue de l'audition, relevé du jour, fin [plan J3-J7 §5.1]. */
  function ending(): void {
    const s = st();
    const ended = s.ended!;
    const o = g.ending?.outcomes[ended.endId];
    if (o === undefined) throw new Error(`director : aucune issue « ${ended.endId} » dans guided.ending`);
    const nameKeys = givenNameKeys(marks(), s.day);   // R2 étendu à l'issue [N7, revue T13 I-3] : la ligne n1 dit le nom
    const names = nameKeys.length;
    push({ kind: 'outcome', endId: ended.endId, names, nameKeys, regimeKey: o.regimeKey, narratorKey: o.narratorKeys[String(Math.min(names, 2))] ?? null });
    push({ kind: 'recap', day: s.day });
    push({ kind: 'end', early: false, endedDay: ended.at.day });
  }

  /** Fin à l'ouverture d'un jour (arrestation dans la nuit, ou reprise d'une partie finie) : même lecture que `toBilanInput` (`bilan.ts`). */
  function endOf(): Beat {
    const s = st();
    const early = s.ended!.endId === EARLY_END_ID;
    const endedDay = early ? Math.max(...s.acts.filter((a) => a.kind === 'sleep').map((a) => a.day)) as DayIndex : s.ended!.at.day;
    return { kind: 'end', early, endedDay };
  }

  function startDay(): void {
    presented = null;
    const s = st();
    if (s.ended !== null) { push(endOf()); return; }   // avant `demoEnd` : une partie finie n'est jamais une fin de démo
    const spec = g.days.find((x) => x.day === s.day);
    const over = g.endOfDemo !== null && s.day > g.endOfDemo.afterDay;
    if (spec === undefined || over) { push({ kind: 'demoEnd' }); return; }
    if (spec.kind === 'montage' && spec.montage !== null) {
      const m = spec.montage;
      posture = postureOf(g, ctx, s.acts, s.day);
      const fact = g.chains.find((c) => c.fact.shownOn?.on === 'card' && c.fact.shownOn.day === s.day);
      const lm = m.lines.some(isLinkedBeat) ? marks() : [];
      const lineKeys = m.lines.map((b) => resolveBeat(b, lm)).filter((k): k is string => k !== null);
      push({ kind: 'montage', day: s.day, posture, lineKeys, postureKey: m.postureKeys[posture], factChainId: fact?.id ?? null });
      // Droit né au réveil : rendu après `montageEnd` (décision 13) ; à la reprise, déjà rendu.
      if (!s.acts.some((a) => a.day === s.day)) for (const [k, right] of Object.entries(s.rightLines)) if (k.startsWith(`${s.day}.`)) deferred.push(right);
      enter(spec.first);   // tout de suite, sans `after` (décision 5, I-2)
      return;
    }
    if (!s.acts.some((a) => a.day === s.day)) {
      push({ kind: 'card', day: s.day, goalKey: spec.goalKey });
      if (welcomeDue(ob, s.day, s.acts.length)) for (const l of ob.welcome.lines) push(lineOf(l.voice, l.key, null, l.lit));
      // Le moment du réveil peut porter sa ligne de droit avant tout acte (`createStreet`, `onSleep` : `withRight`).
      for (const [k, right] of Object.entries(s.rightLines)) if (k.startsWith(`${s.day}.`)) push({ kind: 'right', right });
    }
    after(() => enter(spec.first));
  }

  startDay();

  const refused = (kind: string, id: string, option: string, reason: 'outOfOrder' | 'unknownOption'): ActResult => {
    const act: ActRecord = { day: st().day, minute: live(), kind, id, option };
    return { ok: false, rejected: { act, reason } };
  };

  return {
    current() {
      const head = queue[0];
      if (head === undefined) throw new Error('director : aucun temps en file');
      return head.beat;
    },

    advance() {
      const head = queue[0];
      if (head === undefined || head.beat.kind === 'choice' || head.beat.kind === 'demoEnd' || head.beat.kind === 'end') return;
      queue.shift();
      head.then?.();
    },

    choose(optionId) {
      const head = queue[0];
      const s = presented;
      if (head === undefined || head.beat.kind !== 'choice' || s === null) return refused('choice', s?.id ?? '', optionId, 'outOfOrder');
      if (!head.beat.view.options.some((o) => o.id === optionId)) return refused('choice', head.beat.view.id, optionId, 'unknownOption');
      const a = s.ask;
      const at = live();
      let r: ActResult;
      if (a.kind === 'narrative') r = posing(() => d.scene(s.id, optionId));
      else if (a.kind === 'priced' && !head.beat.priced) r = posing(() => d.choose(a.choiceId, optionId));
      else {
        const des = st().designated;
        if (a.kind !== 'priced' || des === null || des.choiceId !== a.choiceId || des.optionId !== optionId) return refused('choice', head.beat.view.id, optionId, 'outOfOrder');
        r = posing(() => d.confirm() ?? refused('choice', a.choiceId, optionId, 'outOfOrder'));
      }
      if (!r.ok) return r;
      // `posing` a mis les temps `right` en fin de file, derrière le choix : on retire le choix, puis la réplique passe devant eux.
      queue.shift();
      const card = head.beat.card === true;   // carte de montage : ni réplique, ni marche, ni attente ; l'auto-jeu reprend
      const reply = a.kind === 'narrative' && !card ? a.options.find((o) => o.id === optionId)?.replyKey ?? null : null;
      if (reply !== null) queue.unshift({ beat: lineOf('me', reply, null, null), then: null });
      const effective = a.kind === 'priced' ? st().confirmed[`${st().day}.${a.choiceId}`] ?? optionId : optionId;   // voie effective (porte de midi)
      leave(s, effective, at, card);
      return r;
    },

    sceneId: () => (presented === null ? null : presented.id),
  };
}
