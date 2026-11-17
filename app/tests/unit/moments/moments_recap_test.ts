/**
 * Relevé du soir précis [plan rue guidée J1-J2, T11] : `eveningRecap` pur. Tous les chemins J1-J2 sans refus du moteur, pas un échantillon.
 * Le fait que le relevé lit le jour COMME CLOS (un maillon du jour non franchi y paraît `absent`) est épinglé ici.
 */
import { describe, expect, it } from 'vitest';
import absentJson from '../../fixtures/guided/recap-absent.json';
import { parseGuided } from '../../../src/data/schema/guided';
import { eveningRecap } from '../../../src/engine/moments/recap';
import { replay } from '../../../src/engine/moments/replay';
import { pathsOf } from '../../../src/validate/guided';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { parseWorld } from '../../../src/data/schema/world';
import { ctxW10, withStreet } from '../../support/street';
import { pathOf, stateAfter, stateAtEvening, w10Street } from '../../support/guided';

const w10 = parseWorld(w10Raw, cat);
const ctx = ctxW10();
const ANS = { Q11: 'C', Q04: 'A' } as const;
const clean = (): { readonly acts: readonly ActRecord[] }[] => pathsOf(w10.street, 2).filter((p) => replay(p.acts, ctx).rejected.length === 0);
const hasSleep = (p: { readonly acts: readonly ActRecord[] }, d: DayIndex): boolean => p.acts.some((a) => a.day === d && a.kind === 'sleep');

describe('moments : relevé du soir précis [T11]', () => {
  it('test_recap_has_at_least_one_item_each_day', () => {
    let checked = 0;
    for (const p of clean()) for (const d of [1, 2] as const) {
      if (!hasSleep(p, d)) continue;
      expect(eveningRecap(stateAtEvening(p, d, ctx), ctx, ANS).items.length, `${d}`).toBeGreaterThanOrEqual(1); checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('test_every_item_is_a_chain_variant_never_a_free_line', () => {
    const keys = new Set(w10.street.guided!.chains.flatMap((c) => c.links.flatMap((l) => [l.absent, ...Object.values(l.variants)].map((v) => v.recapKey))));
    for (const p of clean()) {
      for (const d of [1, 2] as const) {
        if (!hasSleep(p, d)) continue;
        const r = eveningRecap(stateAtEvening(p, d, ctx), ctx, ANS);
        for (const it of r.items) { expect(keys.has(it.recapKey)).toBe(true); expect(it.day).toBe(d); expect(it.minute).toBeGreaterThanOrEqual(ctx.street.clock.dayStartMinute); }
        expect(r.items.map((i) => i.minute)).toEqual([...r.items.map((i) => i.minute)].sort((a, b) => a - b));
      }
    }
  });

  it('test_recap_quotes_real_answer_for_each_chain', () => {
    const p = pathOf(w10.street, {});
    const r = eveningRecap(stateAtEvening(p, 1, ctx), ctx, ANS);
    expect(r.chains.map((c) => c.chainId)).toEqual(['A', 'B', 'E']);
    expect(r.chains[0]).toMatchObject({   // `question.linkKeys[réponse]` du monde
      chainId: 'A', titleKey: 'w10.chain.A.title', questionKey: 'Q11', questionTitleKey: 'q.Q11.title', answer: 'C', answerLabelKey: 'q.Q11.C.label', linkKey: 'w10.chain.A.link.C',
    });
    expect(r.chains[1]).toMatchObject({ chainId: 'B', questionKey: 'Q04', questionTitleKey: 'q.Q04.title', answer: 'A', answerLabelKey: 'q.Q04.A.label', linkKey: 'w10.chain.B.link.A' });
    expect(r.chains[2]).toMatchObject({ chainId: 'E', questionTitleKey: 'q.Q16.title', answer: null, answerLabelKey: null, linkKey: null });   // pas de réponse sauvegardée pour la question de E
    expect(r.chains[2]!.fact.sourceKey).toBe('w10.fact.E.source');
  });

  it('test_recap_without_answer_has_null_answer_and_link', () => {
    const r = eveningRecap(stateAtEvening(pathOf(w10.street, {}), 1, ctx), ctx, {});
    expect(r.chains.length).toBeGreaterThan(0);
    expect(r.chains.every((c) => c.answer === null && c.linkKey === null && c.answerLabelKey === null)).toBe(true);
    expect(r.chains.every((c) => c.questionTitleKey.startsWith('q.'))).toBe(true);   // la question reste nommée sans réponse
  });

  it('test_absent_only_chain_has_no_entry_but_its_absence_is_an_item', () => {
    const g = parseGuided(absentJson, w10Street);
    const c = ctxW10(withStreet((d) => { (d as { guided: unknown }).guided = g; }));
    const s = stateAfter([], c);
    const r = eveningRecap(s, c, {});
    expect(r.chains.map((x) => x.chainId)).not.toContain('X');
    expect(r.items.map((i) => i.recapKey)).toContain('w10.recap.A1.absent');
  });

  it('test_recap_shows_night_link_next_day', () => {
    const p = pathOf(w10.street, { 'j1.roux': 'laugh' });
    expect(eveningRecap(stateAtEvening(p, 2, ctx), ctx, ANS).items.map((i) => i.recapKey)).toContain('w10.recap.A2.laugh');
    expect(eveningRecap(stateAtEvening(p, 1, ctx), ctx, ANS).items.map((i) => i.recapKey)).not.toContain('w10.recap.A2.laugh');   // la nuit n'a pas encore eu lieu
  });

  it('test_recap_without_guided_is_empty', () => {
    const c = ctxW10(withStreet((d) => { (d as { guided: unknown }).guided = null; }));
    const r = eveningRecap(stateAfter([], c), c, ANS);
    expect(r.items).toEqual([]); expect(r.chains).toEqual([]);
  });

  it('test_recap_right_is_the_one_said_today', () => {
    let seen = 0;
    for (const p of clean()) {
      if (!hasSleep(p, 1)) continue;
      const s = stateAtEvening(p, 1, ctx);
      const today = Object.entries(s.rightLines).filter(([k]) => k.startsWith('1.')).map(([, v]) => v);
      const r = eveningRecap(s, ctx, ANS);
      expect(r.right).toBe(today.length === 0 ? null : today[today.length - 1]!);
      if (r.right !== null) seen += 1;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('test_speech_is_said_only_for_words_silence_only_for_a_scene_and_none_elsewhere', () => {
    const g = w10.street.guided!;
    const atOf = (key: string): string | undefined => g.chains.flatMap((c) => c.links).find((l) => [l.absent, ...Object.values(l.variants)].some((v) => v.recapKey === key))?.at.kind;
    const seen = { said: 0, silence: 0, none: 0 };
    for (const p of clean()) for (const d of [1, 2] as const) {
      if (!hasSleep(p, d)) continue;
      for (const it of eveningRecap(stateAtEvening(p, d, ctx), ctx, ANS).items) {
        seen[it.speech] += 1;
        const absent = g.chains.flatMap((c) => c.links).some((l) => l.absent.recapKey === it.recapKey);
        if (it.speech === 'said') { expect(it.saidKey).not.toBeNull(); expect(atOf(it.recapKey)).toBe('scene'); }
        if (it.speech === 'silence') { expect(it.saidKey).toBeNull(); expect(atOf(it.recapKey)).toBe('scene'); expect(absent).toBe(false); }
        if (it.speech === 'none') expect(absent || atOf(it.recapKey) !== 'scene').toBe(true);
        if (atOf(it.recapKey) !== 'scene' || absent) expect(it.speech).toBe('none');
      }
    }
    expect(seen.said).toBeGreaterThan(0); expect(seen.silence).toBeGreaterThan(0); expect(seen.none).toBeGreaterThan(0);
  });

  it('test_gesture_chain_without_a_person_has_a_null_personKey', () => {
    const e2 = w10.street.guided!.chains.find((c) => c.id === 'E')!.links.find((l) => l.id === 'E2')!;
    for (const v of ['hide', 'keep']) expect(e2.variants[v]!.personKey).toBeNull();
    for (const v of ['declare', 'leaveVisible']) expect(e2.variants[v]!.personKey).toBe('w10.chain.E.person.agent');
  });
});
