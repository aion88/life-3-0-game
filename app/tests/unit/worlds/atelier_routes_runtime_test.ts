// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { journeys } from '../../../src/worlds/catalogue';
import { atelierRoutes } from '../../../src/worlds/atelierRoutes';
import { mountJourney } from '../../../src/worlds/runtime';
import type { JourneyView } from '../../../src/worlds/view';
import type { RunResult } from '../../../src/shared/types';
import { fakeCtx } from '../../support/screens';
import { runLine } from '../../support/screens_ff';

const memory = (): Storage => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear(), key: () => null, get length() { return m.size; } } as unknown as Storage; };
beforeEach(() => { vi.stubGlobal('localStorage', memory()); vi.stubGlobal('sessionStorage', memory()); document.body.replaceChildren(); });
afterEach(() => vi.unstubAllGlobals());
const fakeView = async (): Promise<JourneyView> => ({ show: vi.fn(), perform: vi.fn(async () => {}), skip: vi.fn(), setEmotion: vi.fn(), setLighting: vi.fn(), dispose: vi.fn() } as unknown as JourneyView);
const settleTasks = async (): Promise<void> => { for (let i = 0; i < 6; i++) await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); };

it('test_atelier_routes_runtimeConformance_decisionFlagMatchesPressesTheRuntimeAsks', async () => {
  // Arrange: tous les chemins runtime, joués contre le VRAI `mountJourney` (vue simulée).
  const all = atelierRoutes(journeys);
  const source = runLine('BAABBACBBAD'); if (source.outcome.kind !== 'arrival') throw new Error('arrival fixture required');
  for (const [world, entry] of Object.entries(all)) {
    if (world === 'w10') continue;
    for (const route of entry.routes) {
      localStorage.clear();
      const run = { ...source, seed: -1, outcome: { ...source.outcome, computedWorld: world } } as unknown as RunResult;
      const root = document.createElement('div'); document.body.replaceChildren(root);
      const runtime = await mountJourney(fakeCtx(), run, root, { view: fakeView });
      root.querySelector<HTMLButtonElement>('.journey-modal button')?.click();
      await settleTasks();
      // Act + Assert: une étape `decision` est présentée (la scène courante est la sienne) ; une autre a déjà été appliquée seule.
      for (const step of route.path) {
        const current = root.querySelector('.journey')?.getAttribute('data-scene');
        const label = `${world}/${route.ending} ${step.scene}/${step.option}`;
        if (!step.decision) { expect(current, `${label} aurait dû être appliquée seule`).not.toBe(step.scene); continue; }
        expect(current, label).toBe(step.scene);
        const button = root.querySelector<HTMLButtonElement>(`[data-option="${step.option}"]`);
        expect(button, `${label} : bouton absent`).not.toBeNull();
        expect(button!.disabled, `${label} : bouton désactivé`).toBe(false);
        button!.click();
        await settleTasks();
      }
      expect(root.querySelector('.journey')?.getAttribute('data-scene'), `${world} fin`).toBe(route.ending);
      runtime.dispose();
    }
  }
}, 120000);
