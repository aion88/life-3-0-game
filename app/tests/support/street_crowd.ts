/**
 * Aides des tests des personnages, de la foule et de la file [R-02a.2, plan 02a T7] : un fichier, un écrivain. Rien sous `src/` ne l'importe.
 * Les aides de réception (`shippedCharacterFiles`, `delivered`) lisent `app/public/worlds/w10/characters/` : rien n'y est livré tant que
 * les départements d'art n'ont pas fini l'étape 6.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLIP_NAMES } from '../../src/engine/view/glb';
import { PLAYER_BODY_ID } from '../../src/engine/view/crowd';
import type { Manifest } from '../../src/street/load/worldPayload';
import { S, SCENE } from './street_walk';

export { S, SCENE };

/** Dossier des corps livrés. */
export const CHARACTERS_DIR = fileURLToPath(new URL('../../public/worlds/w10/characters/', import.meta.url));
/** Manifeste de w10, brut. */
export const W10_MANIFEST_PATH = fileURLToPath(new URL('../../public/worlds/w10/manifest.json', import.meta.url));

/** Corps exigés à la réception : la joueuse, chaque PNJ qui est une personne, au moins un corps de foule. */
export const REQUIRED_BODIES: string[] = [
  PLAYER_BODY_ID,
  ...Object.values(SCENE.npcPlaces).filter((p) => p.kind === 'person').map((p) => p.bodyId),
  SCENE.characters.crowdBodies.v[0] as string,
];

const FILE = /^char\.(.+)\.glb$/;

/** Les `.glb` présents dans le dossier de livraison (`[]` sans fichier livré). */
export function shippedCharacterFiles(): { id: string; buf: ArrayBuffer }[] {
  if (!existsSync(CHARACTERS_DIR)) return [];
  return readdirSync(CHARACTERS_DIR).flatMap((name) => {
    const m = FILE.exec(name);
    if (m === null) return [];
    const b = readFileSync(CHARACTERS_DIR + name);
    return [{ id: m[1] as string, buf: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }];
  });
}

/** Corps exigés dont le fichier manque. */
export function missingBodies(): string[] {
  return REQUIRED_BODIES.filter((id) => !existsSync(`${CHARACTERS_DIR}char.${id}.glb`));
}

/** Vrai quand chaque corps exigé est livré (les tests de réception s'ouvrent alors). */
export const delivered = missingBodies().length === 0;
/** Raison affichée quand la réception est fermée : nomme les corps manquants. */
export const skipReason = `corps non livrés (étape 6) : ${missingBodies().join(', ')}`;

/** Un `.glb` synthétique valide (en-tête et bloc JSON seulement) : noms de clips, d'os et nombre de triangles au choix. */
export function writeGlb(o: { animations: readonly string[]; bones: readonly string[]; triangles: number }): ArrayBuffer {
  const json = {
    asset: { version: '2.0' },
    nodes: o.bones.map((name) => ({ name })),
    skins: [{ joints: o.bones.map((_, i) => i) }],
    animations: o.animations.map((name) => ({ name, channels: [], samplers: [] })),
    accessors: [{ count: o.triangles * 3, componentType: 5123, type: 'SCALAR' }],
    meshes: [{ primitives: [{ indices: 0, attributes: {}, mode: 4 }] }],
  };
  const raw = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(raw.length / 4) * 4).fill(0x20);
  padded.set(raw);
  const buf = new ArrayBuffer(20 + padded.length);
  const v = new DataView(buf);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, buf.byteLength, true);
  v.setUint32(12, padded.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buf, 20).set(padded);
  return buf;
}

/** Le manifeste réduit aux corps donnés (`char.<id>`), licence propre, palier `core`. */
export function manifestWith(...ids: string[]): Manifest {
  return {
    budgetBytes: 30_000_000,
    assets: ids.map((id) => ({ id, path: `characters/${id}.glb`, bytes: 1, tier: 'core', license: 'own', source: 'MPFB (CC0 1.0), habillé par le département Blender', verifiedOn: null })),
  };
}

/** Les buffers par id d'asset. */
export function assetsWith(files: Record<string, ArrayBuffer>): ReadonlyMap<string, ArrayBuffer> {
  return new Map(Object.entries(files));
}

const BONES = ['hips', 'spine', 'head'];
/** Un corps synthétique valide : les cinq clips, le jeu d'os commun. */
export const validGlb = (): ArrayBuffer => writeGlb({ animations: CLIP_NAMES, bones: BONES, triangles: 10 });

/** Un corps valide par corps exigé. */
export function syntheticAssets(): ReadonlyMap<string, ArrayBuffer> {
  return assetsWith(Object.fromEntries(REQUIRED_BODIES.map((id) => [`char.${id}`, validGlb()])));
}
export function syntheticManifest(): Manifest {
  return manifestWith(...REQUIRED_BODIES.map((id) => `char.${id}`));
}
