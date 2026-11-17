/**
 * Portes de la v1, état de la semaine : recopie du tableau 5.7 du GDD 03, colonnes « 6 pas » et « 7 pas »
 * [exécuté: replay_gdd03.py pour 6 pas, gd-plancher-gdd03-7pas pour 7 pas ; GDD 03 §5.7, §10.1].
 * Départ canonique, écho maximal sur la variable de porte quand une clé y mène ; les cases « aucune clé » ne produisent pas de ligne.
 */
import type { Milli } from '../../src/shared/milli';
import type { ArrivalWorldId, WorldVar } from '../../src/shared/types/world';

/** Une case du tableau : valeur de la variable de porte après `steps` pas, avec ou sans écho maximal. */
export interface DoorRow {
  readonly world: ArrivalWorldId;
  /** Variable et seuil de la porte, `>` strict, seuil en points [GDD 03 §3.4]. */
  readonly gateVar: WorldVar;
  readonly gateThreshold: number;
  readonly steps: 6 | 7;
  readonly echo: 'none' | 'max';
  readonly expected: Milli;
}

type Gate = { readonly world: ArrivalWorldId; readonly gateVar: WorldVar; readonly gateThreshold: number; readonly echoKey: boolean };
type Cells = readonly [none6: number, max6: number | null, none7: number, max7: number | null];

/** Portes et cases du tableau 5.7, en points, dans l'ordre des mondes du tableau. */
const TABLE: readonly (readonly [Gate, Cells])[] = [
  [{ world: 'w01', gateVar: 'unrest', gateThreshold: 75, echoKey: false }, [37.4, null, 37.8, null]],
  [{ world: 'w02', gateVar: 'surveillance', gateThreshold: 80, echoKey: false }, [75, null, 75, null]],
  [{ world: 'w03', gateVar: 'aiPower', gateThreshold: 60, echoKey: true }, [26.8, 32.8, 27.1, 34.1]],
  [{ world: 'w04', gateVar: 'surveillance', gateThreshold: 80, echoKey: true }, [60, 66, 60, 67]],
  [{ world: 'w05', gateVar: 'surveillance', gateThreshold: 80, echoKey: false }, [91.2, null, 91.4, null]],
  [{ world: 'w06', gateVar: 'surveillance', gateThreshold: 80, echoKey: false }, [70, null, 70, null]],
  [{ world: 'w08', gateVar: 'surveillance', gateThreshold: 80, echoKey: false }, [25, null, 25, null]],
  [{ world: 'w09', gateVar: 'unrest', gateThreshold: 60, echoKey: true }, [41, 47, 42, 49]],
  [{ world: 'w10', gateVar: 'surveillance', gateThreshold: 96, echoKey: true }, [96.8, 100, 97.1, 100]],
  [{ world: 'w11', gateVar: 'unrest', gateThreshold: 70, echoKey: false }, [35.6, null, 35.7, null]],
];

/** Portes par monde : variable, seuil et présence d'une clé d'écho, pour construire les mondes de test. */
export const DOOR_GATES: readonly Gate[] = TABLE.map(([g]) => g);

/** Les lignes du tableau 5.7 : 10 mondes, 28 cases chiffrées. */
export const DOOR_TABLE: readonly DoorRow[] = TABLE.flatMap(([g, c]) => {
  const rows: readonly (readonly [6 | 7, 'none' | 'max', number | null])[] = [
    [6, 'none', c[0]], [6, 'max', c[1]], [7, 'none', c[2]], [7, 'max', c[3]],
  ];
  return rows.flatMap(([steps, echo, points]) => (points === null ? [] : [{
    world: g.world, gateVar: g.gateVar, gateThreshold: g.gateThreshold, steps, echo, expected: Math.round(points * 1000) as Milli,
  }]));
});
