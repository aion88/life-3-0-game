import { describe, expect, it } from 'vitest';
import { getDraft, resetDraft } from '../../../src/screens/draft';

describe('brouillon de partie neuve', () => {
  it('test_draft_starts_empty_and_resets', () => {
    resetDraft();
    expect(getDraft().softened).toBeNull();
    getDraft().softened = true;
    expect(getDraft().softened).toBe(true);
    resetDraft();
    expect(getDraft().softened).toBeNull();
  });
});
