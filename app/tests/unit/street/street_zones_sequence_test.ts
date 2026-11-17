// @vitest-environment happy-dom
/**
 * Z-3 : réplique et ligne de droit ne sont jamais présentes ensemble ; la ligne de droit est mise EN FILE derrière la réplique, n'est
 * jamais perdue, et passe toujours avant la ligne de prix [design/ui/2026-11-02-zones-ecran-ux.md §3, Z-3 ; décision game-designer].
 * Test de séquence sur le vrai `mountUi`, par son API.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { ChoiceView, UiHandle } from '../../../src/street/ui';
import type { PriceLine } from '../../../src/engine/moments';
import { lineHalves } from '../../../src/engine/moments/rights';
import { createInstantAnimator } from '../../../src/ui/motion';
import { FR, realI18n } from '../../support/street_ui';

const HALVES = lineHalves(FR['w10.right.move']!);
const LINE_KEY = 'w10.street.trace.absent';
const CHOICES: readonly ChoiceView[] = [{ id: 'checkpoint.j1', labelKey: 'w10.price.checkpoint.bypass', blocksExit: false, options: [
  { id: 'comply', labelKey: 'w10.price.inv.checkpoint.comply', isRefusal: false, words: 14 },
  { id: 'bypass', labelKey: 'w10.price.checkpoint.bypass', isRefusal: true, words: 0 }] }];
const PRICE: PriceLine = { choiceId: 'checkpoint.j1', optionId: 'comply', textKey: 'w10.price.inv.checkpoint.comply', isRefusal: false, inventoryParams: {} };

let ui: UiHandle; let host: HTMLElement;
/** Journal de présence : à chaque lot de mutations, quels éléments de lecture sont dans le DOM. */
let seenTogether = 0; let added: string[] = []; let mo: MutationObserver;
const has = (s: string): boolean => host.querySelector(`[data-ui="${s}"]`) !== null;
const designate = (): void => { host.querySelector<HTMLElement>('[data-choice="checkpoint.j1"] [data-option="comply"]')!.click(); };
const flush = async (): Promise<void> => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

beforeEach(() => {
  document.body.innerHTML = '';
  host = document.body.appendChild(document.createElement('div'));
  ui = mountUi(host, realI18n('fr'), { animator: createInstantAnimator() });
  seenTogether = 0; added = [];
  mo = new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.addedNodes) if (n instanceof HTMLElement && n.dataset['ui'] !== undefined) added.push(n.dataset['ui']);
    if (has('bubble') && has('right-line')) seenTogether += 1;
  });
  mo.observe(host, { childList: true, subtree: true });
});
afterEach(() => { mo.disconnect(); ui.dispose(); });

describe('Z-3 : la ligne de droit attend la réplique', () => {
  it('test_right_line_requested_during_a_line_waits_and_shows_after_it', async () => {
    ui.showLine(LINE_KEY); await flush();
    ui.showRightLine(HALVES); await flush();
    expect(has('bubble')).toBe(true);
    expect(has('right-line'), 'en file : pas en même temps que la réplique').toBe(false);
    ui.clearLine(); await flush();
    expect(has('bubble')).toBe(false);
    expect(has('right-line'), 'la réplique fermée, la ligne de droit s\'affiche').toBe(true);
    expect(seenTogether).toBe(0);
  });

  it('test_right_line_already_shown_steps_back_for_a_line_then_returns', async () => {
    ui.showRightLine(HALVES); await flush();
    expect(has('right-line')).toBe(true);
    ui.showLine(LINE_KEY); await flush();
    expect(has('right-line'), 'la réplique prend le centre').toBe(false);
    ui.clearLine(); await flush();
    expect(has('right-line'), 'puis la ligne revient, son temps de lecture entier').toBe(true);
    expect(seenTogether).toBe(0);
  });

  it('test_right_line_never_lost_even_if_cleared_while_waiting', async () => {
    ui.showLine(LINE_KEY); await flush();
    ui.showRightLine(HALVES); await flush();
    ui.showRightLine(null); await flush();                               // le runtime l'efface avant qu'elle ait été vue
    ui.clearLine(); await flush();
    expect(has('right-line'), 'jamais perdue : elle passe une fois').toBe(true);
    expect(host.querySelector('[data-ui="right-line"] [data-half="1"]')?.textContent).toBe(HALVES.first);
    ui.showRightLine(null); await flush();                               // vue : l'effacement suivant s'applique
    expect(has('right-line')).toBe(false);
  });

  it('test_right_line_shows_before_the_price_line_when_a_choice_follows', async () => {
    ui.showChoices(CHOICES); designate(); ui.showLine(LINE_KEY); await flush();
    ui.showRightLine(HALVES); await flush();
    added = [];
    ui.showPrice(PRICE); await flush();
    expect(has('bubble'), 'le prix demandé ferme la réplique').toBe(false);
    expect(has('right-line')).toBe(true);
    expect(has('price')).toBe(true);
    const order = added.filter((n) => n === 'right-line' || n === 'price');
    expect(order[0], 'la ligne de droit avant la ligne de prix').toBe('right-line');
    expect(seenTogether).toBe(0);
  });

  it('test_price_without_a_waiting_right_line_is_immediate', () => {
    ui.showChoices(CHOICES); designate(); ui.showPrice(PRICE);
    expect(has('price')).toBe(true);
  });
});
