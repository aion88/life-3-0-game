import {expect,test} from 'vitest';
import {Box3,Mesh,Vector3} from 'three';
import {buildOraclePrecinct,ORACLE_APPROACH} from '../../../src/worlds/oraclePrecinct';
test('Oracle arrival and companion remain outside steps and architectural obstacles',()=>{
 const precinct=buildOraclePrecinct();precinct.group.updateMatrixWorld(true);
 try {
  const obstacles:Box3[]=[];
  precinct.group.traverse(o=>{if(o instanceof Mesh){const b=new Box3().setFromObject(o);if(b.max.y>.08)obstacles.push(b);}});
  for(let i=0;i<=100;i++) {
   const t=i/100,x=3.6+ORACLE_APPROACH.from[0]*(1-t),z=2+ORACLE_APPROACH.groupZ+ORACLE_APPROACH.from[2]*(1-t);
   const body=new Box3(new Vector3(x-.3,.02,z-.3),new Vector3(x+.3,1.85,z+.3));
   expect(obstacles.some(b=>b.intersectsBox(body)),`arrival sample ${i}`).toBe(false);
  }
  const companion=new Box3(new Vector3(5,.02,4.7),new Vector3(5.6,1.85,5.3));
  expect(obstacles.some(b=>b.intersectsBox(companion))).toBe(false);
  const stairs=precinct.group.children.filter(o=>o.name.startsWith('oracle.step.'));
  expect(stairs).toHaveLength(10);
  for(let i=0;i<stairs.length;i++)expect(new Box3().setFromObject(stairs[i]!).max.y).toBeCloseTo((i+1)*.16);
 }finally{precinct.dispose();}
});
