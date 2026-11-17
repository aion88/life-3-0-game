// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { boot } from '../../../src/main';

it('test_boot_sets_ready_flag', async () => {
  const root = document.createElement('div');
  await boot(root);
  expect(document.documentElement.dataset['ready']).toBe('1');
});
