/** Lignes canoniques : une ligne complète de 11 réponses par monde, dans l'ordre de SEL_ORDER [GDD 01 §7, F-8 ; rejoué: lead-programmer]. */
import type { WorldId } from '../../src/shared/types/world';

/** Onze lignes arrivent chacune à leur monde ; la ligne de w09 se lit en motif (`D--ACBB-C-C`), pas ici. */
export const CANONICAL_LINES: readonly (readonly [WorldId, string])[] = [
  ['w01', 'CBCCBCCABBD'], ['w02', 'DBCAAACBDAD'], ['w03', 'BAABBACBBAD'], ['w04', 'ABBBACCBABD'],
  ['w05', 'BBAAABBBDAA'], ['w06', 'DBCAADBCCCD'], ['w07', 'CBCCBDBACCD'], ['w08', 'BBABBBCBDAB'],
  ['w10', 'ACBACBACAAD'], ['w11', 'AAABBCACBBD'], ['w12', 'CBCCBDDACCD'],
];
