// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasTexture, Mesh, type MeshBasicNodeMaterial } from 'three/webgpu';
import { buildDistrict } from '../../../src/street/render/scene';
import { wallCounterOf } from '../../../src/engine/moments/bilan';
import { createI18n, type StringMeta } from '../../../src/i18n/i18n';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import meta from '../../../src/data/strings/meta.json';
import { scene } from '../../support/street_render';
import { ctxW10 } from '../../support/street';
import { noAssets } from '../../support/street_scene';

const i18n = createI18n({ fr, en }, meta as StringMeta, 'fr', { mode: 'dev', report: () => undefined });

/** Contexte 2D factice : happy-dom n'en offre pas, on enregistre les appels. */
function fakeContext(): { ctx: Record<string, unknown>; fillText: ReturnType<typeof vi.fn> } {
  const fillText = vi.fn();
  return { fillText, ctx: { fillText, fillRect: vi.fn(), fillStyle: '', font: '', textAlign: '', textBaseline: '' } };
}

describe('surface de texte de la scène : chemin canevas 2D', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('test_wall_counter_canvas_path_draws_the_translated_text_and_flags_the_texture', () => {
    const { ctx, fillText } = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => (kind === '2d' ? ctx : null)) as never);
    const d = buildDistrict(scene(), noAssets, { interiors: 'core', i18n });
    const counter = d.root.getObjectByName('wallCounter') as Mesh;
    const map = (counter.material as MeshBasicNodeMaterial).map;
    expect(map).toBeInstanceOf(CanvasTexture);   // le chemin canevas a bien été pris, pas le repli sombre
    const before = map!.version;
    const n = wallCounterOf({ acts: [] }, ctxW10()) + 7;
    d.setWallCounter(n);
    const expected = i18n.t('w10.doc.wallCounter', { n });
    expect(fillText).toHaveBeenCalled();
    expect(fillText.mock.calls.at(-1)![0]).toBe(expected);
    expect(counter.userData['text']).toBe(expected);
    expect(map!.version).toBeGreaterThan(before);   // needsUpdate levé
  });
});
