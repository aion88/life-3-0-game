import { describe, expect, it } from 'vitest';
import type { GuidedData, SceneBeat, SceneSpec } from '../../../src/data/schema/guided';
import type { Mark } from '../../../src/engine/moments/marks';
import { leaveStep, nightActs, resolveBeat, routeNext, variantOf } from '../../../src/engine/moments/schedule';
import { w10Street } from '../../support/guided';

/** Marque minimale : seuls `linkId` et `variant` sont lus par l'horaire. */
const mark = (link: string, variant: string): Mark => ({ chainId: 'c', linkId: link, day: 4, minute: 0, variant, v: {} as Mark['v'] });

const BEAT_B3W: SceneBeat = { voice: 'narrator', lit: null, byLink: { link: 'B3w', keys: { theodore: 'w10.scene.j4.wake.bench' }, otherwise: null } };
const BEAT_DOC: SceneBeat = { voice: 'narrator', lit: null, byLink: { link: 'B3w', keys: { theodore: 'w10.doc.extrait.j4.theodore' }, otherwise: 'w10.doc.extrait.j4.otherwise' } };
const base = { day: 5, stage: 'wake', place: 'place.home', anchorMinute: 420, costMin: 0, late: null, actor: null, beats: [], transit: [], waitKind: 'none' } as const;
const J5_WAKE: SceneSpec = { ...base, id: 'j5.wake', ask: { kind: 'route', link: 'B4w', next: { fille: 'j5.sealed' }, otherwise: 'j5.daughter' } } as SceneSpec;
const G = { scenes: [J5_WAKE] } as unknown as GuidedData;

describe('moments : horaire de la semaine, replique et route selon une marque [plan rue guidee J3-J7, T2]', () => {
  it('test_variant_of_reads_marks', () => { expect(variantOf([mark('B3w', 'nadia')], 'B3w')).toBe('nadia'); expect(variantOf([], 'B3w')).toBeNull(); });
  it('test_resolve_beat_reads_variant', () => { expect(resolveBeat(BEAT_B3W, [mark('B3w', 'theodore')])).toBe('w10.scene.j4.wake.bench'); expect(resolveBeat(BEAT_B3W, [mark('B3w', 'nadia')])).toBeNull(); });
  it('test_resolve_beat_otherwise_on_absent_or_unset', () => { expect(resolveBeat(BEAT_B3W, [mark('B3w', 'absent')])).toBeNull(); expect(resolveBeat(BEAT_DOC, [])).toBe('w10.doc.extrait.j4.otherwise'); });
  it('test_resolve_beat_plain_line_gives_its_key', () => { expect(resolveBeat({ voice: 'me', key: 'k.x', lit: null }, [])).toBe('k.x'); });
  it('test_route_next_and_branch', () => { expect(routeNext(J5_WAKE, [mark('B4w', 'fille')])).toEqual({ next: 'j5.sealed', branch: 'fille' }); expect(routeNext(J5_WAKE, [mark('B4w', 'yusuf')])).toEqual({ next: 'j5.daughter', branch: '*' }); });
  it('test_leave_route_takes_branch', () => { expect(leaveStep(G, 'j5.wake', 'fille', 450).next).toBe('j5.sealed'); expect(leaveStep(G, 'j5.wake', '*', 450).next).toBe('j5.daughter'); expect(() => leaveStep(G, 'j5.wake', 'dance', 450)).toThrow(/dance/); });
  it('test_leave_route_without_branch_throws', () => { expect(() => leaveStep(G, 'j5.wake', null, 450)).toThrow(/j5.wake/); });
  it('test_no_night_acts_on_day_seven', () => { expect(nightActs(w10Street, 7, 1100, 'street')).toEqual([]); expect(nightActs(w10Street, 6, 900, 'registre').map((a) => a.kind)).toEqual(['exit', 'enter', 'sleep']); });
});
