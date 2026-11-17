// @vitest-environment happy-dom
/**
 * Carte de montage à l'écran [plan semaine condensée T3, décision 5, I-2, I-5, R-3] : texte seul, 4 lignes au plus, le fait une fois,
 * le panneau d'options reste en Z-droite. Les textes viennent de clés réelles ou de la locale d'essai, jamais de chaînes écrites ici.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { ChoiceView, GestureEvent, UiHandle } from '../../../src/street/ui';
import type { MontageView } from '../../../src/street/ui/montage';
import { createInstantAnimator } from '../../../src/ui/motion';
import { pseudoI18n, realI18n, visibleTexts } from '../../support/street_ui';
import { shotKindOf } from '../../../src/street/guidedRuntime';
import type { Beat } from '../../../src/street/guided/director';
import type { SceneSpec } from '../../../src/data/schema/guided';

const q = (s: string): HTMLElement => document.body.querySelector(s) as HTMLElement;
const qa = (s: string): HTMLElement[] => [...document.body.querySelectorAll<HTMLElement>(s)];
const fr = realI18n('fr');
let ui: UiHandle;

/** Carte la plus chargée : 1 ligne S1, posture, fait ; sans fin tant que la nuit n'a pas eu lieu. */
const open: MontageView = { day: 2, lineKeys: ['w10.msg.courtesy'], postureKey: 'w10.msg.patience', fact: { key: 'w10.fact.E', sourceKey: 'w10.fact.E.source' }, tail: null };
const noFact: MontageView = { ...open, fact: null, lineKeys: ['w10.msg.courtesy', 'w10.msg.thanks'] };
const choice: ChoiceView = { id: 'c.card', labelKey: 'street.ui.choices.milestone', blocksExit: false, priced: true, options: ['a', 'b', 'c'].map((id) => ({ id, labelKey: 'street.ui.sleep', isRefusal: false, words: 0 })) };

beforeEach(() => {
  document.body.innerHTML = '';
  ui = mountUi(document.body.appendChild(document.createElement('div')), fr, { reducedMotion: false, animator: createInstantAnimator() });
});
afterEach(() => { ui.dispose(); });

describe('carte de montage [T3]', () => {
  it('test_card_renders_title_and_at_most_four_lines', () => {
    ui.showMontage({ ...open, tail: { kind: 'palier', palier: 'courtesy' } });
    expect(q('[data-ui="montage-title"]').textContent).toBe(fr.t('w10.day.2.date'));
    // lignes S1 (1) + posture + fait + fin = 4
    expect(qa('[data-ui="montage"] > p')).toHaveLength(4);
    ui.showMontage({ ...noFact, tail: { kind: 'palier', palier: 'courtesy' } });
    expect(qa('[data-ui="montage"] > p')).toHaveLength(4);   // 2 S1 + posture + fin
    expect(q('[data-ui="montage"]').querySelector('button')).toBeNull();
  });
  it('test_card_shows_its_fact_once', () => {
    ui.showMontage(open);
    const facts = qa('[data-ui="montage-fact"]');
    expect(facts).toHaveLength(1);
    expect(facts[0]!.textContent).toContain(fr.t('w10.fact.E'));
    expect(facts[0]!.textContent).toContain(fr.t('w10.fact.E.source'));
    expect(q('[data-ui="montage"]').textContent!.split(fr.t('w10.fact.E')).length - 1).toBe(1);
    ui.showMontage(noFact);
    expect(qa('[data-ui="montage-fact"]')).toHaveLength(0);
    expect(document.body.querySelector('[data-ui="recap-fact"]')).toBeNull();
  });
  it('test_card_stays_mounted_through_choice_and_end', () => {
    ui.showMontage(open); ui.showDestinations(choice);
    expect(qa('[data-ui="montage"]')).toHaveLength(1);
    ui.showDestinations(null); ui.showMontage({ ...open, tail: { kind: 'palier', palier: 'thanks' } });
    expect(qa('[data-ui="montage"]')).toHaveLength(1);
    expect(q('[data-ui="montage-tail"]')).not.toBeNull();
    ui.showMontage(null);
    expect(qa('[data-ui="montage"]')).toHaveLength(0);
  });
  it('test_card_choice_panel_stays_in_right_zone', () => {
    ui.showMontage(open); ui.showDestinations(choice);
    const panel = q('[data-ui="choices"]');
    expect(panel).not.toBeNull();
    expect(panel.closest('[data-ui="montage"]')).toBeNull();                 // le panneau n'est pas dans la carte
    expect(q('[data-ui="montage"]').querySelector('button, [role="option"], [data-ui="options"]')).toBeNull();
    expect(q('[data-ui="montage"]').closest('[data-zone="centre"]')).not.toBeNull();   // la carte est en Z-centre, texte seul
    expect(panel.closest('[data-zone]')).toBeNull();                          // le panneau garde sa place actuelle (Z-droite posée par zones.ts) : hors des colonnes gauche et centre
    expect(panel.dataset['side']).not.toBe('left');                          // `mirrored` (zones.ts:30) reste faux : rien ne coupe la droite
  });
  it('test_card_choice_uses_choice_view_and_confirms', () => {
    const got: GestureEvent[] = []; ui.onGesture((e) => { got.push(e); });
    ui.showMontage(open); ui.showDestinations(choice);
    (q('[data-option="b"]') as HTMLElement).click();   // le même panneau que sur un jour joué : désigner, puis confirmer
    ui.showPrice({ choiceId: 'c.card', optionId: 'b', textKey: 'street.ui.controls', isRefusal: false, inventoryParams: {} });
    q('[data-ui="confirm"]').click();
    expect(got.length).toBeGreaterThan(0);
    expect(got.map((e) => [e.choiceId, e.optionId, e.gesture])).toEqual([['c.card', 'b', 'designate'], ['c.card', 'b', 'confirm']]);
  });
  it('test_card_tail_palier_uses_msg_key', () => {
    ui.showMontage({ ...open, tail: { kind: 'palier', palier: 'patience' } });
    expect(q('[data-ui="montage-tail"]').textContent).toBe(fr.t('w10.msg.patience'));
  });
  it('test_card_tail_arrested_uses_arrested_night_key', () => {
    ui.showMontage({ ...open, tail: { kind: 'arrested', key: 'w10.end.arrestedNight', day: 5 } });
    const t = q('[data-ui="montage-tail"]');
    expect(t.textContent).toBe(fr.t('w10.end.arrestedNight', { jour: fr.t('w10.day.5.date') }));
    expect(t.dataset['tail']).toBe('arrested');
  });
  it('test_card_continue_only_after_tail', () => {
    // le bouton « Continuer » est celui de la barre d'avance : la carte n'en porte pas ; le runtime l'allume à `montage` et `montageEnd`, jamais au choix
    ui.showMontage(open); ui.showContinue(false); ui.showDestinations(choice);
    expect(q('[data-ui="advance"]').hidden).toBe(true);
    expect(q('[data-ui="montage"]').querySelector('[data-ui="continue"]')).toBeNull();
  });
  it('test_card_has_no_literal_text', () => {
    ui.dispose();
    document.body.innerHTML = '';
    ui = mountUi(document.body.appendChild(document.createElement('div')), pseudoI18n('fr'), { reducedMotion: false, animator: createInstantAnimator() });
    ui.showMontage({ ...open, tail: { kind: 'arrested', key: 'w10.end.arrestedNight', day: 5 } });
    const texts = visibleTexts(q('[data-ui="montage"]'));
    expect(texts.length).toBeGreaterThanOrEqual(5);
    for (const t of texts) expect(t.startsWith('[!!') || t.includes('[!!')).toBe(true);
  });
  it('test_card_follows_language', () => {
    ui.showMontage({ ...open, tail: { kind: 'palier', palier: 'thanks' } });
    fr.setLang('en');
    try { expect(q('[data-ui="montage-tail"]').textContent).toBe(fr.t('w10.msg.thanks')); expect(q('[data-ui="montage-title"]').textContent).toBe(fr.t('w10.day.2.date')); }
    finally { fr.setLang('fr'); }
  });
});

describe('carte de montage : caméra [T3]', () => {
  const spec = { place: 'street.x', actor: { id: 'a' }, waitKind: null } as unknown as SceneSpec;
  const choiceBeat = { kind: 'choice', sceneId: 's', view: choice, priced: false, card: true } as unknown as Beat;
  it('test_montage_beats_frame_home', () => {
    const montage = { kind: 'montage', day: 2, posture: 'couloir', lineKeys: [], postureKey: 'k', factChainId: null } as Beat;
    const end = { kind: 'montageEnd', day: 2, tail: { kind: 'palier', palier: 'courtesy' } } as Beat;
    expect(shotKindOf(montage, null, 'home')).toBe('home');
    expect(shotKindOf(end, null, 'home')).toBe('home');
    expect(shotKindOf(choiceBeat, spec, 'home')).toBe('home');   // aucune scène 3D jouée derrière la carte
  });
});
