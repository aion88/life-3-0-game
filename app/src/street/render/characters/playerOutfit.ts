import {BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, SkinnedMesh, SphereGeometry, Vector3, type Object3D} from 'three';

/** Clip the long sleeves at an interpolated seam; no skin-coloured jacket triangles. */
function shortSleeves(source:BufferGeometry,cut:Float32Array):BufferGeometry {
 const names=Object.keys(source.attributes),out:Record<string,number[]>={};for(const name of names)out[name]=[];
 type Vertex={values:Record<string,number[]>;cut:number};
 const vertex=(i:number):Vertex=>({cut:cut[i]!,values:Object.fromEntries(names.map(n=>{const a=source.getAttribute(n);return[n,Array.from({length:a.itemSize},(_,j)=>a.getComponent(i,j))];}))});
 const between=(a:Vertex,b:Vertex):Vertex=>{const t=a.cut/(a.cut-b.cut);return{cut:0,values:Object.fromEntries(names.map(n=>[n,n==='skinIndex'?(t<.5?a.values[n]!:b.values[n]!):a.values[n]!.map((v,j)=>v+(b.values[n]![j]!-v)*t)]))};};
 const count=source.index?.count??source.getAttribute('position').count;
 for(let i=0;i<count;i+=3){const triangle=[0,1,2].map(j=>vertex(source.index?source.index.getX(i+j):i+j)),poly:Vertex[]=[];
  for(let j=0;j<3;j++){const a=triangle[j]!,b=triangle[(j+1)%3]!;if(a.cut<=0)poly.push(a);if((a.cut<=0)!==(b.cut<=0))poly.push(between(a,b));}
  for(let j=1;j+1<poly.length;j++)for(const v of [poly[0]!,poly[j]!,poly[j+1]!])for(const n of names)out[n]!.push(...v.values[n]!);
 }
 const result=new BufferGeometry();for(const n of names)result.setAttribute(n,new BufferAttribute(n==='skinIndex'?new Uint16Array(out[n]!):new Float32Array(out[n]!),source.getAttribute(n).itemSize));return result;
}
/** Light cotton tee, separate bare-arm geometry and denim, preserving the original animated hands. */
export function applyPlayerOutfit(root:Object3D):()=>void {
 const dispose:(()=>void)[]=[];root.updateMatrixWorld(true);const clothing:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)clothing.push(o);});
 for(const object of clothing){
  const source=object.material;if(Array.isArray(source)||!(source instanceof MeshStandardMaterial)||!source.name.includes('male_casualsuit01'))continue;
  let geometry=object.geometry.clone();geometry.computeBoundingBox();const bounds=geometry.boundingBox!,positions=geometry.getAttribute('position'),waist=bounds.min.y+(bounds.max.y-bounds.min.y)*.60;
  const beige=new Color('#d8c6a2'),denim=new Color('#537fa4'),colors=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i++)(positions.getY(i)>=waist?beige:denim).toArray(colors,i*3);geometry.setAttribute('color',new BufferAttribute(colors,3));
  if(object instanceof SkinnedMesh){
   const joints=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
   if(joints&&weights){const cuts=new Float32Array(positions.count).fill(-1),v=new Vector3();
    for(let i=0;i<positions.count;i++){let armWeight=0;let side='';let forearm=0;
     for(let j=0;j<4;j++){const bone=object.skeleton.bones[joints.getComponent(i,j)],w=weights.getComponent(i,j);if(!bone)continue;if(/lowerarm|hand|finger|thumb/.test(bone.name))forearm+=w;if(/upperarm/.test(bone.name)){armWeight+=w;if(w>.1)side=bone.name.endsWith('_l')?'_l':'_r';}}
     if(forearm>.5){cuts[i]=1;continue;}if(armWeight+forearm<.65||!side)continue;
     const a=root.getObjectByName(`upperarm${side}`)?.getWorldPosition(new Vector3()),b=root.getObjectByName(`lowerarm${side}`)?.getWorldPosition(new Vector3());if(!a||!b)continue;const axis=b.sub(a);v.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld).sub(a);cuts[i]=v.dot(axis)/axis.lengthSq()-.38;
    }
    const clipped=shortSleeves(geometry,cuts);geometry.dispose();geometry=clipped;
    const skin=new MeshStandardMaterial({color:'#8f624b',roughness:.93,metalness:0});dispose.push(()=>skin.dispose());
    for(const side of ['_l','_r']){
     const upper=root.getObjectByName(`upperarm${side}`),lower=root.getObjectByName(`lowerarm${side}`),hand=root.getObjectByName(`hand${side}`);if(!upper||!lower||!hand)continue;
     const shoulder=upper.getWorldPosition(new Vector3()),elbow=lower.getWorldPosition(new Vector3()),wrist=hand.getWorldPosition(new Vector3()),armLength=shoulder.distanceTo(elbow);
     const segment=(bone:Object3D,start:Vector3,end:Vector3,r1:number,r2:number)=>{const group=new Group();group.name='player.bare-arm';const axis=end.clone().sub(start),length=axis.length();const geo=new CylinderGeometry(r1,r2,length,24,4);const m=new Mesh(geo,skin);m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new Vector3(0,1,0),axis.normalize());m.castShadow=true;m.receiveShadow=true;group.add(m);group.position.copy(bone.worldToLocal(new Vector3()));group.quaternion.copy(bone.getWorldQuaternion(new Quaternion()).invert());const scale=bone.getWorldScale(new Vector3());group.scale.set(1/scale.x,1/scale.y,1/scale.z);bone.add(group);dispose.push(()=>{geo.dispose();group.removeFromParent();});};
     segment(upper,shoulder.clone().lerp(elbow,.32),elbow,armLength*.17,armLength*.145);segment(lower,elbow,wrist,armLength*.145,armLength*.10);
     const elbowGeo=new SphereGeometry(armLength*.15,20,12),joint=new Mesh(elbowGeo,skin);joint.name='player.elbow';const scale=lower.getWorldScale(new Vector3());joint.scale.set(1/scale.x,1/scale.y,1/scale.z);joint.castShadow=true;lower.add(joint);dispose.push(()=>{elbowGeo.dispose();joint.removeFromParent();});
    }
   }
  }
  const material=source.clone();material.name='player.beige-tee-blue-jeans';material.map=null;material.normalMap=null;material.aoMap=null;material.roughnessMap=null;material.metalnessMap=null;material.color.set('#ffffff');material.vertexColors=true;material.metalness=0;material.roughness=.92;object.geometry=geometry;object.material=material;dispose.push(()=>{geometry.dispose();material.dispose();});
 }
 return()=>dispose.forEach(fn=>fn());
}
