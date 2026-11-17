import { describe, expect, it } from 'vitest';
import { validateContent } from '../../../src/validate/content';
import { inputWithEvent, inputWithMeta, inputWithMilestone, realInput } from '../../fixtures/data/factories';

describe('validate content', () => {
  it('test_event_ws_effect_signalled_not_blocking', () => {
    const r = validateContent(inputWithEvent({ id: 'zk-observation', wsEffect: { unrest: 1000 }, repeatable: true }));
    expect(r.errors).toEqual([]); expect(r.warnings.map(i => i.code)).toContain('GDD03-D128-event-ws-effect');
    expect(r.warnings.find(i => i.code === 'GDD03-D128-event-ws-effect')!.owner).toBe('world-builder');
  });
  it('test_milestone_ws_delta_without_cap_is_error', () => {
    const r = validateContent(inputWithMilestone({ id: 'm1', wsDelta: { surveillance: 2000 } }, null));
    expect(r.errors.map(i => i.code)).toEqual(['GDD03-K3b-cap-required']);
  });
  it('test_missing_cap_signalled_as_debt', () => { expect(validateContent(realInput()).warnings.map(i => i.code)).toContain('GDD03-K3b-cap-missing'); });
  it('test_numeric_params_under_voice_is_error', () => {
    const r = validateContent(inputWithMeta({ 'w10.x': { policy: 'voice', numericParams: ['n'] } }));
    expect(r.errors.map(i => i.code)).toContain('GDD05-V8-numeric-params-under-voice');
  });
});
