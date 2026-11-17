// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { loadFastForwardData } from '../../../src/screens/data';
import { runFastForward } from '../../../src/fastforward/run';
import { SHORT_WORLDS } from '../../../src/worlds/routing';
import { ATELIER_LINES, atelierAnswers, isAtelierWorld } from '../../../src/worlds/atelierAnswers';
import { atelierProgressKeys, mountAtelierWorld } from '../../../src/worlds/atelierWorld';
import type { JourneyView } from '../../../src/worlds/view';

const store = (): Storage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); }, clear: () => data.clear(), key: () => null, get length() { return data.size; } } as unknown as Storage & { data: Map<string, string> };
};
let local: ReturnType<typeof store>; let session: ReturnType<typeof store>;
beforeEach(() => { local = store(); session = store(); vi.stubGlobal('localStorage', local); vi.stubGlobal('sessionStorage', session); document.body.replaceChildren(); });
afterEach(() => vi.unstubAllGlobals());
const fakeView = async (): Promise<JourneyView> => ({ show: vi.fn(), perform: vi.fn(async () => {}), skip: vi.fn(), setEmotion: vi.fn(), setLighting: vi.fn(), dispose: vi.fn() } as unknown as JourneyView);

it('test_atelier_world_everyFixture_leadsToItsOwnWorld', () => {
  // Arrange
  const core = loadCore(); const headlines = loadFastForwardData().headlines;
  for (const world of Object.keys(ATELIER_LINES)) {
    if (!isAtelierWorld(world)) throw new Error(world);
    // Act
    const outcome = runFastForward(core, headlines, atelierAnswers(world), false, SHORT_WORLDS).outcome;
    // Assert
    expect(outcome.kind === 'arrival' ? outcome.computedWorld : outcome.world, world).toBe(world);
  }
});

it('test_atelier_world_mountJourney_neverWritesPlayerSaveOrExploration', async () => {
  // Arrange
  const root = document.createElement('div'); document.body.append(root);
  // Act: monte w01, ferme l'accueil, joue une décision, puis appuie sur « Explorer » si présent.
  const dispose = await mountAtelierWorld(root, '?atelier=monde&monde=w01', { view: fakeView });
  root.querySelector<HTMLButtonElement>('.journey-modal button')?.click();
  root.querySelector<HTMLButtonElement>('.journey-options button:not(:disabled)')?.click();
  // Assert
  expect(root.querySelector('.journey')?.getAttribute('data-world')).toBe('w01');
  expect(local.data.has(atelierProgressKeys('w01')[0]!)).toBe(true);
  expect([...local.data.keys()]).not.toContain('aiaftermath.v2.save');
  expect([...local.data.keys()].every(key => atelierProgressKeys('w01').includes(key))).toBe(true);
  expect(session.data.has('aftermath.exploration.v1')).toBe(false);
  expect(Object.values(window.__atelierRoutes ?? {}).flatMap(entry => entry.routes).length).toBeGreaterThanOrEqual(31 + 15);
  dispose();
  expect(window.__atelierRoutes).toBeUndefined();
});

it('test_atelier_world_playerSentinels_areNeitherReadNorWrittenNorErased', async () => {
  // Arrange: des sentinelles de joueur dans les deux stockages, et des espions sur chaque accès.
  const foreign = JSON.stringify({ origin: {}, answers: {}, entered: true, visit: 'ailleurs' });
  session.setItem('aftermath.exploration.v1', foreign); local.setItem('aiaftermath.v2.save', 'sauvegarde-joueur'); local.setItem('aftermath.journey.v1.w02.4242', 'parcours-joueur');
  const sentinels = { exploration: session.getItem('aftermath.exploration.v1'), save: local.getItem('aiaftermath.v2.save'), journey: local.getItem('aftermath.journey.v1.w02.4242') };
  const realSession = session;
  const sessionCalls = vi.fn(); const originals = { g: realSession.getItem, s: realSession.setItem, r: realSession.removeItem };
  realSession.getItem = (k: string) => { sessionCalls('get', k); return originals.g(k); };
  realSession.setItem = (k: string, v: string) => { sessionCalls('set', k); originals.s(k, v); };
  realSession.removeItem = (k: string) => { sessionCalls('remove', k); originals.r(k); };
  const localWrites: string[] = []; const setLocal = local.setItem, removeLocal = local.removeItem;
  local.setItem = (k: string, v: string) => { localWrites.push(k); setLocal(k, v); }; local.removeItem = (k: string) => { localWrites.push(k); removeLocal(k); };
  const root = document.createElement('div'); document.body.append(root);
  // Act: monte, ferme l'accueil, joue une décision.
  const dispose = await mountAtelierWorld(root, '?atelier=monde&monde=w02', { view: fakeView });
  root.querySelector<HTMLButtonElement>('.journey-modal button')?.click();
  root.querySelector<HTMLButtonElement>('.journey-options button:not(:disabled)')?.click();
  // Assert: la vraie sessionStorage n'a reçu aucun appel, les sentinelles sont identiques, seules les clés de l'atelier ont été écrites.
  expect(sessionCalls).not.toHaveBeenCalled();
  expect(localWrites.length).toBeGreaterThan(0);
  expect(localWrites.every(key => atelierProgressKeys('w02').includes(key))).toBe(true);
  expect({ exploration: session.getItem('aftermath.exploration.v1'), save: local.getItem('aiaftermath.v2.save'), journey: local.getItem('aftermath.journey.v1.w02.4242') }).toEqual(sentinels);
  dispose();
  expect(window.sessionStorage).toBe(realSession);
});

it('test_atelier_world_neufParam_clearsOnlyAtelierKeys', async () => {
  // Arrange
  const [key] = atelierProgressKeys('w03');
  local.setItem(key!, '{"v":1}'); local.setItem('aftermath.journey.v1.w03.12345', 'joueur'); local.setItem('aiaftermath.v2.save', 'joueur');
  const root = document.createElement('div'); document.body.append(root);
  // Act
  const dispose = await mountAtelierWorld(root, '?atelier=monde&monde=w03&neuf=1', { view: fakeView });
  // Assert
  expect(local.data.has(key!)).toBe(false);
  expect(local.getItem('aftermath.journey.v1.w03.12345')).toBe('joueur');
  expect(local.getItem('aiaftermath.v2.save')).toBe('joueur');
  dispose();
});

it('test_atelier_world_w10_mountsEpisodeWithAtelierSeed', async () => {
  // Arrange
  const mountEpisode = vi.fn(async () => ({ dispose: vi.fn() }));
  const root = document.createElement('div'); document.body.append(root);
  // Act
  const dispose = await mountAtelierWorld(root, '?atelier=monde&monde=w10', { loadEpisode: async () => ({ mountEpisode }) });
  // Assert
  expect(mountEpisode).toHaveBeenCalledOnce();
  const run = (mountEpisode.mock.calls[0] as unknown as [unknown, { seed: number; outcome: { computedWorld: string } }])[1];
  expect(run.seed).toBe(-1); expect(run.outcome.computedWorld).toBe('w10');
  dispose();
});

it('test_atelier_world_unknownWorld_showsMenuWithoutMounting', async () => {
  const root = document.createElement('div'); document.body.append(root);
  const dispose = await mountAtelierWorld(root, '?atelier=monde&monde=w07');
  expect(root.querySelectorAll('a').length).toBe(10);
  dispose(); expect(root.children.length).toBe(0);
});
