import { applyPlayerOutfit } from './playerOutfit';
/**
 * Fournisseur de personnages depuis des `.glb` MPFB livrés [plan 02a T7]. La validation du contrat (cinq clips, mêmes os) est
 * synchrone et se fait à la création ; le décodage glTF se fait à la première demande d'un corps, et la poignée se remplit à l'arrivée
 * du modèle (l'appelant n'attend rien : une poignée vide ne dessine rien jusque-là).
 */
import { AnimationMixer, Group, LoopOnce, LoopRepeat, type AnimationAction, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CLIP_NAMES, GlbFormatError, readGlb, type ClipName } from '../../../engine/view/glb';
import type { Manifest } from '../../load/worldPayload';
import { applyLightFloor } from './floor';
import { CharacterContractError, type CharacterHandle, type CharacterProvider, type CharacterSpec } from './provider';

const BODY_PREFIX = 'char.';
/** Durée du fondu entre deux clips, en secondes (rendu seulement : aucune donnée du monde n'en dépend). */
const FADE_S = 0.2;

/** `opts.floorGain` : plancher de lumière (part de l'albédo émise, `characters.floorGain`), absent : aucun. Valide chaque corps du manifeste (`char.<bodyId>`) : cinq clips nommés, mêmes os que le premier. Lève `CharacterContractError`. */
export function createGlbProvider(assets: ReadonlyMap<string, ArrayBuffer>, manifest: Manifest, opts: { readonly floorGain?: number } = {}): CharacterProvider {
  const bodies = new Map<string, ArrayBuffer>();
  let referenceBones: string | null = null;
  let referenceBody = '';
  for (const entry of manifest.assets) {
    if (!entry.id.startsWith(BODY_PREFIX)) continue;
    const buf = assets.get(entry.id);
    if (buf === undefined) throw new CharacterContractError(`corps ${entry.id} : fichier absent du chargement`);
    let info;
    try { info = readGlb(buf); } catch (e) {
      if (e instanceof GlbFormatError) throw new CharacterContractError(`corps ${entry.id} : ${e.message}`);
      throw e;
    }
    const missing = CLIP_NAMES.filter((c) => !info.animations.includes(c));
    if (missing.length > 0) throw new CharacterContractError(`corps ${entry.id} : clips manquants ${missing.join(', ')}`);
    const bones = info.bones.join('|');
    if (referenceBones === null) { referenceBones = bones; referenceBody = entry.id; }
    else if (bones !== referenceBones) throw new CharacterContractError(`corps ${entry.id} : os différents de ${referenceBody} (les clips ne seraient plus interchangeables)`);
    bodies.set(entry.id.slice(BODY_PREFIX.length), buf);
  }

  const parsed = new Map<string, Promise<GLTF>>();
  function load(bodyId: string): Promise<GLTF> {
    let p = parsed.get(bodyId);
    if (p === undefined) {
      const buf = bodies.get(bodyId) as ArrayBuffer;
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      p = new Promise<GLTF>((resolve, reject) => { loader.parse(buf, '', resolve, reject); });
      parsed.set(bodyId, p);
    }
    return p;
  }

  return {
    neutral: false,
    acquire(spec: CharacterSpec): CharacterHandle {
      if (!bodies.has(spec.bodyId)) throw new CharacterContractError(`corps ${BODY_PREFIX}${spec.bodyId} : inconnu du manifeste (personne ${spec.id})`, `${BODY_PREFIX}${spec.bodyId}`);
      const root = new Group();
      root.name = spec.id;
      let released = false;
      let disposeOutfit: (() => void) | null = null;
      let mixer: AnimationMixer | null = null;
      let model: Object3D | null = null;
      const actions = new Map<ClipName, AnimationAction>();
      let wanted: { clip: ClipName; speed: number } | null = null;
      let elapsedMs = 0;   // temps de scène écoulé depuis l'acquisition, y compris avant l'arrivée du modèle
      let current: AnimationAction | null = null;

      const apply = (): void => {
        if (mixer === null || wanted === null) return;
        const next = actions.get(wanted.clip);
        if (next === undefined) return;
        next.timeScale = wanted.speed;
        if (next === current) return;
        next.reset().fadeIn(FADE_S).play();
        current?.fadeOut(FADE_S);
        current = next;
      };

      let failure: CharacterContractError | null = null;
      const fail = (e: unknown): void => {
        failure = new CharacterContractError(`corps ${BODY_PREFIX}${spec.bodyId} : décodage glTF échoué (${e instanceof Error ? e.message : String(e)})`, `${BODY_PREFIX}${spec.bodyId}`);
      };
      load(spec.bodyId).then((gltf) => {
        if (released) return;
        model = clone(gltf.scene);
        if (spec.bodyId === 'player') disposeOutfit = applyPlayerOutfit(model);
        if (opts.floorGain !== undefined && opts.floorGain > 0) applyLightFloor(model, opts.floorGain);
        root.add(model);
        mixer = new AnimationMixer(model);
        for (const clipName of CLIP_NAMES) {
          const src = gltf.animations.find((a) => a.name === clipName);
          if (src === undefined) continue;
          const action = mixer.clipAction(src);
          action.setLoop(clipName === 'turn' ? LoopOnce : LoopRepeat, Infinity);
          action.clampWhenFinished = clipName === 'turn';
          action.time = ((spec.seed % 1000) / 1000) * src.duration;   // désynchronise les passants entre eux
          actions.set(clipName, action);
        }
        apply();
        mixer.update(elapsedMs / 1000);   // l'animation est une fonction du temps de scène, pas de l'heure d'arrivée du décodage (deux prises identiques donnent le même cadre)
      }).catch(fail);   // jamais un corps invisible : l'échec est levé par `tick`, nommé par l'id du corps

      return {
        object: root,
        play(clip, speed) { wanted = { clip, speed }; apply(); },
        tick(dtMs) { if (failure !== null) throw failure; elapsedMs += dtMs; mixer?.update(dtMs / 1000); },
        release() {
          released = true;
          disposeOutfit?.();
          root.removeFromParent();
          if (mixer !== null && model !== null) { mixer.stopAllAction(); mixer.uncacheRoot(model); }
        },
      };
    },
  };
}
