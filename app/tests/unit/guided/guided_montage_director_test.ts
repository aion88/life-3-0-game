/**
 * Le metteur en scène joue les jours de montage [plan semaine condensée, T2 ; ruling R-COND.1 ; décisions 2, 4, 5, 13].
 * Critère sur la cause : un jour `montage` est joué sans un seul temps de scène, et ses actes sont ÉGAUX, acte par acte, à ceux du
 * même jour joué au metteur en scène avec les choix de sa posture. w10 n'a pas encore de jour de montage (T5) : chaque cas bascule
 * un jour en mémoire (`withMontageDay`), jamais le fichier.
 */
import { describe, expect, it } from 'vitest';
import type { SpeechModeId } from '../../../src/data/schema/guided';
import type { GuidedData } from '../../../src/data/schema/guided';
import type { Beat } from '../../../src/street/guided/director';
import { nearestMode, postureOf } from '../../../src/street/guided/montage';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import type { StreetContext } from '../../../src/engine/moments/types';
import { w10Raw } from '../../fixtures/data/factories';
import { ctxW10 } from '../../support/street';
import {
  COULOIR_PICKS, DAY_PICKS, asPickKeys, ctxOfRaw, directorRig, montageSpecOf, nightValue, palierAfter, playOf, playPath, rejectedOf,
  stateAfter, withMontageDay, withNightBelow, type DirectorRig, type Picks,
} from '../../support/guided';

type Raw = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON brut de monde
type MDay = 2 | 3 | 5 | 6;
const MODES: readonly SpeechModeId[] = ['muet', 'couloir', 'bavard'];
const raw0 = w10Raw as Raw;
const actsOfDay = (acts: readonly ActRecord[], d: number) => acts.filter((a) => a.day === d);
const montageOf = (seen: readonly Beat[], d: number) => seen.find((b): b is Extract<Beat, { kind: 'montage' }> => b.kind === 'montage' && b.day === d);
/** Jour joué juste avant `d` dans le cas à un seul jour de montage : il fixe la posture. */
const PREV: Readonly<Record<MDay, number>> = { 2: 1, 3: 2, 5: 4, 6: 5 };
/** Choix du jour joué d'avant dans le mode `m` (posture `m` sur le jour de montage `d`). */
const prevPicks = (d: MDay, m: SpeechModeId): Picks => DAY_PICKS[PREV[d]]![m];
/** Les temps du jour `d` : du temps `montage` (ou `card`) du jour `d` au premier temps d'ouverture du jour suivant, non compris. */
function beatsOfDay(seen: readonly Beat[], d: number): readonly Beat[] {
  const opens = (b: Beat, day: number) => (b.kind === 'card' || b.kind === 'montage') && b.day === day;
  const i = seen.findIndex((b) => opens(b, d));
  const j = seen.findIndex((b, k) => k > i && (opens(b, d + 1) || b.kind === 'end' || b.kind === 'outcome'));
  return seen.slice(i, j < 0 ? undefined : j);
}
/** Joue jusqu'à `stop` sur `ctx` (posture et choix de carte par `picks`), comme `playOf`. */
function rigUntil(ctx: StreetContext, picks: Picks, stop: (b: Beat, r: DirectorRig) => boolean = () => false): { readonly r: DirectorRig; readonly seen: Beat[] } {
  const r = directorRig([], ctx);
  const seen = playPath(r, { ...COULOIR_PICKS, ...picks }, stop);
  return { r, seen };
}
const isCardChoice = (sceneId: string) => (b: Beat): boolean => b.kind === 'choice' && b.card === true && b.sceneId === sceneId;

describe('semaine condensée T2 : le metteur en scène joue les jours de montage', { timeout: 300_000 }, () => {
  it('test_montage_day_emits_no_scene_beat', () => {   // I-3 nommé : temps `right` permis après `montageEnd` seulement (décision 13)
    for (const d of [2, 5] as const) {
      const raw = withMontageDay(raw0, d);
      const { seen } = playOf({ ...prevPicks(d, 'couloir'), ...asPickKeys(montageSpecOf(d).cardDefaults.couloir) }, raw);
      const day = beatsOfDay(seen, d);
      expect(day[0]!.kind).toBe('montage');
      expect(day.every((b) => ['montage', 'choice', 'montageEnd', 'right'].includes(b.kind))).toBe(true);
      expect(day.filter((b) => b.kind === 'choice').every((b) => b.kind === 'choice' && b.card === true)).toBe(true);
      const end = day.findIndex((b) => b.kind === 'montageEnd');
      expect(end).toBeGreaterThan(0);
      expect(day.every((b, i) => b.kind !== 'right' || i > end)).toBe(true);
      if (d === 5) expect(day.filter((b) => b.kind === 'right').map((b) => b.kind === 'right' && b.right)).toContain('privacy');   // droit S3 du vendredi, jamais perdu
    }
  });

  it('test_montage_acts_equal_played_day_with_posture_picks', () => {   // le critère de la cause ; référence = metteur en scène sur w10, jour joué (I-1)
    const g = ctxW10().street.guided as GuidedData;
    const compared: string[] = [];
    for (const d of [2, 3, 5, 6] as const) {
      const spec = montageSpecOf(d);
      const firstAsk = spec.asks[0];
      const ask = firstAsk === undefined ? undefined : g.scenes.find((s) => s.id === firstAsk)!;
      for (const m of MODES) {
        // l'option par défaut de la posture, puis chaque option de la première étape présentée
        const cardOpts: readonly (string | null)[] = [null, ...(ask === undefined ? [] : ask.ask.kind === 'narrative' ? ask.ask.options.map((o) => o.id) : ask.ask.kind === 'priced' ? Object.keys(ask.ask.next) : [])];
        for (const o of cardOpts) {
          const over: Picks = o === null || ask === undefined ? {} : asPickKeys({ [ask.id]: o });
          const ref = playOf({ ...prevPicks(d, m), ...DAY_PICKS[d]![m], ...over }).acts;
          const mont = playOf({ ...prevPicks(d, m), ...asPickKeys(spec.cardDefaults[m]), ...over }, withMontageDay(raw0, d));
          expect(actsOfDay(mont.acts, d), `J${d} ${m} carte ${o ?? 'défaut'}`).toEqual(actsOfDay(ref, d));
          expect(actsOfDay(ref, d).length).toBeGreaterThan(3);
          compared.push(`${d}.${m}.${o ?? '-'}`);
        }
      }
    }
    expect(compared).toHaveLength(36);   // 4 jours x 3 postures x (défaut + chaque option de la première carte : J2 4, J3 2, J5 2, J6 0)
  });

  it('test_montage_priced_step_goes_through_designate_confirm', () => {   // B-1, R-COND.1
    const ctx = ctxOfRaw(withMontageDay(raw0, 2));
    let from = -1;
    const { r } = rigUntil(ctx, { ...prevPicks(2, 'couloir'), ...asPickKeys(montageSpecOf(2).cardDefaults.couloir) }, (b, rr) => {
      if (b.kind === 'montage' && b.day === 2 && from < 0) from = rr.trace.length;
      return b.kind === 'montageEnd' && b.day === 2;
    });
    const day2 = r.trace.slice(from).filter((t) => /^(designate|confirm|choose|scene|act|sleep)\(/.test(t));   // les écritures du pilote, lectures (`state`) ôtées
    const designates = day2.flatMap((t, i) => (t.startsWith('designate(') ? [[t, day2[i + 1]]] : []));
    expect(designates).toEqual([['designate("checkpoint.j2","comply")', 'confirm()'], ['designate("relecture.j2","flag")', 'confirm()']]);
    const priced = new Set(ctx.street.choices.map((c) => c.id));
    expect(day2.filter((t) => t.startsWith('choose(')).every((t) => !priced.has(JSON.parse(`[${t.slice(7, -1)}]`)[0]))).toBe(true);
    expect(stateAfter(r.sink.saved, ctx).confirmed).toMatchObject({ '2.checkpoint.j2': 'comply', '2.relecture.j2': 'flag' });
  });

  it('test_human_and_montage_pose_same_act', () => {   // R-COND.1 : même chemin que le panneau puis `choose`
    const picks = { ...prevPicks(2, 'couloir'), ...asPickKeys(montageSpecOf(2).cardDefaults.couloir) };
    const human = playOf(picks).acts;
    const mont = playOf(picks, withMontageDay(raw0, 2)).acts;
    const priced = (acts: readonly ActRecord[]) => acts.filter((a) => a.day === 2 && (a.kind === 'lane' || (a.kind === 'choice' && a.id === 'relecture.j2')));
    expect(priced(mont)).toEqual(priced(human));
    expect(priced(mont).map((a) => a.kind)).toEqual(['lane', 'choice']);
    const conf = (acts: readonly ActRecord[]) => Object.entries(stateAfter(acts.filter((a) => a.day <= 2), ctxW10()).confirmed).filter(([k]) => k.startsWith('2.'));
    expect(conf(mont)).toEqual(conf(human));
  });

  it('test_director_designates_only_on_montage_days', () => {   // en-tête amendé : jours joués, comportement humain inchangé
    const plain = directorRig();
    playPath(plain, COULOIR_PICKS);
    expect(plain.calls).not.toContain('designate');
    let from = -1; let to = -1;
    const { r } = rigUntil(ctxOfRaw(withMontageDay(raw0, 2)), {}, (b, rr) => {
      if (b.kind === 'montage' && from < 0) from = rr.calls.length;
      if (b.kind === 'montageEnd' && to < 0) to = rr.calls.length;
      return false;
    });
    const at = r.calls.flatMap((c, i) => (c === 'designate' ? [i] : []));
    expect(at.length).toBeGreaterThan(0);
    expect(at.every((i) => i >= from && i < to)).toBe(true);
  });

  it('test_friday_card_choice_comes_after_bruno_door', () => {
    const ctx = ctxOfRaw(withMontageDay(raw0, 5));
    const { r } = rigUntil(ctx, prevPicks(5, 'couloir'), isCardChoice('j5.bruno'));
    const j5 = actsOfDay(r.sink.saved, 5);
    const home = j5.findIndex((a) => a.kind === 'enter' && a.id === 'home');
    const door = j5.findIndex((a) => a.kind === 'choice' && a.id === 'j5.bruno.door');
    expect(home).toBeGreaterThanOrEqual(0);
    expect(door).toBeGreaterThan(home);
    expect(j5.some((a) => a.id === 'j5.bruno')).toBe(false);
    // tracé contre le jour joué : mêmes actes jusqu'au choix de carte
    const ref = actsOfDay(playOf({ ...prevPicks(5, 'couloir'), ...DAY_PICKS[5]!.couloir }).acts, 5);
    expect(j5).toEqual(ref.slice(0, ref.findIndex((a) => a.id === 'j5.bruno')));
  });

  it('test_card_stays_open_until_first_ask', () => {   // I-2 : l'auto-jeu tourne sans « Continuer »
    const { r } = rigUntil(ctxOfRaw(withMontageDay(raw0, 5)), prevPicks(5, 'couloir'), (b) => b.kind === 'montage');
    const n = r.sink.saved.length;
    expect(actsOfDay(r.sink.saved, 5).at(-1)).toMatchObject({ kind: 'scene', id: 'j5.bruno.talk' });
    r.dir.advance();
    const head = r.dir.current();
    expect(head).toMatchObject({ kind: 'choice', card: true, sceneId: 'j5.bruno' });
    expect(r.sink.saved.length).toBe(n);
  });

  it('test_posture_inherits_last_played_day', () => {
    const all = [2, 3, 5, 6].reduce<Raw>((acc, d) => withMontageDay(acc, d as MDay), raw0);
    const ctx = ctxOfRaw(all);
    const g = ctx.street.guided as GuidedData;
    const acts = playOf({ ...DAY_PICKS[1]!.muet, ...DAY_PICKS[4]!.bavard }).acts;   // jours joués : J1 muet (14 mots), J4 bavard (80)
    expect(([2, 3, 5, 6] as const).map((d) => postureOf(g, ctx, acts, d as DayIndex))).toEqual(['muet', 'muet', 'bavard', 'bavard']);
    const { seen } = rigUntil(ctx, DAY_PICKS[1]!.muet, (b) => b.kind === 'card' && b.day === 4);
    expect([montageOf(seen, 2)?.posture, montageOf(seen, 3)?.posture]).toEqual(['muet', 'muet']);
    expect(montageOf(seen, 2)?.postureKey).toBe('w10.montage.posture.muet');
  });

  it('test_posture_between_modes_takes_nearest', () => {   // décision 4 : borne la plus proche, égalité -> couloir
    const m = { muet: 14, couloir: [40, 60] as const, bavard: 70 };
    expect([25, 27, 14, 50, 65, 66, 90].map((w) => nearestMode(m, w))).toEqual(['muet', 'couloir', 'muet', 'couloir', 'couloir', 'bavard', 'bavard']);
    // `montage.posture` fixé l'emporte sur l'héritage (D2)
    const raw = withMontageDay(raw0, 2);
    ((raw.street.guided as Raw).days.find((x: Raw) => x.day === 2).montage as Raw).posture = 'bavard';
    const ctx = ctxOfRaw(raw);
    expect(postureOf(ctx.street.guided as GuidedData, ctx, playOf(DAY_PICKS[1]!.muet).acts, 2)).toBe('bavard');
  });

  it('test_montage_end_tail_is_palier_after_sleep', () => {
    const ctx = ctxOfRaw(withMontageDay(raw0, 2));
    const { r, seen } = rigUntil(ctx, prevPicks(2, 'couloir'), (b) => b.kind === 'montageEnd');
    const end = r.dir.current();
    expect(seen.some((b) => b.kind === 'recap' && b.day === 2)).toBe(false);
    expect(end).toEqual({ kind: 'montageEnd', day: 2, tail: { kind: 'palier', palier: palierAfter({ acts: r.sink.saved }, 2, ctx) } });
  });

  it('test_arrest_in_montage_night_ends_with_arrested_tail_then_end', () => {   // motif withSurvival : seuil calculé sur le chemin
    const ctx0 = ctxOfRaw(withMontageDay(raw0, 5));
    const picks = prevPicks(5, 'couloir');
    const free = rigUntil(ctx0, picks);
    const nights = [1, 2, 3, 4, 5].map((d) => nightValue({ acts: free.r.sink.saved }, d as DayIndex, ctx0));
    const below = nights[4]! + 0.5;
    expect(nights.slice(0, 4).every((v) => v >= below)).toBe(true);
    const { seen } = rigUntil(withNightBelow(ctx0, below), picks);
    const key = (ctx0.street.guided as GuidedData).ending!.arrestedNightKey;
    const i = seen.findIndex((b) => b.kind === 'montageEnd');
    expect(seen[i]).toEqual({ kind: 'montageEnd', day: 5, tail: { kind: 'arrested', key, day: 5 } });
    expect(seen.at(-1)).toEqual({ kind: 'end', early: true, endedDay: 5 });
  });

  it('test_resume_mid_montage_continues_the_card', () => {
    const ctx = ctxOfRaw(withMontageDay(raw0, 5));
    const first = rigUntil(ctx, prevPicks(5, 'couloir'), isCardChoice('j5.bruno'));
    const saved = [...first.r.sink.saved];
    const again = directorRig(saved, ctx);
    const seen = playPath(again, {}, isCardChoice('j5.bruno'));
    expect(seen.map((b) => b.kind)).toEqual(['montage']);
    expect(again.dir.current()).toMatchObject({ kind: 'choice', card: true, sceneId: 'j5.bruno' });
    expect(again.sink.saved).toEqual([]);
    expect(rejectedOf(again)).toEqual([]);
  });

  it('test_played_days_unchanged', () => {   // J1 et J4 : mêmes temps, que les autres jours soient joués ou de montage
    const all = [2, 3, 5, 6].reduce<Raw>((acc, d) => withMontageDay(acc, d as MDay), raw0);
    const plain = playOf({}).seen;
    const cond = playOf({}, all).seen;
    for (const d of [1, 4]) expect(beatsOfDay(cond, d), `J${d}`).toEqual(beatsOfDay(plain, d));
  });
});
