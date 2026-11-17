/**
 * Verbes de la rue, `kind` des actes et clés d'écho [GDD 03 Q6, design §4.3 ; plan 02b T3].
 * Pur : aucun JSON, aucun DOM, aucune horloge. Le vocabulaire est la seule donnée écrite ici ; les clés d'écho vivent dans le monde.
 */
import { baseActKeys } from '../../shared/acts';
import type { ActRecord } from '../../shared/types/street';
import type { StreetData } from '../../data/schema/street';

/** Les sept verbes de la joueuse. Seuls `talk`, `use`, `enter`, `sleep` et le regard appuyé produisent un acte ; se déplacer, regarder et lire un passant n'ont aucun effet d'état. */
export type Verb = 'move' | 'look' | 'readPasserby' | 'talk' | 'useOrTrade' | 'enter' | 'sleep';

/**
 * Les onze `ActRecord.kind` de la rue : `choice` (id = choix, option = option confirmée, refus compris), `lane` (checkpoint, option = voie),
 * `say` (id = réplique), `use` (id = objet du kit), `enter` et `exit` (id = lieu), `glance` (id = nacelle), `obey` (id = consigne),
 * `buyWords` (id `nadia`, option = quantité), `sleep` (id `night`), `scene` (id = scène guidée, option = option narrative).
 */
export const streetActKinds: ReadonlySet<string> = Object.freeze(
  new Set(['choice', 'lane', 'say', 'use', 'enter', 'exit', 'glance', 'obey', 'buyWords', 'sleep', 'scene']),
);

/** Les `kind` connus du validateur d'actes : base (3) union rue (11). */
export function knownActKinds(): ReadonlySet<string> {
  return new Set([...baseActKeys, ...streetActKinds]);
}

/**
 * Clé d'écho d'un acte : `key` de la première entrée de `street.echo` dont le `kind` égale celui de l'acte et dont l'`id` vaut
 * `idPrefix` ou commence par `idPrefix.`. `null` si l'acte n'a pas d'écho.
 */
export function echoKeyOf(a: ActRecord, street: Pick<StreetData, 'echo'>): string | null {
  for (const e of street.echo) {
    if (e.kind === a.kind && (a.id === e.idPrefix || a.id.startsWith(`${e.idPrefix}.`))) return e.key;
  }
  return null;
}
