// @vitest-environment happy-dom
import {test,expect,vi} from 'vitest';
import {Box3,Vector3} from 'three';
import {buildCafePont} from '../../../src/worlds/cafePont';
test('cafe furniture uses adult dimensions and keeps the conversation corridor clear',()=>{
 const spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:()=>()=>{}}) as never);
 const cafe=buildCafePont();cafe.group.updateMatrixWorld(true);
 try {
  const bounds=(name:string)=>new Box3().setFromObject(cafe.group.getObjectByName(name)!);
  expect(bounds('cafe.chair.seat').max.y).toBeCloseTo(.4875);
  expect(bounds('cafe.table.top').max.y).toBeCloseTo(.795);
  expect(bounds('cafe.counter.top').max.y).toBeCloseTo(1.07);
  const route=new Box3(new Vector3(2,.03,2.7),new Vector3(5.6,1.9,3.8));
  for(const name of ['cafe.counter.base','cafe.refuge.bench','cafe.left-wall','cafe.pantry.side'])expect(bounds(name).intersectsBox(route),name).toBe(false);
  expect(cafe.group.children.filter(c=>c.name==='cafe.floor.tiles')).toHaveLength(3);
 }finally{cafe.dispose();spy.mockRestore();}
});
