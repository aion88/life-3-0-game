import { describe, expect, it } from 'vitest';
import {
  WORLD_BUDGET_BYTES,
  loadWorldPayload,
  loadWorldPayloadStaged,
  parseManifest,
  payloadCache,
} from '../../../src/street/load/worldPayload';
import { failing, flaky, licensesTxt, okFetch, spyFetch, stagedManifest, w10Manifest, withAsset, withBytes } from '../../support/street_payload';

const M = stagedManifest();

describe('street payload', () => {
  it('test_manifest_rejects_unknown_license_and_unverified_third_party', () => {
    expect(() => parseManifest(withAsset({ license: 'QAL' }))).toThrow(/license/);
    expect(() => parseManifest(withAsset({ license: 'CC0', verifiedOn: null }))).toThrow(/verifiedOn/);
    expect(() => parseManifest(withAsset({ license: 'own', verifiedOn: null }))).not.toThrow();
  });

  it('test_world_payload_under_budget', () => {
    const m = parseManifest(w10Manifest);
    expect(m.assets.reduce((n, a) => n + a.bytes, 0)).toBeLessThanOrEqual(m.budgetBytes);
    expect(m.budgetBytes).toBe(WORLD_BUDGET_BYTES);
    expect(WORLD_BUDGET_BYTES).toBe(30_000_000);
  });

  it('test_budget_boundary_is_inclusive_and_read_from_the_manifest', () => {
    expect(() => parseManifest(withBytes(30_000_000, 20_000_000, 10_000_000))).not.toThrow();
    expect(() => parseManifest(withBytes(30_000_000, 20_000_000, 10_000_001))).toThrow(/budget/);
    expect(() => parseManifest(withBytes(30_000_001, 1))).toThrow(/budget/);
    expect(() => parseManifest(withBytes(100, 60, 41))).toThrow(/budget/);
  });

  it('test_no_quaternius_in_the_shipped_manifest', () => {
    expect(parseManifest(w10Manifest).assets.some((a) => /quaternius/i.test(a.source))).toBe(false);
    expect(() => parseManifest(withAsset({ license: 'CC0', verifiedOn: '2026-10-28', source: 'Quaternius pack' }))).toThrow(/quaternius/i);
  });

  it('test_every_non_own_asset_is_named_in_licenses_txt', () => {
    for (const a of parseManifest(w10Manifest).assets.filter((x) => x.license !== 'own')) expect(licensesTxt).toContain(a.id);
  });

  it('test_core_arrives_before_deferred', async () => {
    const order: string[] = [];
    await loadWorldPayload(M, { fetch: spyFetch(order) });
    for (const e of ['end:c1', 'end:c2']) for (const d of ['start:d1', 'start:d2']) expect(order.indexOf(e)).toBeLessThan(order.indexOf(d));
    expect(order).toHaveLength(8);
  });

  it('test_staged_core_resolves_with_core_only_then_all_with_everything', async () => {
    const order: string[] = [];
    const staged = loadWorldPayloadStaged(M, { fetch: spyFetch(order) });
    let calledAtCore: string[] = [];
    const core = await staged.core.then((c) => {
      calledAtCore = order.filter((o) => o.startsWith('end:d'));
      return c;
    });
    expect([...core.keys()].sort()).toEqual(['c1', 'c2']);
    // deferred démarre dès que core est arrivé (tâche de fond) mais n'est pas encore arrivé quand core résout
    expect(calledAtCore).toEqual([]);
    const all = await staged.all;
    expect([...all.keys()].sort()).toEqual(['c1', 'c2', 'd1', 'd2']);
  });

  it('test_abort_raises_a_fetch_load_error_naming_the_file', async () => {
    await expect(loadWorldPayload(M, { fetch: failing('c2') })).rejects.toMatchObject({ kind: 'fetch', file: expect.stringContaining('c2') });
  });

  it('test_retry_does_not_refetch_what_arrived', async () => {
    const calls: string[] = [];
    const f = flaky(calls, 'c2');
    const cache = new Map<string, ArrayBuffer>();
    await expect(loadWorldPayload(M, { fetch: f }, cache)).rejects.toMatchObject({ kind: 'fetch', file: expect.stringContaining('c2') });
    expect(cache.has('c1')).toBe(true);
    expect(cache.has('c2')).toBe(false);
    await loadWorldPayload(M, { fetch: f }, cache);
    expect(calls.filter((c) => c === 'c1')).toHaveLength(1);
    expect(calls.filter((c) => c === 'c2')).toHaveLength(2);
  });

  it('test_progress_reports_bytes_done_over_total', async () => {
    const seen: number[] = [];
    await loadWorldPayload(M, { fetch: okFetch, onProgress: (d, t) => seen.push(d / t) });
    expect(seen.at(-1)).toBe(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('test_progress_does_not_double_count_cached_bytes', async () => {
    const cache = new Map<string, ArrayBuffer>([['c1', new ArrayBuffer(2)]]);
    const seen: number[] = [];
    await loadWorldPayload(M, { fetch: okFetch, onProgress: (d, t) => seen.push(d / t) }, cache);
    expect(Math.max(...seen)).toBe(1);
    expect(seen.at(-1)).toBe(1);
    const again: number[] = [];
    await loadWorldPayload(M, { fetch: okFetch, onProgress: (d, t) => again.push(d / t) }, cache);
    expect(again).toEqual([1]);
  });

  it('test_payload_cache_is_one_map_per_world', () => {
    expect(payloadCache('w10')).toBe(payloadCache('w10'));
    expect(payloadCache('w10')).not.toBe(payloadCache('w11'));
  });
});
