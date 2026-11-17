/**
 * Profils de l'oracle de survie rejoués en actes de rue [R-02b.14, R-02b.37, R-02b.59 ; plan 02b T10, complété en T15]. Aucune valeur de jeu ici :
 * mots, jours, noms, permis, absences et issue viennent de `survival.oracle.json`, le coût du `comply` et celui de chaque option des données du monde.
 * Chaque jour sans nom émet le REFUS que la donnée porte (`offer.refused.jN`) ; chaque jour de nom, l'option qui nomme.
 * Seul le #7 trouvé hors du J2 n'est pas rejoué (il lève : aucun profil ne le porte avant J5, l'objet reste au logement).
 */
import { parseWorld } from '../../src/data/schema/world';
import type { ActRecord, DayIndex } from '../../src/shared/types/street';
import { cat, w10Raw } from '../fixtures/data/factories';
import { lanesOpen } from '../../src/engine/moments/checkpoint';
import { createStreet, reduceAct, toDayState } from '../../src/engine/moments/state';
import type { StreetContext, StreetState } from '../../src/engine/moments/types';
import { braceletCount } from '../../src/engine/moments/words';
import { startWeek, type WeekState } from '../../src/engine/week';
import type { MomentId } from '../../src/shared/types/street';
import type { Palier } from '../../src/survival';
import { act } from './street';
import { oracle } from './survival';

const world = parseWorld(w10Raw, cat);
const COMPLY_WORDS = world.street.checkpoint.forcedWords.comply;
/** La file la plus longue du checkpoint : le Registre ne s'ouvre qu'après (la porte peut être fermée selon le jour). */
const COMPLY_MINUTES = Math.max(world.street.checkpoint.minutes.comply, world.street.checkpoint.minutes.closedGate);
const DAYS: readonly DayIndex[] = [1, 2, 3, 4, 5, 6];

/** Réglages d'un profil : `audition` est l'option du choix `audition.j7` (la réponse ne change pas la fin, GDD 05). */
export interface ProfileOpts { readonly audition?: string }
/** Réglages de la nuit 1. */
export interface Night1Opts { readonly bypass?: boolean }

/** Le J1 : composant laissé, téléphone pris, sortie, voie du checkpoint, `spent − 14` mots de remplissage, trois regards, une consigne, nuit [R-02b.37]. */
export function night1(spent: number, opts: Night1Opts = {}): ActRecord[] {
  const lane = opts.bypass === true ? 'bypass' : 'comply';
  const fill = opts.bypass === true ? spent : spent - COMPLY_WORDS;
  return [
    act(1, 420, 'choice', 'j1.phone', 'take'), act(1, 421, 'choice', 'j1.component', 'leave'), act(1, 430, 'exit', 'home'),
    act(1, 600, 'lane', 'checkpoint', lane),
    ...dayTail(1, 700, fill),
  ];
}

/** Fin d'un jour : mots de remplissage, trois regards, une consigne obéie, nuit. */
function dayTail(day: DayIndex, from: number, fill: number): ActRecord[] {
  return [
    ...Array.from({ length: fill }, () => act(day, from, 'say', 'filler.1')),
    act(day, from + 10, 'glance', 'n1'), act(day, from + 11, 'glance', 'n2'), act(day, from + 12, 'glance', 'n3'),
    act(day, from + 20, 'obey', 'order'), act(day, 1300, 'sleep', 'night'),
  ];
}

/** Un jour sans nom : le refus que la donnée porte, par jour [w10.json : choix `offer.refused.jN`]. */
const REFUSAL_CHOICE: Readonly<Record<number, { readonly id: string; readonly option: string }>> = {
  2: { id: 'j2.component', option: 'hide' }, 3: { id: 'j3.marlene', option: 'banal' },
  4: { id: 'j4.neighbour', option: 'silent' }, 5: { id: 'j5.bruno', option: 'refuse' },
};
/** Un jour de nom : l'option qui nomme (J2 : `declare`, sans coût en mots côté oracle, J3 à J5 : `name`). */
const NAME_CHOICE: Readonly<Record<number, { readonly id: string; readonly option: string }>> = {
  2: { id: 'j2.component', option: 'declare' }, 3: { id: 'j3.marlene', option: 'name' },
  4: { id: 'j4.neighbour', option: 'name' }, 5: { id: 'j5.bruno', option: 'name' },
};

/** Les mots que coûte l'option (lus dans la donnée `words`, jamais en dur) [R-02b.48]. */
function optionCost(id: string, option: string): number {
  return world.street.choices.find((c) => c.id === id)?.options.find((o) => o.id === option)?.words ?? 0;
}

/** Le choix du jour `d` : nom si l'oracle en donne un ce jour-là, sinon le refus de la donnée ; `null` hors J2 à J5. */
function offerOf(d: DayIndex, names: readonly number[]): { readonly id: string; readonly option: string } | null {
  return (names.includes(d) ? NAME_CHOICE[d] : REFUSAL_CHOICE[d]) ?? null;
}

/** Les jours que le profil joue : jusqu'à la nuit d'arrestation, ou les six jours puis le J7 [R-02b.28]. */
function lastNightOf(end: string): number {
  const m = /^arrested:(\d)$/.exec(end);
  return m === null ? DAYS.length : Number(m[1]);
}

/** Les actes d'un profil de l'oracle sur sept jours : voie `comply`, offre du jour, permis, absences, puis remplissage jusqu'aux mots de l'oracle. */
export function actsOfProfile(name: string, opts: ProfileOpts = {}): ActRecord[] {
  const o = oracle('survival').profiles[name] ?? oracle('survival').d134[name];
  if (o === undefined) throw new Error(`profil inconnu : ${name}`);
  if (o.found !== null && o.found !== 2) throw new Error(`actsOfProfile : « ${name} » : #7 trouvé le J${o.found}, rejoué seulement le J2 (laissé visible)`);
  const last = lastNightOf(o.end);
  const out: ActRecord[] = [];
  for (const d of DAYS.filter((x) => x <= last)) {
    const offer = offerOf(d, o.names);
    const absent = o.absent.includes(d);
    if (d === 1) out.push(act(1, 420, 'choice', 'j1.phone', 'take'), act(1, 421, 'choice', 'j1.component', 'leave'));
    if (d === 2 && o.found === 2) out.push(act(2, 420, 'choice', 'j2.component', 'leaveVisible'));
    else if (d === 2) out.push(act(2, 420, 'choice', offer!.id, offer!.option));
    if (absent) out.push(act(d, 780, 'choice', 'door.noon', 'stay'));               // resté au logement jusqu'à midi : la porte pose la question [R-C5]
    else {
      out.push(act(d, 430, 'exit', 'home'));
      if (o.permit === d) out.push(act(d, 440, 'choice', `permit.j${d}`, 'request'));
      out.push(act(d, 600, 'lane', 'checkpoint', 'comply'));
      if (!world.street.registre.closedDays.includes(d)) {
        out.push(act(d, 600 + COMPLY_MINUTES + 10, 'enter', 'registre'), act(d, 600 + COMPLY_MINUTES + 40, 'exit', 'registre'));
      }
    }
    let paid = absent ? 0 : COMPLY_WORDS;
    if (d === 2 && o.found !== 2) paid += optionCost(offer!.id, offer!.option);
    if (d > 2 && offer !== null) { out.push(act(d, 790, 'choice', offer.id, offer.option)); paid += optionCost(offer.id, offer.option); }
    out.push(...dayTail(d, 800, o.words[d - 1]! - paid));
  }
  if (!/^arrested:\d$/.test(o.end)) out.push(act(7, 1100, 'choice', 'audition.j7', opts.audition ?? 'silence'));
  return out;
}

/** Ce que le joueur voit à un écran du J1 : le moment, le nombre du bracelet, la ligne de droit du moment, les voies, l'heure, le palier du matin. */
export interface Screen {
  readonly moment: MomentId; readonly bracelet: number; readonly rightLine: string | null;
  readonly lanes: readonly string[]; readonly clockMinute: number; readonly palier: Palier | null;
}

/** Un écran du J1 : `arrive` mène à l'écran (l'état est noté ensuite), `then` est ce que le joueur y fait. */
interface J1Step { readonly arrive?: readonly ActRecord[]; readonly then?: readonly ActRecord[] }

/**
 * Le J1 en quatorze écrans, un pas chacun [GDD 05 §3.7]. La marche ne figure pas parmi les actes : l'horloge ne bouge qu'aux actes, et la
 * porte (écran 4) est notée AVANT la sortie. Le soir, `enter home` à la dernière minute de la rue donne le moment `nuit` avant `sleep`.
 */
function j1Steps(): readonly J1Step[] {
  const night = world.street.clock.dayEndMinute;
  return [
    {},                                                                                        // 1 le lever
    { arrive: [act(1, 421, 'use', 'sectorCard')] },                                            // 2 la carte : droit 1
    { then: [act(1, 425, 'choice', 'j1.component', 'leave'), act(1, 430, 'choice', 'j1.phone', 'take')] },   // 3 ce que tu emportes
    { then: [act(1, 430, 'exit', 'home')] },                                                   // 4 la porte (7 h 10)
    { then: [act(1, 440, 'glance', 'n1')] },                                                   // 5 la rue aller
    { then: [act(1, 450, 'choice', 'm1.scan', 'pass')] },                                      // 6 la cabine de scan
    { then: [act(1, 460, 'choice', 'm2.nadia', 'pass')] },                                     // 7 Nadia
    { then: [act(1, 470, 'glance', 'n2'), act(1, 480, 'obey', 'order')] },                     // 8 la file : droit 4
    { then: [act(1, 600, 'lane', 'checkpoint', 'comply'), act(1, 670, 'glance', 'n3')] },      // 9 le checkpoint
    { arrive: [act(1, 680, 'enter', 'registre')], then: [act(1, 690, 'choice', 'relecture.j1', 'pass'), act(1, 700, 'exit', 'registre')] },   // 10 le Registre
    { then: [act(1, 720, 'choice', 'm3.letter', 'refuse')] },                                  // 11 le banc de Théodore
    { arrive: [act(1, 1060, 'choice', 'm5.yusuf', 'pass')] },                                  // 12 le soir
    { arrive: [act(1, night, 'enter', 'home')], then: [act(1, night, 'sleep', 'night')] },     // 13 la nuit
    {},                                                                                        // 14 le matin du J2
  ];
}

/** Rejoue le J1 écran par écran avec les réglages réels du monde et note l'état utile à chacun. Lève si un acte est refusé. */
export function walkJ1(ctx: StreetContext): readonly Screen[] {
  let s: StreetState = createStreet(ctx);
  let w: WeekState = startWeek(ctx.run, ctx.world, ctx.core);
  const play = (list: readonly ActRecord[] | undefined): void => {
    for (const a of list ?? []) {
      const r = reduceAct(s, w, a, ctx);
      if ('reason' in r) throw new Error(`walkJ1 : acte refusé (${r.reason}) : ${JSON.stringify(a)}`);
      s = r.state; w = r.week;
    }
  };
  return j1Steps().map((step) => {
    play(step.arrive);
    const shot: Screen = {
      moment: s.moment, bracelet: braceletCount(toDayState(s, w, ctx).ledger), rightLine: s.rightLines[`${s.day}.${s.moment}`] ?? null,
      lanes: lanesOpen(s, ctx), clockMinute: s.clock.minute, palier: s.readings.at(-1)?.palier ?? null,
    };
    play(step.then);
    return shot;
  });
}
