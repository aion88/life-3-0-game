import { expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Group } from 'three';
import { applyPlayerOutfit } from '../../../src/street/render/characters/playerOutfit';
it('separates light shirt and blue jeans without mutating the shared model or skin', () => {
 const geometry = new BufferGeometry(); geometry.setAttribute('position',new Float32BufferAttribute([0,0,0,0,1,0,0,2,0],3));
 const material = new MeshStandardMaterial({color:'#573c26'}); material.name='player_body.male_casualsuit01';
 const player=new Mesh(geometry,material), npc=new Mesh(geometry,material), skin=new Mesh(geometry,new MeshStandardMaterial());
 const root=new Group();root.add(player,skin); const dispose=applyPlayerOutfit(root);
 expect(player.material).not.toBe(material);expect(npc.material).toBe(material);expect(skin.geometry).toBe(geometry);
 expect(geometry.getAttribute('color')).toBeUndefined();
 const colors=player.geometry.getAttribute('color');expect(colors.getX(2)).toBeGreaterThan(colors.getX(0));expect(colors.getZ(0)).toBeGreaterThan(colors.getX(0));
 dispose();
});

it('replaces long rigged sleeves with a continuous cut edge and separate articulated bare arms',async()=>{
 const {Bone,Skeleton,SkinnedMesh,Uint16BufferAttribute}=await import('three');
 const root=new Group(),bones:InstanceType<typeof Bone>[]=[];
 for(const side of ['_l','_r']){const upper=new Bone(),lower=new Bone(),hand=new Bone();upper.name=`upperarm${side}`;lower.name=`lowerarm${side}`;hand.name=`hand${side}`;upper.position.set(side==='_l'?.2:-.2,2,0);lower.position.y=-1;hand.position.y=-.8;root.add(upper);upper.add(lower);lower.add(hand);bones.push(upper,lower,hand);}
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([.16,1.9,0,.25,1.5,0,.15,1.4,.1],3));geometry.setAttribute('skinIndex',new Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));geometry.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));geometry.setIndex([0,1,2]);
 const material=new MeshStandardMaterial();material.name='player_body.male_casualsuit01';const outfit=new SkinnedMesh(geometry,material);root.add(outfit);root.updateMatrixWorld(true);outfit.bind(new Skeleton(bones));const dispose=applyPlayerOutfit(root);
 const arms:Group[]=[];root.traverse(o=>{if(o.name==='player.bare-arm')arms.push(o as Group);});expect(arms).toHaveLength(4);
 const p=outfit.geometry.getAttribute('position');expect(p.count).toBe(3);for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeGreaterThanOrEqual(1.619);
 expect(geometry.getAttribute('position').getY(1)).toBe(1.5);dispose();expect(root.getObjectByName('player.bare-arm')).toBeUndefined();
});
