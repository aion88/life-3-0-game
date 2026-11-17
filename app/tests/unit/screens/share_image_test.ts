// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBilan } from '../../../src/bilan/build';
import { layoutShare } from '../../../src/bilan/share';
import { loadBilanCommon } from '../../../src/data/bilanLoad';
import { renderShare, shareImage, shareLines } from '../../../src/screens/bilan/shareImage';
import { fakeCanvas2d } from '../../support/screens';
import { realI18n } from '../../support/street_ui';
import { bilanCtx, extinctionInput, W10, weekEndOf } from '../../support/screens_bilan';

const t = realI18n('fr');
const core = bilanCtx().core;
const data = buildBilan(weekEndOf(), { core, common: loadBilanCommon(), lived: W10, computedFile: null, has: (k) => t.has(k) });
const OPTS = { width: 1200, height: 630, names: false };
const drawn = (calls: readonly string[]): string[] => calls.filter((c) => c.startsWith('fillText(')).map((c) => JSON.parse(/^fillText\((".*"),[\d.-]+,/.exec(c)![1]!) as string);

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('image partageable', () => {
  it('test_layout_share_has_no_gap_for_0_to_4_others', () => {
    for (const n of [0, 1, 2, 3, 4]) {
      const { margin, blocks } = layoutShare(n, 1200, 630);
      expect(blocks[0]!.y).toBe(margin);
      blocks.forEach((b, i) => { if (i > 0) expect(b.y).toBe(blocks[i - 1]!.y + blocks[i - 1]!.h); expect(b.h).toBeGreaterThan(0); });
      const last = blocks[blocks.length - 1]!;
      expect(last.y + last.h).toBe(630 - margin);
      expect(blocks.length).toBe(2 + Math.max(1, n));
    }
  });

  it('test_share_names_off_by_default', () => {
    const names = data.dossier!.names.map((n) => t.t(n.personKey));
    const withNames = buildBilan(weekEndOf('Un nom, J4'), { core, common: loadBilanCommon(), lived: W10, computedFile: null, has: (k) => t.has(k) });
    expect(withNames.dossier!.names.length).toBeGreaterThan(0);
    const off = shareLines(withNames, t, false);
    const on = shareLines(withNames, t, true);
    expect(off.names).toEqual([]);
    expect(on.names).toEqual(withNames.dossier!.names.map((n) => t.t(n.personKey)));
    expect(names).toEqual([]);
    const f = fakeCanvas2d();
    renderShare(withNames, t, OPTS, f.canvas);
    for (const n of on.names) expect(drawn(f.calls()).join('|')).not.toContain(n);
    const g = fakeCanvas2d();
    renderShare(withNames, t, { ...OPTS, names: true }, g.canvas);
    for (const n of on.names) expect(drawn(g.calls()).join('|')).toContain(n);
  });

  it('test_share_text_passes_bilan_policy', () => {
    const f = fakeCanvas2d();
    renderShare(data, t, OPTS, f.canvas);
    const texts = drawn(f.calls());
    expect(texts.length).toBeGreaterThanOrEqual(3);
    const world = t.t(`world.${data.curve.lifeWorld}.name`);
    for (const s of texts) {
      expect(s).not.toMatch(/\{\w+\}/);
      expect(s.split(world).join('')).not.toMatch(/\d/);      // B-V9 : aucun chiffre hors le nom du monde, une date
    }
    expect(texts).toContain(world);
  });

  it('test_share_image_makes_no_network_call', async () => {
    const fetchSpy = vi.fn(); const xhr = vi.fn();
    vi.stubGlobal('fetch', fetchSpy); vi.stubGlobal('XMLHttpRequest', xhr);
    const f = fakeCanvas2d();
    (f.canvas as unknown as { toBlob: (cb: (b: Blob | null) => void) => void }).toBlob = (cb) => cb(new Blob(['x'], { type: 'image/png' }));
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await shareImage(data, t, OPTS, f.canvas);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
  });

  it('test_share_png_download_uses_blob_and_anchor', async () => {
    const f = fakeCanvas2d();
    const blob = new Blob(['x'], { type: 'image/png' });
    const toBlob = vi.fn((cb: (b: Blob | null) => void, type?: string) => { void type; cb(blob); });
    (f.canvas as unknown as { toBlob: typeof toBlob }).toBlob = toBlob;
    const create = vi.fn(() => 'blob:abc'); URL.createObjectURL = create; URL.revokeObjectURL = vi.fn();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    await shareImage(data, t, OPTS, f.canvas);
    expect(toBlob.mock.calls[0]![1]).toBe('image/png');
    expect(create).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toMatch(/\.png$/);
    expect(clicked[0]!.href).toBe('blob:abc');
  });

  it('test_share_fails_loudly_when_toblob_gives_null', async () => {
    const f = fakeCanvas2d();
    (f.canvas as unknown as { toBlob: (cb: (b: Blob | null) => void) => void }).toBlob = (cb) => cb(null);
    await expect(shareImage(data, t, OPTS, f.canvas)).rejects.toThrow(/toBlob/);
  });

  it('test_share_lines_refuse_extinction', () => {
    const ext = buildBilan(extinctionInput(), { core, common: loadBilanCommon(), lived: null, computedFile: null, has: () => true });
    expect(() => shareLines(ext, t, false)).toThrow();
  });
});
