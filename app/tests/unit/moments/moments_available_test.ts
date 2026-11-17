import { describe, expect, it } from 'vitest';
import { availableOptions } from '../../../src/engine/moments/choices';
import { replay } from '../../../src/engine/moments/replay';
import { reduceAct } from '../../../src/engine/moments/state';
import type { StreetState } from '../../../src/engine/moments/types';
import type { WeekState } from '../../../src/engine/week';
import type { ActRecord } from '../../../src/shared/types/street';
import { pathsOf } from '../../../src/validate/guided';
import { act, ctxW10, homeAt, streetAt } from '../../support/street';
import { stateAfter } from '../../support/guided';

const ctx = ctxW10();
/**
 * Noeuds du préfixe commun des chemins de `pathsOf` que le moteur refuse (voies du contrôle fermées par l'état : bons, composant,
 * courtoisie) ; mesuré, déterministe. N7 : 855 (4 185 avant, quand `pathsOf` gardait le retour d'agent hors `requires`).
 */
const DISCARDED = 855;
const key = (a: ActRecord): string => `${a.day}.${a.minute}.${a.kind}.${a.id}.${a.option}`;
const choiceIdOf = (a: ActRecord): string | null => (a.kind === 'lane' ? `checkpoint.j${a.day}` : a.kind === 'choice' ? a.id : null);
const actFor = (s: StreetState, choiceId: string, option: string): ActRecord =>
  choiceId.startsWith('checkpoint.') ? act(s.day, s.clock.minute, 'lane', 'checkpoint', option) : act(s.day, s.clock.minute, 'choice', choiceId, option);

describe('availableOptions', () => {
  it('test_available_options_are_never_rejected_on_confirm', () => {
    const seen = new Map<string, { s: StreetState; w: WeekState } | null>();
    let nodes = 0; let discarded = 0; let offered = 0;
    for (const p of pathsOf(ctx.street, 2)) {
      let { state: s, week: w } = replay([], ctx);
      let prefix = '';
      for (const a of p.acts) {
        prefix += `|${key(a)}`;
        const known = seen.get(prefix);
        if (known === null) break;
        if (known !== undefined) { s = known.s; w = known.w; continue; }
        nodes += 1;
        for (const c of ctx.street.choices) {
          for (const o of availableOptions(s, ctx, c.id)) {
            offered += 1;
            const r = reduceAct(s, w, actFor(s, c.id, o), ctx);
            expect(r, `${c.id}/${o} présenté mais refusé (jour ${s.day}, minute ${s.clock.minute})`).not.toHaveProperty('reason');
          }
        }
        const r = reduceAct(s, w, a, ctx);
        if ('reason' in r) {
          const c = choiceIdOf(a);
          expect(c === null || !availableOptions(s, ctx, c).includes(a.option ?? ''), `acte refusé que availableOptions présente : ${key(a)}`).toBe(true);
          seen.set(prefix, null); discarded += 1;
          break;
        }
        seen.set(prefix, { s: r.state, w: r.week }); s = r.state; w = r.week;
      }
    }
    expect(nodes).toBeGreaterThan(0); expect(offered).toBeGreaterThan(0); expect(discarded, 'chemins écartés : options à prix indisponibles dans le sur-ensemble de pathsOf').toBe(DISCARDED);
  }, 60_000);   // marche exhaustive des 6 210 chemins (9 018 avant N7) : ~5 s seule, dépassait le délai par défaut de 5 s sous la charge de la suite complète

  it('test_courtesy_lane_hidden_when_palier_not_courtesy', () => {
    const s = { ...stateAfter([], ctx), ...homeAt(2, 480), location: 'street' as const, readings: [{ day: 1, palier: 'strained' }] } as unknown as StreetState;
    expect(availableOptions(s, ctx, 'checkpoint.j2')).not.toContain('courtesy');
    expect(availableOptions({ ...s, readings: [] } as StreetState, ctx, 'checkpoint.j2')).toContain('courtesy');
  });

  it('test_buy_options_filtered_by_bons_and_component', () => {
    const s = { ...homeAt(1, 480), location: 'street' as const, bons: 0, kit: { ...homeAt(1, 480).kit, component: 'handedOver' } } as StreetState;
    const o = availableOptions(s, ctx, 'checkpoint.j1');
    expect(o).not.toContain('buy:bons'); expect(o).not.toContain('buy:component'); expect(o).toContain('comply');
  });

  it('test_closed_unknown_or_indoors_gives_nothing', () => {
    expect(availableOptions(homeAt(1, 480), ctx, 'checkpoint.j1')).toEqual([]);
    expect(availableOptions(homeAt(1, 480), ctx, 'nope')).toEqual([]);
    expect(availableOptions(homeAt(1, 480), ctx, 'j2.component')).toEqual([]);
  });

  it('test_jalon_offered_only_when_due', () => {
    expect(availableOptions(homeAt(2, 900), ctx, 'j2.agentReturn')).toEqual([]);
    for (const opt of ['keep', 'leaveVisible']) {
      const s = { ...streetAt(2, 1020), confirmed: { '2.j2.component': opt } } as StreetState;
      expect(availableOptions({ ...s, clock: { day: 2, minute: 1019 } }, ctx, 'j2.agentReturn')).toEqual([]);
      expect(availableOptions(s, ctx, 'j2.agentReturn')).toEqual(['go']);
      expect(reduceAct(s, replay([], ctx).week, act(2, 1020, 'choice', 'j2.agentReturn', 'go'), ctx)).not.toHaveProperty('reason');
    }
    const hide = { ...streetAt(2, 1020), confirmed: { '2.j2.component': 'hide' } } as StreetState;
    expect(availableOptions(hide, ctx, 'j2.agentReturn')).toEqual([]);
  });
});
