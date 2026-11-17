// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import { answersOf } from '../../../src/shared/types';
import { nextQuestion } from '../../../src/screens/questionnaire';
import { getDraft, resetDraft } from '../../../src/screens/draft';
import { fakeCtx } from '../../support/screens';
import { realI18n, visibleTexts } from '../../support/street_ui';
import { questionTexts, questionTextProblems } from '../../support/question_text';
import { answerN, answerWith, continueBtn, costLine, firstAnswers, openQ, optionBtns, stubCanvas, TIMING } from '../../support/screens_q';

let stub: ReturnType<typeof stubCanvas>;
beforeEach(() => { stub = stubCanvas(); resetDraft(); });
afterEach(() => { stub.restore(); });

const STRINGS: Record<'fr' | 'en', Record<string, string>> = { fr, en };
const Q = fakeCtx().core.questionnaire;
const sorted = [...Q.questions].sort((a, b) => a.order - b.order);

describe('nextQuestion', () => {
  it('test_next_question_returns_first_unanswered_by_order', () => {
    expect(nextQuestion(Q, {})!.key).toBe(sorted[0]!.key);
    expect(nextQuestion(Q, { [sorted[0]!.key]: 'A', [sorted[1]!.key]: 'A' })!.key).toBe(sorted[2]!.key);
    // une réponse plus loin dans l'ordre ne saute pas la première question sans réponse
    expect(nextQuestion(Q, { [sorted[1]!.key]: 'A' })!.key).toBe(sorted[0]!.key);
  });
  it('test_next_question_returns_null_when_all_answered', () => {
    const all = Object.fromEntries(sorted.map((x) => [x.key, 'A' as const]));
    expect(nextQuestion(Q, all)).toBeNull();
  });
});

describe('écran questionnaire', () => {
  it('test_questionnaire_shows_all_answers_in_data_order (3 ou 4 réponses, ordre des données)', async () => {
    const { root } = await openQ();
    const first = sorted[0]!;
    expect(optionBtns(root).map((b) => b.dataset['option'])).toEqual(first.answers.map((a) => a.key));
    expect(optionBtns(root)).toHaveLength(first.answers.length);
  });

  it('test_every_question_shows_its_answers_in_data_order', async () => {
    const { root, frames } = await openQ();
    for (let i = 0; i < sorted.length; i++) {
      const want = sorted[i]!.answers.map((a) => a.key);
      expect(optionBtns(root).map((b) => b.dataset['option'])).toEqual(want);
      answerWith(root, 0);
      frames.advance(TIMING.minReadMs + 50);
      if (i < sorted.length - 1) continueBtn(root)!.click();
    }
  });

  it('one click selects, reveals consequence and enables Continue without advancing time', async () => {
    const { root, ctx } = await openQ();
    const b = optionBtns(root)[1]!;
    b.click();
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.dataset['state']).toBe('selected');
    expect(ctx.save.load().data.answers[sorted[0]!.key]).toBe('B');
    expect(costLine(root)!.hidden).toBe(false);
    expect(costLine(root)!.textContent).toBe(realI18n('fr').t(`q.${sorted[0]!.key}.B.cost`));
    expect(continueBtn(root)!.disabled).toBe(false);
    continueBtn(root)!.click();
    expect(root.querySelector('h1')!.textContent).toBe(realI18n('fr').t(`q.${sorted[1]!.key}.title`));
  });

  it('can revise a selection and its consequence before continuing', async () => {
    const { root, ctx } = await openQ();
    optionBtns(root)[0]!.click(); optionBtns(root)[1]!.click();
    expect(optionBtns(root).every(b => !b.disabled)).toBe(true);
    expect(optionBtns(root)[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(optionBtns(root)[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(costLine(root)!.textContent).toBe(realI18n('fr').t(`q.${sorted[0]!.key}.B.cost`));
    expect(ctx.save.load().data.answers[sorted[0]!.key]).toBe('B');
    expect(continueBtn(root)!.disabled).toBe(false);
  });

  it('Continue stays unavailable until an answer is selected', async () => {
    const { root } = await openQ();
    expect(continueBtn(root)!.hidden).toBe(true);
    expect(continueBtn(root)!.disabled).toBe(true);
  });

  const sweep = (root: HTMLElement, lang: 'fr' | 'en', where: string): void => {
    const copy=root.cloneNode(true) as HTMLElement;copy.querySelectorAll('.q-source-sticker').forEach(el=>el.remove());copy.querySelectorAll('[data-testid="q-scene"]').forEach(el=>{el.replaceChildren(document.createTextNode(el.textContent??''));});
    const texts = visibleTexts(copy, '[hidden]');
    // La date de la question (`q.<Q>.date`, pastille soleil, spec C §3.1) est la seconde exception, au seul contrôle de chiffre : une date n'est ni un numéro ni un compteur.
    const dates = new Set(Object.entries(STRINGS[lang]).filter(([k]) => /^q\.Q\d+\.date$/.test(k)).map(([, v]) => v));
    expect(texts.length, where).toBeGreaterThan(2);
    // Seule exception : le titre canon de Q18 est un lieu et une date (« Genève, 7 juillet 2026 »), chaîne fermée de T2 ; point ouvert writer.
    const canonDate = realI18n(lang).t('q.Q18.title');
    const qTexts = questionTexts(lang);
    for (const s of texts) {
      const at = `${where} : ${s}`;
      // Scène, libellé, coût : chiffres en jetons nommés par clé (meta.json), lettre d'option en marque seulement (support/question_text).
      const qKey = qTexts.get(s);
      if (qKey !== undefined) { expect(questionTextProblems(s, lang, qKey), at).toEqual([]); continue; }
      if (s !== canonDate && !dates.has(s)) expect(s, at).not.toMatch(/[0-9]/);
      expect(s, at).not.toMatch(/(^|[^\p{L}])[A-Da-d]($|[^\p{L}])/u);
      expect(s, at).not.toMatch(/\bQ\s?\d/i);
      expect(s, at).not.toMatch(/[*★☆†‡]|\[!!|\b[a-z]+\.[a-z]+\.[a-z]+/i);
    }
    expect(root.querySelector('[data-ui="dot-row"]')!.getAttribute('aria-hidden'), where).toBe('true');
    expect(root.querySelector('[data-ui="dot-row"]')!.textContent, where).toBe('');
  };

  it.each(['fr', 'en'] as const)('test_no_number_letter_counter_or_mark_on_screen (%s) : rendu, désignation, confirmation', async (lang) => {
    const { root, frames } = await openQ({ ctx: fakeCtx({ i18n: realI18n(lang) }) });
    const t = realI18n(lang);
    for (let i = 0; i < sorted.length; i++) {
      sweep(root, lang, `Q${i} rendu`);
      expect(root.textContent).toContain(t.t('q.ui.pick'));
      optionBtns(root)[0]!.click();
      sweep(root, lang, `Q${i} désignée`);
      expect(root.textContent).not.toContain(t.t('q.ui.confirm'));
      optionBtns(root)[0]!.click();
      frames.advance(TIMING.minReadMs + 100);
      sweep(root, lang, `Q${i} confirmée`);
      if (i < sorted.length - 1) continueBtn(root)!.click();
    }
  });

  // Un cas par langue et par question (22 cas), pas une boucle de 39 montages dans un seul test : le budget de 5 s par test tient sous la charge
  // de la suite complète (échecs « Test timed out in 5000ms » chez ta-render et impl-panel, 2026-11-03).
  const costCases = (['fr', 'en'] as const).flatMap((lang) => sorted.map((_, i) => [lang, i] as const));
  it.each(costCases)('test_no_number_on_any_answer_cost_line (%s, question %i)', async (lang, i) => {
    for (let j = 0; j < sorted[i]!.answers.length; j++) {
      const ctx = fakeCtx({ i18n: realI18n(lang) });
      ctx.save.update({ phase: 'questionnaire', answers: answersOf(Object.fromEntries(sorted.slice(0, i).map((x) => [x.key, 'A' as const]))) });
      const { root, frames, screen } = await openQ({ ctx });
      answerWith(root, j);
      // Juste au-delà de `costDelayMs` : la ligne de coût est là. Avancer jusqu'à `minReadMs` peignait le mur ~52 images par réponse pour rien,
      // aucun contrôle ici ne dépend de « Continuer ».
      frames.advance(TIMING.costDelayMs + 50);
      expect(costLine(root)!.hidden).toBe(false);
      sweep(root, lang, `Q${i} réponse ${j} coût`);
      screen.unmount();
    }
  });

  it('test_fresh_game_persists_each_answer', async () => {
    const { root, frames, ctx } = await openQ();
    answerN(root, frames, 3);
    const data = ctx.save.load().data;
    expect(Object.keys(data.answers)).toHaveLength(3);
    expect(data.phase).toBe('questionnaire');
  });

  it('test_resume_mid_questionnaire_shows_first_unanswered_question', async () => {
    const ctx = fakeCtx();
    ctx.save.update({ phase: 'questionnaire', answers: answersOf({ [sorted[0]!.key]: 'A', [sorted[1]!.key]: 'B' }) });
    const { root } = await openQ({ ctx });
    expect(root.querySelector('h1')!.textContent).toBe(realI18n('fr').t(`q.${sorted[2]!.key}.title`));
  });

  it('entrée avec toutes les réponses : navigue vers fastforward sans montrer de question', async () => {
    const ctx = fakeCtx();
    const all = firstAnswers(ctx);
    ctx.save.update({ phase: 'questionnaire', answers: answersOf(all) });
    const { root } = await openQ({ ctx });
    expect(ctx.navigate).toHaveBeenCalledWith('fastforward', { answers: all });
    expect(root.querySelector('h1')).toBeNull();
  });
});

describe('mode Rejoue', () => {
  const replayCtx = (phase: 'fastforward' | 'street' | 'bilan' = 'bilan') => {
    const ctx = fakeCtx();
    const old = answersOf(Object.fromEntries(sorted.map((x) => [x.key, x.answers[x.answers.length - 1]!.key])));
    ctx.save.update({ phase, answers: old, softened: false, acts: [{ day: 1, minute: 0, kind: 'k', id: 'i', option: null }] });
    return { ctx, old };
  };

  it('test_replay_mode_keeps_previous_save_until_last_answer', async () => {
    const { ctx } = replayCtx();
    const before = ctx.save.load().data;
    const { root, frames } = await openQ({ ctx });
    expect(root.querySelector('h1')!.textContent).toBe(realI18n('fr').t(`q.${sorted[0]!.key}.title`));
    answerN(root, frames, 10);
    expect(ctx.save.load().data).toEqual(before);
    expect(ctx.save.load().data.phase).toBe('bilan');
  });

  it('test_replay_last_answer_writes_answers_and_clears_acts', async () => {
    const { ctx } = replayCtx();
    const { root, frames } = await openQ({ ctx });
    answerN(root, frames, 11, 0);
    const d = ctx.save.load().data;
    expect(d.answers).toEqual(firstAnswers(ctx));
    expect(d.acts).toEqual([]);
    expect(d.phase).toBe('fastforward');
  });

  it('test_replay_last_answer_writes_draft_softened', async () => {
    const { ctx } = replayCtx();
    getDraft().softened = true;
    const { root, frames } = await openQ({ ctx });
    answerN(root, frames, 11);
    expect(ctx.save.load().data.softened).toBe(true);
  });

  it('test_replay_draft_untouched_saves_softened_false', async () => {
    const { ctx } = replayCtx();
    ctx.save.update({ softened: null });
    const { root, frames } = await openQ({ ctx });
    answerN(root, frames, 11);
    expect(ctx.save.load().data.softened).toBe(false);
  });

  it('test_abandon_in_replay_mode_leaves_previous_bilan_reachable', async () => {
    const { ctx } = replayCtx();
    const before = ctx.save.load().data;
    const { root, frames, screen } = await openQ({ ctx });
    answerN(root, frames, 5);
    screen.unmount();
    expect(ctx.save.load().data).toEqual(before);
    expect(ctx.save.load().data.phase).toBe('bilan');
  });

  it('fresh game, 11e réponse : phase fastforward, actes vides, softened non touché', async () => {
    const { root, frames, ctx } = await openQ();
    answerN(root, frames, 11);
    const d = ctx.save.load().data;
    expect(d.phase).toBe('fastforward');
    expect(d.acts).toEqual([]);
    expect(Object.keys(d.answers)).toHaveLength(11);
    expect(d.softened).toBeNull();
  });
});

describe('navigation immédiate', () => {
  it.each([false, true])('last Continue navigates immediately, reduced motion %s', async (reducedMotion) => {
    const { root, frames, ctx } = await openQ({ reducedMotion });
    answerN(root, frames, 11);
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(continueBtn(root)!.disabled).toBe(false);
    continueBtn(root)!.click(); continueBtn(root)!.click();
    await Promise.resolve();
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).toHaveBeenCalledWith('fastforward', { answers: firstAnswers(ctx) });
  });

  it('test_crt_wall_is_canvas_2d_not_webgl', async () => {
    const { root, frames } = await openQ();
    answerN(root, frames, 11);
    frames.advance(TIMING.minReadMs + 100);
    expect(stub.requested.length).toBeGreaterThan(0);
    expect(stub.requested.every((k) => k === '2d')).toBe(true);
    expect(stub.requested.some((k) => k.startsWith('webgl') || k === 'experimental-webgl')).toBe(false);
  });
});
