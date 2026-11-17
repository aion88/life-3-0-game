/**
 * Le metteur en scène [plan rue guidée J1-J2, T7 ; spec §4, §11.2, §11.7] : joué sur le pilote réel de w10 et un puits mémoire.
 * Les choix de `street.choices` passent par le `designate` du panneau (pilote nu), puis `dir.choose` ; le metteur en scène, lui, ne désigne jamais.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { pathsOf } from '../../../src/validate/guided';
import { replay } from '../../../src/engine/moments/replay';
import { availableOptions } from '../../../src/engine/moments/choices';
import { choiceViews } from '../../../src/street/runtime';
import type { BeatLine } from '../../../src/data/schema/guided';
import type { Beat } from '../../../src/street/guided/director';
import frJson from '../../../src/data/strings/fr.json';
import { ctxW10, diceStub } from '../../support/street';
import { nominalLaneMinutes } from '../../../src/engine/moments/schedule';
import {
  beats, chooseHere, directorRig, driverFrom, freeWalkJ1Acts, laneEnd, nominalLanes, obW10, playAllDefault, playAllDefaultDay1, playPath,
  playPicks, playUntil, playUntilChoice, playUntilQueue, rejectedOf, stepOnce, ctxW10DemoAfter, type DirectorRig,
} from '../../support/guided';

const ctx = ctxW10();
const g = ctx.street.guided!;
const FR = frJson as Record<string, string>;
let rig: DirectorRig;
beforeEach(() => { rig = directorRig(); });

const kinds = (bs: readonly Beat[]): readonly string[] => bs.map((b) => b.kind);
const lineKeys = (bs: readonly Beat[]): readonly string[] => bs.flatMap((b) => (b.kind === 'line' ? [b.key] : []));
const sceneOfChoices = (bs: readonly Beat[]): readonly string[] => bs.flatMap((b) => (b.kind === 'choice' ? [b.sceneId] : []));
/** Les temps qui suivent le courant, sans rien choisir (arrêt au prochain choix). */
const nextKinds = (r: DirectorRig): readonly string[] => kinds(beats(r, 12));

describe('metteur en scène guidé', () => {
  it('test_day_one_starts_at_home_with_card_then_kit_lines', () => {
    const b = beats(rig, 3);
    expect(b[0]).toEqual({ kind: 'card', day: 1, goalKey: g.days[0]!.goalKey });
    expect(b.slice(1).every((x) => x.kind === 'line' && x.lit !== null)).toBe(true);
    expect(rig.sink.saved).toEqual([]);
  });

  it('test_kit_lines_come_from_onboarding_only', () => {
    expect(g.scenes.find((s) => s.id === 'j1.wake')!.beats).toEqual([]);
    const b = beats(rig, 1 + obW10.welcome.lines.length + 2);
    expect(lineKeys(b.slice(1, 1 + obW10.welcome.lines.length))).toEqual(obW10.welcome.lines.map((l) => l.key));
    expect(b.at(-2)).toEqual({ kind: 'right', right: rig.drv.state().street.rightLines['1.lever'] });   // droit du réveil, avant tout acte
    expect(b.at(-1)).toMatchObject({ kind: 'choice', sceneId: 'j1.wake', priced: true, view: { id: 'j1.phone' } });
  });

  it('test_narrative_choice_writes_scene_act_and_walks_to_next_place', () => {
    playUntil(rig, 'j1.roux');
    expect(rig.dir.choose('silent')).toEqual({ ok: true });
    expect(rig.sink.saved.at(-1)).toMatchObject({ kind: 'scene', id: 'j1.roux', option: 'silent' });
    const silent = g.scenes.find((s) => s.id === 'j1.roux')!.ask;
    const reply = silent.kind === 'narrative' ? silent.options.find((o) => o.id === 'silent')!.replyKey : null;
    expect(rig.dir.current()).toEqual({ kind: 'line', voice: 'me', key: reply, speaker: null, lit: null });   // la réplique avant la suite
    expect(nextKinds(rig)).toContain('walk');
  });

  it('test_refused_transit_throws', () => {   // `enter registre` avant la voie : le moteur refuse, la faute de données se montre
    const scenes = g.scenes.map((x) => (x.id === 'j1.roux' ? { ...x, transit: [{ kind: 'enter' as const, id: 'registre' as const }] } : x));
    const street = { ...ctx.street, guided: { ...g, scenes } };
    const bad = directorRig([], ctxW10(street));
    expect(() => playUntil(bad, 'j1.roux')).toThrow(/transit enter registre refusé \(outOfOrder\)/);
  });

  it('test_scene_id_is_null_between_steps', () => {
    playUntil(rig, 'j1.roux');
    expect(rig.dir.sceneId()).toBe('j1.roux');
    rig.dir.choose('silent');
    const between: (string | null)[] = [];
    while (!(rig.dir.current().kind === 'line' && rig.dir.sceneId() === 'j1.marlene')) {   // réplique, marche : hors étape
      between.push(rig.dir.sceneId()); rig.dir.advance();
    }
    expect(between.length).toBeGreaterThan(0);
    expect(between.every((x) => x === null)).toBe(true);
    playAllDefaultDay1(rig);
    expect(rig.dir.sceneId()).toBeNull();   // le relevé n'est pas une étape
  });

  it('test_resume_after_scene_act_starts_next_scene', () => {
    const acts = playUntilChoice(rig, 'j1.roux', 'laugh');
    const again = driverFrom(acts);
    expect(again.dir.sceneId()).toBe('j1.marlene');
    expect(again.sink.saved).toEqual([]);
    expect(rejectedOf(again)).toEqual([]);
  });

  it('test_late_after_detour_plays_late_scene', () => {
    const seen = playPath(rig, { 'j1.street': 'scan', 'm1.scan': 'scan' }, (b) => b.kind === 'recap');
    expect(sceneOfChoices(seen)).not.toContain('j1.registre');
    expect(lineKeys(seen)).toContain(g.scenes.find((s) => s.id === 'j1.registre')!.late!.lineKey);
    expect(lineKeys(seen)).toContain((g.scenes.find((s) => s.id === 'j1.registre.late')!.beats[0]! as BeatLine).key);
    expect(rig.sink.saved.some((a) => a.id === 'm4.list')).toBe(false);
  });

  it('test_queue_skip_sets_clock_not_only_image', () => {
    playUntilQueue(rig);
    const n = rig.sink.saved.length;
    const lane = rig.sink.saved.at(-1)!;
    expect(lane).toMatchObject({ kind: 'lane', id: 'checkpoint' });
    expect(rig.dir.current()).toEqual({ kind: 'wait', label: 'queue', fromMinute: lane.minute, untilMinute: laneEnd(rig.drv) });
    expect(laneEnd(rig.drv)).toBeGreaterThan(lane.minute);
    rig.dir.advance();
    expect(rig.drv.state().live.clock.minute).toBe(laneEnd(rig.drv));
    expect(rig.sink.saved.length).toBe(n);
  });

  it('test_free_walk_save_resumes_at_first_unplayed_step', () => {
    const again = driverFrom(freeWalkJ1Acts);
    expect(again.dir.sceneId()).toBe('j1.roux');
    expect(again.dir.current()).not.toMatchObject({ kind: 'card' });
    expect(rejectedOf(again)).toEqual([]);
    const seen = playPath(again, {}, (b) => b.kind === 'recap');
    expect(sceneOfChoices(seen)).not.toContain('j1.wake');
    expect(sceneOfChoices(seen)).not.toContain('j1.checkpoint');   // la voie déjà passée n'est pas reproposée
    expect(sceneOfChoices(seen)).toContain('j1.registre');
    expect(rejectedOf(again)).toEqual([]);
  });

  it('test_right_line_beat_follows_the_act_that_meets_it', () => {
    const seen = playAllDefault(rig);
    // droits des jours écrits (J1 à J4 : `4.lever`, rester, montré au réveil du J4) ; un droit né après le dernier jour écrit n'a pas de scène où se montrer
    const written = Math.max(...g.days.map((d) => d.day));
    const lines = Object.entries(rig.drv.state().street.rightLines).filter(([k]) => Number(k.split('.')[0]) <= written).map(([, r]) => r);
    expect(lines.length).toBeGreaterThan(0);
    for (const r of lines) expect(seen).toContainEqual({ kind: 'right', right: r });
    expect(seen.filter((b) => b.kind === 'right')).toHaveLength(lines.length);
  });

  it('test_night_from_registre_exits_then_enters_home', () => {
    playAllDefaultDay1(rig);
    expect(rig.dir.current()).toEqual({ kind: 'recap', day: 1 });
    expect(rig.sink.saved.filter((a) => a.kind === 'exit' || a.kind === 'enter').slice(-2).map((a) => `${a.kind} ${a.id}`)).toEqual(['exit registre', 'enter home']);
    expect(rig.drv.state().live.clock.minute).toBe(ctx.street.moments.eveningMinute);
    expect(rig.sink.saved.some((a) => a.kind === 'sleep')).toBe(false);
    rig.dir.advance();   // « Continuer » du relevé : la nuit
    expect(rig.sink.saved.at(-1)).toMatchObject({ kind: 'sleep', day: 1, minute: ctx.street.moments.eveningMinute });
    expect(rig.dir.current()).toEqual({ kind: 'night' });
    rig.dir.advance();
    expect(rig.dir.current()).toEqual({ kind: 'card', day: 2, goalKey: g.days[1]!.goalKey });
  });

  it('test_agent_scene_skipped_when_component_hidden', () => {
    for (const option of ['hide', 'declare']) {
      const r = directorRig();
      const seen = playPath(r, { 'j2.component': option }, (b, x) => b.kind === 'recap' && x.drv.state().street.day === 2);
      const agent = g.scenes.find((s) => s.id === 'j2.agent')!;
      expect(r.sink.saved.some((a) => a.id === 'j2.agentReturn')).toBe(false);
      expect(r.dir.current().kind).toBe('recap');
      expect(sceneOfChoices(seen)).not.toContain('j2.agent');
      expect(lineKeys(seen)).not.toContain(agent.actor!.actionKey);   // « L'agent frappe à ta porte » jamais dit
      for (const b of agent.beats) expect(lineKeys(seen)).not.toContain((b as BeatLine).key);
    }
  });

  it('test_agent_comes_when_component_kept_and_action_line_precedes_choice', () => {
    const seen = playPath(rig, { 'j2.component': 'keep' }, (b) => b.kind === 'choice' && b.sceneId === 'j2.agent');
    const agent = g.scenes.find((s) => s.id === 'j2.agent')!;
    expect(rig.dir.current()).toMatchObject({ kind: 'choice', sceneId: 'j2.agent', priced: false, view: { id: 'j2.agentReturn', options: [{ id: 'go' }] } });
    expect(lineKeys(seen).slice(-1 - agent.beats.length)).toEqual([agent.actor!.actionKey, ...agent.beats.map((b) => (b as BeatLine).key)]);
    expect(rig.drv.state().live.clock.minute).toBe(agent.anchorMinute);
    expect(chooseHere(rig)).toBe('go');
    expect(rig.sink.saved.at(-1)).toMatchObject({ kind: 'choice', id: 'j2.agentReturn', option: 'go', minute: agent.anchorMinute });
  });

  // Fin de démo d'un monde partiel : w10 finit au J7 depuis T13 (`endOfDemo: null`), ces cas se jouent sur w10 arrêté après le J2.
  it('test_two_days_end_on_demo_end_never_replay', () => {
    rig = directorRig([], ctxW10DemoAfter(2));
    playAllDefault(rig);
    expect(rig.dir.current()).toEqual({ kind: 'demoEnd' });
    const n = rig.sink.saved.length;
    rig.dir.advance();
    expect(rig.dir.current()).toEqual({ kind: 'demoEnd' });
    expect(rig.dir.sceneId()).toBeNull();
    expect(rig.sink.saved.length).toBe(n);
    expect(rig.sink.saved.filter((a) => a.kind === 'sleep').map((a) => a.day)).toEqual(g.days.map((d) => d.day).filter((d) => d <= 2));   // une nuit par jour joué
    expect(directorRig(rig.sink.saved, ctxW10DemoAfter(2)).dir.current()).toEqual({ kind: 'demoEnd' });   // une reprise après la démo n'y rejoue rien
  });

  it('test_every_wait_is_skippable', () => {
    rig = directorRig([], ctxW10DemoAfter(2));
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const b = rig.dir.current();
      if (b.kind === 'demoEnd') break;
      const passive = b.kind === 'wait' || b.kind === 'walk' || b.kind === 'night';
      const n = rig.sink.saved.length;
      stepOnce(rig);
      if (!passive) continue;
      seen.add(b.kind);
      expect(rig.dir.current()).not.toEqual(b);   // un seul « Passer » quitte le temps : le courant n'est plus ce temps-là
      if (b.kind === 'wait') expect(rig.drv.state().live.clock.minute).toBeGreaterThanOrEqual(b.untilMinute);
      if (b.kind === 'wait' && b.label === 'queue') expect(rig.sink.saved.length).toBe(n);   // la file ne pose rien ; un « Passer » qui mène à la nuit pose ses transits
    }
    expect([...seen].sort()).toEqual(['night', 'wait', 'walk']);   // spec §4.3 : « Passer » aussi sur la nuit
  });

  it('test_long_passive_step_gets_a_pass_wait', () => {
    const seen = playAllDefaultDay1(rig);
    const relecture = g.scenes.find((s) => s.id === 'j1.relecture')!;
    expect(seen).toContainEqual(expect.objectContaining({ kind: 'wait', label: 'pass', untilMinute: relecture.anchorMinute + relecture.costMin }));
    expect(seen.filter((b) => b.kind === 'wait' && b.label === 'pass').every((b) => b.kind === 'wait' && (b.untilMinute - b.fromMinute) * ctx.street.clock.msPerHour / 60 > 3000)).toBe(true);
  });

  it('test_priced_view_is_the_panel_view_filtered_by_available_options', () => {
    rig = directorRig([], ctxW10DemoAfter(2));
    const has = (k: string): boolean => (FR[k] ?? '') !== '';
    for (let i = 0; i < 2000; i++) {
      const b = rig.dir.current();
      if (b.kind === 'demoEnd') break;
      if (b.kind === 'choice' && b.sceneId !== b.view.id) {
        const st = rig.drv.state();
        const panel = choiceViews([b.view.id], ctx, { has })[0]!;
        const open = availableOptions({ ...st.street, clock: st.live.clock }, ctx, b.view.id);
        expect(b.view).toEqual({ ...panel, options: panel.options.filter((o) => open.includes(o.id)) });
      }
      stepOnce(rig);
    }
  });

  it('test_director_acts_equal_pathsOf_acts', () => {   // concordance T4 / T7 [ruling] : une seule source des ancres, coûts, `late` et files
    let n = 0, dice = 0, superset = 0;
    const refused: Record<string, number> = {};
    for (const p of pathsOf(ctx.street, 2)) {
      const no = replay(p.acts, ctx).rejected[0];
      if (no !== undefined) { const k = `${no.act.id} ${no.act.option} ${no.reason}`; refused[k] = (refused[k] ?? 0) + 1; continue; }
      if (!nominalLanes(p, ctx)) { dice++; continue; }   // patrouille tirée ou porte fermée : vérifié contre l'horloge vive plus bas
      const played = playPicks(directorRig(), p);
      if (played === null) { superset++; continue; }    // `ifUnavailable` pris là où le jalon est dû : chemin du sur-ensemble, jamais joué
      n++;
      expect(played.acts).toEqual(p.acts);
    }
    // N7 [mesuré] : 6 210 chemins, 4 176 joués à l'identique, aucun du sur-ensemble `ifUnavailable` (le jalon lit `requires`, 846 avant),
    // dé à 0. Les 2 034 refus restants sont tous des voies du contrôle fermées par l'état (bons, composant, palier), que la preuve ne porte
    // pas (`pricedOpen`). Avant N7 : 9 018 chemins, 6 534 refusés, 846 du sur-ensemble, 1 638 à l'identique.
    expect({ n, dice, superset }).toEqual({ n: 4176, dice: 0, superset: 0 });
    expect(refused).toEqual({ 'checkpoint buy:bons bonsInsufficient': 1008, 'checkpoint buy:component unknownOption': 666, 'checkpoint courtesy unknownOption': 360 });
  });

  it('test_dice_lane_paths_follow_the_live_clock', () => {   // [ruling] chemins hors concordance : la patrouille tirée dure ce que le moteur dit
    const patrol = ctxW10(ctx.street, diceStub([0.999]));      // dernier seau du tirage de contournement : la patrouille
    let n = 0;
    for (const p of pathsOf(ctx.street, 2)) {
      // chemins acceptés aux minutes nominales qui contournent : sous patrouille, leurs minutes écrites ne tiennent plus
      if (replay(p.acts, ctx).rejected.length > 0 || !p.acts.some((a) => a.kind === 'lane' && a.option === 'bypass')) continue;
      expect(nominalLanes(p, patrol)).toBe(false);
      const r = directorRig([], patrol);
      const played = playPicks(r, p);
      if (played === null) continue;
      n++;
      expect(rejectedOf(r)).toEqual([]);
      for (const [i, a] of played.acts.entries()) {
        if (a.kind !== 'lane' || a.option !== 'bypass') continue;
        const end = replay(played.acts.slice(0, i + 1), patrol).state.clock.minute;
        expect(end).toBeGreaterThan(a.minute + nominalLaneMinutes(ctx.street, a.option!));   // la patrouille, pas la minute nominale
        const next = played.acts[i + 1]!;
        expect(next.minute).toBeGreaterThanOrEqual(end);                                      // l'étape suivante part de l'horloge vive
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it('test_director_never_designates', () => {
    playAllDefault(rig);
    expect(rig.calls.filter((c) => c === 'designate')).toEqual([]);
    expect(rig.calls).toContain('confirm');
    expect(rig.calls).toContain('scene');
    expect(rig.calls).toContain('sleep');
  });

  it('test_choose_off_choice_or_undesignated_is_refused_and_writes_nothing', () => {
    expect(rig.dir.choose('take')).toMatchObject({ ok: false, rejected: { reason: 'outOfOrder' } });   // la carte, pas un choix
    playUntil(rig, 'j1.wake');
    expect(rig.dir.choose('take')).toMatchObject({ ok: false });                                          // rien n'est désigné
    rig.drv.designate('j1.phone', 'leave');
    expect(rig.dir.choose('take')).toMatchObject({ ok: false });                                          // désigné autre chose
    expect(rig.sink.saved).toEqual([]);
    expect(rig.dir.current()).toMatchObject({ kind: 'choice', sceneId: 'j1.wake' });
  });
});
