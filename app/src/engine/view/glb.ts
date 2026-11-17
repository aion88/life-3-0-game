/**
 * Lecture pure d'un `.glb` (glTF 2.0 binaire) : en-tête et bloc JSON seulement, aucune géométrie décodée [plan 02a T7].
 * Sert aux tests de réception des corps et à la validation du fournisseur (clips, os), sans Three.js.
 */

/** Jeu minimal nommé : attente, marche, demi-tour, parole, attente en file. */
export const CLIP_NAMES = ['idle', 'walk', 'turn', 'talk', 'queue'] as const;
export type ClipName = typeof CLIP_NAMES[number];

/** Ce qu'on lit d'un corps : noms des clips, triangles, noms des os (premier squelette), poids en octets. */
export interface GlbInfo { readonly animations: readonly string[]; readonly triangles: number; readonly bones: readonly string[]; readonly bytes: number }

/** Fichier qui n'est pas un glTF 2.0 binaire lisible. */
export class GlbFormatError extends Error {
  constructor(message: string) { super(message); this.name = 'GlbFormatError'; }
}

const MAGIC = 0x46546c67;      // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'

/** UTF-8 -> chaîne sans `TextDecoder` (absent de la bibliothèque du moteur). */
function utf8(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++] as number;
    let cp = b;
    let extra = 0;
    if (b >= 0xf0) { cp = b & 0x07; extra = 3; } else if (b >= 0xe0) { cp = b & 0x0f; extra = 2; } else if (b >= 0xc0) { cp = b & 0x1f; extra = 1; }
    for (; extra > 0 && i < bytes.length; extra--) cp = (cp << 6) | ((bytes[i++] as number) & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out;
}

interface Gltf {
  animations?: { name?: string }[];
  nodes?: { name?: string }[];
  skins?: { joints?: number[] }[];
  accessors?: { count?: number }[];
  meshes?: { primitives?: { indices?: number; mode?: number; attributes?: Record<string, number> }[] }[];
}

/** Lit l'en-tête et le bloc JSON d'un `.glb`. Lève `GlbFormatError` si le fichier n'en est pas un. */
export function readGlb(buf: ArrayBuffer): GlbInfo {
  if (buf.byteLength < 20) throw new GlbFormatError('fichier trop court pour un .glb');
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== MAGIC) throw new GlbFormatError("pas un .glb (signature 'glTF' absente)");
  if (view.getUint32(4, true) !== 2) throw new GlbFormatError(`glTF version ${view.getUint32(4, true)} (2 attendue)`);
  const jsonLen = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON) throw new GlbFormatError('premier bloc non JSON');
  if (20 + jsonLen > buf.byteLength) throw new GlbFormatError('bloc JSON tronqué');
  let json: Gltf;
  try { json = JSON.parse(utf8(new Uint8Array(buf, 20, jsonLen))) as Gltf; } catch { throw new GlbFormatError('bloc JSON illisible'); }
  const nodes = json.nodes ?? [];
  const joints = json.skins?.[0]?.joints ?? [];
  const accessors = json.accessors ?? [];
  let indexCount = 0;
  for (const m of json.meshes ?? []) {
    for (const p of m.primitives ?? []) {
      if (p.mode !== undefined && p.mode !== 4) continue;       // triangles seulement (mode 4, défaut)
      const acc = p.indices ?? p.attributes?.['POSITION'];
      indexCount += accessors[acc ?? -1]?.count ?? 0;
    }
  }
  return {
    animations: (json.animations ?? []).map((a, i) => a.name ?? `animation_${i}`),
    triangles: Math.floor(indexCount / 3),
    bones: joints.map((j) => nodes[j]?.name ?? `node_${j}`),
    bytes: buf.byteLength,
  };
}
