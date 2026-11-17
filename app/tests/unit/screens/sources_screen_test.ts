// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../../src/data/strings/en.json';
import fr from '../../../src/data/strings/fr.json';
import { loadBilanCommon } from '../../../src/data/bilanLoad';
import { buildSources, SOURCE_LABELS } from '../../../src/bilan/sources';
import { sharePercent } from '../../../src/bilan/share';
import { createSourcesScreen } from '../../../src/screens/sources';
import { mountScreen } from '../../support/screens';
import { yearOfStep } from '../../../src/fastforward/headlines';
import { runOf } from '../../support/run';
import { EXTINCTION_LINE, REDIRECT_LINE, W10_LINE, sourcesCtx } from '../../support/screens_sources';

const FR = fr as Record<string, string>;
const EN = en as Record<string, string>;
const common = loadBilanCommon();

async function open(line: string, o: Parameters<typeof sourcesCtx>[1] = {}, from: 'bilan' | 'warning' = 'bilan') {
  const ctx = sourcesCtx(line, o);
  const { root } = await mountScreen(createSourcesScreen(), ctx, { from });
  return { ctx, root, text: root.textContent ?? '' };
}
const btn = (root: HTMLElement, id: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);

describe('écran sources et honnêteté [plan 03 T13]', () => {
  it('test_sources_shows_four_labels_with_legends', async () => {
    const { text } = await open(W10_LINE);
    expect(SOURCE_LABELS).toHaveLength(4);
    for (const l of SOURCE_LABELS) {
      expect(text).toContain(FR[`sources.label.${l}`]);
      expect(text).toContain(FR[`sources.legend.${l}`]);
    }
  });

  it('test_sources_shows_eight_content_points', async () => {
    const { root, text } = await open(W10_LINE);
    expect(common.contentPoints).toHaveLength(8);
    expect(root.querySelectorAll('[data-testid="sources-point"]')).toHaveLength(8);
    for (const id of common.contentPoints) {
      expect(text).toContain(FR[`sources.point.${id}.title`]);
      expect(text).toContain(FR[`sources.point.${id}.body`]);
    }
  });

  it('test_sources_world_table_missing_line_when_no_file', async () => {
    const { root, text } = await open(W10_LINE, { withW10: false });
    expect(text).toContain(FR['sources.worlds.none']);
    expect(root.querySelectorAll('[data-testid="sources-world-row"]')).toHaveLength(0);
    const withFile = await open(W10_LINE, { withW10: true });
    expect(withFile.text).not.toContain(FR['sources.worlds.none']);
    expect(withFile.root.querySelectorAll('[data-testid="sources-world-row"]').length).toBe(4);
  });

  it('test_sources_world_rows_each_carry_a_label', async () => {
    const { root } = await open(W10_LINE, { withW10: true });
    const rows = [...root.querySelectorAll<HTMLElement>('[data-testid="sources-world-row"]')];
    const built = buildSources(runOf(W10_LINE), { core: sourcesCore(), common, computedFile: null });
    expect(built.worldRows).toBeNull();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const label = r.dataset['label'] as (typeof SOURCE_LABELS)[number];
      expect(SOURCE_LABELS).toContain(label);
      expect(r.textContent).toContain(FR[`sources.label.${label}`]);
    }
    expect(rows.map((r) => r.textContent).join(' ')).toContain(FR['w10.sources.fli']);
  });

  it('test_sources_percentages_fr_use_comma', async () => {
    const { text } = await open(W10_LINE);
    const w04 = common.counts.find((c) => c.world === 'w04')!.count;
    expect(sharePercent(w04, common.total, 'fr')).toBe('31,6 %');
    expect(text).toContain('31,6 %');
    expect(text).not.toMatch(/\d\.\d %/);
  });

  it('test_sources_percentages_en_use_dot', async () => {
    const { text } = await open(W10_LINE, { lang: 'en' });
    expect(text).toContain('31.6%');
    expect(text).not.toContain('31,6');
  });

  it('test_sources_shares_rows_are_the_ten_arrival_worlds_and_rare_line_is_filled', async () => {
    const { root, text } = await open(W10_LINE);
    expect(root.querySelectorAll('[data-testid="sources-share-row"]')).toHaveLength(10);
    expect(text).not.toContain('{');
    expect(text).toContain('917'); // une partie sur 917 : 746 496 / 814
    expect(text).toContain(FR['sources.note.tegmark']);
  });

  it('test_sources_back_with_input_returns_to_bilan_with_the_same_input', async () => {
    const run = runOf(EXTINCTION_LINE);
    const input = { entry: 'extinction', run, week: null, survival: null, acts: [] } as const;
    const ctx = sourcesCtx(EXTINCTION_LINE);
    const { root } = await mountScreen(createSourcesScreen(), ctx, { from: 'bilan', input });
    btn(root, 'sources-back')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
    const [id, payload] = ctx.navigate.mock.calls[0] as [string, { input: unknown }];
    expect(id).toBe('bilan');
    expect(payload.input).toBe(input);
  });

  it('test_sources_back_without_input_goes_to_lang', async () => {
    for (const from of ['bilan', 'warning'] as const) {
      const { ctx, root } = await open(W10_LINE, {}, from);
      btn(root, 'sources-back')!.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(ctx.navigate).toHaveBeenCalledWith('lang', undefined);
    }
  });

  it('test_sources_hypotheses_are_seven_rows_by_title_and_label', async () => {
    const { root } = await open(W10_LINE);
    const rows = [...root.querySelectorAll<HTMLElement>('[data-testid="sources-hypothesis"]')];
    const built = buildSources(runOf(W10_LINE), { core: sourcesCore(), common, computedFile: null }).hypotheses;
    expect(built).toHaveLength(7);
    expect(rows).toHaveLength(7);
    built.forEach((h, i) => {
      expect(rows[i]!.textContent).toContain(FR[`q.${h.question}.title`]);
      expect(rows[i]!.textContent).toContain(FR[`q.${h.question}.${h.answer}.label`]);
    });
  });

  it('test_sources_screen_is_readable_in_softened_mode', async () => {
    for (const line of [EXTINCTION_LINE, W10_LINE, REDIRECT_LINE]) {
      const run = runOf(line);
      for (const softened of [true, false]) {
      const { text } = await open(line, { softened });
      expect(text.length).toBeGreaterThan(500);
      expect(text).toContain(FR['sources.title']);
      expect(text).toContain(FR['sources.point.rareWorlds.title']);
      if (run.outcome.kind === 'extinction') expect(text).not.toContain(String(yearOfStep(run.outcome.ruptureStep)));
      }
    }
  });

  it('test_sources_en_has_every_key_it_reads', () => {
    for (const k of Object.keys(FR).filter((x) => x.startsWith('sources.') || x.startsWith('w10.sources.'))) expect(EN[k], k).toBeDefined();
  });

  it('test_sources_source_never_reads_rupture_or_extinction_year [R-03.27]', () => {
    const src = readFileSync(join(__dirname, '../../../src/screens/sources/index.ts'), 'utf8');
    expect(src).not.toMatch(/ruptureYear|projectedExtinctionYear/);
  });
});

function sourcesCore() { return sourcesCtx(W10_LINE).core; }
