/** Bloc dossier de w10 [plan 03 T10 ; GDD 06 §3.10 ; R-03.16]. Profils de l'oracle de survie rejoués en actes, aucune règle de rue réécrite. */
import { describe, expect, it } from 'vitest';
import { buildDossier, type DossierContext } from '../../../src/bilan/dossier';
import { flaggedLines, relectureLineOf } from '../../../src/engine/moments/bilan';
import { replay } from '../../../src/engine/moments/replay';
import { toBilanInput } from '../../../src/engine/moments/bilan';
import type { BilanInput } from '../../../src/shared/types/bilan';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import { act, ctxW10 } from '../../support/street';
import { actsOfProfile } from '../../support/profile_acts';
import { oracle } from '../../support/survival';

const street = ctxW10();
const ctx: DossierContext = { lived: street.world, street };
const personKeyOf = (choiceId: string): string => (street.world.bilan as unknown as { dossier: { names: { choiceId: string; personKey: string }[] } }).dossier.names.find((n) => n.choiceId === choiceId)!.personKey;
const noStreet: DossierContext = { lived: { ...street.world, bilan: {} }, street };

function inputOf(acts: readonly ActRecord[]): BilanInput {
  const r = replay(acts, street);
  return toBilanInput(r.state, r.week, street);
}
const dossierOf = (acts: readonly ActRecord[], c: DossierContext = ctx) => buildDossier(inputOf(acts), c);
const mentionsOfActs = (acts: readonly ActRecord[]) => dossierOf(acts)!.mentions;
const mentionsOf = (profile: string) => dossierOf(actsOfProfile(profile))!.mentions;

describe('dossier : noms', () => {
  it('test_zero_names_profile_has_empty_names', () => {
    expect(dossierOf(actsOfProfile('Zéro nom'))!.names).toEqual([]);
  });
  it('test_two_names_profile_lists_two_in_day_order', () => {
    // ÉCART NOMMÉ [R-03.26] : « Deux noms, J2 + J3 » ne liste qu'UN nom tant que la donnée n'ajoute pas j2.component/declare ; bascule à deux alors.
    expect(dossierOf(actsOfProfile('Deux noms, J2 + J3'))!.names.map((n) => n.day)).toEqual([3]);
    // « Deux noms, J2 + J3 » : le nom du J2 est l'option `declare` du composant, sans personne en donnée (`dossier.names` ne porte que J3, J4, J5) ; on épingle donc la paire J4 + J5.
    const d = dossierOf(actsOfProfile('Deux noms, J4 + J5'))!;
    expect(d.names).toEqual([{ personKey: personKeyOf('j4.neighbour'), day: 4 }, { personKey: personKeyOf('j5.bruno'), day: 5 }]);
    const four = dossierOf(actsOfProfile('Quatre noms'))!;
    expect(four.names.map((n) => n.day)).toEqual([3, 4, 5]);
  });
  it('person keys come from data, not code', () => {
    const d = dossierOf(actsOfProfile('Un nom, J3'))!;
    expect(d.names).toEqual([{ personKey: personKeyOf('j3.marlene'), day: 3 }]);
  });
});

describe('dossier : audition', () => {
  it.each(['all', 'none', 'silence'] as const)('test_audition_answer_read_from_act (%s)', (opt) => {
    expect(dossierOf(actsOfProfile('Zéro nom', { audition: opt }))!.answer).toBe(opt);
  });
  it('test_audition_answer_null_when_week_stops_early', () => {
    expect(dossierOf(actsOfProfile('Muet'))!.answer).toBeNull();
  });
});

describe('dossier : lignes signalées', () => {
  const withFlags = (flags: readonly DayIndex[]): ActRecord[] => {
    const base = actsOfProfile('Zéro nom');
    const out: ActRecord[] = [];
    for (const a of base) {
      out.push(a);
      if (a.kind === 'exit' && a.id === 'registre' && a.day <= 6 && a.day !== 3) {
        out.push(act(a.day as DayIndex, a.minute + 1, 'choice', `relecture.j${a.day}`, flags.includes(a.day as DayIndex) ? 'flag' : 'pass'));
      }
    }
    return out;
  };
  it('test_flagged_count_equals_flagged_lines_of_02b', () => {
    const acts = withFlags([1, 2, 4]);
    expect(flaggedLines(acts)).toBe(3);
    expect(dossierOf(acts)!.flaggedCount).toBe(flaggedLines(acts));
  });
  it('test_flagged_count_never_exceeds_five', () => {
    const d = dossierOf(withFlags([1, 2, 3, 4, 5, 6]))!;
    expect(d.flaggedCount).toBeLessThanOrEqual(5);
    expect(d.files.length).toBeLessThanOrEqual(5);
  });
  it('test_zero_flagged_uses_none_key_not_numeric_param', () => {
    const d = dossierOf(withFlags([]))!;
    expect(d.flaggedCount).toBe(0);
    // Le bloc ne porte que l'entier ; la clé sans paramètre vit en donnée, et l'écran la choisit quand le compte est nul.
    const data = street.world.bilan as unknown as { dossier: { noneFlaggedKey: string } };
    expect(data.dossier.noneFlaggedKey).toBe('w10.bilan.file.noneFlagged');
    expect(Object.keys(d)).not.toContain('noneFlaggedKey');
  });
  it('test_file_lines_follow_relecture_line_of', () => {
    const acts = withFlags([1, 4]);
    const r = replay(acts, street);
    const d = buildDossier(inputOf(acts), ctx)!;
    expect(d.files.length).toBeGreaterThan(0);
    for (const f of d.files) {
      expect(f.lineKey).toBe(relectureLineOf(f.day, r.state.ledgers[f.day - 1]!, street.street));
    }
    expect(d.files.map((f) => f.day)).toEqual([...d.files.map((f) => f.day)].sort((a, b) => a - b));
  });
  it('test_file_line_outcome_is_flagged_or_dismissed', () => {
    const d = dossierOf(withFlags([1, 4]))!;
    for (const f of d.files) expect(f.outcome).toBe(f.day === 1 || f.day === 4 ? 'flagged' : 'dismissed');
    expect(d.files.some((f) => f.outcome === 'dismissed')).toBe(true);
  });
  it('test_file_lines_at_most_five_days_ten_lines_in_service', () => {
    const d = dossierOf(withFlags([1, 2, 4, 5, 6]))!;
    expect(d.files.length).toBeLessThanOrEqual(5);
    expect(new Set(d.files.map((f) => f.day)).size).toBe(d.files.length);
    const service = Object.values(street.street.lines.relecture).reduce((n, l) => n + l.length, 0);
    expect(service).toBe(10);
  });
});

describe('dossier : mentions', () => {
  it('test_mention_saved_by_a_name', () => {
    // Valeurs littérales : aucun profil de l'oracle ne doit sa liberté à un nom (« Zéro nom » finit déjà libre) ; le cas positif est construit ci-dessous.
    const expected: Readonly<Record<string, boolean>> = {
      'Zéro nom': false, 'Zéro nom + permis au J6': false, 'Bavard, quatre noms': false, 'Un nom, J2': false, 'Un nom, J3': false,
      'Un nom, J4': false, 'Un nom, J5': false, 'Deux noms, J2 + J3': false, 'Deux noms, J4 + J5': false, 'Quatre noms': false,
      'Deux noms puis arrêté': false, 'Bavard': false, 'Muet': false,
    };
    expect(Object.keys(expected).sort()).toEqual(Object.keys(oracle('survival').profiles).sort());
    for (const [name, want] of Object.entries(expected)) expect(mentionsOf(name).includes('savedByName'), name).toBe(want);
  });
  it('test_counterfactual_substitutes_refusal_and_is_valid_on_every_oracle_profile', () => {
    const names = (street.world.bilan as unknown as { dossier: { names: { choiceId: string; nameOption: string; refuseOption: string }[] } }).dossier.names;
    for (const profile of Object.keys(oracle('survival').profiles)) {
      const acts = actsOfProfile(profile);
      for (const o of names) {
        const n = acts.find((a) => a.kind === 'choice' && a.id === o.choiceId && a.option === o.nameOption);
        if (n === undefined) continue;
        const cf = replay(acts.map((a) => (a === n ? { ...a, option: o.refuseOption } : a)), street);
        // Un contrefactuel qui s'arrête plus tôt que les actes écrits rejette la suite (`ended`) : invalide, donc jamais compté comme « sauvé » [R-03.26].
        expect(cf.rejected.filter((r) => r.reason !== 'ended'), `${profile} ${o.choiceId}`).toEqual([]);
        expect(cf.state.ended, `${profile} ${o.choiceId}`).not.toBeNull();
      }
    }
  });
  it('savedByName is true when the name is what kept the week free (16 extra words on J4)', () => {
    const base = actsOfProfile('Un nom, J4');
    const more = Array.from({ length: 16 }, (_, i) => act(4, 900 + i, 'say', 'filler.1'));
    const acts = [...base, ...more].sort((a, b) => a.day - b.day || a.minute - b.minute);
    const nameAct = acts.find((a) => a.id === 'j4.neighbour')!;
    expect(replay(acts, street).state.ended?.endId).toBe('released');
    const cf = replay(acts.map((a) => (a === nameAct ? { ...a, option: 'silent' } : a)), street);
    expect(cf.rejected).toEqual([]);
    expect(cf.state.ended?.endId).toBe('arrestedAudition');
    expect(mentionsOfActs(acts)).toContain('savedByName');
  });
  describe('arrestation contrefactuelle [R-03.26 amendé]', () => {
    // « Un nom, J3 » + 25 mots de remplissage au J3 : libre avec le nom ; avec le refus `banal`, arrêté la nuit même, et l'audition (acte suivant) est rejetée `ended`.
    const fill = (n: number): ActRecord[] => Array.from({ length: n }, (_, i) => act(3, 900 + i, 'say', 'filler.1'));
    const build = (extra: readonly ActRecord[]): ActRecord[] =>
      [...actsOfProfile('Un nom, J3'), ...fill(25), ...extra].sort((a, b) => a.day - b.day || a.minute - b.minute);
    const cfOf = (acts: readonly ActRecord[]) => {
      const nameAct = acts.find((a) => a.id === 'j3.marlene' && a.option === 'name')!;
      return replay(acts.map((a) => (a === nameAct ? { ...a, option: 'banal' } : a)), street);
    };
    /** `acts` bruts, tels qu'écrits : le bilan réel ne reçoit que des actes acceptés, ici on force un acte refusé. */
    const mentionsOfRaw = (acts: readonly ActRecord[]) => buildDossier({ ...inputOf(acts), acts }, ctx)!.mentions;
    it('real week free, refusal arrests the same night, later acts rejected `ended` : saved by the name', () => {
      const acts = build([]);
      expect(replay(acts, street).state.ended?.endId).toBe('released');
      const cf = cfOf(acts);
      expect(cf.state.ended?.endId).toBe('arrested');
      expect(cf.rejected.length).toBeGreaterThan(0);
      expect(cf.rejected.every((r) => r.reason === 'ended')).toBe(true);
      expect(mentionsOfActs(acts)).toContain('savedByName');
    });
    it('a rejection for any other reason makes the counterfactual invalid : false', () => {
      const acts = build([act(2, 500, 'choice', 'no.such.choice', 'x')]);
      const cf = cfOf(acts);
      expect(cf.state.ended?.endId).toBe('arrested');
      expect(cf.rejected.some((r) => r.reason !== 'ended')).toBe(true);
      expect(mentionsOfRaw(acts)).not.toContain('savedByName');
      expect(mentionsOfRaw(build([]))).toContain('savedByName');           // témoin : sans l'acte refusé, vrai
    });
  });
  it('savedByName is false without any name', () => {
    expect(mentionsOf('Zéro nom')).not.toContain('savedByName');
  });
  it('test_mention_two_names_then_arrested', () => {
    expect(mentionsOf('Deux noms puis arrêté')).toContain('twoNamesThenArrested');
    expect(mentionsOf('Deux noms, J4 + J5')).not.toContain('twoNamesThenArrested');
    expect(mentionsOf('Un nom, J3')).not.toContain('twoNamesThenArrested');
  });
  it('test_mention_declared_leaver_when_permit_asked', () => {
    expect(mentionsOf('Zéro nom + permis au J6')).toContain('declaredLeaver');
    expect(mentionsOf('Zéro nom')).not.toContain('declaredLeaver');
  });
  it('test_mention_radio_from_inside_when_day6_lived', () => {
    expect(mentionsOf('Zéro nom')).toContain('radioFromInside');
    expect(mentionsOf('Muet')).not.toContain('radioFromInside');       // arrêté la nuit 5 : le J6 n'a pas été vécu
  });
  it('mentions come in the order of the data keys', () => {
    const order = ['savedByName', 'twoNamesThenArrested', 'declaredLeaver', 'radioFromInside'];
    const m = mentionsOf('Zéro nom + permis au J6');
    expect(m).toEqual(order.filter((k) => m.includes(k as never)));
  });
});

describe('dossier : garde et pureté', () => {
  it('test_dossier_is_null_for_a_world_other_than_w10', () => {
    expect(dossierOf(actsOfProfile('Zéro nom'), noStreet)).toBeNull();
    expect(dossierOf(actsOfProfile('Zéro nom'), { lived: null, street: null })).toBeNull();
  });
  it('test_dossier_block_is_pure', () => {
    const acts = actsOfProfile('Deux noms puis arrêté', { audition: 'all' });
    const input = inputOf(acts);
    const snap = JSON.stringify(input);
    const a = buildDossier(input, ctx);
    const b = buildDossier(input, ctx);
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(snap);
  });
});
