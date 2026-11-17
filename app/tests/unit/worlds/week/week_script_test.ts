import { describe, expect, it } from 'vitest';
import type { Beat } from '../../../../src/worlds/week/weekContracts';
import { CONTESTS, RULES } from '../../../../src/worlds/week/weekContent';
import { runWeek } from '../../../../src/worlds/week/weekScript';
import { createWeek, type WeekState } from '../../../../src/worlds/week/weekState';

/** Réponses dans l'ordre des gestes et pièces (plan §9.1). */
const PARTIES = {
  recrute: { answers: [0, 2, 0, 1, 1, 1, 0, 0, 0, 1, 0], evenings: [['60', '20'], ['62', '20']], dossier: 79, ending: 'recrute', names: 3 },
  arrete: { answers: [2, 0, 1, 0, 0, 2, 2, 2, 3, 0, 1], evenings: [['49', '15'], ['24', '10']], dossier: -10, ending: 'arrete', names: 0 },
  relache: { answers: [0, -1, 0, 1, 1, 1, 2, 0, 3, 1, 1], evenings: [['57', '20'], ['50', '15']], dossier: 44, ending: 'relache', names: 0 },
  arreteGarante: { answers: [2, 0, 0, 0, 0, 2, 2, 2, 3, 0, 1], evenings: [['53', '15'], ['28', '10']], dossier: -6, ending: 'arrete', names: 0 },
} as const;

interface Played { beats: Beat[]; state: WeekState; snapshots: { beat: Beat; dossier: number }[] }

function play(answers: readonly number[]): Played {
  const state = createWeek();
  const queue = [...answers];
  const beats: Beat[] = [];
  const snapshots: Played['snapshots'] = [];
  const run = runWeek(state);
  let reply: number | undefined;
  for (;;) {
    const step = run.next(reply);
    if (step.done) break;
    const beat = step.value;
    beats.push(beat);
    snapshots.push({ beat, dossier: state.dossier });
    reply = beat.kind === 'gesture' || beat.kind === 'piece' ? queue.shift() : undefined;
  }
  expect(queue).toEqual([]);
  return { beats, state, snapshots };
}

const scenes = (b: Beat[]) => b.flatMap((x) => (x.kind === 'scene' ? [x] : []));
const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

describe('week script', () => {
  for (const [name, p] of Object.entries(PARTIES)) {
    it(`test_week_script_${name}_game_reaches_expected_evenings_and_ending`, () => {
      const { beats } = play(p.answers);
      const tickets = beats.flatMap((b) => (b.kind === 'ticket' && b.title.startsWith('Relevé du soir') ? [b] : []));
      const got = tickets.map((t) => {
        const rows = t.rows.filter((r): r is Exclude<typeof r, string> => typeof r !== 'string');
        return [
          rows.find((r) => r.total)?.value,
          rows.find((r) => r.label === 'Mots accordés demain')?.value,
        ];
      });
      expect(got).toEqual(p.evenings);
      const end = beats[beats.length - 1];
      expect(end).toMatchObject({ kind: 'ending', ending: p.ending, dossier: p.dossier, threshold: RULES.threshold });
      expect(end?.kind === 'ending' && end.names).toHaveLength(p.names);
    });

    it(`test_week_script_${name}_game_has_eleven_decisions_with_clean_prices`, () => {
      const { beats } = play(p.answers);
      const decisions = beats.filter((b) => b.kind === 'gesture' || b.kind === 'piece');
      expect(decisions).toHaveLength(11);
      for (const b of beats) {
        if (b.kind !== 'gesture') continue;
        for (const t of b.targets) {
          expect(t.price).not.toBe('');
          expect(t.price).not.toContain(' · ');
        }
      }
    });

    it(`test_week_script_${name}_game_never_uses_an_em_dash`, () => {
      const { beats } = play(p.answers);
      expect(strings(beats).filter((s) => s.includes('—'))).toEqual([]);
    });
  }

  it('test_week_script_recruited_game_scene_sequence_matches_plan', () => {
    const { beats } = play(PARTIES.recrute.answers);
    expect(scenes(beats).map((s) => s.id)).toEqual([
      'P-J1-01', 'P-J1-02', 'P-J1-03', 'P-J1-04', 'P-J1-05', 'P-J1-06', 'P-J1-07', 'P-J1-R',
      'P-J2-01', 'P-J2-02', 'P-J2-03', 'P-J2-R', 'P-J3-01', 'P-J3-02', 'P-J3-03', 'P-J3-04', 'P-FIN-recrute',
    ]);
  });

  it('test_week_script_mother_branch_puts_parents_scene_with_both_parents', () => {
    const { beats } = play(PARTIES.recrute.answers);
    const parents = scenes(beats).filter((s) => s.place === 'parents');
    expect(parents).toHaveLength(1);
    expect(parents[0]).toMatchObject({ id: 'P-J1-07', cast: ['maman', 'papa'] });
  });

  it('test_week_script_mother_credit_is_written_after_the_parents_scene', () => {
    const { beats } = play(PARTIES.recrute.answers);
    const parentsAt = beats.findIndex((b) => b.kind === 'scene' && b.id === 'P-J1-07');
    const creditAt = beats.findIndex((b) => b.kind === 'written' && b.delta === RULES.motherDossier);
    const papa = beats.findIndex((b) => b.kind === 'lines' && b.lines.some((l) => l.cast === 'papa'));
    expect(parentsAt).toBeGreaterThan(-1);
    expect(papa).toBeGreaterThan(parentsAt);
    expect(creditAt).toBeGreaterThan(papa);
  });

  it('test_week_script_home_branch_has_no_parents_scene_and_writes_abandoned_trip', () => {
    const { beats } = play(PARTIES.arrete.answers);
    expect(scenes(beats).some((s) => s.place === 'parents')).toBe(false);
    expect(beats.some((b) => b.kind === 'written' && b.label === 'Trajet abandonné' && b.delta === -2)).toBe(true);
    expect(beats.some((b) => b.kind === 'control' && b.act === 'goHome')).toBe(true);
  });

  it('test_week_script_mother_branch_drives_control_in_order', () => {
    const { beats } = play(PARTIES.recrute.answers);
    expect(beats.flatMap((b) => (b.kind === 'control' ? [b.act] : []))).toEqual(['approach', 'requestGuarantee', 'authorize']);
  });

  it('test_week_script_garante_arrest_carries_the_mother_line_only_then', () => {
    const garante = play(PARTIES.arreteGarante.answers).beats.at(-1);
    const arrete = play(PARTIES.arrete.answers).beats.at(-1);
    const recrute = play(PARTIES.recrute.answers).beats.at(-1);
    expect(garante?.kind === 'ending' && garante.mother).toBeTruthy();
    expect(arrete?.kind === 'ending' && arrete.mother).toBeUndefined();
    expect(recrute?.kind === 'ending' && recrute.mother).toBeUndefined();
  });

  it('test_week_script_false_lines_are_indexes_2_1_1', () => {
    expect([CONTESTS.refus.falseIndex, CONTESTS.avis.falseIndex, CONTESTS.releve.falseIndex]).toEqual([2, 1, 1]);
    const { beats } = play(PARTIES.recrute.answers);
    const pieces = beats.flatMap((b) => (b.kind === 'piece' ? [b] : []));
    expect(pieces).toHaveLength(3);
    expect(pieces[0]?.rows.filter((r) => 'line' in r)[2]).toEqual({ line: 'Samedi, 14:10 · rassemblement surveillé, place Nord' });
    expect(pieces[1]?.rows.filter((r) => 'line' in r)[1]).toEqual({ line: 'Mots dits hier : 12' });
  });

  it('test_week_script_registry_notice_falsifies_yesterday_words_by_six', () => {
    const { beats, state } = play(PARTIES.recrute.answers);
    const notice = beats.flatMap((b) => (b.kind === 'piece' && b.title.startsWith('Avis') ? [b] : []))[0];
    expect(notice?.rows).toContainEqual({ line: `Mots dits hier : ${6 + 6}` });
    expect(state.yesterday).toBeGreaterThan(0);
  });

  it('test_week_script_touching_bracelet_line_costs_six_words_and_writes_unfounded', () => {
    const answers: number[] = [...PARTIES.recrute.answers];
    answers[1] = 4;
    const { beats } = play(answers);
    const at = beats.findIndex((b) => b.kind === 'piece');
    const after = beats.slice(at + 1, at + 4);
    expect(after).toContainEqual({ kind: 'say', words: 6 });
    expect(after).toContainEqual({ kind: 'written', label: 'Contestation infondée', delta: -3 });
  });

  it('test_week_script_passing_the_registry_notice_writes_yesterday_words', () => {
    const answers: number[] = [...PARTIES.recrute.answers];
    answers[3] = -1;
    const { beats } = play(answers);
    expect(beats).toContainEqual({ kind: 'written', label: "Mots d'hier, selon le Registre", delta: -3 });
  });

  it('test_week_script_signed_notebook_ends_with_three_names_without_duplicate', () => {
    const end = play(PARTIES.recrute.answers).beats.at(-1);
    expect(end?.kind === 'ending' && [...end.names].sort()).toEqual(['Marlène', 'Nadia', 'Théodore']);
  });

  it('test_week_script_bruno_can_receive_marlene', () => {
    const { beats } = play(PARTIES.recrute.answers);
    const pen = beats.flatMap((b) => (b.kind === 'gesture' && b.object?.label === 'Le stylo' ? [b] : []))[0];
    expect(pen?.targets.map((t) => t.label)).toEqual(['Nadia', 'Marlène', 'Rendre le stylo']);
  });

  it('test_week_script_pen_offers_only_names_not_yet_given', () => {
    const { beats } = play(PARTIES.arrete.answers);
    const pen = beats.flatMap((b) => (b.kind === 'gesture' && b.object?.label === 'Le stylo' ? [b] : []))[0];
    expect(pen?.targets.map((t) => t.label)).toEqual(['Théodore', 'Nadia', 'Marlène', 'Rendre le stylo']);
    expect(pen?.targets[0]?.gain).toBe(true);
    expect(pen?.targets.at(-1)?.gain).toBeUndefined();
  });

  it('test_week_script_stage_enter_follows_every_scene_except_control_j1_evening_and_final', () => {
    const { beats } = play(PARTIES.recrute.answers);
    beats.forEach((b, i) => {
      if (b.kind !== 'scene') return;
      const entered = beats[i + 1]?.kind === 'stage' && (beats[i + 1] as { act: string }).act === 'enter';
      const skipped = b.place === 'controle-j1' || b.id.endsWith('-R') || b.id.startsWith('P-FIN');
      expect(entered, b.id).toBe(!skipped);
    });
  });

  it('test_week_script_checkpoint_pass_happens_once_before_fourteen_words', () => {
    const { beats } = play(PARTIES.recrute.answers);
    const pass = beats.flatMap((b, i) => (b.kind === 'stage' && b.act === 'checkpoint-pass' ? [i] : []));
    expect(pass).toHaveLength(1);
    const say14 = beats.findIndex((b, i) => i > (pass[0] ?? 0) && b.kind === 'say' && b.words === RULES.checkpointWords);
    expect(say14).toBeGreaterThan(pass[0] ?? Infinity);
  });

  it('test_week_script_props_show_and_hide_where_the_plan_says', () => {
    const { beats } = play(PARTIES.recrute.answers);
    const props = beats.flatMap((b) => (b.kind === 'prop' ? [`${b.id}:${String(b.visible)}`] : []));
    expect(props).toEqual(['lettre:true', 'lettre:false', 'dossier:true', 'stylo:true', 'stylo:false', 'dossier:true', 'carnet:true']);
  });

  it('test_week_script_tickets_wait_for_no_answer_and_papers_are_four', () => {
    const { beats } = play(PARTIES.recrute.answers);
    expect(beats.filter((b) => b.kind === 'ticket')).toHaveLength(4);
  });

  it('test_week_script_same_answers_give_the_same_beats', () => {
    const a = play(PARTIES.relache.answers).beats;
    const b = play(PARTIES.relache.answers).beats;
    expect(b).toEqual(a);
  });

  it('test_week_script_out_of_range_answer_is_refused', () => {
    const run = runWeek(createWeek());
    let step = run.next();
    while (!step.done && step.value.kind !== 'gesture') step = run.next();
    expect(() => run.next(99)).toThrow(RangeError);
  });

  it('test_week_script_dossier_reads_back_from_state_after_each_beat', () => {
    const { snapshots } = play(PARTIES.recrute.answers);
    const mother = snapshots.find((s) => s.beat.kind === 'written' && s.beat.delta === RULES.motherDossier);
    expect(mother?.dossier).toBe(RULES.startDossier + RULES.motherDossier);
  });
});
