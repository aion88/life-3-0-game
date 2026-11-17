/**
 * La rue de w10, construite à partir de la donnée de scène [plan 02a T6]. Aucune règle de jeu : la vue affiche, elle ne calcule rien.
 * Procédurale de bout en bout (`assets` est reçu pour la forme du contrat de chargement : T5 n'y met aucun asset de scène).
 * Le compteur du mur montre la valeur du moteur (`wallCounterOf`, passée par le pilote) et ne descend jamais.
 */
import { Group, type Object3D } from 'three/webgpu';
import type { GradeUniforms } from '../../../engine/view/grade';
import type { LightRig } from '../lighting';
import type { I18n } from '../../../i18n/i18n';
import type { SceneData } from '../../../engine/view/sceneSchema';
import { buildCheckpoint } from './checkpoint';
import { buildCoffre } from './coffre';
import { buildCutaway } from './cutaway';
import { buildFacades } from './facades';
import { buildInteriors } from './interiors';
import { createKit } from './kit';
import { buildLamps } from './lamps';
import { buildSky } from './sky';
import { addExternalHits, buildPlaces } from './places';
import { ResourceBag } from './resources';
import { buildGround, buildNacelles } from './street';
import { canvasTextSurface, type TextSurfaceFactory } from './textSurface';

export type { TextSurface, TextSurfaceFactory } from './textSurface';
export { liveResourceCount, type LiveResources } from './resources';

/** Ce que le pilote tient du quartier. */
export interface DistrictHandle {
  readonly root: Object3D;
  readonly nacelles: ReadonlyMap<string, Object3D>;
  /** Les 11 objets cliquables, pas les personnes (rendues par la foule) [R-02a.14 a]. */
  readonly hitMeshes: ReadonlyMap<string, Object3D>;
  /** Les seize écrans du mur : seule source du canal de bloom [R-02a.14 b]. */
  readonly wallScreens: readonly Object3D[];
  /** Sources émissives hors mur (le Coffre, les lampes, les fenêtres éclairées) pour les mesures de T13. */
  readonly otherEmissives: readonly Object3D[];
  /** Les lieux de `layout.places` plus `checkpoint`. */
  readonly places: ReadonlyMap<string, Object3D>;
  setGrade(u: GradeUniforms): void;
  /** Lumière de la scène (hémisphère et soleil) de l'état de lumière courant [TV-02a-render]. */
  setLight(rig: LightRig): void;
  /** Lampadaires : allumage (0 à 1) et point du sol regardé, pour choisir les sources réelles [TV-02a-render]. */
  /** Dôme de ciel de l'état de lumière, centré sur l'oeil de la caméra [ciel-jour-spec]. */
  setSky(rig: LightRig, eye: { readonly x: number; readonly y: number; readonly z: number }): void;
  setLamps(level: number, viewer: { readonly x: number; readonly z: number }): void;
  setWallCounter(n: number): void;
  /** Séquences jouées : fente de la guérite, visage sur une télé du mur, bras de la barrière (0 baissé, 1 levé) [GDD sequences-jouees §0.1]. */
  setSlit(state: 'idle' | 'lit' | 'red'): void;
  setWallFace(on: boolean): void;
  setBarrierArm(t: number): void;
  /** Coupe de l'immeuble 9 : annule les instances de façade et de lampadaire qui cachent le logement, masque la porte de rue et les nacelles de l'étendue, allume les lampes de bureau (palier `deferred` ; au palier `core`, la façade seule) [spec rue guidée §4.5, revue finale M-2]. */
  setCutaway(on: boolean): void;
  /** Montre ou cache la voiture grise (le pilote décide) [R-02a.14 e]. */
  setVisible(id: 'greyCar', visible: boolean): void;
  dispose(): void;
}

/** Options : palier d'intérieurs, langues, usine de texte (injectable pour les tests). */
export interface DistrictOptions { readonly interiors: 'core' | 'deferred'; readonly i18n: I18n; readonly textSurface?: TextSurfaceFactory }

/** Construit le quartier. `deferred` ajoute le logement et le Registre meublés. */
export function buildDistrict(d: SceneData, assets: ReadonlyMap<string, ArrayBuffer>, opts: DistrictOptions): DistrictHandle {
  void assets;
  const bag = new ResourceBag();
  const k = createKit(d, bag);
  const root = new Group();
  root.name = 'district';

  const lights = buildGround(root, k);
  buildFacades(root, k);
  const lampLights = buildLamps(root, k);
  const skyDome = buildSky(root, k, (d.layout.zMax.v - d.layout.zMin.v) * 1.8);   // sous le plan lointain de la caméra (2 x longueur)
  const nacelles = buildNacelles(root, k);
  const { facade, portail } = buildCoffre(root, k);
  const cp = buildCheckpoint(root, k, opts.textSurface ?? canvasTextSurface);
  const { places, hits } = buildPlaces(root, k, new Map([['facadeCoffre', facade], ['portail', portail]]));
  places.set('checkpoint', cp.place);
  addExternalHits(k, hits, { parent: cp.place, heightM: cp.wall.heightM, widthM: d.checkpoint.wall.widthM, depthM: d.checkpoint.booth.depthM.v }, { parent: portail });
  const interior = opts.interiors === 'deferred' ? buildInteriors(root, k) : { lights: [], bulbs: [] };
  const cutaway = buildCutaway(root, k, { nacelles, lights: interior.lights, bulbs: interior.bulbs, intensityCd: d.cutaway.lamp.intensityCd.v });

  let shown = -Infinity;
  let freed = false;
  return {
    root, nacelles, hitMeshes: hits, wallScreens: cp.wall.screens, otherEmissives: k.otherEmissives, places,
    setGrade(u) { k.accent.value = u.accent; },
    setLight(rig) { lights.apply(rig); },
    setSky(rig, eye) { skyDome.apply(rig, eye); },
    setLamps(level, viewer) { lampLights.apply(level, viewer); },
    setWallCounter(n) {
      if (!(n > shown)) return;   // jamais décroissant, NaN ignoré
      shown = n;
      cp.wall.counter.setText(opts.i18n.t('w10.doc.wallCounter', { n }));
    },
    setSlit(state) { cp.rig.setSlit(state); },
    setWallFace(on) { cp.wall.setFace(on); },
    setBarrierArm(t) { cp.rig.setArm(t); },
    setCutaway(on) { cutaway.set(on); },
    setVisible(id, visible) {
      if (id === 'greyCar') places.get('voitureGrise')!.visible = visible;
    },
    dispose() {
      if (freed) return;
      freed = true;
      root.removeFromParent();
      bag.disposeAll();
    },
  };
}
