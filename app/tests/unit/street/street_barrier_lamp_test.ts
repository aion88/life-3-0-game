// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { Mesh } from 'three/webgpu';
import { buildDistrict } from '../../../src/street/render/scene';
import { createI18n, type StringMeta } from '../../../src/i18n/i18n';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import meta from '../../../src/data/strings/meta.json';
import { scene } from '../../support/street_render';
import { noAssets } from '../../support/street_scene';

const i18n = createI18n({ fr, en }, meta as StringMeta, 'fr', { mode: 'dev', report: () => undefined });
const district = () => buildDistrict(scene(), noAssets, { interiors: 'core', i18n });

describe('lampes de la barrière : boîtier sombre et petite source [TV-02a-render]', () => {
  it('test_barrier_lamp_has_a_dark_housing_and_a_smaller_emissive_bulb', () => {
    const d = district();
    for (const which of ['tip', 'post']) {
      const housing = d.root.getObjectByName(`barrier.lamp.housing.${which}`) as Mesh | undefined;
      const bulb = d.root.getObjectByName(`barrier.lamp.${which}`) as Mesh | undefined;
      expect(housing, `boîtier ${which}`).toBeDefined();
      expect(bulb, `source ${which}`).toBeDefined();
      expect(bulb!.scale.x).toBeLessThan(housing!.scale.x * 0.5);       // la source est nettement plus petite que le boîtier
      expect(d.otherEmissives).toContain(bulb);                         // seule la source est émissive
      expect(d.otherEmissives).not.toContain(housing);
    }
  });
  it('test_housing_keeps_the_sourced_lamp_diameter', () => {
    const d = district(); const s = scene().checkpoint.barrier;
    const tip = d.root.getObjectByName('barrier.lamp.housing.tip') as Mesh;
    expect(tip.scale.x * 2).toBeCloseTo(s.lampM.v, 9);                  // bible §5.2 b : lampe sphérique de 0,2 m, c'est le boîtier
  });
});
