import {AnimationClip, Box3, BoxGeometry, Color, CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, NumberKeyframeTrack, Quaternion, SphereGeometry, TorusGeometry, Vector3, type Object3D} from 'three';
import type {CastMember} from './cast';
export type Wardrobe='shawl'|'apron'|'vest'|'coat'|'uniform'|'scarf';
export interface Appearance { garment:Wardrobe; cloth:string; accent:string; hair?:string; glasses?:boolean; prop?:'book'|'camera'|'bag'; width:number }
/** Recurring people have authored silhouettes; these are wardrobe assemblies over the shared facial rigs. */
export const appearances:Record<string,Appearance>={
 marlene:{garment:'shawl',cloth:'#7d4d4b',accent:'#d6b98e',hair:'#b0a092',glasses:true,width:1.05},
 nadia:{garment:'coat',cloth:'#39716a',accent:'#d5b477',prop:'bag',width:.95},
 agente:{garment:'uniform',cloth:'#3e5365',accent:'#d5d6c0',width:1},
 esteban:{garment:'vest',cloth:'#926443',accent:'#d8c8a8',prop:'bag',width:1.08},
 tomasz:{garment:'coat',cloth:'#405e72',accent:'#c3b7a1',glasses:true,width:.93},
 sabine:{garment:'scarf',cloth:'#496d66',accent:'#c78160',prop:'book',width:1},
 courtiere:{garment:'uniform',cloth:'#5b5166',accent:'#d9c8a2',width:1.04},
 soraya:{garment:'shawl',cloth:'#697e99',accent:'#dfc3a0',width:1.04},
 anatol:{garment:'uniform',cloth:'#52665c',accent:'#dfc895',glasses:true,width:1.03},
 dorothee:{garment:'coat',cloth:'#905a51',accent:'#d4b69d',prop:'book',width:.96},
 remy:{garment:'apron',cloth:'#3f7270',accent:'#d0a570',width:1.06},
 noor:{garment:'vest',cloth:'#b16c48',accent:'#d9d4ac',prop:'book',width:.94},
 maelle:{garment:'scarf',cloth:'#68795e',accent:'#d9a3a0',width:1.04},
 anselme:{garment:'coat',cloth:'#80664f',accent:'#c8d1bd',glasses:true,width:.98},
 iris:{garment:'vest',cloth:'#95564c',accent:'#cbd9c5',width:.94},
 salome:{garment:'apron',cloth:'#5d7181',accent:'#d6c5a5',glasses:true,width:1},
 lazare:{garment:'scarf',cloth:'#735c7e',accent:'#ceb583',prop:'book',width:.96},
 armand:{garment:'uniform',cloth:'#687062',accent:'#e1bf91',width:1.1},
 brigitte:{garment:'apron',cloth:'#7d5145',accent:'#d5c6a3',hair:'#8d8176',width:1.1},
 hubert:{garment:'vest',cloth:'#48655b',accent:'#c4ae7f',glasses:true,width:1.05},
 agathe:{garment:'coat',cloth:'#a46648',accent:'#d5c7b2',prop:'bag',width:.96},
 voisine:{garment:'scarf',cloth:'#487678',accent:'#d5ae8a',width:1.04},
 mina:{garment:'apron',cloth:'#647b7d',accent:'#d2b584',width:1.03},
 octave:{garment:'uniform',cloth:'#5d5965',accent:'#c8aa6f',width:1.07},
 thais:{garment:'vest',cloth:'#8b704e',accent:'#d8d9c0',prop:'bag',width:.96},
 ibrahim:{garment:'coat',cloth:'#4c786b',accent:'#d1bc9c',glasses:true,width:1.06},
 aurele:{garment:'scarf',cloth:'#726385',accent:'#d3bb88',prop:'book',width:.95},
 clemence:{garment:'coat',cloth:'#7b846b',accent:'#d6cba9',width:1.04},
 awa:{garment:'vest',cloth:'#a3684d',accent:'#cbdfce',prop:'book',width:1.02},
 gisele:{garment:'shawl',cloth:'#59777c',accent:'#cda17f',hair:'#b5ada3',glasses:true,prop:'camera',width:1.06},
 arsene:{garment:'coat',cloth:'#866b5a',accent:'#d1c5a8',width:1.1},
 anouk:{garment:'scarf',cloth:'#64734e',accent:'#dfad8d',prop:'bag',width:.94},
 lucien:{garment:'vest',cloth:'#806049',accent:'#d5b57f',glasses:true,width:1.12},
 mireille:{garment:'shawl',cloth:'#846862',accent:'#d8cdb0',hair:'#aea092',width:1.05},
 ines:{garment:'coat',cloth:'#5c7581',accent:'#d0aa75',prop:'book',width:.96},
 augustin:{garment:'apron',cloth:'#6d755b',accent:'#c9aa79',width:1.08},
};
const fabric=(color:string)=>new MeshStandardMaterial({color,roughness:.94,metalness:0});
/** Place a rigid wardrobe piece at a world-space bind pose, then let its bone animate it. */
function attach(root:Object3D,boneName:string,part:Group,position:Vector3):void {
 const bone=root.getObjectByName(boneName)??root;bone.updateWorldMatrix(true,false);
 part.position.copy(bone.worldToLocal(position));part.quaternion.copy(bone.getWorldQuaternion(new Quaternion()).invert());part.scale.copy(bone.getWorldScale(new Vector3())).set(1/part.scale.x,1/part.scale.y,1/part.scale.z);bone.add(part);
}
export function applyCastAppearance(root:Object3D,person:CastMember):void {
 const spec=appearances[person.id];if(!spec)return;
 root.updateMatrixWorld(true);const bounds=new Box3().setFromObject(root),h=bounds.max.y-bounds.min.y,base=bounds.min.y;
 const parts:Mesh[]=[];
 root.traverse(o=>{if(o instanceof Mesh)parts.push(o);});
 for(const o of parts){const list=Array.isArray(o.material)?o.material:[o.material];const modified=list.map(source=>{if(!(source instanceof MeshStandardMaterial))return source;const name=source.name;const cloth=/suit|dress|shirt/.test(name),hair=/short0|ponytail|hair/.test(name);if(!cloth&&!(hair&&spec.hair))return source;const m=source.clone();m.color.set(cloth?spec.cloth:spec.hair!);if(cloth){m.map=null;m.roughness=.94;m.metalness=0;}else if(hair&&spec.hair){
 const tint=new Color(spec.hair);m.color.set('#ffffff');m.roughness=.88;
 // Preserve the hair-card alpha and strand texture while changing its pigment.
 m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\ndiffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(.2126,.7152,.0722))) * .55 + vec3(${tint.r.toFixed(5)},${tint.g.toFixed(5)},${tint.b.toFixed(5)}) * .45;`);};
 m.customProgramCacheKey=()=>`cast-hair-${spec.hair}`;
 }return m;});o.material=Array.isArray(o.material)?modified:modified[0]!;}
 const cloth=fabric(spec.cloth),accent=fabric(spec.accent),dark=fabric('#293b3d');
 const mesh=(geo:import('three').BufferGeometry,mat:MeshStandardMaterial,x:number,y:number,z:number)=>{const m=new Mesh(geo,mat);m.position.set(x*h,y*h,z*h);m.castShadow=true;m.receiveShadow=true;return m;};
 const torso=new Group();torso.name=`wardrobe.${person.id}.${spec.garment}`;
 const bodyX=(bounds.max.x+bounds.min.x)/2,bodyZ=(bounds.max.z+bounds.min.z)/2;
 const chest=new Vector3(bodyX,base+h*.64,bodyZ);
 if(spec.garment==='shawl'){
  const wrap=mesh(new CylinderGeometry(h*.145,h*.18,h*.15,40,1,true),cloth,0,.12,0);wrap.scale.z=.60;torso.add(wrap);
  const fold=mesh(new BoxGeometry(h*.12,h*.25,h*.018),accent,-.045,.015,.085);fold.rotation.z=-.18;torso.add(fold);
 }else if(spec.garment==='apron'){
  torso.add(mesh(new BoxGeometry(h*.19,h*.30,h*.018),cloth,0,-.035,.085));
  torso.add(mesh(new BoxGeometry(h*.10,h*.065,h*.012),accent,0,-.09,.098));
  for(const x of [-.068,.068])torso.add(mesh(new BoxGeometry(h*.018,h*.15,h*.012),accent,x,.15,.08));
 }else if(spec.garment==='coat'){
  const skirt=mesh(new CylinderGeometry(h*.12,h*.16,h*.22,32,1,true),cloth,0,-.13,0);skirt.scale.z=.65;torso.add(skirt);
  for(const side of [-1,1]){const lapel=mesh(new BoxGeometry(h*.036,h*.17,h*.012),accent,side*.05,.10,.086);lapel.rotation.z=side*.22;torso.add(lapel);}
 }else if(spec.garment==='vest'){
  for(const x of [-.063,.063])torso.add(mesh(new BoxGeometry(h*.073,h*.26,h*.025),cloth,x,.025,.085));
  for(let i=0;i<4;i++)torso.add(mesh(new SphereGeometry(h*.004,8,6),accent,.012,.11-i*.04,.105));
 }else if(spec.garment==='uniform'){
  for(const x of [-.11,.11])torso.add(mesh(new BoxGeometry(h*.06,h*.015,h*.09),accent,x,.19,.012));
  torso.add(mesh(new BoxGeometry(h*.035,h*.05,h*.012),accent,-.055,.10,.09));
 }else{
  const collar=mesh(new TorusGeometry(h*.045,h*.016,8,32),accent,0,.20,.018);collar.rotation.x=Math.PI/2;torso.add(collar);
  const tail=mesh(new BoxGeometry(h*.04,h*.22,h*.022),accent,.025,.08,.08);tail.rotation.z=.1;torso.add(tail);
 }
 if(spec.prop){const item=new Group();item.name=`prop.${spec.prop}`;const material=spec.prop==='camera'?dark:accent;item.add(mesh(new BoxGeometry(h*.10,h*.12,h*.035),material,.115,-.12,.10));if(spec.prop==='camera'){const lens=mesh(new CylinderGeometry(h*.027,h*.027,h*.035,20),dark,.115,-.12,.138);lens.rotation.x=Math.PI/2;item.add(lens);}torso.add(item);}
 attach(root,'spine_03',torso,chest);
 if(spec.glasses){const glasses=new Group();glasses.name='wardrobe.glasses';for(const x of [-.027,.027])glasses.add(mesh(new TorusGeometry(h*.023,h*.0025,6,24),dark,x,0,0));glasses.add(mesh(new BoxGeometry(h*.016,h*.004,h*.004),dark,0,0,0));attach(root,'head',glasses,new Vector3(bodyX,base+h*.926,bounds.max.z-h*.04));}
 root.scale.x*=spec.width;root.userData['castIdentity']=person.id;root.userData['wardrobe']=spec.garment;
}
/** Purpose-built pupil: ceramic shell, visible joints, optical face and articulated listening gestures. */
export function createRobotStudent():{body:Group;animations:AnimationClip[]} {
 const body=new Group();body.name='robot.student';const shell=fabric('#d6d2b6'),teal=fabric('#476f70'),joint=fabric('#263d46');const glow=new MeshStandardMaterial({color:'#c4e4d2',emissive:'#65b8ae',emissiveIntensity:.45,roughness:.45});
 const add=(parent:Object3D,geometry:import('three').BufferGeometry,mat:MeshStandardMaterial,x:number,y:number,z:number)=>{const m=new Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 add(body,new CapsuleGeometry(.19,.28,6,24),shell,0,.92,0).scale.z=.6;
 add(body,new BoxGeometry(.20,.11,.025),teal,0,1,.122);
 add(body,new CylinderGeometry(.12,.14,.08,28),teal,0,.72,0).scale.z=.68;
 // Inset grille, fasteners and shell joints provide readable construction at medium shots.
 for(let i=0;i<5;i++)add(body,new BoxGeometry(.11,.006,.008),joint,0,.967+i*.015,.139);
 for(const x of [-.076,.076])for(const y of [.965,1.035])add(body,new SphereGeometry(.006,8,6),shell,x,y,.14);
 add(body,new TorusGeometry(.135,.005,6,32),teal,0,.88,0).rotation.x=Math.PI/2;

 for(const side of [-1,1]){
  const leg=new Group();leg.name=`robot_leg_${side===1?'l':'r'}`;leg.position.set(side*.115,.69,0);body.add(leg);add(leg,new SphereGeometry(.065,16,12),joint,0,0,0);add(leg,new CapsuleGeometry(.055,.18,4,16),shell,0,-.16,0);add(leg,new SphereGeometry(.062,16,12),teal,0,-.32,0);add(leg,new CapsuleGeometry(.049,.19,4,16),shell,0,-.47,0);add(leg,new BoxGeometry(.13,.08,.22),teal,0,-.64,.045);
  const arm=new Group();arm.name=`robot_arm_${side===1?'l':'r'}`;arm.position.set(side*.23,1.09,0);body.add(arm);add(arm,new SphereGeometry(.066,16,12),teal,0,0,0);add(arm,new CapsuleGeometry(.041,.16,4,16),shell,side*.025,-.14,0);add(arm,new SphereGeometry(.047,16,12),joint,side*.025,-.27,0);add(arm,new CapsuleGeometry(.034,.16,4,16),shell,side*.025,-.39,.02);add(arm,new BoxGeometry(.07,.075,.05),teal,side*.025,-.525,.025);
  for(let finger=0;finger<3;finger++)add(arm,new CapsuleGeometry(.008,.044,3,8),shell,side*.025+(finger-1)*.021,-.58,.025);

 }
 add(body,new CylinderGeometry(.046,.046,.10,20),joint,0,1.25,0);const head=new Group();head.name='robot_head';head.position.y=1.39;body.add(head);const helmet=add(head,new SphereGeometry(.15,32,20),shell,0,0,0);helmet.scale.set(1,.92,.78);add(head,new BoxGeometry(.22,.07,.025),joint,0,.015,.111);for(const side of [-1,1])add(head,new SphereGeometry(.017,16,12),glow,side*.058,.015,.132);add(head,new CylinderGeometry(.036,.036,.024,20),teal,-.15,0,0).rotation.z=Math.PI/2;add(head,new CylinderGeometry(.036,.036,.024,20),teal,.15,0,0).rotation.z=Math.PI/2;
 const idle=new AnimationClip('idle',4,[new NumberKeyframeTrack('robot_head.rotation[y]',[0,1,2,3,4],[0,.08,0,-.08,0])]);
 const talk=new AnimationClip('talk',3,[new NumberKeyframeTrack('robot_head.rotation[x]',[0,.6,1.2,2,3],[0,.12,0,-.06,0]),new NumberKeyframeTrack('robot_arm_l.rotation[z]',[0,.7,1.7,3],[0,-.35,-.18,0])]);
 const walk=new AnimationClip('walk',1,[new NumberKeyframeTrack('robot_leg_l.rotation[x]',[0,.5,1],[-.25,.25,-.25]),new NumberKeyframeTrack('robot_leg_r.rotation[x]',[0,.5,1],[.25,-.25,.25])]);
 body.userData['castIdentity']='eleve';body.userData['nonhuman']=true;return{body,animations:[idle,talk,walk]};
}
