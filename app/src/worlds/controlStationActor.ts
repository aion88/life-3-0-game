import {AnimationMixer, Box3, BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3, type AnimationAction, type Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {applyPlayerOutfit} from '../street/render/characters/playerOutfit';

export type StationGesture='rest'|'ticket'|'phone';
/** Existing rig, with articulated shoulder/elbow poses for actual hand-held props. */
export async function createStationActor(){
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`${import.meta.env.BASE_URL}worlds/w10/characters/char.player.glb`);
 const model=gltf.scene,disposeOutfit=applyPlayerOutfit(model);model.updateMatrixWorld(true);
 const bounds=new Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;
 model.scale.multiplyScalar(1.72/height);model.position.y=-bounds.min.y*1.72/height;
 const root=new Group();root.name='station.player';root.add(model);root.position.set(-.6,0,5.1);root.rotation.y=Math.PI;
 model.traverse(object=>{if(object instanceof Mesh){object.castShadow=true;object.receiveShadow=true;}});
 const mixer=new AnimationMixer(model),clips=new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));let current:AnimationAction|undefined;
 const play=(name:'idle'|'walk')=>{const next=clips.get(name);if(next===current)return;current?.fadeOut(.18);next?.reset().fadeIn(.18).play();current=next;};play('idle');
 const head=model.getObjectByName('head');
 const chain=(side:'l'|'r')=>{
  const shoulder=model.getObjectByName(`upperarm_${side}`),elbow=model.getObjectByName(`lowerarm_${side}`),hand=model.getObjectByName(`hand_${side}`);
  if(!shoulder||!elbow||!hand)throw new Error('Le personnage ne contient pas les articulations de main nécessaires.');
  const fingers=['index','middle','ring','pinky'].flatMap(name=>[1,2,3].flatMap(index=>{
   const bone=model.getObjectByName(`${name}_0${index}_${side}`);return bone?[{bone,rest:bone.quaternion.clone(),curl:index===1?.22:index===2?.38:.18}]:[];
  }));
  return {shoulder,elbow,hand,fingers};
 };
 const left=chain('l'),right=chain('r');
 const skinRoot=new Group();skinRoot.name='station.held-prop';root.add(skinRoot);
 const ticket=new Mesh(new BoxGeometry(.085,.055,.004),new MeshStandardMaterial({color:'#bdcba5',roughness:.68}));ticket.name='station.ticket';skinRoot.add(ticket);
 const stripe=new Mesh(new BoxGeometry(.068,.008,.005),new MeshStandardMaterial({color:'#1c6459',roughness:.8}));stripe.position.y=.012;ticket.add(stripe);
 const phone=new Group();phone.name='station.phone';skinRoot.add(phone);
 const phoneBody=new Mesh(new BoxGeometry(.075,.146,.010),new MeshStandardMaterial({color:'#172827',metalness:.28,roughness:.45}));phone.add(phoneBody);
 const screenMat=new MeshStandardMaterial({color:'#b9dccc',emissive:'#73b6ab',emissiveIntensity:.3,roughness:.7});
 const phoneScreen=new Mesh(new BoxGeometry(.063,.122,.002),screenMat);phoneScreen.position.z=.006;phone.add(phoneScreen);
 for(let i=0;i<3;i++){const line=new Mesh(new BoxGeometry(.044,i===0?.008:.004,.001),new MeshStandardMaterial({color:'#24564d',roughness:1}));line.position.set(0,.035-i*.021,.008);phone.add(line);}
 let gesture:StationGesture='rest',blend=0;let targetYaw=0;
 const scratchA=new Vector3(),scratchB=new Vector3(),rotation=new Quaternion(),world=new Quaternion(),parentWorld=new Quaternion();
 const worldWrist=new Vector3(),desiredGrip=new Quaternion(),localGrip=new Quaternion(),gripOffset=new Vector3(0,.065,.016);
 const rotateJoint=(joint:Object3D,hand:Object3D,destination:Vector3,weight:number)=>{
  root.updateMatrixWorld(true);const origin=joint.getWorldPosition(new Vector3());
  scratchA.copy(hand.getWorldPosition(new Vector3())).sub(origin).normalize();scratchB.copy(destination).sub(origin).normalize();
  rotation.setFromUnitVectors(scratchA,scratchB);rotation.slerp(new Quaternion(),1-weight);
  joint.getWorldQuaternion(world);world.premultiply(rotation);joint.parent!.getWorldQuaternion(parentWorld);joint.quaternion.copy(parentWorld.invert().multiply(world));root.updateMatrixWorld(true);
 };
 const update=(dt:number,moving:boolean)=>{
  // Some finger joints have no clip track: restore them before applying a bounded grip.
  for(const arm of [left,right])for(const f of arm.fingers)f.bone.quaternion.copy(f.rest);
  play(moving?'walk':'idle');mixer.update(dt);
  blend=Math.min(1,blend+dt*3);
  if(gesture!=='rest'){
   const arm=gesture==='ticket'?left:right;
   // Reader is on the character's left. Never reach across the torso with the right arm.
   const contact=gesture==='ticket'?new Vector3(-1.52,1.20,.465):root.localToWorld(new Vector3(-.23,1.25,.38));
   if(gesture==='ticket')desiredGrip.setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2+.25);
   else desiredGrip.copy(root.quaternion).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI)).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.15));
   // Solve for wrist such that the centre of the held object, not the wrist itself, meets the target.
   worldWrist.copy(contact).sub(gripOffset.clone().applyQuaternion(desiredGrip));
   const target=arm.hand.getWorldPosition(new Vector3()).lerp(worldWrist,blend);
   for(let i=0;i<7;i++){rotateJoint(arm.elbow,arm.hand,target,.65);rotateJoint(arm.shoulder,arm.hand,target,.55);}
   arm.hand.parent!.getWorldQuaternion(parentWorld);
   localGrip.copy(parentWorld.invert()).multiply(desiredGrip);arm.hand.quaternion.slerp(localGrip,blend);
   for(const f of arm.fingers)f.bone.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),f.curl*blend));
   if(head&&gesture==='phone')head.rotation.x+=.12*blend;
   root.updateMatrixWorld(true);
   // Keep prop in metre-scaled actor space, while following actual palm orientation and location.
   arm.hand.getWorldQuaternion(world);
   const palm=arm.hand.getWorldPosition(new Vector3()).add(gripOffset.clone().applyQuaternion(world));
   skinRoot.position.copy(root.worldToLocal(palm.clone()));
   root.getWorldQuaternion(parentWorld);skinRoot.quaternion.copy(parentWorld.invert().multiply(world));
   root.userData['heldProp']=gesture;
   root.userData['contactError']=palm.distanceTo(contact);
  }else root.userData['heldProp']='none';
  skinRoot.visible=gesture!=='rest';ticket.visible=gesture==='ticket';phone.visible=gesture==='phone';
 };
 const setGesture=(next:StationGesture)=>{if(next===gesture)return;gesture=next;blend=0;};
 const setHeading=(radians:number,dt:number)=>{targetYaw=radians;let d=targetYaw-root.rotation.y;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;root.rotation.y+=d*Math.min(1,dt*7);};
 const dispose=()=>{mixer.stopAllAction();disposeOutfit();const geos=new Set<import('three').BufferGeometry>(),mats=new Set<import('three').Material>(),textures=new Set<import('three').Texture>();root.traverse(o=>{if(o instanceof Mesh){geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);for(const t of Object.values(m))if(t&&typeof t==='object'&&'isTexture'in t)textures.add(t as import('three').Texture);}}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.removeFromParent();};
 return {root,update,setGesture,setHeading,setAccepted:()=>{screenMat.color.copy(new Color('#c8e2a8'));},dispose};
}
