/** Cuisson des LUT 3D d'état [art bible §E.7]. TS pur : aucun import de moteur de rendu. */

/** Réglages d'un état : valeurs en données `supposed` tant que le technical-artist n'a pas livré ses LUT. */
export interface LutParams { readonly contrast: number; readonly saturation: number; readonly tint: readonly [number, number, number] }

/** Côté d'une LUT : 32 pixels, soit 32³ x 4 = 131 072 octets en RGBA8. */
export const LUT_SIZE = 32;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * LUT RGBA8 de `size`³ texels, `r` le plus rapide puis `g` puis `b` (l'ordre d'un `Data3DTexture` : x, y, z).
 * Par texel : saturation autour de la luminance Rec. 709, contraste autour de 0,5, puis teinte multiplicative.
 * Les réglages neutres (1, 1, [1,1,1]) donnent la LUT identité.
 */
export function bakeLut(size: number, params: LutParams): Uint8Array {
  const out = new Uint8Array(size * size * size * 4);
  const max = size - 1;
  let i = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const rgb = [r / max, g / max, b / max];
        const luma = 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
        for (let k = 0; k < 3; k++) {
          let c = luma + (rgb[k]! - luma) * params.saturation;
          c = (c - 0.5) * params.contrast + 0.5;
          c *= params.tint[k]!;
          out[i++] = Math.round(clamp01(c) * 255);
        }
        out[i++] = 255;
      }
    }
  }
  return out;
}
