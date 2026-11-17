import { expect, it } from 'vitest';
import { devValidate } from '../../../src/app/devValidate';
import { inputWithMeta, realInput } from '../../fixtures/data/factories';

it('test_dev_validate_passes_on_real_data', () => {
  const warn: string[] = [];
  expect(() => devValidate(realInput(), (m) => warn.push(m))).not.toThrow();
});

it('test_dev_validate_throws_on_voice_with_numeric_params', () => {
  const input = inputWithMeta({ 'w10.x': { policy: 'voice', numericParams: ['n'] } });
  expect(() => devValidate(input, () => undefined)).toThrow(/GDD05-V8-numeric-params-under-voice/);
});
