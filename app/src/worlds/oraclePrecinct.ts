/** Oracle precinct in metres: stairs and character route share one spatial contract. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshStandardMaterial,TorusGeometry} from 'three';
export const ORACLE_APPROACH = { groupZ:3, from:[-1.25,0,2] as const, camera:[13,6.2,17] as const, focus:[0,1.8,-4] as const };
export function buildOraclePrecinct(){
 const group=new Group();group.name='oracle.precinct';
 const box=new BoxGeometry(),cylinder=new CylinderGeometry(1,1,1,24),arch=new TorusGeometry(1,.045,8,40,Math.PI);
 const mats=['#d7ccab','#8c9e95','#b39862','#354e54','#a6b4a6'].map(color=>new MeshStandardMaterial({color,roughness:.78}));
 const block=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat=0)=>{const m=new Mesh(box,mats[mat]);m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=m.receiveShadow=true;group.add(m);return m;};
 const column=(x:number,z:number,h:number,base=0)=>{const m=new Mesh(cylinder,mats[0]);m.position.set(x,base+h/2,z);m.scale.set(.24,h,.24);m.castShadow=m.receiveShadow=true;group.add(m);};
 // The front edge is z=1.6. The entire arrival path remains on the forecourt at z>=5.
 for(let i=0;i<10;i++)block(`oracle.step.${i}`,3,(i+1)*.08,1.3-i*.6,13,(i+1)*.16,.6);
 block('oracle.upper-terrace',3,.8,-8,17,1.6,7);
 for(const x of [-5.5,11.5]){block('oracle.balustrade',x,2,-8,.25,.8,7,2);for(let z=-11;z<=-5;z++)column(x,z,.7,1.6);}
 for(const x of [-3,0,6,9])column(x,-9,6,1.6);
 block('oracle.entablature',3,7.65,-9,15,.4,2.8);
 block('oracle.pediment',3,8.05,-9,12,.4,2.5,2);
 block('oracle.portal',3,4.1,-10,3,5,.3,3);
 for(let i=0;i<5;i++)block('oracle.portal.flute',2+i*.5,4.1,-9.8,.05,4.5,.08,2);
 // Enclosing wings and arcades make a civic square, with visible avenues into a district.
 for(const x of [-15,19]) {
  block('oracle.wing',x,5,-14,7,10,13,1);
  block('oracle.wing.cornice',x,10.1,-14,7.4,.3,13.4);
  for(let row=0;row<3;row++)for(let bay=0;bay<4;bay++) {
   const z=-9-bay*2.4;
   block('oracle.wing.window',x+(x<0?3.52:-3.52),2+row*2.7,z,.05,1.7,1.1,3);
   block('oracle.wing.sill',x+(x<0?3.62:-3.62),1.1+row*2.7,z,.25,.12,1.4,2);
  }
  for(let z=-12;z<=3;z+=3){column(x<0?-8:14,z,3.2);}
  block('oracle.arcade.roof',x<0?-8:14,3.3,-4.5,1.4,.2,18);
 }
 for(let i=0;i<5;i++) {
  const x=-24+i*13,h=10+(i%3)*4;
  block('oracle.district',x,h/2,-30,9,h,6,i%2?1:4);
  block('oracle.district.crown',x,h+.2,-30,9.5,.4,6.5,2);
  for(let row=0;row<3;row++)for(let bay=0;bay<3;bay++)block('oracle.district.window',x-2.6+bay*2.6,2+row*3,-26.95,1.2,1.8,.08,3);
 }
 for(const x of [-8,14])for(let z=-10;z<3;z+=3){const m=new Mesh(arch,mats[0]);m.position.set(x,2.25,z+1.5);m.rotation.y=Math.PI/2;m.scale.set(1.45,1.1,1);group.add(m);}
 block('oracle.avenue',3,-.005,10,13,.02,17,1);
 return {group,dispose(){box.dispose();cylinder.dispose();arch.dispose();mats.forEach(m=>m.dispose());group.clear();}};
}
