/**
 * Inventaire des clés des écrans (plan 03, T2, R-03.7) : chaque clé que T3 à T13 liront existe en FR et en EN, dérivée des DONNÉES réelles
 * (questionnaire, catalogue, w10), jamais devinée. Les textes sont provisoires, neutres : sans chiffre, sans lettre isolée, sans fiction inventée.
 */
import { describe, expect, it } from 'vitest';
import frJson from '../../../src/data/strings/fr.json';
import enJson from '../../../src/data/strings/en.json';
import metaJson from '../../../src/data/strings/meta.json';
import { ruleFor, type StringMeta } from '../../../src/i18n/i18n';
import { QUESTION_TEXT_KEY, questionTextProblems } from '../../support/question_text';
import { PROVISIONAL, keysUnder } from '../../../src/validate/provisional';
import { validateContent } from '../../../src/validate/content';
import { WORLD_VARS } from '../../../src/shared/types/world';
import { cat, qRaw, realInput, w10Raw } from '../../fixtures/data/factories';

const fr = frJson as Record<string, string>; const en = enJson as Record<string, string>;
const meta = metaJson as StringMeta;
type Q = { key: string; answers: { key: string }[] };
const questions = qRaw['questions'] as Q[];
const choices = w10Raw['street'].choices as { id: string; options: { id: string }[] }[];

/** Toutes les clés attendues, par famille. */
const families: Record<string, string[]> = {
  questionnaire: questions.flatMap((q) => [`q.${q.key}.title`, `q.${q.key}.scene`, `q.${q.key}.date`, ...q.answers.flatMap((a) => [`q.${q.key}.${a.key}.label`, `q.${q.key}.${a.key}.cost`])]),
  questionnaireUi: ['progress', 'pick', 'confirm', 'continue'].map((k) => `q.ui.${k}`),
  warning: ['title', 'body', 'soft.label', 'soft.hint', 'continue'].map((k) => `warning.${k}`),
  fastforwardUi: ['pause', 'resume', 'speed.label', 'speed.normal', 'speed.fast', 'speed.fastest', 'mode.auto', 'mode.manual', 'continue', 'journal', 'year', 'yearHidden', 'next'].map((k) => `ff.ui.${k}`),
  arrival: ['ff.arrival.lead', 'ff.arrival.extinctionLead', ...WORLD_VARS.flatMap((v) => [`ff.arrival.offset.${v}.up`, `ff.arrival.offset.${v}.down`])],
  fronts: ['ff.une.still', 'ff.une.masthead', ...WORLD_VARS.flatMap((v) => [`ff.une.${v}.up`, `ff.une.${v}.down`])],   // unes du fast-forward, Cynthia 2026-11-03
  causes: ['title', 'edition', 'final', 'replay', 'countdownStops', 'previous', 'next', 'seeBilan', 'read'].map((k) => `causes.ui.${k}`),
  redirect: ['arrival', 'bilan', 'sheet', 'curve.history', 'curve.life'].map((k) => `redirect.${k}`),
  worlds: cat.entries.flatMap((e) => [`world.${e.id}.name`, `world.${e.id}.clear`]),
  days: (w10Raw['calendar'] as { dateKey: string }[]).map((c) => c.dateKey),
  traceback: questions.flatMap((q) => q.answers.map((a) => `bilan.trace.${q.key}.${a.key}`)),
  dayLines: choices.flatMap((c) => c.options.map((o) => `w10.bilan.day.${c.id}.${o.id.replace(':', '_')}`)),
  dossier: [
    ...['title', 'names', 'namesNone', 'flagged', 'noneFlagged', 'outcome.flagged', 'outcome.dismissed', 'says', 'saysNobody', 'noAnswer'].map((k) => `w10.bilan.file.${k}`),
    ...['all', 'none', 'silence'].map((k) => `w10.bilan.audition.${k}`),
    ...['savedByName', 'twoNamesThenArrested', 'declaredLeaver', 'radioFromInside'].map((k) => `w10.bilan.mention.${k}`),
    ...['j3', 'j4', 'j5'].map((k) => `w10.bilan.person.${k}`),
    ...['arrested', 'arrestedAudition', 'released', 'recruited'].map((k) => `w10.bilan.fate.end.${k}`),
    'w10.bilan.day.fact.j6', 'w10.bilan.bascule.hold',
  ],
  bilanUi: [
    ...['nav.label', 'nav.prev', 'nav.next', 'btn.sources', 'btn.replay', 'btn.explore', 'btn.image', 'soft.label', 'sheet.title', 'sheet.world', 'sheet.days', 'sheet.kit', 'sheet.fate'].map((k) => `bilan.${k}`),
    ...['kept', 'left', 'seized', 'handedOver', 'declared'].map((k) => `bilan.kit.state.${k}`),
    ...['title', 'history', 'life', 'mark', 'withEcho', 'withoutEcho', 'gate', 'noGate', 'extinctionYear', 'yearHidden', ...WORLD_VARS.map((v) => `var.${v}`)].map((k) => `bilan.curve.${k}`),
    ...['toward', 'forward.one', 'forward.other', 'back.one', 'back.other', 'b', 'd', 'e'].map((k) => `bilan.bascule.${k}`),
    ...['sheet', 'dossier', 'chains', 'others', 'traceback', 'rights'].map((k) => `bilan.page.${k}.label`),   // chains : rue guidée J3-J7 T7
    'bilan.others.title', 'bilan.others.line', 'bilan.others.locked', 'bilan.traceback.title', 'bilan.rights.title', 'bilan.chains.title', 'bilan.hypothesis.mark', 'bilan.share.names', 'bilan.share.download',
  ],
  sources: [
    ...['title', 'back', 'hypotheses.title', 'worlds.title', 'worlds.none', 'shares.title', 'shares.more', 'rare.line', 'note.tegmark', 'note.dudh', 'note.dissent'].map((k) => `sources.${k}`),
    ...['sourced', 'unreopened', 'extrapolated', 'gameHypothesis'].flatMap((l) => [`sources.label.${l}`, `sources.legend.${l}`]),
    ...['worldReached', 'tegmarkCanon', 'rights', 'hypotheses', 'projection', 'extinction', 'hiddenGauge', 'rareWorlds'].flatMap((p) => [`sources.point.${p}.title`, `sources.point.${p}.body`]),
    ...['fli', 'uranium', 'contraband', 'gauge'].map((k) => `w10.sources.${k}`),
  ],
};

describe('inventaire des clés des écrans', () => {
  for (const [family, keys] of Object.entries(families)) {
    it(`test_family_${family}_exists_in_fr_and_en`, () => {
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.filter((k) => !(k in fr))).toEqual([]); expect(keys.filter((k) => !(k in en))).toEqual([]);
    });
  }
  it('test_family_sizes_come_from_real_data', () => {
    expect(families['questionnaire']).toHaveLength(11 * 3 + 38 * 2); expect(families['traceback']).toHaveLength(38);
    expect(families['worlds']).toHaveLength(24); expect(families['days']).toHaveLength(7); expect(families['dayLines']).toHaveLength(104);
    expect(families['arrival']).toHaveLength(2 + 12);
  });
  it('test_every_key_added_by_t2_is_covered_by_a_family', () => {
    const covered = new Set(Object.values(families).flat());
    const prefixes = PROVISIONAL.flatMap((e) => (e.kind === 'strings' ? [e.prefix] : []));
    const mine = Object.keys(fr).filter((k) => prefixes.some((p) => k.startsWith(`${p}.`)) && !k.startsWith('ff.traj') && !k.startsWith('ff.var') && !k.startsWith('ff.w07') && !k.startsWith('ff.w12')
      && !k.startsWith('w10.choice.') && !k.startsWith('street.ui.words.') && !k.startsWith('street.ui.choices.')   // UI-C T6 : provisoires de la rue, hors des familles du plan 03
      && !k.startsWith('w10.welcome.') && !k.startsWith('w10.goal.') && !k.startsWith('w10.evening.scene.') && !k.startsWith('w10.arrive.') && !k.startsWith('w10.seq.') && !k.startsWith('rights.')   // rue guidée T12 : droits à source nommée, hors familles ; playtest 2026-11-03 §1 A, §3 A : accueil, objectif, scène du soir, hors des familles du plan 03
      && !/^w10\.(scene|chain|recap|fact|demo|end)\./.test(k));   // rue guidée T5 : journées guidées J1-J2, hors des familles du plan 03
    expect(mine.filter((k) => !covered.has(k))).toEqual([]);
  });
  it('test_titles_in_each_language_have_the_same_placeholders', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const k of Object.values(families).flat()) expect(ph(fr[k]!), k).toBe(ph(en[k]!));
  });
  it('test_provisional_texts_have_no_digit_no_isolated_a_to_d_letter_no_em_dash', () => {
    // T4 interdit la lettre isolée A à D à l'écran du questionnaire : majuscule isolée partout, et aussi minuscule hors élision (« d'une »)
    // pour les textes du questionnaire (« a » verbe ou article compris), seul écran où le test de lettre vaut.
    const upper = /(?<![\p{L}\p{N}'’])[A-D](?![\p{L}\p{N}'’])/u;
    const anyCase = /(?<![\p{L}\p{N}'’])[A-Da-d](?![\p{L}\p{N}'’])/u;
    const allowedDigits = (k: string) => k.startsWith('q.Q') || k.startsWith('world.') || k.startsWith('w10.day.') || k.startsWith('sources.') || k.startsWith('w10.sources.');
    for (const k of Object.values(families).flat()) {
      for (const [lang, t] of [['fr', fr[k]!], ['en', en[k]!]] as const) {
        expect(t, k).not.toContain('—');
        if (!allowedDigits(k)) expect(t, k).not.toMatch(/\d/);
        const bare = t.replace(/\{\w+\}/g, '');
        // Scène, libellé, coût : vrai texte du canon depuis le 2026-11-03, la lettre d'option se cherche en marque (support/question_text).
        if (QUESTION_TEXT_KEY.test(k)) { expect(questionTextProblems(t, lang, k), k).toEqual([]); continue; }
        if (k.startsWith('q.')) expect(bare, k).not.toMatch(anyCase);
        if (!/^(world\.|sources\.|w10\.sources\.)/.test(k)) expect(bare, k).not.toMatch(upper);
      }
    }
  });
  it('test_question_texts_carry_no_letter_or_number_of_the_data_keys', () => {
    for (const q of questions) for (const a of q.answers) {
      for (const field of ['label', 'cost'] as const) for (const [lang, table] of [['fr', fr], ['en', en]] as const) {
        const k = `q.${q.key}.${a.key}.${field}`; const t = table[k]!;
        // Chiffres : seulement les jetons nommés de la clé dans meta.json (décision team-lead, 2026-11-03) ; jamais une clé de données.
        expect(questionTextProblems(t, lang, k), k).toEqual([]); expect(t, k).not.toMatch(/\bQ\d/);
      }
    }
  });
  it('test_every_provisional_prefix_is_in_the_registry_with_an_owner_and_keys', () => {
    expect(PROVISIONAL.length).toBeGreaterThanOrEqual(12);
    for (const e of PROVISIONAL) {
      expect(e.owner.trim(), JSON.stringify(e)).not.toBe(''); expect(e.reason.trim()).not.toBe('');
      if (e.kind === 'strings') { expect(keysUnder(fr, e.prefix), e.prefix).toBeGreaterThan(0); expect(keysUnder(en, e.prefix), e.prefix).toBe(keysUnder(fr, e.prefix)); }
    }
  });
  it('test_provisional_registry_raises_one_todo_warning_per_entry_on_real_data', () => {
    const r = validateContent(realInput());
    expect(r.errors).toEqual([]);
    const todo = r.warnings.filter((w) => w.code === 'GDD05-todo-provisional-text' || w.code === 'GDD06-todo-right-carriers');
    expect(todo).toHaveLength(PROVISIONAL.length);
    expect(todo.every((w) => w.owner !== '')).toBe(true);
  });
  it('test_policy_of_each_family_is_the_declared_one', () => {
    expect(ruleFor(meta, 'bilan.trace.Q11.A').policy).toBe('bilan'); expect(ruleFor(meta, 'w10.bilan.day.j3.marlene.name').policy).toBe('bilan');
    expect(ruleFor(meta, 'q.Q18.title').allowCalendar).toBe(true); expect(ruleFor(meta, 'warning.body').policy).toBe('voice');
    expect(ruleFor(meta, 'w10.sources.fli').policy).toBe('sources'); expect(ruleFor(meta, 'sources.rare.line').numericParams).toEqual(['gatekeeper', 'oneIn']);
  });
});
