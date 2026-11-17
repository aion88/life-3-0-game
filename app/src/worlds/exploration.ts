/** Alternate runs never overwrite the original questionnaire or its legacy action log. */
import type { AppContext } from '../app/shell';
import type { Answers, RunResult } from '../shared/types';
import { runFastForward } from '../fastforward/run';
import { loadFastForwardData } from '../screens/data';
import { SHORT_WORLDS } from './routing';
import { mountExplorer } from './explorer';
const KEY = 'aftermath.exploration.v1';
interface Exploration { origin: Answers; answers: Answers; entered: boolean; visit?: string }
let memory: Exploration | null = null;
const same = (a: Answers, b: Partial<Answers>): boolean => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
export function clearExploration(): void { memory = null; try { sessionStorage.removeItem(KEY); } catch { /* In-memory fallback. */ } }
function write(value: Exploration): void { memory = value; try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* In-memory fallback. */ } }
export function exploration(ctx: AppContext): Exploration | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as Exploration;
    const valid = (a: Answers): boolean => !!a && ctx.core.questionnaire.questions.every(q => q.answers.some(v => v.key === a[q.key]));
    if (!memory || !valid(memory.origin) || !valid(memory.answers) || typeof memory.entered !== 'boolean' || !same(memory.origin, ctx.save.load().data.answers)) { clearExploration(); return null; }
  } catch { clearExploration(); return null; }
  if (!memory.visit) write({ ...memory, visit: crypto.randomUUID() });
  return memory;
}
export function enterExploration(ctx: AppContext): boolean { const value = exploration(ctx); if (!value) return false; write({ ...value, entered: true }); return true; }
export function openExploration(host: HTMLElement, ctx: AppContext, run: RunResult): { dispose(): void } {
  const origin = exploration(ctx)?.origin ?? run.answers;
  const original = runFastForward(ctx.core, loadFastForwardData().headlines, origin, run.softened, SHORT_WORLDS);
  return mountExplorer(host, ctx, original, answers => {
    write({ origin, answers, entered: false, visit: crypto.randomUUID() });
    void ctx.navigate('fastforward', { answers: origin });
  });
}
/** Small explicit return control only during a hypothetical run. */
export function explorationReturn(ctx: AppContext, parent: HTMLElement): void {
  const value = exploration(ctx); if (!value) return;
  const b = parent.ownerDocument.createElement('button'); b.type = 'button'; b.dataset['ui'] = 'exploration-return';
  b.textContent = ctx.i18n.lang() === 'fr' ? 'Hypothèse · Revenir à ma partie' : 'Alternative · Return to my game';
  b.addEventListener('click', () => { clearExploration(); void ctx.navigate('fastforward', { answers: value.origin }); }); parent.append(b);
}

/** Each deliberate visit starts fresh; reloads keep that visit, originals keep their own key. */
export function explorationProgressKey(ctx: AppContext, originalKey: string): string {
  const visit = exploration(ctx)?.visit;
  return visit ? `${originalKey}.exploration.${visit}` : originalKey;
}
