/**
 * Le metteur en scène de la semaine [plan rue guidée J3-J7, T4] : répliques et routes selon une marque, audition du J7 (issue, relevé,
 * fin, sans nuit), arrestation dans la nuit, reprise après la fin. Joué sur le pilote réel de w10, `guided` = `director-week.json`
 * (J1 deux étapes, J2 une route et une réplique selon A1, J3 un choix à prix à 10 h lu par une route à 14 h, J7 l'audition à prix).
 */
import { describe, expect, it } from 'vitest';
import { pathsOf, picksOf } from '../../../src/validate/guided';
import FIX from '../../fixtures/guided/director-week.json';
import {
  ctxArrestNight, ctxDirWeek, ctxW10DemoAfter, directorRig, linesUntilChoice, outcomeOf, pairCover, playAllDefault, playPath, playPicks, rejectedOf,
  weekPicks,
} from '../../support/guided';

describe('metteur en scène, semaine', () => {
  it('test_linked_beat_follows_yesterday_mark', () => {
    const r = directorRig([], ctxDirWeek);
    playPath(r, { 'j1.a': 'theodore' }, (b) => b.kind === 'card' && b.day === 2);
    expect(linesUntilChoice(r)).toContain('w10.dw.bench');
  });

  it('test_linked_beat_null_shows_nothing', () => {
    const r = directorRig([], ctxDirWeek);
    playPath(r, { 'j1.a': 'nadia' }, (b) => b.kind === 'card' && b.day === 2);
    const keys = linesUntilChoice(r);
    expect(keys).toContain('w10.dw.j2.wake');   // la scène est bien jouée, seule la réplique liée manque
    expect(keys).not.toContain('w10.dw.bench');
  });

  it('test_route_takes_the_branch_of_the_mark', () => {
    const day2 = (pick: string): readonly string[] => {
      const r = directorRig([], ctxDirWeek);
      playPath(r, { 'j1.a': pick }, (b) => b.kind === 'card' && b.day === 2);
      return linesUntilChoice(r);
    };
    expect(day2('theodore')).toContain('w10.dw.j2.bench');
    expect(day2('theodore')).not.toContain('w10.dw.j2.street');
    expect(day2('nadia')).toContain('w10.dw.j2.street');
    expect(day2('nadia')).not.toContain('w10.dw.j2.bench');
  });

  it('test_director_routes_like_proof', () => {   // Review Focus 2
    const paths = pathsOf(ctxDirWeek.street, 7, 'projection');
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) { const r = directorRig([], ctxDirWeek); expect(playPicks(r, p)?.acts).toEqual(p.acts); }
  });

  // T3 revue M1 : la preuve juge une route sur les marques de FIN de jour ; ici la marque vient d'un choix à prix du MÊME jour, plus tôt
  // (m2.nadia à 10 h, route j3.r à 14 h). Le metteur en scène lit les marques à la présentation : les deux chemins doivent être égaux.
  it('test_route_reads_same_day_earlier_choice_like_proof', () => {
    for (const option of ['buy', 'pass']) {
      const r = directorRig([], ctxDirWeek);
      const seen = playPath(r, weekPicks({ 'm2.nadia': option }));   // `j1.a` : première option, theodore
      const lines = seen.flatMap((b) => (b.kind === 'line' ? [b.key] : []));
      expect(lines).toContain(option === 'buy' ? 'w10.dw.j3.paid' : 'w10.dw.j3.free');
      expect(lines).not.toContain(option === 'buy' ? 'w10.dw.j3.free' : 'w10.dw.j3.paid');
      // `pathOf` rejoue sur le seuil d'arrestation livré (`ctxW10(street)`), qui arrête ces journées muettes à la nuit 4 : le chemin de la
      // preuve est pris directement dans `pathsOf`, par ses choix.
      const want = weekPicks({ 'j1.a': 'theodore', 'm2.nadia': option });
      const proof = pathsOf(ctxDirWeek.street, 7, 'projection').find((p) => Object.entries(picksOf(p)).every(([k, o]) => want[k] === o))!;
      expect(proof.key).toContain(option === 'buy' ? 'j3.r~buy' : 'j3.r~*');
      expect(r.sink.saved).toEqual(proof.acts);
    }
    for (const p of pairCover(ctxDirWeek.street, 7)) { const r = directorRig([], ctxDirWeek); expect(playPicks(r, p)?.acts).toEqual(p.acts); }
  });

  it('test_audition_goes_to_outcome_recap_end_without_sleep', () => {
    const r = directorRig([], ctxDirWeek);
    const seen = playPath(r, weekPicks({ 'audition.j7': 'none' }));
    expect(seen.map((b) => b.kind).slice(-3)).toEqual(['outcome', 'recap', 'end']);
    expect(seen.at(-1)).toEqual({ kind: 'end', early: false, endedDay: 7 });
    expect(rejectedOf(r)).toEqual([]);
    expect(r.sink.saved.some((a) => a.kind === 'sleep' && a.day === 7)).toBe(false);
    const n = r.sink.saved.length;
    r.dir.advance();   // la fin ne bouge pas
    expect(r.dir.current()).toMatchObject({ kind: 'end' });
    expect(r.sink.saved.length).toBe(n);
    expect(r.drv.finishDay()).not.toBeNull();
  });

  it('test_outcome_narrator_by_names', () => {
    const b = outcomeOf(playPath(directorRig([], ctxDirWeek), weekPicks({ 'j1.a': 'theodore', 'audition.j7': 'none' })));
    const o = FIX.ending.outcomes[b.endId as keyof typeof FIX.ending.outcomes];
    expect(b).toMatchObject({ names: 1, regimeKey: o.regimeKey, narratorKey: o.narratorKeys['1'] ?? null });
    const z = outcomeOf(playPath(directorRig([], ctxDirWeek), weekPicks({ 'j1.a': 'nadia', 'audition.j7': 'none' })));
    expect(z).toMatchObject({ names: 0, narratorKey: FIX.ending.outcomes[z.endId as keyof typeof FIX.ending.outcomes].narratorKeys['0'] });
  });

  it('test_resume_after_audition_ends', () => {
    const r = directorRig([], ctxDirWeek);
    playPath(r, weekPicks({}));
    expect(directorRig(r.sink.saved, ctxDirWeek).dir.current()).toMatchObject({ kind: 'end', early: false });
  });

  it('test_early_arrest_goes_to_end_not_demo', () => {
    const ctx = ctxArrestNight(2);
    const r = directorRig([], ctx);
    playPath(r, {});
    expect(r.dir.current()).toEqual({ kind: 'end', early: true, endedDay: 2 });
    expect(directorRig(r.sink.saved, ctx).dir.current()).toEqual({ kind: 'end', early: true, endedDay: 2 });   // reprise
  });

  it('test_unwritten_day_still_demo_end', () => {
    const r = directorRig([], ctxW10DemoAfter(2));   // w10 finit au J7 depuis T13 : un w10 arrêté après le J2 garde la fin de démo
    playAllDefault(r);
    expect(r.dir.current()).toEqual({ kind: 'demoEnd' });
  });
});
