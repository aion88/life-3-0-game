import {expect,it} from 'vitest';
import {AnimationMixer,Box3,Mesh} from 'three';
import {appearances,createRobotStudent} from '../../../src/worlds/castAppearance';
import {castMember,castMembers} from '../../../src/worlds/cast';
it('gives every human identity an authored wardrobe and keeps identity aliases stable',()=>{
 for(const world of ['w01','w02','w03','w04','w05','w06','w08','w09','w10','w11'])for(const person of castMembers(world))if(person.body!=='robot.student')expect(appearances[person.id],person.id).toBeDefined();
 expect(appearances['marlene']!.garment).not.toBe(appearances['nadia']!.garment);
 expect(castMembers('w10').filter(p=>p.id==='marlene')).toHaveLength(1);
});
it('embodies the pupil as a nonhuman articulated model, with stable scale and listening animation',()=>{
 expect(castMember('w08','L’ÉLÈVE')?.body).toBe('robot.student');
 const {body,animations}=createRobotStudent();expect(body.userData['nonhuman']).toBe(true);
 const bounds=new Box3().setFromObject(body);expect(bounds.max.y-bounds.min.y).toBeGreaterThan(1.4);expect(bounds.max.y-bounds.min.y).toBeLessThan(1.7);
 const mixer=new AnimationMixer(body);mixer.clipAction(animations.find(a=>a.name==='talk')!).play();mixer.update(.6);
 expect(body.getObjectByName('robot_head')!.rotation.x).toBeGreaterThan(.05);
 mixer.stopAllAction();mixer.uncacheRoot(body);body.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
});
