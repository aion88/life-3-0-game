/** Spatial dinner interaction: references the shipped tableware and the player's actual wrist. */
import { Group, Mesh, MeshStandardNodeMaterial, PointLight, RingGeometry, LatheGeometry, BoxGeometry, Vector2, SphereGeometry, CylinderGeometry, TorusGeometry, Vector3, Quaternion, type Object3D } from 'three/webgpu';
import type { Stage } from '../stage';
import type { Shot } from '../../engine/view/rig';

export type DinnerObjectFocus = 'plate' | 'basil' | 'bracelet';
export type DinnerFocus = DinnerObjectFocus | 'marlene' | 'player' | 'wide' | 'window';
export interface DinnerHotspot { readonly id: DinnerObjectFocus; readonly label: string; readonly position: Vector3 }
export interface DinnerView {
  /** World-space targets; absent props are omitted, never replaced by guessed screen coordinates. */
  hotspots(): readonly DinnerHotspot[];
  /** An intimate view of the real object, or a two-person/table tableau for null. */
  shotForFocus(id: DinnerFocus | null): Shot;
  /** Visible object reaction only: plate slides aside; selected bracelet stays orange. */
  react(id: DinnerObjectFocus): void;
  /** Actual partner world position, refreshed by the runtime before a reverse shot. */
  setPartnerPosition(position: { x: number; y?: number; z: number }): void;
  setActive(on: boolean): void;
  /** Call after the player skeleton has been updated, with frame delta in milliseconds. */
  update(dtMs: number): void;
  dispose(): void;
}

/** Mount wrist/light cues, basil foliage and reversible plate staging; shared materials remain untouched. */
export function createDinnerView(stage: Stage, player: Object3D): DinnerView {
  const group = new Group(); group.name = 'episode.dinner.interaction'; group.visible = false; stage.view.add(group);
  const metal = new MeshStandardNodeMaterial({ color: '#416779', metalness: .6, roughness: .3 });
  const indicator = new MeshStandardNodeMaterial({ color: '#ffc078', emissive: '#ef9a4e', emissiveIntensity: .4, metalness: .15, roughness: .35 });
  const bandGeo = new TorusGeometry(.042, .009, 8, 32);
  const bracelet = new Mesh(bandGeo, metal); bracelet.name = 'episode.bracelet'; group.add(bracelet);
  const lightGeo = new TorusGeometry(.043, .003, 6, 32);
  const braceletLight = new Mesh(lightGeo, indicator); bracelet.add(braceletLight);
  const ringGeo = new RingGeometry(.13, .145, 40);
  const ring = new Mesh(ringGeo, indicator); ring.rotation.x = -Math.PI / 2; ring.visible = false; group.add(ring);
  const light = new PointLight('#ffbe78', 0, 1.4, 2); group.add(light);
  const warmth = new PointLight('#ffd4a5', 1.8, 4.5, 2); group.add(warmth);
  const foliage = new Group(); foliage.name = 'episode.dinner.basil'; group.add(foliage);
  const leafGeo = new SphereGeometry(1, 12, 8);
  const stemGeo = new CylinderGeometry(.0017, .0025, 1, 5);
  const leafMaterials = ['#426834', '#618443', '#74934e'].map(color => new MeshStandardNodeMaterial({ color, roughness: .85 }));
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.39996, height = .1 + (i % 3) * .035;
    const x = Math.cos(angle) * .035, z = Math.sin(angle) * .035;
    const stem = new Mesh(stemGeo, leafMaterials[0]);
    stem.position.set(x, height / 2, z); stem.scale.y = height; foliage.add(stem);
    for (let side = -1; side <= 1; side += 2) {
      const leaf = new Mesh(leafGeo, leafMaterials[i % 3]);
      leaf.position.set(x + Math.cos(angle) * .033 * side, height - .014, z + Math.sin(angle) * .033 * side);
      leaf.scale.set(.043, .007, .02); leaf.rotation.set(side * .2, -angle, side * .25); foliage.add(leaf);
    }
  }
  // A closed lathed profile gives the ceramic a foot, shallow well and rounded lip.
  const dishGeo = new LatheGeometry([
    [0, .003], [.065, .003], [.074, .005], [.083, .009], [.112, .018],
    [.127, .023], [.13, .026], [.129, .029], [.125, .03], [.111, .025],
    [.082, .015], [.065, .012], [0, .012],
  ].map(([x, y]) => new Vector2(x, y)), 64);
  const ceramic = new MeshStandardNodeMaterial({ color: '#f1e8d5', roughness: .23, metalness: 0 });
  const linen = new MeshStandardNodeMaterial({ color: '#8e8470', roughness: 1 });
  const clothGeo = new BoxGeometry(.29, .003, .29);
  const utensilGeo = new BoxGeometry(.012, .006, .17);
  const settings = new Group(); settings.name = 'episode.dinner.tableware'; group.add(settings);
  const dishes: Mesh[] = [];
  for (const [i, [x, z]] of ([[-.34, -.13], [.02, -.13], [-.32, .18]] as const).entries()) {
    const dish = new Mesh(dishGeo, ceramic); dish.name = `episode.dinner.plate.${i}`;
    dish.position.set(x, .004, z); dishes.push(dish); settings.add(dish);
    const mat = new Mesh(clothGeo, linen); mat.position.set(x, 0, z); settings.add(mat);
    const knife = new Mesh(utensilGeo, metal); knife.position.set(x + .155, .006, z); settings.add(knife);
  }
  let originalPlates: { object: Object3D; visible: boolean }[] = [];
  const restoreTableware = (): void => { for (const item of originalPlates) item.object.visible = item.visible; };
  let partnerPosition: Vector3 | null = null;
  let originalLeaves: Object3D | undefined;
  let leavesWereVisible = true;
  const restoreLeaves = (): void => { if (originalLeaves) originalLeaves.visible = leavesWereVisible; };
  let wrist: Object3D | undefined;
  const resolveWrist = (): void => { wrist ??= player.getObjectByName('hand_l') ?? player.getObjectByName('lowerarm_l'); };
  let districtRoot: Object3D | null = null;
  let plate: Object3D | undefined;
  let basil: Object3D | undefined;
  let active = false, disposed = false, reaction: DinnerObjectFocus | null = null, elapsed = 0;
  let selected: DinnerObjectFocus | null = null;
  let plateOrigin: Vector3 | null = null, plateMoved = false, plateElapsed = 0;
  const reducedMotion = (): boolean => stage.canvasHost.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  const restorePlate = (): void => { if (plate && plateOrigin) { plate.position.copy(plateOrigin); plate.updateMatrixWorld(true); } };

  const rotation = new Quaternion();
  const point = new Vector3();

  const resolve = (): void => {
    const root = stage.district().root;
    if (root === districtRoot) return;
    restorePlate(); restoreLeaves(); restoreTableware();
    districtRoot = root;
    originalPlates = [0, 1, 2].flatMap(i => {
      const object = root.getObjectByName(`marlene.plate.${i}`);
      return object ? [{ object, visible: object.visible }] : [];
    });
    const middle = root.getObjectByName('marlene.plate.1');
    settings.visible = !!middle;
    if (middle) { middle.getWorldPosition(settings.position); settings.position.y -= .012; }
    plate = middle ? dishes[2] : undefined;
    plateOrigin = plate?.position.clone() ?? null;
    basil = root.getObjectByName('marlene.basil.pot');
    originalLeaves = root.getObjectByName('marlene.basil.leaves');
    leavesWereVisible = originalLeaves?.visible ?? true;
  };
  const targets = (): DinnerHotspot[] => {
    resolve(); resolveWrist();
    const out: DinnerHotspot[] = [];
    if (plate) { plate.updateWorldMatrix(true, false); out.push({ id: 'plate', label: 'La troisième assiette', position: plate.getWorldPosition(new Vector3()) }); }
    if (basil) { basil.updateWorldMatrix(true, false); const at = basil.getWorldPosition(new Vector3()); at.y += .15; out.push({ id: 'basil', label: 'Le basilic de Marlène', position: at }); }
    if (wrist) { wrist.updateWorldMatrix(true, false); out.push({ id: 'bracelet', label: 'Ton bracelet', position: wrist.getWorldPosition(new Vector3()) }); }
    return out;
  };
  const shotForFocus = (id: DinnerFocus | null): Shot => {
    if (id === 'window') {
      const opening = stage.district().root.getObjectByName('marlene.window');
      if (opening) {
        const at = opening.getWorldPosition(new Vector3());
        return { focus: { x: at.x, z: at.z }, y: at.y + .1, distM: 2.2, elevDeg: 2, azimDeg: 90, focalMm: 42 };
      }
    }
    const target = id === null ? null : targets().find(t => t.id === id)?.position;
    const portraitDistance = Math.max(1, Math.min(1.5, .85 / (stage.camera.aspect || 1)));
    if (id === 'marlene' || id === 'player') {
      player.updateWorldMatrix(true, false);
      const subject = id === 'marlene' && partnerPosition ? partnerPosition : player.getWorldPosition(new Vector3());
      return {
        focus: { x: subject.x, z: subject.z }, y: subject.y + (stage.camera.aspect < 1 ? 1.8 : 1.35),
        distM: 2.15 * portraitDistance, elevDeg: 5,
        azimDeg: id === 'marlene' ? 65 : 245, focalMm: 48,
      };
    }
    if (target) return {
      focus: { x: target.x, z: target.z }, y: target.y,
      distM: (id === 'bracelet' ? 2.5 : 2.3) * portraitDistance, elevDeg: id === 'bracelet' ? 12 : id === 'plate' ? 62 : 25,
      azimDeg: id === 'bracelet' ? 65 : id === 'plate' ? 145 : 100, focalMm: id === 'bracelet' ? 42 : 48,
    };
    // Use the authored room/table and real player, not a duplicate room coordinate.
    resolve(); player.updateWorldMatrix(true, false); player.getWorldPosition(point);
    const table = plate?.getWorldPosition(new Vector3());
    const x = table ? (table.x + point.x) / 2 : point.x;
    const z = table ? (table.z + point.z) / 2 : point.z;
    return { focus: { x, z }, y: .95, distM: 5.8 * Math.min(portraitDistance, 1.2), elevDeg: 42, azimDeg: 120, focalMm: 40 };
  };
  const update = (dtMs: number): void => {
    if (disposed || !active) return;
    resolve(); resolveWrist();
    if (originalLeaves) originalLeaves.visible = false;
    for (const item of originalPlates) item.object.visible = false;
    foliage.visible = !!basil;
    if (basil) {
      basil.getWorldPosition(foliage.position); foliage.position.y += .09;
      warmth.position.copy(foliage.position); warmth.position.y += 1.1; warmth.position.x -= .35;
    }
    if (plateMoved && plate && plateOrigin) {
      plateElapsed = reducedMotion() ? 650 : Math.min(650, plateElapsed + Math.max(0, Math.min(dtMs, 100)));
      const t = plateElapsed / 650, ease = t * t * (3 - 2 * t);
      plate.position.copy(plateOrigin);
      plate.position.x -= .13 * ease;
      plate.position.z += .01 * ease;
      plate.position.y += Math.sin(t * Math.PI) * .1;
      plate.updateMatrixWorld(true);
    }
    if (wrist) {
      wrist.updateWorldMatrix(true, false); wrist.getWorldPosition(bracelet.position); wrist.getWorldQuaternion(rotation);
      bracelet.quaternion.copy(rotation); bracelet.rotateX(Math.PI / 2); bracelet.visible = true;
    } else bracelet.visible = false;
    const settleIndicator = (): void => {
      indicator.emissiveIntensity = selected === 'bracelet' ? 1.5 : .4;
      ring.visible = false;
      light.intensity = selected === 'bracelet' && wrist ? .12 : 0;
      if (selected === 'bracelet') light.position.copy(bracelet.position);
    };
    if (reaction === null) { settleIndicator(); return; }
    elapsed += Math.max(0, Math.min(dtMs, 100));
    const at = targets().find(t => t.id === reaction)?.position;
    const pulse = Math.max(0, 1 - elapsed / 1400);
    if (!at || pulse === 0) { reaction = null; settleIndicator(); return; }
    indicator.emissiveIntensity = .4 + pulse * 1.6;
    ring.visible = reaction !== 'bracelet'; ring.position.copy(at); ring.position.y += .025;
    ring.scale.setScalar(1 + (1 - pulse) * .15);
    light.position.copy(at); light.position.y += .12; light.intensity = pulse * .7;
  };
  return {
    hotspots: targets, shotForFocus,
    setPartnerPosition(position) { partnerPosition = new Vector3(position.x, position.y ?? 0, position.z); },
    react(id) { if (disposed) return; selected = id; reaction = id; elapsed = 0; if (id === 'plate' && !plateMoved) { resolve(); plateMoved = true; plateElapsed = 0; } update(0); },
    setActive(on) { active = on; group.visible = on; if (!on) { reaction = null; selected = null; ring.visible = false; light.intensity = 0; indicator.emissiveIntensity = .4; restorePlate(); restoreLeaves(); restoreTableware(); plateMoved = false; plateElapsed = 0; } else update(0); },
    update,
    dispose() { if (disposed) return; disposed = true; restorePlate(); restoreLeaves(); restoreTableware(); group.removeFromParent(); dishGeo.dispose(); clothGeo.dispose(); utensilGeo.dispose(); ceramic.dispose(); linen.dispose(); leafGeo.dispose(); stemGeo.dispose(); leafMaterials.forEach(material => material.dispose()); bandGeo.dispose(); lightGeo.dispose(); ringGeo.dispose(); metal.dispose(); indicator.dispose(); },
  };
}
