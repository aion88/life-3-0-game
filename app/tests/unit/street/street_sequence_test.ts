import { describe, expect, it } from 'vitest';
import { blockedPoint, createSequencer, effectEntries, parseSequences, SEQ_TRANSITIONS, type SequenceTable } from '../../../src/engine/view/sequence';
import { queueBlockers, stepQueue, type QueueState } from '../../../src/engine/view/crowd';
import { barrierBlockers, solidBlockers, stepWalk, streetBounds, type Blocker } from '../../../src/engine/view/walk';
import type { Vec2 } from '../../../src/engine/moments/types';
import { DataLoadError } from '../../../src/data/schema/common';
import seqRaw from '../../../src/street/data/w10.sequences.json';
import { readFileSync } from 'node:fs';
import { FR, EN } from '../../support/street_ui';
import { day1State, S, SCENE, WALK } from '../../support/street_walk';
import { ctxW10 } from '../../support/street';

/**
 * Moteur des séquences jouées : verrou d'entrée, passage d'un clic, ordre séquence puis acte, données du premier cas (`checkpoint.j1`).
 * Les tests de marche rejouent la boucle de `runtime.ts` (pas de 50 ms, `stepWalk` avec les obstacles de la rue).
 */
const has = (k: string): boolean => k in FR && k in EN;
const TABLE: SequenceTable = parseSequences(seqRaw, SCENE, S, has);
const STOP = (WALK.speedMps.v * WALK.maxDtMs.v) / 1000;
const DT = WALK.maxDtMs.v;
const J1 = TABLE.sequences['checkpoint.j1']!;
const OPTIONS = S.choices.find((c) => c.id === 'checkpoint.j1')!.options.map((o) => o.id);
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
const START: Vec2 = { x: 0, z: -5 };   // à la lisière de la zone du choix : rayon 7,5 m autour de z -12, soit z -4,5 sur l'axe

/** La file telle que la boucle la porte (`stepQueue`, place réservée au joueur) : `permille` = avance de la file. */
interface Sim { queue: QueueState | null; permille: number }
const sim = (permille = 0): Sim => ({ queue: null, permille });

/** Une image de la boucle de `runtime.ts` : obstacles selon le bras (levé : ni segment de barrière ni solide du bras), VOISINS DE LA FILE compris, marche dirigée, saut. */
function frame(seq: ReturnType<typeof createSequencer>, player: Vec2, w: Sim = sim()): { player: Vec2; ended: boolean; hopped: boolean; blockers: readonly Blocker[] } {
  w.queue ??= stepQueue(SCENE, null, w.permille, player, 0);          // la file existe avant la première image de la séquence
  const up = seq.cueState().barrierUp;
  const blockers: Blocker[] = [...(up ? [] : barrierBlockers(null, SCENE)), ...streetBounds(SCENE), ...solidBlockers(SCENE, !up)];
  if (w.queue !== null) blockers.push(...queueBlockers(SCENE, w.queue.zs, player));
  const out = seq.step(DT, player, STOP, blockers);
  if (out.ended) return { player, ended: true, hopped: false, blockers };
  const walked = stepWalk(player, { keys: new Set(), dtMs: DT, ...(out.dir === null ? {} : { dir: out.dir }) }, WALK, blockers);
  const next = out.teleport ?? walked.pos;
  w.queue = stepQueue(SCENE, w.queue, w.permille, next, DT);
  return { player: next, ended: false, hopped: out.teleport !== null, blockers };
}

/** Une séquence jouée du début à la fin, image par image ; rend la trace de l'acte et la position finale. */
function play(choice: string, option: string, start: Vec2, w: Sim = sim()) {
  const seq = createSequencer(TABLE);
  const log: string[] = [];
  let player = start, finalSeen: Vec2 | null = null, frames = 0, moved = 0;
  const spec = seq.begin(choice, option, (final) => { log.push(`acte:${seq.phase()}`); finalSeen = final; player = final; });
  expect(spec).not.toBeNull();
  log.push('debut');
  while (seq.active() && frames < 2000) {
    const f = frame(seq, player, w);
    frames++;
    if (f.ended) break;
    moved += f.hopped ? 0 : dist(player, f.player);
    player = f.player;
  }
  return { log, player, finalSeen: finalSeen as Vec2 | null, frames, moved, seq, spec: spec! };
}

describe('sequence : données de checkpoint.j1', () => {
  it('test_every_option_of_checkpoint_j1_has_a_sequence', () => { expect(Object.keys(J1).sort()).toEqual([...OPTIONS].sort()); });

  it('test_durations_within_the_decided_bounds_3_to_8_s', () => {
    expect(TABLE.limits).toMatchObject({ minS: 3, maxS: 8 });
    for (const [o, s] of Object.entries(J1)) { expect(s.durationS, o).toBeGreaterThanOrEqual(3); expect(s.durationS, o).toBeLessThanOrEqual(8); }
  });

  it('test_every_anchor_is_in_the_street_and_clear_of_solids', () => {
    const solids = solidBlockers(SCENE);
    for (const [id, a] of Object.entries(TABLE.anchors)) expect(blockedPoint(a, solids, SCENE), id).toBe(false);
  });

  it('test_every_narration_key_exists_in_both_languages', () => { for (const [o, s] of Object.entries(J1)) { expect(FR[s.narrationKey], o).toBeTruthy(); expect(EN[s.narrationKey], o).toBeTruthy(); } });

  it('test_each_option_ends_on_its_target_after_its_duration_from_the_zone_edge', () => {
    for (const [o, s] of Object.entries(J1)) {
      const r = play('checkpoint.j1', o, START);
      const target = TABLE.anchors[s.target]!;
      // la marche finit avant la durée : la séquence ne se termine pas sur un téléport
      expect(r.frames * DT / 1000, `${o} : marche finie avant la fin`).toBeGreaterThanOrEqual(s.durationS - DT / 1000);
      expect(r.moved, `${o} : le personnage a marché`).toBeGreaterThan(1);
      expect(dist(r.finalSeen!, target), o).toBe(0);
    }
  });

  it('test_walk_reaches_every_point_of_the_path_on_foot_and_the_target_before_the_end', () => {
    for (const [o, spec] of Object.entries(J1)) {
      const seq = createSequencer(TABLE);
      const stops = [...(spec.path ?? []).map((l) => l.to), ...(spec.hop === undefined ? [spec.target] : [])];   // avec un saut, la cible n'est pas marchée
      const reached = new Set<string>();
      let player = START, elapsed = 0, hopAt: number | null = null, targetAt: number | null = null;
      const cuts: number[] = [];                                                          // les téléportations : la coupe d'entrée (tôt) et le saut (à sa date)
      seq.begin('checkpoint.j1', o, () => undefined);
      for (let i = 0; i < 400 && seq.active(); i++) {
        const f = frame(seq, player); elapsed += DT;
        if (f.ended) break;
        player = f.player;
        if (f.hopped) { cuts.push(elapsed); if (spec.hop !== undefined && elapsed > 1000) hopAt = elapsed; }
        for (const id of stops) if (dist(player, TABLE.anchors[id]!) <= STOP) reached.add(id);
        if (targetAt === null && dist(player, TABLE.anchors[spec.target]!) <= STOP) targetAt = elapsed;
      }
      expect([...reached].sort(), `${o} : points de passage atteints à pied`).toEqual([...new Set(stops)].sort());
      expect(targetAt, `${o} : cible atteinte`).not.toBeNull();
      expect(targetAt!, `${o} : avant la fin`).toBeLessThan(spec.durationS * 1000);
      if (spec.hop !== undefined) expect(hopAt, `${o} : le saut a lieu à sa date`).toBeCloseTo(spec.hop.atS * 1000, -2);
      else expect(hopAt, `${o} : aucun saut`).toBeNull();
      expect(cuts.filter((c) => c <= 1000).length, `${o} : au plus une coupe d'entrée, dans la première seconde`).toBeLessThanOrEqual(1);
    }
  });
});

describe('sequence : la fin naturelle ne téléporte pas', () => {
  /** Points de départ de la zone du choix (rayon 7,5 m autour de z -12), côté rue, hors décor plein : la joueuse peut confirmer de n'importe où. */
  const zone = SCENE.interactions['wall']!.at.v;
  const STARTS: Vec2[] = [];
  for (const x of [-6, -4, -2, 0, 0.75, 2, 4.5, 6]) for (const z of [-10, -8, -6, -5]) {
    const p = { x, z };
    if (dist(p, zone) <= 7.5 && !blockedPoint(p, [...solidBlockers(SCENE), ...barrierBlockers(null, SCENE)], SCENE)) STARTS.push(p);
  }

  it('test_every_option_reaches_its_target_on_foot_from_every_start_of_the_zone_with_the_queue_in_the_way', () => {
    expect(STARTS.length).toBeGreaterThan(15);
    for (const permille of [0, 1000]) for (const [o, spec] of Object.entries(J1)) for (const start of STARTS) {
      const r = play('checkpoint.j1', o, start, sim(permille));
      expect(dist(r.finalSeen!, TABLE.anchors[spec.target]!), `${o} depuis (${start.x} ; ${start.z}), file ${permille} : fin sur la cible`).toBeLessThanOrEqual(STOP);
      expect(dist(r.player, TABLE.anchors[spec.target]!), `${o} depuis (${start.x} ; ${start.z}) : la joueuse est sur la cible, pas posée par la fin`).toBeLessThanOrEqual(STOP);
    }
  });

  it('test_when_the_walk_is_blocked_the_natural_end_leaves_the_player_where_she_got_not_on_the_target', () => {
    const seq = createSequencer(TABLE);
    let final: Vec2 | null = null;
    seq.begin('checkpoint.j1', 'refuse', (f) => { final = f; });
    const stuck: Vec2 = { x: 0.75, z: -9.6 };                         // un point que la marche n'a pas quitté (aucun pas rendu à `step`)
    seq.step(J1['refuse']!.durationS * 1000, stuck, STOP);
    expect(final).toEqual(stuck);                                      // fin naturelle : là où elle est, jamais posée sur l'étal
    const skipped = createSequencer(TABLE); let f2: Vec2 | null = null;
    skipped.begin('checkpoint.j1', 'refuse', (f) => { f2 = f; });
    skipped.skip();
    expect(f2).toEqual(TABLE.anchors['anchor.stall.front']);           // un clic pose l'état final
  });

  it('test_reduced_motion_never_walks_and_fades_to_the_final_position', () => {
    for (const [o, spec] of Object.entries(J1)) {
      const seq = createSequencer(TABLE);
      const played = seq.begin('checkpoint.j1', o, () => undefined, [], { reduced: true })!;
      expect(played.hop, o).toBeDefined();
      let player = START, steps = 0, hopped = false, maxFade = 0;
      for (let i = 0; i < 400 && seq.active(); i++) {
        const out = seq.step(DT, player, STOP);
        if (out.dir !== null) steps++;
        maxFade = Math.max(maxFade, seq.fade());
        if (out.teleport !== null) { hopped = true; player = out.teleport; }
      }
      expect(steps, `${o} : aucune marche`).toBe(0);
      expect(hopped, `${o} : le fondu pose la joueuse`).toBe(true);
      expect(player, o).toEqual(TABLE.anchors[spec.target]);
      expect(maxFade, `${o} : le fondu est visible`).toBeGreaterThan(0.9);
    }
  });

  it('test_teardown_mid_sequence_applies_the_act_once_then_nothing_more', () => {
    const seq = createSequencer(TABLE); const log: string[] = [];
    seq.begin('checkpoint.j1', 'bypass', () => { log.push('acte'); });
    seq.step(500, START, STOP);
    if (seq.active()) seq.skip();                                       // le démontage de `runtime.ts` : skip si la séquence joue
    if (seq.active()) seq.skip();
    expect(log).toEqual(['acte']);
  });
});

describe('sequence : indice laissé par la variante informant, second battement, nombres en données', () => {
  const INFORMANT = ['bribe', 'informant'];
  const inZone = SCENE.interactions['wall']!.at.v;
  const ended = (day?: number) => { const q = createSequencer(TABLE); q.begin('checkpoint.j1', 'buy:bons', () => undefined, INFORMANT, day === undefined ? {} : { day }); q.skip(); return q; };

  it('test_informant_clue_stays_in_the_post_zone_and_clears_when_the_player_leaves_it', () => {
    const q = ended(1);
    expect(q.cueState()).toEqual({ slit: 'lit', face: true, barrierUp: false });
    q.settle({ x: 5.2, z: -12.4 }, 1);                                              // là où la séquence l'a laissée : dans la zone
    expect(q.cueState().face).toBe(true);
    const z = TABLE.limits.lingerZone;
    q.settle({ x: z.center.x, z: z.center.z + z.radiusM - 0.1 }, 1);                // au bord, dedans
    expect(q.cueState().face).toBe(true);
    q.settle({ x: z.center.x, z: z.center.z + z.radiusM + 0.1 }, 1);                // un pas dehors
    expect(q.cueState()).toEqual({ slit: 'idle', face: false, barrierUp: false });
    q.settle(inZone, 1);
    expect(q.cueState().face, "l'indice effacé ne revient pas en rentrant").toBe(false);
  });

  it('test_informant_clue_clears_when_the_day_changes_even_if_the_player_never_left', () => {
    const q = ended(3);
    q.settle(inZone, 3);
    expect(q.cueState().face).toBe(true);
    q.settle(inZone, 4);                                                            // la nuit est passée
    expect(q.cueState()).toEqual({ slit: 'idle', face: false, barrierUp: false });
  });

  it('test_a_new_sequence_starts_clean_and_settle_does_nothing_while_playing', () => {
    const q = ended(1);
    q.settle({ x: 0, z: 30 }, 1);
    q.begin('checkpoint.j1', 'buy:bons', () => undefined, INFORMANT, { day: 2 });
    q.step(2000, START, STOP);
    q.settle({ x: 0, z: 30 }, 9);                                                   // pendant la séquence : ignoré
    expect(q.cueState().face).toBe(true);
  });

  it('test_informant_second_pulse_is_minus_six_medium_half_a_second_after_the_first_and_once', () => {
    const q = createSequencer(TABLE);
    const spec = q.begin('checkpoint.j1', 'buy:bons', () => undefined, INFORMANT)!;
    expect(spec.secondPulse).toEqual({ atS: 0.5, dossierPulse: -1, pulseWeight: 'medium' });
    expect(spec.dossierPulse).toBe(-1);                                              // le premier battement : -4 de l'achat
    expect(q.takeSecondPulse()).toBeNull();
    q.step(400, START, STOP);
    expect(q.takeSecondPulse()).toBeNull();
    q.step(150, START, STOP);
    expect(q.takeSecondPulse()).toEqual({ dir: -1, weight: 'medium' });
    expect(q.takeSecondPulse()).toBeNull();                                          // une seule fois
    const plain = createSequencer(TABLE); plain.begin('checkpoint.j1', 'buy:bons', () => undefined, ['bribe']); plain.step(2000, START, STOP);
    expect(plain.takeSecondPulse(), 'sans informateur : un seul battement').toBeNull();
  });

  it('test_numbers_the_engine_and_the_runtime_use_come_from_the_data', () => {
    expect(TABLE.limits).toMatchObject({ crossSampleM: 0.1, reducedHopShare: 0.4, reducedFadeS: 0.8, reducedFadeShare: 0.2, widenEpsilon: 0.0001, widenHeightShare: 0.5 });
    const seq = readFileSync(`${process.cwd()}/src/engine/view/sequence.ts`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const rt = readFileSync(`${process.cwd()}/src/street/runtime.ts`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(seq, 'sequence.ts : pas de pas ni de part de fondu en dur').not.toMatch(/\/ 0\.1\b|\* 0\.4\b|\* 0\.2\b|Math\.min\(0\.8/);
    expect(rt, 'runtime.ts : ni seuil ni part d élargissement en dur').not.toMatch(/1\.0001|\(widenNow - 1\) \/ 2/);
  });

  it('test_limits_refuse_a_zero_sample_step', () => {
    const raw = JSON.parse(JSON.stringify(seqRaw)) as typeof seqRaw;
    raw.limits.crossSampleM.v = 0;
    expect(() => parseSequences(raw, SCENE, S, has)).toThrow(DataLoadError);
  });
});

describe('sequence : machine à états, verrou, passage, ordre', () => {
  it('test_table_of_transitions_is_closed', () => {
    expect(SEQ_TRANSITIONS).toEqual({ idle: ['playing'], playing: ['ended'], ended: ['idle', 'playing'] });
  });

  it('test_begin_locks_input_until_the_end', () => {
    const seq = createSequencer(TABLE);
    expect(seq.active()).toBe(false);
    seq.begin('checkpoint.j1', 'bypass', () => undefined);
    expect(seq.active()).toBe(true);
    seq.step(1000, START, STOP);
    expect(seq.active()).toBe(true);
    seq.step(J1['bypass']!.durationS * 1000, START, STOP);
    expect(seq.active()).toBe(false);
    expect(seq.phase()).toBe('ended');
  });

  it('test_a_choice_without_sequence_does_not_lock_and_returns_null', () => {
    const seq = createSequencer(TABLE);
    expect(seq.begin('door.noon', 'x', () => undefined)).toBeNull();
    expect(seq.begin('checkpoint.j1', 'inconnue', () => undefined)).toBeNull();
    expect(seq.active()).toBe(false);
  });

  it('test_order_is_sequence_then_act_exactly_once', () => {
    const r = play('checkpoint.j1', 'comply', START);
    expect(r.log).toEqual(['debut', 'acte:ended']);                  // l'acte est appliqué quand la séquence est déjà terminée
    expect(r.frames * DT).toBeGreaterThanOrEqual(r.spec.durationS * 1000 - DT);
    r.seq.step(DT, r.player, STOP); r.seq.skip();
    expect(r.log).toEqual(['debut', 'acte:ended']);                  // ni un second pas ni un passage tardif ne rejouent l'acte
  });

  it('test_skip_jumps_to_the_final_state_then_applies_the_act_once', () => {
    const seq = createSequencer(TABLE);
    const log: string[] = [];
    seq.begin('checkpoint.j1', 'bypass', (f) => { log.push(`acte@${f.x},${f.z}:${seq.phase()}`); });
    seq.step(500, START, STOP);
    expect(log).toEqual([]);                                         // rien avant la fin
    expect(seq.skip()).toBe(true);
    const t = TABLE.anchors[J1['bypass']!.target]!;
    expect(log).toEqual([`acte@${t.x},${t.z}:ended`]);
    expect(seq.skip()).toBe(false);
    expect(log).toHaveLength(1);
    expect(seq.active()).toBe(false);
  });

  it('test_skip_outside_a_sequence_does_nothing', () => { expect(createSequencer(TABLE).skip()).toBe(false); });

  it('test_a_second_begin_during_a_sequence_is_refused', () => {
    const seq = createSequencer(TABLE);
    seq.begin('checkpoint.j1', 'comply', () => undefined);
    expect(seq.begin('checkpoint.j1', 'bypass', () => undefined)).toBeNull();
    expect(seq.current()!.narrationKey).toBe(J1['comply']!.narrationKey);
  });

  it('test_a_new_sequence_can_start_after_the_end', () => {
    const seq = createSequencer(TABLE);
    seq.begin('checkpoint.j1', 'comply', () => undefined); seq.skip();
    expect(seq.begin('checkpoint.j1', 'refuse', () => undefined)).not.toBeNull();
    expect(seq.active()).toBe(true);
  });

  it('test_walk_never_enters_a_solid_and_crosses_the_barrier_line_only_with_the_arm_up_or_after_the_hop', () => {
    for (const o of OPTIONS) {
      const seq = createSequencer(TABLE);
      let player = START, hopped = false, crossed = false, before = START;
      seq.begin('checkpoint.j1', o, () => undefined);
      for (let i = 0; i < 400 && seq.active(); i++) {
        const up = seq.cueState().barrierUp;
        const f = frame(seq, player);
        if (f.ended) break;
        before = player; player = f.player; hopped ||= f.hopped;
        expect(blockedPoint(player, f.blockers.filter((b) => b.kind === 'box'), SCENE), `${o} image ${i}`).toBe(false);
        const wallZ = SCENE.interactions['wall']!.at.v.z;
        if (before.z > wallZ && player.z <= wallZ) { crossed = true; expect(up || hopped, `${o} : franchit la ligne de la barrière, bras levé ou après le saut`).toBe(true); }
      }
      if (['comply', 'courtesy', 'buy:bons', 'buy:permission', 'buy:component'].includes(o)) expect(crossed, `${o} : passe la barrière`).toBe(true);
    }
  });

  it('test_cues_set_the_scene_in_order_and_the_end_plays_them_all', () => {
    const seq = createSequencer(TABLE);
    expect(seq.cueState()).toEqual({ slit: 'idle', face: false, barrierUp: false });
    seq.begin('checkpoint.j1', 'comply', () => undefined, []);
    seq.step(2000, START, STOP);
    expect(seq.cueState()).toEqual({ slit: 'lit', face: true, barrierUp: false });          // la fente s'allume, le visage paraît
    seq.step(1500, START, STOP);
    expect(seq.cueState()).toEqual({ slit: 'lit', face: false, barrierUp: true });          // le visage part, le bras se lève
    seq.skip();
    expect(seq.cueState()).toEqual({ slit: 'idle', face: false, barrierUp: false });        // état final : tout est rejoué, bras redescendu
  });

  it('test_found7_lights_the_slit_red_and_the_informant_keeps_slit_and_face', () => {
    const state = (o: string, e: readonly string[]) => { const q = createSequencer(TABLE); q.begin('checkpoint.j1', o, () => undefined, e); q.skip(); return q.cueState(); };
    expect(state('comply', ['found7']).slit).toBe('idle');
    const mid = createSequencer(TABLE); mid.begin('checkpoint.j1', 'comply', () => undefined, ['found7']); mid.step(2000, START, STOP);
    expect(mid.cueState().slit).toBe('red');
    expect(state('buy:bons', ['bribe', 'informant'])).toEqual({ slit: 'lit', face: true, barrierUp: false });   // l'indice reste après la fin
    expect(state('buy:bons', ['bribe'])).toEqual({ slit: 'idle', face: false, barrierUp: false });
  });

  it('test_hop_fades_to_black_around_its_date_and_lands_on_the_target', () => {
    const seq = createSequencer(TABLE);
    seq.begin('checkpoint.j1', 'bypass', () => undefined, []);
    const hop = J1['bypass']!.hop!;
    seq.step(hop.atS * 1000 - 100, START, STOP);
    expect(seq.fade()).toBeGreaterThan(0.5);                                    // au creux du fondu juste avant le saut
    const out = seq.step(100, START, STOP);
    expect(out.teleport).toEqual(TABLE.anchors['anchor.bypass.out']);
    expect(seq.step(DT, START, STOP).teleport).toBeNull();                       // une seule fois
    seq.step(hop.fadeS * 1000, START, STOP);
    expect(seq.fade()).toBe(0);
  });

  it('test_camera_widens_during_the_sequence_only', () => {
    const seq = createSequencer(TABLE);
    expect(seq.widen()).toBe(1);
    seq.begin('checkpoint.j1', 'comply', () => undefined, []);
    expect(seq.widen()).toBeGreaterThan(1);
    seq.skip();
    expect(seq.widen()).toBe(1);
  });

  it('test_reaction_turns_the_queue_head_toward_the_player_after_its_delay', () => {
    const seq = createSequencer(TABLE);
    seq.begin('checkpoint.j1', 'comply', () => undefined);
    const head = { id: 'queue.0', pos: { x: 0.75, z: -10.1 }, heading: 0 };
    expect(seq.react(head, { x: 0, z: -4 })).toBeNull();            // avant le délai
    expect(seq.react({ ...head, id: 'queue.1' }, { x: 0, z: -4 })).toBeNull();   // une autre personne
    seq.step(2000, START, STOP);
    const r = seq.react(head, { x: 0, z: -4 })!;
    expect(r.heading).toBeCloseTo(Math.atan2(-0.75, -6.1), 5);        // vers la joueuse : dx -0,75, dz +6,1, cap = atan2(dx, -dz)
    expect(r.pos).toEqual(head.pos);
  });

  it('test_reaction_away_turns_the_back_and_stops_when_the_sequence_ends', () => {
    const seq = createSequencer(TABLE);
    seq.begin('checkpoint.j1', 'buy:bons', () => undefined);
    seq.step(2000, START, STOP);
    const head = { id: 'queue.0', pos: { x: 0.75, z: -10.1 }, heading: 0 };
    expect(seq.react(head, { x: 0, z: -4 })!.heading).toBeCloseTo(Math.atan2(-0.75, -6.1) + Math.PI, 5);   // « personne ne te regarde »
    seq.skip();
    expect(seq.react(head, { x: 0, z: -4 })).toBeNull();
  });
});

describe('sequence : variantes choisies par l\'effet réel de l\'acte [GDD §0]', () => {
  const pick = (option: string, entries: readonly string[]) => { const q = createSequencer(TABLE); const s = q.begin('checkpoint.j1', option, () => undefined, entries)!; return { key: s.narrationKey, pulse: s.dossierPulse, hasVariants: 'variants' in s }; };

  it('test_bypass_says_what_the_draw_gave_free_nacelle_or_patrol', () => {
    expect(pick('bypass', [])).toEqual({ key: 'w10.seq.checkpoint.bypass.free', pulse: 0, hasVariants: false });          // libre : aucune pulsation
    expect(pick('bypass', ['bypassNacelle'])).toEqual({ key: 'w10.seq.checkpoint.bypass.nacelle', pulse: -1, hasVariants: false });
    expect(pick('bypass', ['patrol'])).toEqual({ key: 'w10.seq.checkpoint.bypass.patrol', pulse: -1, hasVariants: false });
  });

  it('test_comply_is_clean_without_the_component_and_found7_with_it', () => {
    expect(pick('comply', [])).toMatchObject({ key: 'w10.seq.checkpoint.comply', pulse: 0 });
    expect(pick('comply', ['found7'])).toMatchObject({ key: 'w10.seq.checkpoint.comply.found7', pulse: -1 });
    expect(pick('courtesy', ['found7'])).toMatchObject({ key: 'w10.seq.checkpoint.comply.found7', pulse: -1 });
  });

  it('test_buy_pulses_down_and_the_informant_changes_the_line', () => {
    expect(pick('buy:bons', ['bribe'])).toMatchObject({ key: 'w10.seq.checkpoint.buy', pulse: -1 });
    expect(pick('buy:bons', ['bribe', 'informant'])).toMatchObject({ key: 'w10.seq.checkpoint.buy.informant', pulse: -1 });
  });

  it('test_pulse_weights_follow_the_gdd_table_1_6', () => {
    const w = (o: string, e: readonly string[]) => { const q = createSequencer(TABLE); return q.begin('checkpoint.j1', o, () => undefined, e)!.pulseWeight; };
    expect(w('comply', ['found7'])).toBe('strong');           // -10
    expect(w('bypass', ['bypassNacelle'])).toBe('low');       // -3
    expect(w('bypass', ['patrol'])).toBe('strong');           // -8
    expect(w('buy:bons', ['bribe'])).toBe('medium');          // -4
    expect(w('refuse', ['absentRegistre'])).toBe('medium');   // -4
  });

  it('test_every_variant_name_is_an_entry_the_engine_can_write', () => {
    const ids = new Set(Object.keys((ctxW10().world.survival as unknown as { entries: Record<string, unknown> }).entries));
    for (const [o, spec] of Object.entries(J1)) for (const v of Object.keys(spec.variants ?? {})) expect(ids.has(v), `${o} : ${v}`).toBe(true);
  });

  it('test_effect_entries_read_the_same_outcome_as_the_engine_for_the_designated_option', () => {
    const ctx = ctxW10();
    const base = { ...day1State(), phase: 'designated' as const };
    const at = { day: 1 as const, minute: 600 };
    expect(base.kit['component'], 'le J1 démarre avec le composant sur soi').toBe('kept');
    expect(effectEntries({ ...base, designated: { choiceId: 'checkpoint.j1', optionId: 'comply' } }, ctx, at)).toEqual(['found7']);
    expect(effectEntries({ ...base, kit: {}, designated: { choiceId: 'checkpoint.j1', optionId: 'comply' } }, ctx, at)).toEqual([]);
    expect(effectEntries({ ...base, designated: { choiceId: 'checkpoint.j1', optionId: 'refuse' } }, ctx, at)).toEqual(['absentRegistre']);
    expect(effectEntries({ ...base, designated: null }, ctx, at)).toEqual([]);                                  // rien de désigné : rien à montrer
    expect(effectEntries({ ...base, designated: { choiceId: 'j1.phone', optionId: 'take' } }, ctx, at)).toEqual([]);   // pas une voie du checkpoint
  });
});

describe('sequence : refus de données', () => {
  type Json = { anchors: Record<string, { v: Vec2; owner?: string }>; sequences: Record<string, Record<string, { target: string; narrationKey: string; durationS: { v: number }; npcReaction: { id: string } }>> };
  const clone = (): Json => JSON.parse(JSON.stringify(seqRaw)) as Json;
  const bad = (m: (j: Json) => void): string => { const j = clone(); m(j); try { parseSequences(j, SCENE, S, has); return ''; } catch (e) { expect(e).toBeInstanceOf(DataLoadError); return (e as Error).message; } };

  it('test_unknown_choice_option_anchor_person_and_key_are_refused', () => {
    expect(bad((j) => { j.sequences['nope'] = j.sequences['checkpoint.j1']!; })).toContain('choix inconnu');
    expect(bad((j) => { j.sequences['checkpoint.j1']!['nope'] = j.sequences['checkpoint.j1']!['comply']!; })).toContain('option inconnue');
    expect(bad((j) => { j.sequences['checkpoint.j1']!['comply']!.target = 'nulle part'; })).toContain('ancre inconnue');
    expect(bad((j) => { j.sequences['checkpoint.j1']!['comply']!.npcReaction.id = 'personne'; })).toContain('personne inconnue');
    expect(bad((j) => { j.sequences['checkpoint.j1']!['comply']!.narrationKey = 'w10.seq.absente'; })).toContain('clé de narration absente');
  });

  it('test_duration_outside_the_bounds_is_refused', () => {
    expect(bad((j) => { j.sequences['checkpoint.j1']!['refuse']!.durationS.v = 9; })).toContain('hors des bornes');
    expect(bad((j) => { j.sequences['checkpoint.j1']!['refuse']!.durationS.v = 2; })).toContain('hors des bornes');
  });

  it('test_an_anchor_inside_a_solid_or_outside_the_street_is_refused', () => {
    expect(bad((j) => { j.anchors['anchor.cp.slit']!.v = { x: 0, z: -12 }; })).toContain('décor plein');
    expect(bad((j) => { j.anchors['anchor.cp.slit']!.v = { x: 9, z: -5 }; })).toContain('décor plein');
  });

  it('test_a_supposed_value_without_owner_is_refused', () => {
    expect(bad((j) => { delete j.anchors['anchor.cp.slit']!.owner; })).not.toBe('');
  });
});
