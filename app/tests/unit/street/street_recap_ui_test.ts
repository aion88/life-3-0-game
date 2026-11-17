// @vitest-environment happy-dom
/**
 * Relevé du soir précis, rendu [plan rue guidée J1-J2, T11] : chaque ligne nomme la personne, l'heure et les mots dits ou le silence ;
 * encarts « En 2026 », « Fait réel », « Ce qui est écrit » ; aucune ligne par axe ; la rue libre garde son soir tel quel.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { UiHandle } from '../../../src/street/ui';
import { createInstantAnimator } from '../../../src/ui/motion';
import { eveningRecap } from '../../../src/engine/moments/recap';
import type { Recap } from '../../../src/engine/moments/recap';
import { eveningLines } from '../../../src/engine/moments/evening';
import { replay } from '../../../src/engine/moments/replay';
import { rightParts } from '../../../src/engine/moments/rights';
import { pathsOf } from '../../../src/validate/guided';
import { parseWorld } from '../../../src/data/schema/world';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { ctxW10 } from '../../support/street';
import { FR, realI18n } from '../../support/street_ui';
import { pathOf, stateAtEvening } from '../../support/guided';

const w10 = parseWorld(w10Raw, cat);
const ctx = ctxW10();
const i18n = realI18n('fr');
const ANS = { Q11: 'C', Q04: 'A' } as const;
const stamp = (m: number): string => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
const q = (s: string): HTMLElement => document.body.querySelector(s) as HTMLElement;
const qa = (s: string): HTMLElement[] => [...document.body.querySelectorAll<HTMLElement>(s)];

let ui: UiHandle;
const render = (r: Recap): void => { ui.showEvening([], 'courtesy', r.day, r); };
beforeEach(() => { document.body.innerHTML = ''; ui = mountUi(document.body.appendChild(document.createElement('div')), i18n, { animator: createInstantAnimator(), reducedMotion: false }); });
afterEach(() => { ui.dispose(); });

describe('relevé du soir précis : rendu [T11]', () => {
  it('test_every_item_names_person_hour_and_words_or_silence', async () => {
    // Cette marche rend des milliers de relevés (4 176 chemins acceptés depuis N7, 1 638 avant). happy-dom garde chaque relevé retiré
    // (requêtes `querySelectorAll` en cache, observateur de mutations des zones) jusqu'au prochain tour de boucle : une marche synchrone les
    // retenait tous (mesuré N7 : 0,5 Mo par rendu, tas saturé à 4 Go). Un tour de boucle après chaque rendu, comme en jeu.
    let rendered = 0;
    for (const p of pathsOf(w10.street, 2)) {
      if (replay(p.acts, ctx).rejected.length > 0) continue;
      for (const d of [1, 2] as const) {
        if (!p.acts.some((a) => a.day === d && a.kind === 'sleep')) continue;
        const r = eveningRecap(stateAtEvening(p, d, ctx), ctx, ANS); render(r);
        const li = qa('[data-ui="recap"] ol > li');
        expect(li).toHaveLength(r.items.length);
        r.items.forEach((it, i) => {
          const text = li[i]!.textContent!;
          if (it.personKey !== null) expect(text).toContain(FR[it.personKey]!);
          else expect(li[i]!.querySelector('.c-recap-person')).toBeNull();
          expect(text).toContain(stamp(it.minute));
          expect(text).toContain(FR[it.recapKey]!);
          const said = `« ${FR[it.saidKey ?? 'w10.recap.silence']!} »`;
          if (it.speech === 'said') { expect(text).toContain(said); expect(text).not.toContain(FR['w10.recap.silence']!); }
          else if (it.speech === 'silence') { expect(text).toContain(FR['w10.recap.silence']!); expect(text).not.toContain('« '); }
          else { expect(text).not.toContain(FR['w10.recap.silence']!); expect(text).not.toContain('« '); }
        });
        rendered += 1;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    expect(rendered).toBeGreaterThan(20);
  }, 60_000);   // marche exhaustive de tous les chemins J1-J2, rendus un par un

  it('test_recap_quotes_real_answer_for_each_chain', () => {
    const r = eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, ANS); render(r);
    expect(q('[data-ui="recap-2026"] h3').textContent).toBe('En 2026');
    const A = q('[data-ui="recap-2026"] [data-chain="A"]').textContent!;
    for (const k of ['w10.chain.A.title', 'q.Q11.title', 'q.Q11.C.label', 'w10.chain.A.link.C']) expect(A, k).toContain(FR[k]!);   // chaîne, question, vraie réponse, puis le lien
    expect(A.indexOf(FR['q.Q11.C.label']!)).toBeLessThan(A.indexOf(FR['w10.chain.A.link.C']!));
    const B = q('[data-ui="recap-2026"] [data-chain="B"]').textContent!;
    for (const k of ['w10.chain.B.title', 'q.Q04.title', 'q.Q04.A.label', 'w10.chain.B.link.A']) expect(B, k).toContain(FR[k]!);
    const E = q('[data-ui="recap-2026"] [data-chain="E"]').textContent!;   // E : pas de réponse sauvegardée, la question reste nommée
    expect(E).toContain(FR['q.Q16.title']!); expect(E).toContain(FR['w10.recap.noAnswer']!);
    expect(qa('[data-ui="recap-2026"] [data-chain]').map((e) => e.dataset['chain'])).toEqual(r.chains.map((c) => c.chainId));
  });

  it('test_recap_without_answer_says_so', () => {
    const r = eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, {}); render(r);
    for (const c of r.chains) {
      const t = q(`[data-ui="recap-2026"] [data-chain="${c.chainId}"]`).textContent!;
      expect(t).toContain(FR[`q.${c.questionKey}.title`]!); expect(t).toContain(FR['w10.recap.noAnswer']!);
      expect(t.indexOf(FR[`q.${c.questionKey}.title`]!)).toBeLessThan(t.indexOf(FR['w10.recap.noAnswer']!));   // la question d'abord, puis l'absence de réponse
    }
  });

  it('test_recap_fact_box_gives_each_chain_fact_with_its_source', () => {
    const r = eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, ANS); render(r);
    expect(q('[data-ui="recap-fact"] h3').textContent).toBe('Fait réel');
    for (const c of r.chains) {
      const p = q(`[data-ui="recap-fact"] [data-chain="${c.chainId}"]`);
      expect(p.textContent).toContain(FR[c.titleKey]!); expect(p.textContent).toContain(FR[c.fact.key]!); expect(p.textContent).toContain(FR[c.fact.sourceKey]!);
      expect(p.textContent).not.toContain(c.fact.source);   // la provenance interne (chemin de recherche) n'est jamais montrée
      expect(p.textContent).not.toMatch(/research\/|\.md/u);
    }
  });

  it('test_recap_right_box_has_here_source_and_quote', () => {
    const p = pathsOf(w10.street, 2).find((x) => replay(x.acts, ctx).rejected.length === 0 && x.acts.some((a) => a.day === 1 && a.kind === 'sleep')
      && eveningRecap(stateAtEvening(x, 1, ctx), ctx, ANS).right !== null)!;
    const r = eveningRecap(stateAtEvening(p, 1, ctx), ctx, ANS); render(r);
    const parts = rightParts('w10', r.right!, (k) => FR[k]!);
    const box = q('[data-ui="recap-right"]');
    expect(box.querySelector('h3')!.textContent).toBe('Ce qui est écrit');
    for (const t of [parts.here, parts.source, parts.quote]) expect(box.textContent).toContain(t);
  });

  it('test_no_right_box_without_a_right_today', () => {
    const base = eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, ANS);
    render({ ...base, right: null });
    expect(document.body.querySelector('[data-ui="recap-right"]')).toBeNull();
    expect(document.body.querySelector('[data-ui="recap-2026"]')).not.toBeNull();
  });

  it('test_no_generic_axis_line_in_guided_recap', () => {
    const r = eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, ANS); render(r);
    expect(qa('[data-axis]').length).toBe(0);
    expect(document.body.querySelector('[data-ui="evening"]')).toBeNull();
    for (const l of ctx.street.evening.lines) for (const k of [l.fait, l.rien]) expect(document.body.textContent).not.toContain(FR[k]!);
  });

  it('test_recap_keeps_the_bracelet_message', () => {
    render(eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, ANS));
    expect(q('[data-ui="evening-message"]').textContent).toBe(FR['w10.msg.courtesy']);
  });

  it('test_free_street_evening_is_unchanged', () => {
    ui.showEvening(eveningLines(1, [], ctx), 'thanks', 1);
    expect(document.body.querySelector('[data-ui="recap"]')).toBeNull();
    expect(qa('[data-ui="evening"] li').length).toBeGreaterThan(0);
    expect(q('[data-ui="evening-title"]').textContent).toBe(FR['w10.evening.scene.title']);
  });

  it('test_recap_follows_language_change', () => {
    render(eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, ANS));
    expect(q('[data-ui="recap-title"]').textContent).toBe('Ce que tes choix ont fait');
    i18n.setLang('en');
    try { expect(q('[data-ui="recap-title"]').textContent).toBe('What your choices did'); } finally { i18n.setLang('fr'); }
  });

  it('test_no_replay_day_button', () => {
    render(eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, ANS));
    expect(document.body.textContent).not.toMatch(/Rejouer|Recommencer/iu);
    expect(document.body.querySelector('[data-ui="recap"] button')).toBeNull();
  });
});
