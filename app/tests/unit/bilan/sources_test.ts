/** SOURCES & HONESTY, données [plan 03 T11 ; GDD 06 §3.8, décision 8]. Aucun texte : des clés et des comptes. */
import { describe, expect, it } from 'vitest';
import { buildSources, SOURCE_LABELS } from '../../../src/bilan/sources';
import { sharePercent } from '../../../src/bilan/share';
import { bilanTraceback } from '../../../src/bilan/others';
import { ans } from '../../support/answers';
import { runOf } from '../../support/run';
import { runLivingIn } from '../../support/week';
import { core, common, W10 } from '../../support/bilan_build';

const none = { core, common, computedFile: null };
const sctx = { core, common, computedFile: W10 };

describe('SOURCES & HONESTY [plan 03 T11]', () => {
  it('test_sources_world_rows_null_for_world_without_file', () => {
    const s = buildSources(runOf('AAAAAAAAAAA'), { core, common, computedFile: null });
    expect(s.world).toBe('w03');
    expect(s.worldRows).toBeNull();
  });
  it('test_sources_world_rows_present_for_w10', () => {
    const s = buildSources(runLivingIn('w10'), sctx);
    expect(s.world).toBe('w10');
    expect(s.worldRows).toEqual(W10.bilan && 'sources' in W10.bilan ? W10.bilan.sources : null);
    expect(s.worldRows!.length).toBeGreaterThan(0);
  });
  it('test_sources_shares_total_is_746496', () => {
    const s = buildSources(runLivingIn('w10'), sctx);
    expect(s.shares.total).toBe(746496);
  });
  it('test_sources_shares_table_has_ten_arrival_worlds', () => {
    const rows = buildSources(runLivingIn('w10'), sctx).shares.rows;
    expect(rows.map((r) => r.world)).toEqual(['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w08', 'w09', 'w10', 'w11']);
    expect(rows.find((r) => r.world === 'w04')!.count).toBe(235696);
  });
  it('test_sources_rare_line_is_gatekeeper_31_6_and_zookeeper_one_in_917', () => {
    const s = buildSources(runLivingIn('w10'), sctx);
    const count = (w: string) => s.shares.rows.find((r) => r.world === w)!.count;
    expect(s.rareLineKey).toBe('sources.rare.line');
    expect(sharePercent(count('w04'), s.shares.total, 'fr')).toBe('31,6 %');
    expect(sharePercent(count('w04'), s.shares.total, 'en')).toBe('31.6%');
    expect(Math.round(s.shares.total / count('w09'))).toBe(917);
  });
  it('test_sources_hypotheses_are_the_seven_hypothesis_answers', () => {
    const h = buildSources(runLivingIn('w10'), sctx).hypotheses;
    expect(h).toHaveLength(7);
    for (const row of h) {
      const q = core.questionnaire.questions.find((x) => x.key === row.question)!;
      expect(q.answers.find((a) => a.key === row.answer)!.hypothesis).toBe(true);
    }
  });
  it('test_sources_hypotheses_are_not_the_traceback', () => {
    const a = buildSources(runOf('ACBACBACAAD'), none).hypotheses;
    const b = buildSources(runOf('AAAAAAAAAAA'), none).hypotheses;
    expect(b).toEqual(a);                                     // même liste quelle que soit la partie
    const trace = bilanTraceback(core, ans('ACBACBACAAD'));
    expect(trace.every((t) => a.some((h) => h.question === t.question && h.answer === t.answer))).toBe(false);
  });
  it('test_sources_always_has_four_labels_and_eight_points', () => {
    // SourcesScreen (T2) ne porte ni les étiquettes ni les points : les quatre étiquettes sont la constante de l'union, les huit points viennent de `bilan.json`.
    expect(SOURCE_LABELS).toHaveLength(4);
    expect(SOURCE_LABELS).toEqual(['sourced', 'unreopened', 'extrapolated', 'gameHypothesis']);
    expect(common.contentPoints).toHaveLength(8);          // `common` = loadBilanCommon() sur bilan.json réel, jamais une fixture
    expect(new Set(common.contentPoints).size).toBe(8);
    for (const run of [runOf('AAAAAAAAAAA'), runLivingIn('w10')]) {
      expect(buildSources(run, { core, common, computedFile: null }).noteKeys).toEqual(common.noteKeys);
    }
  });
  it('test_sources_extinction_names_the_extinction_world_and_no_rows', () => {
    const s = buildSources(runOf('CBCCBDBACCD'), { core, common, computedFile: null });
    expect(s.world).toBe('w07');
    expect(s.worldRows).toBeNull();
  });
});
