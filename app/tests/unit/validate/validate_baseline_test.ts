import { describe, expect, it } from 'vitest';
import { compareToBaseline, validateContent, type BaselineEntry } from '../../../src/validate/content';
import baselineRaw from '../../fixtures/validator-baseline.json';
import { realInput } from '../../fixtures/data/factories';

const baseline: readonly BaselineEntry[] = baselineRaw;

describe('validate baseline', () => {
  it('test_real_data_has_no_error_and_no_new_warning', () => {
    const r = validateContent(realInput()); expect(r.errors).toEqual([]);
    const { added, stale, count } = compareToBaseline(r, baseline); expect(added).toEqual([]); expect(stale).toEqual([]);
    expect(count).toBe(baseline.length); console.info(`validator-baseline : ${count} entrées`);              // le compte s'affiche à chaque run [D141 (1) b]
    expect(baseline.every(e => e.owner.trim() !== '' && e.date !== '' && e.reason.trim() !== '')).toBe(true);
  });
  it('test_baseline_entry_without_owner_fails', () => {
    const r = validateContent(realInput()); const noOwner = { ...baseline[0]!, owner: '' };
    expect(() => compareToBaseline(r, [noOwner])).toThrow(/owner/);
  });
});
