/** Bus d'événements d'interface et mouvements réductibles [plan UI-C T3, spec C §4, §5, I-9]. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadUi } from '../../../src/data/ui/load';
import { MOTION_IDS, type MotionId, type Timing } from '../../../src/data/schema/ui';
import { UI_EVENT_NAMES, createUiEvents } from '../../../src/ui/events';
import { createInstantAnimator, designateParams, motionFor, reducedMotionOf } from '../../../src/ui/motion';

const timing = (): Timing => loadUi().timing;
/** Seul ce qui dépend de l'écran ou de l'exécution : cible de la pièce, dispersion du confetti, couleur d'ombre. */
const PARAMS = { dx: 300, dy: -120, rotDeg: 20, shadowColor: 'var(--sh-menthe)' };

/** Copie du timing avec la durée d'un mouvement changée. */
function withMs(id: MotionId, ms: number): Timing {
  const t = structuredClone(timing());
  t.motion[id] = { ...t.motion[id], v: { ...t.motion[id].v, ms } };
  return t;
}

afterEach(() => vi.unstubAllGlobals());

describe('events', () => {
  it('test_event_names_are_exactly_spec_section_5', () => {
    expect([...UI_EVENT_NAMES].sort()).toEqual(
      ['ui.designate', 'ui.undesignate', 'ui.confirm', 'ui.cost.reveal', 'ui.price.reveal', 'bracelet.coin', 'oeil.shutter', 'bracelet.settle',
        'regime.confetti', 'regime.message', 'ui.refusal.system', 'ui.bubble.in', 'ui.bubble.out', 'ui.card.open', 'ui.card.close', 'ui.page'].sort(),
    );
    expect(UI_EVENT_NAMES).toHaveLength(16);
  });

  it('test_events_log_and_unsubscribe', () => {
    const bus = createUiEvents();
    const seen: string[] = [];
    const off = bus.on((n) => seen.push(n));
    bus.emit('ui.designate');
    bus.emit('ui.confirm');
    off();
    bus.emit('ui.page');
    expect(seen).toEqual(['ui.designate', 'ui.confirm']);
    expect(bus.log()).toEqual(['ui.designate', 'ui.confirm', 'ui.page']);
    bus.clear();
    expect(bus.log()).toEqual([]);
  });
});

describe('motion, reduced', () => {
  it('test_reduced_motion_every_id_is_fade_at_most_120', () => {
    const max = timing().juice.reducedMaxMs.v;
    for (const id of MOTION_IDS) {
      const m = motionFor(id, true, timing(), PARAMS);
      if (m === null) continue;
      for (const kf of m.keyframes) expect(Object.keys(kf).filter((k) => k !== 'offset' && k !== 'easing')).toEqual(['opacity']);
      expect(Number(m.options.duration)).toBeLessThanOrEqual(max);
      expect(Number(m.options.delay ?? 0)).toBe(0);
    }
  });

  it('test_reduced_motion_caps_a_long_duration', () => {
    const m = motionFor('pageChange', true, withMs('pageChange', 5000), PARAMS);
    expect(m?.options.duration).toBe(timing().juice.reducedMaxMs.v);
  });

  it('test_reduced_motion_drops_coin_confetti_shutter', () => {
    const dropped = ['coin', 'confetti', 'shutter', 'braceletSettle'];
    for (const id of dropped) expect(motionFor(id as MotionId, true, timing(), PARAMS)).toBeNull();
    for (const id of MOTION_IDS.filter((i) => !dropped.includes(i))) expect(motionFor(id, true, timing(), PARAMS)).not.toBeNull();
  });

  it('test_reduced_motion_fade_directions', () => {
    const op = (id: MotionId): unknown[] => motionFor(id, true, timing(), PARAMS)!.keyframes.map((k) => k.opacity);
    expect(op('bubbleIn')).toEqual([0, 1]);
    expect(op('bubbleOut')).toEqual([1, 0]);
    expect(op('fadeOthers')).toEqual([1, timing().motion.fadeOthers.v.params.opacity]);
  });

  it('test_reduced_motion_element_state_never_ends_invisible', () => {
    for (const id of ['designate', 'undesignate', 'confirmPress', 'confirmRelease'] as const) {
      const ops = motionFor(id, true, timing(), PARAMS)!.keyframes.map((k) => k.opacity);
      expect(ops, id).toEqual([1, 1]);
    }
    // jouée l'une après l'autre sur la même option, la fin reste visible (fill both)
    const seq = ['designate', 'undesignate'] as const;
    expect(motionFor(seq[1], true, timing(), PARAMS)!.keyframes.at(-1)!.opacity).toBe(1);
  });
});

describe('motion, full', () => {
  it('test_full_motion_designate_is_180_pop', () => {
    const t = timing();
    const m = motionFor('designate', false, t, PARAMS)!;
    expect(m.options.duration).toBe(180);
    expect(m.options.easing).toBe(t.easings.pop.v);
    expect(m.keyframes.some((k) => 'transform' in k)).toBe(true);
    expect(motionFor('undesignate', false, t, PARAMS)!.options.duration).toBe(120);
  });

  it('test_full_motion_reads_timing_not_literals', () => {
    for (const id of MOTION_IDS) {
      const a = motionFor(id, false, timing(), PARAMS)!;
      const b = motionFor(id, false, withMs(id, 777), PARAMS)!;
      expect(a.options.duration).toBe(timing().motion[id].v.ms);
      expect(b.options.duration).toBe(777);
    }
  });

  it('test_full_motion_params_drive_the_keyframes', () => {
    const a = JSON.stringify(motionFor('cardIn', false, timing(), PARAMS)!.keyframes);
    const b = JSON.stringify(motionFor('cardIn', false, timing(), { ...PARAMS, scale: 0.5 })!.keyframes);
    expect(a).not.toEqual(b);
  });

  it('test_full_motion_delay_and_stagger_come_from_timing', () => {
    const t = timing();
    expect(motionFor('priceReveal', false, t, PARAMS)!.options.delay).toBe(t.motion.priceReveal.v.delayMs);
    const k = (i: number): unknown => motionFor('optionsIn', false, t, { index: i })!.options.delay;
    expect(k(2)).toBe(t.motion.optionsIn.v.delayMs + 2 * t.motion.optionsIn.v.staggerMs);
  });

  it('test_motion_is_deterministic', () => {
    for (const id of MOTION_IDS) expect(motionFor(id, false, timing(), PARAMS)).toEqual(motionFor(id, false, timing(), PARAMS));
  });
});

/** Grandeurs que le §4 fixe : en données, avec provenance, jamais en identité silencieuse. */
const SPEC_PARAMS: Record<string, Record<string, number>> = {
  confirmPress: { dy: 2, shadowFromPx: 3, shadowToPx: 1 }, confirmRelease: { dy: 2, shadowFromPx: 1, shadowToPx: 3 },
  fadeOthers: { opacity: 0.25 }, costReveal: { dy: 8 }, priceReveal: { dy: 8 }, bubbleIn: { scale: 0.9, dy: 8 }, optionsIn: { dx: 40 },
  braceletSettle: { from: 1.15 }, message: { scale: 1.6, fromDeg: 20, rotateDeg: 6 }, refusalShake: { shakePx: 4, shakes: 2 },
  pageChange: { dx: 24 }, cardIn: { scale: 0.95 },
};

describe('motion params in data', () => {
  it('test_every_spec_quantity_is_carried_by_timing_params', () => {
    for (const [id, want] of Object.entries(SPEC_PARAMS)) {
      const entry = timing().motion[id as MotionId];
      expect(entry.v.params, id).toEqual(want);
      expect(entry.src, id).toContain('§4');
    }
  });

  it('test_no_motion_is_silently_identity_without_caller_params', () => {
    for (const id of Object.keys(SPEC_PARAMS) as MotionId[]) {
      const kf = motionFor(id, false, timing())!.keyframes;
      expect(new Set(kf.map((k) => JSON.stringify(k))).size, id).toBeGreaterThan(1);
    }
  });

  it('test_params_are_read_from_data_not_literals', () => {
    const t = structuredClone(timing());
    t.motion.pageChange = { ...t.motion.pageChange, v: { ...t.motion.pageChange.v, params: { dx: 99 } } };
    expect(JSON.stringify(motionFor('pageChange', false, t)!.keyframes)).toContain('99px');
  });

  it('test_fade_others_opacity_equals_theme_faded_opacity', () => {
    expect(timing().motion.fadeOthers.v.params.opacity).toBe(loadUi().theme.fadedOpacity);
  });

  it('test_refusal_shake_has_two_shakes_of_4px', () => {
    const xs = motionFor('refusalShake', false, timing())!.keyframes.map((k) => k.transform);
    expect(xs).toEqual(['translateX(0px)', 'translateX(-4px)', 'translateX(4px)', 'translateX(-4px)', 'translateX(4px)', 'translateX(0px)']);
  });
});

describe('designate (questionnaire par échelle, rue par largeur, fond rose par jetons)', () => {
  it('test_designate_street_animates_width_432_to_480_and_pink_background', () => {
    const { theme } = loadUi();
    const kf = motionFor('designate', false, timing(), designateParams(theme, 'street'))!.keyframes;
    expect([kf[0]!.width, kf[1]!.width]).toEqual(['432px', '480px']);
    expect([kf[0]!.backgroundColor, kf[1]!.backgroundColor]).toEqual(['var(--c-creme)', 'var(--c-rose)']);
    expect(kf[1]!.transform).toContain(`rotate(${theme.street.designatedRotationDeg.v}deg)`);
    expect(JSON.stringify(kf)).not.toMatch(/#|rgb|hsl/);
  });

  it('test_designate_questionnaire_scales_1_025_and_rotates', () => {
    const { theme } = loadUi();
    const kf = motionFor('designate', false, timing(), designateParams(theme, 'questionnaire'))!.keyframes;
    expect(kf[1]!.transform).toBe('scale(1.025) rotate(-0.6deg)');
    expect(kf[1]!.width).toBeUndefined();
  });

  it('test_undesignate_is_the_exact_reverse', () => {
    const { theme } = loadUi();
    const p = designateParams(theme, 'street');
    expect(motionFor('undesignate', false, timing(), p)!.keyframes).toEqual([...motionFor('designate', false, timing(), p)!.keyframes].reverse());
  });

  it('test_confirm_press_squashes_shadow_3_to_1_and_moves_2px', () => {
    const kf = motionFor('confirmPress', false, timing(), { shadowColor: 'var(--sh-menthe)' })!.keyframes;
    expect(kf).toEqual([
      { transform: 'translateY(0px)', boxShadow: '0 3px 0 var(--sh-menthe)' },
      { transform: 'translateY(2px)', boxShadow: '0 1px 0 var(--sh-menthe)' },
    ]);
  });
});

describe('fond de repos par écran [spec C §3.1, §3.3]', () => {
  const bgs = (variant: 'questionnaire' | 'street', id: 'designate' | 'undesignate'): unknown[] =>
    motionFor(id, false, timing(), designateParams(loadUi().theme, variant))!.keyframes.map((k) => k.backgroundColor);

  it('test_questionnaire_rests_on_white_street_on_cream', () => {
    expect(bgs('questionnaire', 'designate')).toEqual(['var(--c-blanc)', 'var(--c-rose)']);
    expect(bgs('street', 'designate')).toEqual(['var(--c-creme)', 'var(--c-rose)']);
  });

  it('test_undesignate_ends_on_the_screen_rest_background', () => {
    expect(bgs('questionnaire', 'undesignate').at(-1)).toBe('var(--c-blanc)');
    expect(bgs('street', 'undesignate').at(-1)).toBe('var(--c-creme)');
  });
});

describe('reducedMotionOf', () => {
  it('test_reduced_motion_of_flag_wins_over_media', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(reducedMotionOf(undefined)).toBe(true);
    expect(reducedMotionOf(false)).toBe(false);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(reducedMotionOf(undefined)).toBe(false);
    expect(reducedMotionOf(true)).toBe(true);
  });
});

describe('animator', () => {
  it('test_instant_animator_records_and_resolves', async () => {
    const an = createInstantAnimator();
    const el = {} as Element;
    const spec = motionFor('cardIn', false, timing(), PARAMS)!;
    await expect(an.play(el, spec)).resolves.toBeUndefined();
    expect(an.played()).toEqual([{ el, spec }]);
  });
});
