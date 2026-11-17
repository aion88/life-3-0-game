/**
 * Condensat d'une suite de uint32 : FNV-1a sur les quatre octets petit-boutistes de chaque valeur.
 * Partagé par le générateur de valeurs dorées et par les tests [GDD 03 T-1c ; PHASE V m1].
 * Choix de bits : chaque octet est xoré puis multiplié par 0x01000193 (Math.imul), résultat uint32.
 */
export function foldUint32(h, x) {
  let r = h >>> 0;
  for (let i = 0; i < 4; i++) {
    r = Math.imul(r ^ ((x >>> (8 * i)) & 0xff), 0x01000193) >>> 0;
  }
  return r;
}
